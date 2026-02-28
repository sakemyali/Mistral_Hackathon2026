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
        text_coordination: The spatial coordinates (x, y).
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
    Core logic to get a suggestion from Mistral and audio from ElevenLabs.
    This function is designed to be called internally by other modules.

    Args:
        item (SuggestionItem): The request item containing context and content.

    Returns:
        Dict[str, Any]: Coordination, suggestion text, and base64 audio.
    """
    mistral_key: str = os.getenv("MISTRAL_API_KEY", "")
    agent_id: str = os.getenv("MISTRAL_SUGGEST_AGENT_ID", "")
    eleven_key: str = os.getenv("ELEVENLABS_API_KEY", "")

    if not all([mistral_key, agent_id]):
        return {"error": "Mistral API configuration missing."}

    try:
        # 1. Mistral Agent Completion
        client: Mistral = Mistral(api_key=mistral_key)
        response = client.agents.complete(
            agent_id=agent_id,
            messages=[{
                "role": "user",
                "content": (
                    f"Language: {item.language}\n"
                    f"Context: {item.context}\n"
                    f"Content: {item.content}"
                )
            }],
            response_format={"type": "json_object"}
        )

        raw_content: str = response.choices[0].message.content
        try:
            parsed = json.loads(raw_content)
            result_text = parsed.get("suggestion", raw_content)
        except json.JSONDecodeError:
            result_text = raw_content

        # 2. ElevenLabs TTS Generation
        audio_b64: Optional[str] = None
        if eleven_key:
            try:
                el_client = ElevenLabs(api_key=eleven_key)
                # Using the latest convert method for 2026 SDK
                audio_stream = el_client.text_to_speech.convert(
                    voice_id="21m00Tcm4TlvDq8ikWAM",  # Rachel
                    text=result_text,
                    model_id="eleven_multilingual_v2",
                    output_format="mp3_44100_128"
                )
                audio_bytes: bytes = b"".join(list(audio_stream))
                audio_b64 = base64.b64encode(audio_bytes).decode()
            except Exception as e:
                print(f"TTS error: {e}")

        return {
            "text_coordination": item.text_coordination,
            "content": result_text,
            "audio": audio_b64
        }

    except Exception as e:
        return {"error": f"Process failed: {str(e)}"}


def run_internal_test() -> None:
    """
    Directly tests the logic function and saves the audio file for verification.
    """
    # Define sample data locally
    item = SuggestionItem(
        text_coordination={"x": 1024, "y": 768},
        context="User is at a bakery looking at a croissant.",
        content="Golden Butter Croissant",
        language="English"
    )

    print("--- Starting internal function test ---")
    # Run the async logic in a temporary event loop
    result = asyncio.run(get_suggestion_advice(item))

    if "error" in result:
        print(f"Test Failed: {result['error']}")
    else:
        print(f"Agent Suggestion: {result['content']}")
        if result.get("audio"):
            output_filename = "suggestion_internal_test.mp3"
            with open(output_filename, "wb") as f:
                f.write(base64.b64decode(result["audio"]))
            print(f"--- Success: Audio saved to '{output_filename}' ---")


if __name__ == "__main__":
    run_internal_test()