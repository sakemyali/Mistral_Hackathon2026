import asyncio
import time
import tempfile
from pathlib import Path
from typing import Awaitable, Callable, Dict, Optional

from capture import ScreenCapture
from ocr import OCRResult, OCRWord
from vision import analyze_screen
from classifier import classify_intent, IntentResult
from agents import agent_registry
from agents.base import AgentContext, AgentResponse
from config import OCR_FPS, VISION_FPS, CLASSIFIER_FPS
from metrics import log_pipeline_tick, log_intent
from doraimon_integration import run_doraimon_pipeline


class PipelineOrchestrator:
    def __init__(self):
        self.capture = ScreenCapture()
        self._latest_ocr: Optional[OCRResult] = None
        self._latest_vision: Optional[str] = None
        self._latest_intent: Optional[IntentResult] = None
        self._last_classified_text: Optional[str] = None
        self._running = False
        # Toggle flags — when both are off, OCR/Vision/Classifier loops idle
        self._assistant_enabled = True
        self._translation_enabled = False
        # Voice selection
        self._voice_id: Optional[str] = None
        self._tmp_dir = Path(tempfile.gettempdir()) / "doraimon_live_check"
        self._tmp_dir.mkdir(parents=True, exist_ok=True)

    def _build_ocr_result_from_coord(self, coord_output: dict) -> OCRResult:
        items = coord_output.get("Text Coordination", [])
        words: list[OCRWord] = []
        full_text_parts: list[str] = []
        if isinstance(items, list):
            for item in items:
                if not isinstance(item, dict):
                    continue
                text = str(item.get("text", "")).strip()
                bbox = item.get("bbox", {})
                if not text or not isinstance(bbox, dict):
                    continue
                try:
                    x = int(bbox.get("x"))
                    y = int(bbox.get("y"))
                    w = int(bbox.get("w"))
                    h = int(bbox.get("h"))
                except Exception:
                    continue
                if w <= 0 or h <= 0:
                    continue
                words.append(
                    OCRWord(
                        text=text,
                        x=x,
                        y=y,
                        width=w,
                        height=h,
                        confidence=0.99,
                    )
                )
                full_text_parts.append(text)

        full_text = " ".join(full_text_parts).strip()
        if not full_text:
            context = coord_output.get("Context", "")
            if isinstance(context, str):
                full_text = context.strip()
        if not words and full_text:
            words = [
                OCRWord(
                    text=full_text[:5000],
                    x=20,
                    y=20,
                    width=900,
                    height=80,
                    confidence=0.5,
                )
            ]

        return OCRResult(words=words, full_text=full_text, timestamp=time.time())

    def set_assistant_enabled(self, enabled: bool):
        self._assistant_enabled = enabled
        print(f"[Pipeline] Assistant {'enabled' if enabled else 'disabled'}")

    def set_translation_enabled(self, enabled: bool):
        self._translation_enabled = enabled
        print(f"[Pipeline] Translation {'enabled' if enabled else 'disabled'}")

    def set_voice_id(self, voice_id: Optional[str]):
        self._voice_id = voice_id
        print(f"[Pipeline] Voice ID set to {voice_id}")

    def get_voice_id(self) -> Optional[str]:
        return self._voice_id

    def set_capture_region(self, region: Optional[Dict[str, int]]):
        """Set a sub-region for screen capture. None = full monitor."""
        self.capture.set_capture_region(region)

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
            # Skip OCR if neither assistant nor translation needs it
            if not self._assistant_enabled and not self._translation_enabled:
                await asyncio.sleep(interval)
                continue

            start = time.time()
            try:
                frame = await loop.run_in_executor(None, self.capture.grab_frame)
                ts = int(time.time() * 1000)
                image_path = self._tmp_dir / f"live_{ts}.png"
                ocr_out = self._tmp_dir / f"live_{ts}_ocr.json"
                coord_out = self._tmp_dir / f"live_{ts}_coord.json"
                await loop.run_in_executor(None, frame.save, image_path, "PNG")
                run_result = await loop.run_in_executor(
                    None,
                    run_doraimon_pipeline,
                    str(image_path),
                    "same",
                    str(ocr_out),
                    str(coord_out),
                )
                coord_output = run_result.get("coord_output", {}) if isinstance(run_result, dict) else {}
                result = self._build_ocr_result_from_coord(coord_output)
                self._latest_ocr = result
                await on_ocr(result)
            except Exception as e:
                print(f"[OCR] Error: {e}")
            finally:
                try:
                    if 'image_path' in locals():
                        Path(image_path).unlink(missing_ok=True)
                    if 'ocr_out' in locals():
                        Path(ocr_out).unlink(missing_ok=True)
                    if 'coord_out' in locals():
                        Path(coord_out).unlink(missing_ok=True)
                except Exception:
                    pass

            elapsed = time.time() - start
            await log_pipeline_tick("ocr", elapsed, interval)
            await asyncio.sleep(max(0, interval - elapsed))

    async def _vision_loop(self):
        """0.25 FPS Pixtral pipeline (every 4s)."""
        loop = asyncio.get_event_loop()
        interval = 1.0 / VISION_FPS

        while self._running:
            # Vision only needed for assistant
            if not self._assistant_enabled:
                await asyncio.sleep(interval)
                continue

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
            # Classifier only needed for assistant
            if not self._assistant_enabled:
                await asyncio.sleep(interval)
                continue

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
                        voice_id=self._voice_id,
                    )
                    agent_result = await agent_registry.route(ctx)
                    await on_intent(intent, agent_result)
                except Exception as e:
                    print(f"[Classifier] Error: {e}")

            await asyncio.sleep(interval)

    def record_suggestion_feedback(self, action: str):
        """Forward feedback (applied/dismissed) to the VibeAgent for turn awareness."""
        from agents.vibe_agent import VibeAgent
        for agent in agent_registry._agents:
            if isinstance(agent, VibeAgent):
                agent.record_feedback(action)
                break

    async def handle_chat(self, user_message: str) -> str:
        """Handle a chat message using current screen context. Works even when assistant is OFF."""
        from mistralai import Mistral
        from config import MISTRAL_API_KEY, DEVSTRAL_MODEL
        from prompts import CHAT_SYSTEM_PROMPT, CHAT_USER_PROMPT

        vision_str = self._latest_vision or "No visual analysis available"
        ocr_str = self._latest_ocr.full_text if self._latest_ocr else "No OCR text available"

        prompt = CHAT_USER_PROMPT.format(
            vision_analysis=vision_str,
            ocr_text=ocr_str[:2000],
            user_message=user_message,
        )

        try:
            client = Mistral(api_key=MISTRAL_API_KEY)
            response = client.chat.complete(
                model=DEVSTRAL_MODEL,
                messages=[
                    {"role": "system", "content": CHAT_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
                max_tokens=500,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"[Chat] Error: {e}")
            return f"Sorry, I couldn't process that: {e}"

    def stop(self):
        self._running = False
