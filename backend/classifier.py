import json
from typing import Literal

from pydantic import BaseModel
from config import MINISTRAL_MODEL
from api import mistral_chat
from prompts import CLASSIFIER_PROMPT


class IntentResult(BaseModel):
    intent: Literal["normal", "hesitant", "typo"]
    confidence: float
    reasoning: str


async def classify_intent(ocr_text: str, vision_analysis: str) -> IntentResult:
    """Classify user intent using Ministral 3B."""
    prompt = CLASSIFIER_PROMPT.format(
        ocr_text=ocr_text[:2000],
        vision_analysis=vision_analysis[:1000],
    )

    data = await mistral_chat({
        "model": MINISTRAL_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 150,
        "response_format": {"type": "json_object"},
    })
    content = data["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    return IntentResult(**parsed)
