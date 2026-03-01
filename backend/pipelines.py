import asyncio
import time
from typing import Awaitable, Callable, Optional

from capture import ScreenCapture
from ocr import extract_text_with_boxes, OCRResult
from vision import analyze_screen
from classifier import classify_intent, IntentResult
from agents import agent_registry
from agents.base import AgentContext, AgentResponse
from config import OCR_FPS, VISION_FPS, CLASSIFIER_FPS
from metrics import log_pipeline_tick, log_intent


class PipelineOrchestrator:
    def __init__(self):
        self.capture = ScreenCapture()
        self._latest_ocr: Optional[OCRResult] = None
        self._latest_vision: Optional[str] = None
        self._latest_intent: Optional[IntentResult] = None
        self._last_classified_text: Optional[str] = None
        self._running = False

    async def start(
        self,
        on_intent: Callable[[IntentResult, Optional[AgentResponse]], Awaitable[None]],
        on_ocr: Callable[[OCRResult], Awaitable[None]],
    ):
        """Start all pipelines. Callbacks fire when new data is available."""
        self._running = True
        await asyncio.gather(
            self._ocr_loop(on_ocr),
            self._vision_loop(),
            self._classifier_loop_staggered(on_intent),
        )

    async def _ocr_loop(
        self, on_ocr: Callable[[OCRResult], Awaitable[None]]
    ):
        """2 FPS OCR pipeline."""
        loop = asyncio.get_event_loop()
        interval = 1.0 / OCR_FPS

        while self._running:
            start = time.time()
            try:
                frame = await loop.run_in_executor(None, self.capture.grab_frame)
                result = await loop.run_in_executor(
                    None, extract_text_with_boxes, frame
                )
                self._latest_ocr = result
                await on_ocr(result)
            except Exception as e:
                print(f"[OCR] Error: {e}")

            elapsed = time.time() - start
            await log_pipeline_tick("ocr", elapsed, interval)
            await asyncio.sleep(max(0, interval - elapsed))

    async def _vision_loop(self):
        """0.25 FPS Pixtral pipeline (every 4s)."""
        loop = asyncio.get_event_loop()
        interval = 1.0 / VISION_FPS

        while self._running:
            start = time.time()
            try:
                frame = await loop.run_in_executor(None, self.capture.grab_frame)
                b64 = await loop.run_in_executor(
                    None, self.capture.frame_to_base64, frame
                )
                analysis = await analyze_screen(b64)
                self._latest_vision = analysis
            except Exception as e:
                print(f"[Vision] Error: {e}")

            elapsed = time.time() - start
            await log_pipeline_tick("vision", elapsed, interval)
            await asyncio.sleep(max(0, interval - elapsed))

    async def _classifier_loop_staggered(
        self,
        on_intent: Callable[[IntentResult, Optional[AgentResponse]], Awaitable[None]],
    ):
        """0.5 FPS classifier (every 2s), offset by 1s so it doesn't collide with vision."""
        await asyncio.sleep(1.0)
        interval = 1.0 / CLASSIFIER_FPS

        while self._running:
            if (
                self._latest_ocr
                and self._latest_ocr.full_text
                and self._latest_ocr.full_text != self._last_classified_text
            ):
                vision_str = self._latest_vision or "No visual analysis yet"
                try:
                    prev_intent = self._latest_intent.intent if self._latest_intent else None
                    self._last_classified_text = self._latest_ocr.full_text

                    t0 = time.monotonic()
                    intent = await classify_intent(
                        self._latest_ocr.full_text, vision_str
                    )
                    cls_elapsed = time.monotonic() - t0

                    self._latest_intent = intent

                    await log_pipeline_tick("classifier", cls_elapsed, interval)
                    await log_intent(
                        intent=intent.intent,
                        confidence=intent.confidence,
                        previous_intent=prev_intent,
                    )

                    ctx = AgentContext(
                        intent=intent.intent,
                        confidence=intent.confidence,
                        ocr_text=self._latest_ocr.full_text,
                        vision_analysis=vision_str,
                        timestamp=time.time(),
                    )
                    agent_result = await agent_registry.route(ctx)
                    await on_intent(intent, agent_result)
                except Exception as e:
                    print(f"[Classifier] Error: {e}")

            await asyncio.sleep(interval)

    def stop(self):
        self._running = False
