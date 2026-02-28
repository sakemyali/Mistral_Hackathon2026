from typing import Any, Optional

from mistralai import Mistral

from .config import MISTRAL_API_KEY


def _client() -> Mistral:
    if not MISTRAL_API_KEY:
        raise RuntimeError("MISTRAL_API_KEY is not set")
    return Mistral(api_key=MISTRAL_API_KEY)


def complete_text(model: str, prompt: str) -> str:
    client = _client()
    res = client.chat.complete(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    return res.choices[0].message.content or ""


def analyze_and_translate_image(
    model: str,
    image_base64: str,
    target_language: str,
    prompt: Optional[str] = None,
) -> str:
    client = _client()
    default_prompt = (
        "You are an OCR + translation assistant. "
        "1) Read all visible text in the image. "
        f"2) Translate it to {target_language}. "
        "3) Return only the translated text as plain text, no JSON, no markdown."
    )
    effective_prompt = prompt or default_prompt

    res = client.chat.complete(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": f"data:image/png;base64,{image_base64}"},
                    {"type": "text", "text": effective_prompt},
                ],
            }
        ],
    )

    content = res.choices[0].message.content
    if isinstance(content, str):
        return content.strip()

    return _extract_text_from_content(content) or ""


def _extract_text_from_content(content: Any) -> Optional[str]:
    if content is None:
        return None
    if isinstance(content, str):
        text = content.strip()
        return text or None
    if isinstance(content, dict):
        text = content.get("text")
        if isinstance(text, str) and text.strip():
            return text.strip()
    if isinstance(content, list):
        for part in content:
            extracted = _extract_text_from_content(part)
            if extracted:
                return extracted

    text_attr = getattr(content, "text", None)
    if isinstance(text_attr, str) and text_attr.strip():
        return text_attr.strip()

    nested_content = getattr(content, "content", None)
    if nested_content is not None:
        extracted = _extract_text_from_content(nested_content)
        if extracted:
            return extracted

    return None
