from dotenv import load_dotenv

load_dotenv()

import asyncio
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect

from src.config import DEFAULT_IMAGE_MODEL
from src.mistral_client import analyze_and_translate_image
from src.schemas import (
    ImageTranslateRequest,
    ImageTranslateResponse,
    ProcessRequest,
    ProcessResponse,
    VoiceChunk,
)
from src.workflow import invoke_workflow


app = FastAPI(title="DorAImon Backend (FastAPI + LangGraph)")


@app.get("/health/live")
async def health_live() -> dict[str, str]:
    return {"status": "alive"}


@app.get("/health/ready")
async def health_ready() -> dict[str, str]:
    return {"status": "ready"}


@app.post("/v1/process", response_model=ProcessResponse)
async def process(req: ProcessRequest) -> ProcessResponse:
    try:
        state = await invoke_workflow(
            input_type=req.input_type,
            content=req.content,
            target_language=req.target_language,
            session_id=req.session_id,
        )
        return ProcessResponse(
            result=state.get("final_result", ""),
            model_used=state.get("model_name", "unknown"),
            trace_id=state.get("trace_id", "no-trace"),
            latency_ms=state.get("latency_ms", 0),
            route=state.get("route", "unknown"),
            intent=state.get("intent", "unknown"),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"workflow failed: {exc}") from exc


@app.post("/v1/image-translate", response_model=ImageTranslateResponse)
async def image_translate(req: ImageTranslateRequest) -> ImageTranslateResponse:
    model = req.model or DEFAULT_IMAGE_MODEL
    try:
        result = await asyncio.to_thread(
            analyze_and_translate_image,
            model,
            req.image_base64,
            req.target_language,
            req.prompt,
        )
        return ImageTranslateResponse(result=result, model_used=model)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"image translate failed: {exc}") from exc


@app.websocket("/v1/voice/stream")
async def voice_stream(ws: WebSocket) -> None:
    await ws.accept()
    chunks: list[str] = []
    target_language = "ja"
    session_id = "voice-session"
    try:
        while True:
            payload = VoiceChunk.model_validate_json(await ws.receive_text())
            chunks.append(payload.chunk)
            target_language = payload.target_language or target_language
            session_id = payload.session_id or session_id

            if payload.final:
                transcript = " ".join(chunks).strip()
                state = await invoke_workflow(
                    input_type="audio",
                    content=transcript,
                    target_language=target_language,
                    session_id=session_id,
                )
                await ws.send_json(
                    {
                        "result": state.get("final_result", ""),
                        "model_used": state.get("model_name", "unknown"),
                        "trace_id": state.get("trace_id", "no-trace"),
                        "latency_ms": state.get("latency_ms", 0),
                        "route": state.get("route", "voice"),
                        "intent": state.get("intent", "voice_input"),
                    }
                )
                chunks.clear()
            else:
                await ws.send_json({"status": "streaming", "buffered_chunks": len(chunks)})
    except WebSocketDisconnect:
        return
