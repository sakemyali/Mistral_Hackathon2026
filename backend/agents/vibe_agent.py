"""
VibeAgent — Code helper agent for dorAImon.

Activates on 'hesitant' or 'typo' intents. Uses Devstral (codestral-latest)
via the official Mistral SDK to analyze on-screen code and provide suggestions.
Chains to NarrationService for optional TTS narration.

Ported from conn_api/code_advises.py (direct chat API, no Agents API).
"""

import hashlib
import json
from typing import Any, Dict, Optional

from mistralai import Mistral

from agents.base import BaseAgent, AgentContext, AgentResponse
from agents.narration_service import generate_narration
from config import MISTRAL_API_KEY, DEVSTRAL_MODEL


# Intent → action mapping
INTENT_ACTION_MAP: Dict[str, str] = {
    "hesitant": "suggestFunction",
    "typo": "fixError",
}


class VibeAgent(BaseAgent):
    name: str = "vibe"

    def __init__(self):
        self._last_ocr_hash: Optional[str] = None

    async def should_activate(self, context: AgentContext) -> bool:
        """Activate on hesitant/typo intents with sufficient confidence."""
        if context.intent not in INTENT_ACTION_MAP:
            return False

        if context.confidence < 0.5:
            return False

        # Dedup: skip if OCR text hasn't changed since last activation
        ocr_hash = hashlib.md5(context.ocr_text.encode()).hexdigest()
        if ocr_hash == self._last_ocr_hash:
            return False

        return True

    async def execute(self, context: AgentContext) -> AgentResponse:
        """
        Analyze on-screen code via Devstral and return suggestion + narration.
        """
        # Update dedup hash
        self._last_ocr_hash = hashlib.md5(context.ocr_text.encode()).hexdigest()

        action = INTENT_ACTION_MAP.get(context.intent, "suggestFunction")

        # --- Build prompt (from code_advises.py build_analysis_prompt) ---
        prompt = (
            "You are an expert programmer and code reviewer.\n"
            f"Context regarding this code: {context.vision_analysis}\n"
            f"Please analyze the following code and provide advice "
            f"or point out potential bugs in English.\n"
            "CRITICAL INSTRUCTION: You must respond ONLY with a valid "
            "JSON object.\n"
            'The JSON must have a single key named "advice" containing '
            "your review comment as a string. Do not add any other text.\n"
            f"Code Content:\n{context.ocr_text}"
        )

        advice_text = ""
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
                max_tokens=300,
                response_format={"type": "json_object"},
            )

            raw_content: str = response.choices[0].message.content

            try:
                parsed = json.loads(raw_content)
                advice_text = parsed.get("advice", raw_content)
            except json.JSONDecodeError:
                advice_text = raw_content

        except Exception as e:
            print(f"[VibeAgent] API error: {e}")
            advice_text = f"Could not analyze code: {str(e)}"

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
                    "raw": advice_text,
                    "context": context.vision_analysis,
                },
                "narration": narration,
            },
        )
