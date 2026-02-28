from dotenv import load_dotenv

load_dotenv()

import asyncio
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect

from src.config import DEFAULT_AUDIO_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_OCR_MODEL
from src.mistral_client import (
    analyze_and_translate_image,
    choose_task_from_text,
    ocr_image_from_path,
    run_code_generation,
    run_special_instruction,
    run_translation_output,
    transcribe_audio_from_path,
)
from src.schemas import (
    ImageTranslateRequest,
    ImageTranslateResponse,
    ProcessRequest,
    ProcessResponse,
    UnifiedProcessRequest,
    UnifiedProcessResponse,
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


@app.post("/v1/process-unified", response_model=UnifiedProcessResponse)
async def process_unified(req: UnifiedProcessRequest) -> UnifiedProcessResponse:
    process = req.process
    target_language = process.target_language
    todo = process.todo

    if bool(process.image_path) == bool(process.audio_path):
        raise HTTPException(status_code=400, detail="Provide exactly one of image_path or audio_path")

    try:
        if process.image_path:
            ocr_result = await asyncio.to_thread(ocr_image_from_path, DEFAULT_OCR_MODEL, process.image_path)
            source_text = ocr_result.get("text", "")
            text_coordination = ocr_result.get("text_coordination", [])
            source_type = "image"
            source_model = ocr_result.get("model", DEFAULT_OCR_MODEL)
        else:
            transcribed = await asyncio.to_thread(transcribe_audio_from_path, DEFAULT_AUDIO_MODEL, process.audio_path)
            source_text = transcribed.get("text", "")
            text_coordination = []
            source_type = "audio"
            source_model = transcribed.get("model", DEFAULT_AUDIO_MODEL)

        if not source_text.strip():
            raise HTTPException(status_code=400, detail="No source text extracted from input")

        decision = await asyncio.to_thread(choose_task_from_text, source_text, todo)
        task_type = decision.get("task_type", "translate")
        selected_model = decision.get("selected_model")
        decided_todo = decision.get("todo") or todo or ""

        if task_type == "code":
            out = await asyncio.to_thread(run_code_generation, source_text, decided_todo)
        elif task_type == "special" and selected_model:
            out = await asyncio.to_thread(run_special_instruction, source_text, decided_todo, selected_model)
        else:
            out = await asyncio.to_thread(run_translation_output, source_text, target_language, text_coordination)

        response = {
            "process": {
                "source_type": source_type,
                "source_model": source_model,
                "model": out.get("model"),
                "todo": out.get("todo"),
                "decision": decision,
                "target_language": target_language,
                "source_text": source_text,
                "output": out.get("output"),
                "ai_calls": 3,
            }
        }
        return UnifiedProcessResponse(process=response["process"])
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"unified process failed: {exc}") from exc


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
