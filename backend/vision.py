import json
from config import PIXTRAL_MODEL
from api import mistral_chat

VISION_PROMPT = """Analyze this screenshot of a user's screen. Describe in JSON format:
{
  "active_application": "string - what app/website is visible",
  "user_activity": "string - what the user appears to be doing",
  "visual_cues": {
    "cursor_position": "string - where the cursor appears to be",
    "active_input": "boolean - is there an active text input",
    "multiple_windows": "boolean",
    "idle_indicators": "string - any signs of inactivity"
  },
  "context_summary": "string - one sentence summary of the scene"
}
Be concise. Focus on productivity-relevant observations."""


async def analyze_screen(base64_image: str) -> str:
    """Send screenshot to Pixtral-12B for visual scene analysis.

    Returns the raw JSON string from the model response.
    """
    data = await mistral_chat({
        "model": PIXTRAL_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": VISION_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        },
                    },
                ],
            }
        ],
        "max_tokens": 300,
        "response_format": {"type": "json_object"},
    })
    return data["choices"][0]["message"]["content"]
