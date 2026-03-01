"""
Shared narration service for dorAImon agents.

Generates context-aware narration text via Ministral-3B,
then converts to speech via ElevenLabs TTS.
NOT a BaseAgent — called internally by agents like VibeAgent.
"""

import base64
from typing import Any, Dict, Optional

from mistralai import Mistral
from elevenlabs.client import ElevenLabs

from config import (
    MISTRAL_API_KEY,
    ELEVENLABS_API_KEY,
    VOICE_ID_JP,
    VOICE_ID_EN,
    VOICE_MODE,
    MINISTRAL_MODEL,
)
from prompts import NARRATION_SYSTEM_PROMPT, NARRATION_USER_PROMPT

# Voice mapping: language → voice ID
VOICE_MAP: Dict[str, str] = {
    "Japanese": VOICE_ID_JP,
    "English": VOICE_ID_EN,
}


async def generate_narration(
    intent: str,
    action: str,
    ocr_snippet: str,
    language: str = "English",
    voice_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Generate a short narration + TTS audio for an agent action.

    Args:
        intent: The classified user intent (e.g. "hesitant", "typo").
        action: The action being taken (e.g. "suggestFunction", "fixError").
        ocr_snippet: Truncated OCR text from the screen (~200 chars).
        language: Target language for TTS voice selection.
        voice_id: Override voice ID from frontend voice selector.

    Returns:
        Dict with audioBuffer (base64), text, voiceMode — or None if disabled.
    """
    if VOICE_MODE == "silent":
        return None

    if not MISTRAL_API_KEY:
        return None

    # --- Step 1: Generate narration text via Ministral-3B ---
    try:
        client = Mistral(api_key=MISTRAL_API_KEY)

        user_prompt = NARRATION_USER_PROMPT.format(
            intent=intent,
            action=action,
            ocr_snippet=ocr_snippet[:200],
        )

        response = client.chat.complete(
            model=MINISTRAL_MODEL,
            messages=[
                {"role": "system", "content": NARRATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=80,
        )

        narration_text: str = response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Narration] LLM error: {e}")
        narration_text = f"Let me help you with that {action.replace('suggest', '').replace('fix', '')}."

    # --- Step 2: ElevenLabs TTS ---
    audio_b64: Optional[str] = None

    if ELEVENLABS_API_KEY:
        try:
            el_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

            voice_id = voice_id or VOICE_MAP.get(language, VOICE_ID_EN)

            audio_stream = el_client.text_to_speech.convert(
                voice_id=voice_id,
                text=narration_text,
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_128",
            )

            audio_bytes: bytes = b"".join(list(audio_stream))
            audio_b64 = base64.b64encode(audio_bytes).decode()
        except Exception as e:
            print(f"[Narration] TTS error: {e}")

    return {
        "audioBuffer": audio_b64,
        "text": narration_text,
        "voiceMode": VOICE_MODE,
    }
