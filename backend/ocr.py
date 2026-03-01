import time
from typing import List

import pytesseract
from pytesseract import Output
from PIL import Image
from pydantic import BaseModel


class OCRWord(BaseModel):
    text: str
    x: int
    y: int
    width: int
    height: int
    confidence: float


class OCRResult(BaseModel):
    words: List[OCRWord]
    full_text: str
    timestamp: float


def extract_text_with_boxes(
    image: Image.Image, min_confidence: int = 40
) -> OCRResult:
    """Extract words with bounding boxes from a PIL Image."""
    data = pytesseract.image_to_data(image, output_type=Output.DICT)
    words: List[OCRWord] = []
    texts: List[str] = []

    for i in range(len(data["level"])):
        conf = int(data["conf"][i])
        text = data["text"][i].strip()
        if conf >= min_confidence and text:
            words.append(
                OCRWord(
                    text=text,
                    x=data["left"][i],
                    y=data["top"][i],
                    width=data["width"][i],
                    height=data["height"][i],
                    confidence=conf / 100.0,
                )
            )
            texts.append(text)

    return OCRResult(
        words=words,
        full_text=" ".join(texts),
        timestamp=time.time(),
    )
