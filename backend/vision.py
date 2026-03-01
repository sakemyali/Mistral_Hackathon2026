import json
from config import PIXTRAL_MODEL
from api import mistral_chat
from prompts import VISION_ANALYSIS_PROMPT


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
                    {"type": "text", "text": VISION_ANALYSIS_PROMPT},
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
