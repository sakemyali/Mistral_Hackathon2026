import asyncio
import time
from typing import List, Optional

from mistralai import Mistral

from config import MISTRAL_API_KEY, MISTRAL_TEXT_MODEL
from metrics import log_translation

LANG_CODES = {
    "English": "en",
    "Japanese": "ja",
    "French": "fr",
    "Spanish": "es",
    "German": "de",
    "Chinese": "zh",
    "Korean": "ko",
    "Portuguese": "pt",
    "Arabic": "ar",
    "Russian": "ru",
}

_client: Optional[Mistral] = None


def _get_client() -> Mistral:
    global _client
    if _client is None:
        _client = Mistral(api_key=MISTRAL_API_KEY)
    return _client


def _translate_texts(texts: List[str], src_lang: str, tgt_lang: str) -> List[str]:
    client = _get_client()
    joined = "\n---\n".join(texts)
    prompt = (
        f"Translate the following text from {src_lang} to {tgt_lang}. "
        f"Preserve the original formatting. Each segment is separated by ---. "
        f"Return only the translated segments separated by ---.\n\n{joined}"
    )
    res = client.chat.complete(
        model=MISTRAL_TEXT_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    content = (res.choices[0].message.content or "").strip()
    parts = [p.strip() for p in content.split("---")]
    # Pad or trim to match input length
    while len(parts) < len(texts):
        parts.append("")
    return parts[: len(texts)]


async def translate_batch(
    texts: List[str], source_lang: str, target_lang: str
) -> List[str]:
    """Translate a batch of text strings using Mistral (mistral-large-latest).

    If source_lang is 'Auto', the model infers the source language automatically.
    """
    if not texts:
        return []

    t0 = time.monotonic()
    src_code = LANG_CODES.get(source_lang, source_lang) if source_lang != "Auto" else "auto"
    tgt_code = LANG_CODES.get(target_lang, target_lang.lower()[:2])

    if src_code == tgt_code:
        return list(texts)

    src_label = source_lang if source_lang != "Auto" else "auto-detected"
    tgt_label = target_lang

    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(
        None, _translate_texts, texts, src_label, tgt_label
    )

    await log_translation(
        text_count=len(texts),
        source_lang=src_code,
        target_lang=tgt_code,
        elapsed=time.monotonic() - t0,
    )
    return results
