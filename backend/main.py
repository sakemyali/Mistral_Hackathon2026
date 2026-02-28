import asyncio
import json
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from pipelines import PipelineOrchestrator
from translator import translate_batch
from ocr import OCRResult
from classifier import IntentResult
from agents.base import AgentResponse
from config import (
    WANDB_ENABLED, WANDB_PROJECT, WANDB_RUN_NAME,
    OCR_FPS, VISION_FPS, CLASSIFIER_FPS,
    PIXTRAL_MODEL, MINISTRAL_MODEL,
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
                "pixtral_model": PIXTRAL_MODEL,
                "ministral_model": MINISTRAL_MODEL,
            },
        )

    async def on_intent(intent: IntentResult, agent_result: Optional[AgentResponse]):
        await manager.broadcast(
            {
                "type": "intent_update",
                "intent": intent.intent,
                "confidence": intent.confidence,
                "reasoning": intent.reasoning,
                "agent_action": agent_result.model_dump() if agent_result else None,
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

    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/health")
async def health():
    return {"status": "ok", "clients": len(manager.active)}
