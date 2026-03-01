import asyncio
import json
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from pipelines import PipelineOrchestrator
from translator import translate_batch
from ocr import OCRResult
from classifier import IntentResult
from agents.base import AgentResponse
from doraimon_integration import run_doraimon_pipeline
from config import (
    WANDB_ENABLED, WANDB_PROJECT, WANDB_RUN_NAME,
    OCR_FPS, VISION_FPS, CLASSIFIER_FPS,
    MISTRAL_OCR_MODEL, MISTRAL_TEXT_MODEL,
)
import metrics


class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        data = json.dumps(message)
        dead: List[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)


manager = ConnectionManager()
pipeline = PipelineOrchestrator()


class DoraimonProcessRequest(BaseModel):
    image_path: str = Field(min_length=1)
    target_language: str = "Japanese"
    ocr_output_path: str = "ocr_output.json"
    coord_output_path: str = "output.json"


@asynccontextmanager
async def lifespan(app: FastAPI):
    if WANDB_ENABLED:
        metrics.init(
            project=WANDB_PROJECT,
            run_name=WANDB_RUN_NAME or None,
            config={
                "ocr_fps": OCR_FPS,
                "vision_fps": VISION_FPS,
                "classifier_fps": CLASSIFIER_FPS,
                "ocr_model": MISTRAL_OCR_MODEL,
                "text_model": MISTRAL_TEXT_MODEL,
            },
        )

    async def on_intent(intent: IntentResult, agent_result: Optional[AgentResponse]):
        # If assistant is disabled, suppress agent actions (don't broadcast suggestions/narration)
        effective_agent = agent_result if pipeline._assistant_enabled else None
        await manager.broadcast(
            {
                "type": "intent_update",
                "intent": intent.intent,
                "confidence": intent.confidence,
                "reasoning": intent.reasoning,
                "agent_action": effective_agent.model_dump() if effective_agent else None,
            }
        )

    async def on_ocr(ocr: OCRResult):
        await manager.broadcast(
            {
                "type": "ocr_update",
                "words": [w.model_dump() for w in ocr.words],
                "full_text": ocr.full_text,
                "timestamp": ocr.timestamp,
            }
        )

    task = asyncio.create_task(pipeline.start(on_intent, on_ocr))
    yield
    pipeline.stop()
    task.cancel()
    metrics.finish()


app = FastAPI(title="dorAImon Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    # Send available monitors to new client
    try:
        monitors = pipeline.list_monitors()
        await websocket.send_text(json.dumps({
            "type": "monitor_list",
            "monitors": monitors,
        }))
    except Exception as e:
        print(f"[WS] Failed to send monitor list: {e}")
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "translate":
                try:
                    result = await translate_batch(
                        msg["texts"], msg["source_lang"], msg["target_lang"]
                    )
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "translation_result",
                                "translations": result,
                                "request_id": msg.get("request_id"),
                            }
                        )
                    )
                except Exception as e:
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "error",
                                "message": f"Translation failed: {e}",
                                "request_id": msg.get("request_id"),
                            }
                        )
                    )

            elif msg.get("type") == "toggle_assistant":
                pipeline.set_assistant_enabled(msg.get("enabled", True))

            elif msg.get("type") == "toggle_translation":
                pipeline.set_translation_enabled(msg.get("enabled", True))

            elif msg.get("type") == "set_voice":
                pipeline.set_voice_id(msg.get("voice_id"))

            elif msg.get("type") == "set_capture_monitor":
                pipeline.set_capture_monitor(msg.get("monitor_index", 1))

            elif msg.get("type") == "suggestion_feedback":
                pipeline.record_suggestion_feedback(msg.get("action", "dismissed"))

            elif msg.get("type") == "chat_message":
                try:
                    reply = await pipeline.handle_chat(msg.get("text", ""))
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "chat_response",
                                "text": reply,
                                "request_id": msg.get("request_id"),
                            }
                        )
                    )
                except Exception as e:
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "error",
                                "message": f"Chat failed: {e}",
                                "request_id": msg.get("request_id"),
                            }
                        )
                    )

    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/health")
async def health():
    return {"status": "ok", "clients": len(manager.active)}


@app.post("/v1/doraimon/process")
async def doraimon_process(req: DoraimonProcessRequest):
    result = await asyncio.to_thread(
        run_doraimon_pipeline,
        image_path=req.image_path,
        target_language=req.target_language,
        ocr_output_path=req.ocr_output_path,
        coord_output_path=req.coord_output_path,
    )
    return {"status": "ok", **result}
