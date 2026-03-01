"""
VibeAgent — Versatile AI assistant agent for dorAImon.

Activates on 'hesitant', 'typo', or 'normal' intents. Uses Devstral (codestral-latest)
via the official Mistral SDK to analyze the screen and provide contextual suggestions:
code fixes, ideas, tips, or actions.

Chains to NarrationService for optional TTS narration.

Throttled with 6 gates: intent, pending-suggestion, exact dedup, cooldown, narration guard, similarity.
Turn-aware: tracks last N suggestions and feeds history into prompt.
"""

import hashlib
import json
import time
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional

from mistralai import Mistral

from agents.base import BaseAgent, AgentContext, AgentResponse
from agents.narration_service import generate_narration
from config import (
    MISTRAL_API_KEY,
    DEVSTRAL_MODEL,
    VIBE_COOLDOWN_SECONDS,
    VIBE_SIMILARITY_THRESHOLD,
    VIBE_NARRATION_GUARD_SECONDS,
    NORMAL_COOLDOWN_SECONDS,
    VIBE_PENDING_TIMEOUT_SECONDS,
)
from prompts import VIBE_AGENT_PROMPT


# Intent → action mapping (now includes "normal" for general assistance)
INTENT_ACTION_MAP: Dict[str, str] = {
    "hesitant": "suggestFunction",
    "typo": "fixError",
    "normal": "suggest",
}


class VibeAgent(BaseAgent):
    name: str = "vibe"

    def __init__(self):
        self._last_ocr_hash: Optional[str] = None
        self._last_ocr_text: Optional[str] = None
        self._last_activation_time: float = 0.0
        # Turn awareness
        self._suggestion_history: List[Dict[str, str]] = []  # last 5
        self._pending_suggestion: Optional[Dict[str, str]] = None
        self._pending_suggestion_time: float = 0.0

    def record_feedback(self, action: str):
        """Record user feedback (applied/dismissed) for turn awareness."""
        if self._pending_suggestion:
            self._pending_suggestion["feedback"] = action
            self._suggestion_history.append(self._pending_suggestion)
            # Keep last 5
            if len(self._suggestion_history) > 5:
                self._suggestion_history = self._suggestion_history[-5:]
            self._pending_suggestion = None

    def _build_history_text(self) -> str:
        """Build a text summary of recent suggestions for context injection."""
        if not self._suggestion_history:
            return ""
        lines = ["\nRecent suggestion history (do NOT repeat these):"]
        for i, entry in enumerate(self._suggestion_history[-3:], 1):
            feedback = entry.get("feedback", "unknown")
            explanation = entry.get("explanation", "")[:80]
            lines.append(f"  {i}. [{feedback}] {explanation}")
        return "\n".join(lines)

    async def should_activate(self, context: AgentContext) -> bool:
        """Activate on hesitant/typo/normal intents with 6 throttle gates."""
        # Gate 1: Intent filter
        if context.intent not in INTENT_ACTION_MAP:
            return False

        if context.confidence < 0.5:
            return False

        # Gate 2: Pending suggestion — don't spam, but auto-clear if stale (timeout)
        if self._pending_suggestion is not None:
            if (time.time() - self._pending_suggestion_time) < VIBE_PENDING_TIMEOUT_SECONDS:
                return False
            # Timed out — clear stale pending suggestion so new ones can generate
            print(f"[VibeAgent] Pending suggestion timed out after {VIBE_PENDING_TIMEOUT_SECONDS}s, clearing")
            self._pending_suggestion = None

        # Gate 3: Exact dedup via MD5 hash
        ocr_hash = hashlib.md5(context.ocr_text.encode()).hexdigest()
        if ocr_hash == self._last_ocr_hash:
            return False

        now = time.time()

        # Gate 4: Time-based cooldown (longer for "normal" intent)
        cooldown = NORMAL_COOLDOWN_SECONDS if context.intent == "normal" else VIBE_COOLDOWN_SECONDS
        if (now - self._last_activation_time) < cooldown:
            return False

        # Gate 5: Narration guard (default 8s — let voice finish)
        if (now - self._last_activation_time) < VIBE_NARRATION_GUARD_SECONDS:
            return False

        # Gate 6: Similarity check (catches scrolling logs / minor text shifts)
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
        Analyze on-screen content via Devstral and return contextual suggestion + narration.
        """
        # Update throttle state
        self._last_ocr_hash = hashlib.md5(context.ocr_text.encode()).hexdigest()
        self._last_ocr_text = context.ocr_text
        self._last_activation_time = time.time()

        action = INTENT_ACTION_MAP.get(context.intent, "suggest")

        # --- Build prompt with history ---
        history_text = self._build_history_text()
        prompt = VIBE_AGENT_PROMPT.format(
            vision_analysis=context.vision_analysis,
            ocr_text=context.ocr_text,
            suggestion_history=history_text,
        )

        suggestion_type = "code"
        content = ""
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
                suggestion_type = parsed.get("suggestion_type", "code")
                content = parsed.get("content", "")
                code_before = parsed.get("code_before", "")
                code_after = parsed.get("code_after", "")
                explanation = parsed.get("explanation", raw_content)
            except json.JSONDecodeError:
                explanation = raw_content

        except Exception as e:
            print(f"[VibeAgent] API error: {e}")
            explanation = f"Could not analyze: {str(e)}"

        # Store as pending for turn awareness (with timestamp for timeout)
        self._pending_suggestion = {
            "explanation": explanation,
            "suggestion_type": suggestion_type,
            "content": content[:100],
        }
        self._pending_suggestion_time = time.time()

        # --- Chain to narration service for optional TTS ---
        narration: Optional[Dict[str, Any]] = None
        try:
            narration = await generate_narration(
                intent=context.intent,
                action=action,
                ocr_snippet=context.ocr_text[:200],
                voice_id=context.voice_id,
            )
        except Exception as e:
            print(f"[VibeAgent] Narration error: {e}")

        return AgentResponse(
            agent_name=self.name,
            action=action,
            data={
                "suggestion": {
                    "suggestion_type": suggestion_type,
                    "content": content,
                    "code_before": code_before,
                    "code_after": code_after,
                    "explanation": explanation,
                    "context": context.vision_analysis,
                },
                "narration": narration,
            },
        )
