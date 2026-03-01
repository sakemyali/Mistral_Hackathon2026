"""
VibeAgent — Code helper agent for dorAImon.

Activates on 'hesitant' or 'typo' intents. Uses Devstral (codestral-latest)
via the official Mistral SDK to analyze on-screen code and provide deliverable
code suggestions (code_before / code_after).
Chains to NarrationService for optional TTS narration.

Throttled with 5 gates: intent, exact dedup, cooldown, narration guard, similarity.
"""

import hashlib
import json
import time
from difflib import SequenceMatcher
from typing import Any, Dict, Optional

from mistralai import Mistral

from agents.base import BaseAgent, AgentContext, AgentResponse
from agents.narration_service import generate_narration
from config import (
    MISTRAL_API_KEY,
    DEVSTRAL_MODEL,
    VIBE_COOLDOWN_SECONDS,
    VIBE_SIMILARITY_THRESHOLD,
    VIBE_NARRATION_GUARD_SECONDS,
)
from prompts import VIBE_AGENT_PROMPT


# Intent → action mapping
INTENT_ACTION_MAP: Dict[str, str] = {
    "hesitant": "suggestFunction",
    "typo": "fixError",
}


class VibeAgent(BaseAgent):
    name: str = "vibe"

    def __init__(self):
        self._last_ocr_hash: Optional[str] = None
        self._last_ocr_text: Optional[str] = None
        self._last_activation_time: float = 0.0

    async def should_activate(self, context: AgentContext) -> bool:
        """Activate on hesitant/typo intents with 5 throttle gates."""
        # Gate 1: Intent filter
        if context.intent not in INTENT_ACTION_MAP:
            return False

        if context.confidence < 0.5:
            return False

        # Gate 2: Exact dedup via MD5 hash
        ocr_hash = hashlib.md5(context.ocr_text.encode()).hexdigest()
        if ocr_hash == self._last_ocr_hash:
            return False

        now = time.time()

        # Gate 3: Time-based cooldown (default 10s)
        if (now - self._last_activation_time) < VIBE_COOLDOWN_SECONDS:
            return False

        # Gate 4: Narration guard (default 8s — let voice finish)
        if (now - self._last_activation_time) < VIBE_NARRATION_GUARD_SECONDS:
            return False

        # Gate 5: Similarity check (catches scrolling logs / minor text shifts)
        if self._last_ocr_text is not None:
            ratio = SequenceMatcher(
                None,
                self._last_ocr_text[:2000],
                context.ocr_text[:2000],
            ).ratio()
            if ratio > VIBE_SIMILARITY_THRESHOLD:
                return False

        return True

    async def execute(self, context: AgentContext) -> AgentResponse:
        """
        Analyze on-screen code via Devstral and return deliverable code + narration.
        """
        # Update throttle state
        self._last_ocr_hash = hashlib.md5(context.ocr_text.encode()).hexdigest()
        self._last_ocr_text = context.ocr_text
        self._last_activation_time = time.time()

        action = INTENT_ACTION_MAP.get(context.intent, "suggestFunction")

        # --- Build prompt from centralized prompts.py ---
        prompt = VIBE_AGENT_PROMPT.format(
            vision_analysis=context.vision_analysis,
            ocr_text=context.ocr_text,
        )

        code_before = ""
        code_after = ""
        explanation = ""

        try:
            if not MISTRAL_API_KEY:
                return AgentResponse(
                    agent_name=self.name,
                    action=action,
                    data={"error": "MISTRAL_API_KEY is missing."},
                )

            client = Mistral(api_key=MISTRAL_API_KEY)
            response = client.chat.complete(
                model=DEVSTRAL_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=800,
                response_format={"type": "json_object"},
            )

            raw_content: str = response.choices[0].message.content

            try:
                parsed = json.loads(raw_content)
                code_before = parsed.get("code_before", "")
                code_after = parsed.get("code_after", "")
                explanation = parsed.get("explanation", raw_content)
            except json.JSONDecodeError:
                explanation = raw_content

        except Exception as e:
            print(f"[VibeAgent] API error: {e}")
            explanation = f"Could not analyze code: {str(e)}"

        # --- Chain to narration service for optional TTS ---
        narration: Optional[Dict[str, Any]] = None
        try:
            narration = await generate_narration(
                intent=context.intent,
                action=action,
                ocr_snippet=context.ocr_text[:200],
            )
        except Exception as e:
            print(f"[VibeAgent] Narration error: {e}")

        return AgentResponse(
            agent_name=self.name,
            action=action,
            data={
                "suggestion": {
                    "code_before": code_before,
                    "code_after": code_after,
                    "explanation": explanation,
                    "context": context.vision_analysis,
                },
                "narration": narration,
            },
        )
