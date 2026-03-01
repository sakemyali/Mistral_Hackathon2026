import asyncio
import time
from typing import List

from api import mistral_chat
from config import MISTRAL_TEXT_MODEL
from prompts import TRANSLATION_PROMPT
from metrics import log_translation


async def _translate_with_mistral(text: str, source_lang: str, target_lang: str) -> str:
    """Translate a single text using Mistral Large API."""
    try:
        prompt = TRANSLATION_PROMPT.format(
            source_lang=source_lang,
            target_lang=target_lang,
            text=text
        )
        
        data = await mistral_chat({
            "model": MISTRAL_TEXT_MODEL,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 500,
        })
        
        translated = data["choices"][0]["message"]["content"].strip()
        return translated
    except Exception as e:
        print(f"[Translator] Error translating with Mistral: {e}")
        return text


async def translate_batch(
    texts: List[str], source_lang: str, target_lang: str
) -> List[str]:
    """Translate a batch of text strings using Mistral Large API.
    
    If source_lang is 'Auto', attempts to auto-detect from the text.
    """
    if not texts:
        return []

    t0 = time.monotonic()
    
    # Handle auto-detect by asking Mistral to detect
    if source_lang == "Auto":
        sample_text = " ".join(texts[:3])
        try:
            data = await mistral_chat({
                "model": MISTRAL_TEXT_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": f"What language is this text in? Reply with just the language name: {sample_text}"
                    }
                ],
                "max_tokens": 50,
            })
            source_lang = data["choices"][0]["message"]["content"].strip()
            print(f"[Translator] Auto-detected source language: {source_lang}")
        except Exception as e:
            print(f"[Translator] Auto-detect failed: {e}, defaulting to English")
            source_lang = "English"
    
    # Don't translate if source and target are the same
    if source_lang.lower() == target_lang.lower():
        return list(texts)

    # Translate each text using Mistral
    results = []
    for text in texts:
        translated = await _translate_with_mistral(text, source_lang, target_lang)
        results.append(translated)

    await log_translation(
        text_count=len(texts),
        source_lang=source_lang,
        target_lang=target_lang,
        elapsed=time.monotonic() - t0,
    )
    return results

