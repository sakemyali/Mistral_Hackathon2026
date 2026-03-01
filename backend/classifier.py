import json
from typing import Literal

from pydantic import BaseModel
from config import MINISTRAL_MODEL
from api import mistral_chat

CLASSIFIER_PROMPT = """You are a work productivity intent classifier. Based on the OCR text and visual analysis from a user's screen, classify their current state into exactly one intent:

- "normal": User is actively and productively working. Text is coherent, actions are purposeful.
- "hesitant": User appears stuck, indecisive, or distracted. Signs include: long pauses with empty input fields, switching between windows frequently, cursor hovering without action, search queries that suggest confusion.
- "typo": User's text contains typos, repeated corrections, or garbled input suggesting they are typing carelessly or struggling with input.

Respond in JSON:
{{"intent": "normal"|"hesitant"|"typo", "confidence": 0.0-1.0, "reasoning": "brief explanation"}}

OCR Text: {ocr_text}

Visual Analysis: {vision_analysis}"""


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
