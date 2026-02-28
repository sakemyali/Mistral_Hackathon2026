import base64
import json
import os
import asyncio
from typing import Any, Dict, List, Optional

from elevenlabs.client import ElevenLabs
from pydantic import BaseModel
from mistralai import Mistral


class SuggestionItem(BaseModel):
    """
    Input schema for the suggestion and information request.

    Attributes:
        text_coordination: The spatial coordinates of the text.
        context: The surrounding context or situation.
        content: The actual text content to analyze.
        language: The target language for the output.
    """
    text_coordination: Dict[str, int]
    context: str
    content: str
    language: str


async def get_suggestion_advice(item: SuggestionItem) -> Dict[str, Any]:
    """
    Core logic to get a suggestion from Mistral Chat API and audio from ElevenLabs.
    This function is designed to be called internally by other Python modules.

    Args:
        item (SuggestionItem): The request item containing context and content.

    Returns:
        Dict[str, Any]: A dictionary containing coordination, content, and audio.
    """
    mistral_key: str = os.getenv("MISTRAL_API_KEY", "")
    eleven_key: str = os.getenv("ELEVENLABS_API_KEY", "")

    if not mistral_key:
        return {"error": "MISTRAL_API_KEY is missing."}

    client: Mistral = Mistral(api_key=mistral_key)

    # 1. Mistral Chat Completion (Direct API call without Agents)
    try:
        # Instruction for the model to ensure JSON output
        system_prompt: str = (
            "You are a helpful assistant. Analyze the user's context and "
            "content to provide a concise suggestion in the specified language. "
            "You MUST respond ONLY with a valid JSON object containing "
            "a single key 'suggestion'."
        )

        user_content: str = (
            f"Language: {item.language}\n"
            f"Context: {item.context}\n"
            f"Content: {item.content}"
        )

        response = client.chat.complete(
            model="mistral-small-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            response_format={"type": "json_object"}
        )

        raw_content: str = response.choices[0].message.content

        try:
            parsed = json.loads(raw_content)
            result_text = parsed.get("suggestion", raw_content)
        except json.JSONDecodeError:
            result_text = raw_content

    except Exception as e:
        return {"error": f"Mistral API error: {str(e)}"}

    # 2. Text-to-Speech Generation using ElevenLabs
    audio_b64: Optional[str] = None
    if eleven_key:
        try:
            el_client = ElevenLabs(api_key=eleven_key)

            # Switch voice ID based on language
            voice_mapping: Dict[str, str] = {
                "Japanese": os.getenv("VOICE_ID_JP"),
                "English": os.getenv("VOICE_ID_EN")
            }
            # Fallback to English if language is not in mapping
            selected_voice_id = voice_mapping.get(item.language, os.getenv("VOICE_ID_EN"))

            # Fetching audio stream from the 2026 SDK convert method
            audio_stream = el_client.text_to_speech.convert(
                voice_id=selected_voice_id,
                output_format="mp3_44100_128",
                text=result_text,
                model_id="eleven_multilingual_v2"
            )

            audio_bytes: bytes = b"".join(list(audio_stream))
            audio_b64 = base64.b64encode(audio_bytes).decode()
        except Exception as e:
            print(f"TTS error: {e}")

    return {
        "text_coordination": item.text_coordination,
        "content": result_text,
        "audio": audio_b64,
    }


def run_internal_test() -> None:
    """
    Internal test function to verify Chat API and TTS logic.
    """
    sample_payload = SuggestionItem(
        text_coordination={"x": 100, "y": 200},
        context="User is looking at a menu in a French bakery.",
        content="Pain au Chocolat",
        language="English"
    )

    print("--- Starting internal Chat API test ---")
    # Execute the async function using the event loop
    result = asyncio.run(get_suggestion_advice(sample_payload))

    if "error" in result:
        print(f"Test Failed: {result['error']}")
    else:
        print(f"Mistral Suggestion: {result['content']}")

        if result.get("audio"):
            out_path = "suggestion_direct_test.mp3"
            with open(out_path, "wb") as f:
                f.write(base64.b64decode(result["audio"]))
            print(f"--- Success: Audio saved to {out_path} ---")


if __name__ == "__main__":
    run_internal_test()