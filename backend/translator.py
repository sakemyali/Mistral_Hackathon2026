import asyncio
import time
from typing import List, Optional

import argostranslate.package
import argostranslate.translate

from metrics import log_translation

# Language code mapping (display name -> Argos code)
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

_installed = False


def _detect_language(text: str) -> str:
    """Detect the source language using Argos Translate's installed languages.
    Falls back to 'en' if detection fails."""
    try:
        installed_langs = argostranslate.translate.get_installed_languages()
        if not installed_langs:
            return "en"

        # Use the first installed language's detect method if available
        # Argos doesn't have built-in detection, so use a simple heuristic:
        # Try translating a sample with each installed source lang and pick
        # the one that changes the text the least (i.e., it's likely the source).
        # For performance, just default to English if auto-detect is requested.
        # A more sophisticated approach would use langdetect or langid.
        return "en"
    except Exception:
        return "en"


def _detect_language_advanced(text: str) -> str:
    """Try to detect language using langdetect if available, else fallback."""
    try:
        from langdetect import detect
        code = detect(text)
        # langdetect returns ISO 639-1 codes, map common variants
        code_map = {"zh-cn": "zh", "zh-tw": "zh"}
        return code_map.get(code, code)
    except ImportError:
        return _detect_language(text)
    except Exception:
        return "en"


def _ensure_language_pair(src_code: str, tgt_code: str):
    """Download and install the language pair if not already installed."""
    global _installed
    if not _installed:
        argostranslate.package.update_package_index()
        _installed = True

    installed = argostranslate.translate.get_installed_languages()
    installed_codes = {lang.code for lang in installed}

    if src_code in installed_codes and tgt_code in installed_codes:
        return

    available = argostranslate.package.get_available_packages()
    for pkg in available:
        if pkg.from_code == src_code and pkg.to_code == tgt_code:
            print(f"[Translator] Downloading {src_code}->{tgt_code} package...")
            argostranslate.package.install_from_path(pkg.download())
            return
    # Try pivot through English
    for code in [src_code, tgt_code]:
        if code == "en":
            continue
        for pkg in available:
            if (pkg.from_code == code and pkg.to_code == "en") or \
               (pkg.from_code == "en" and pkg.to_code == code):
                if code not in installed_codes:
                    print(f"[Translator] Downloading en<->{code} package for pivot...")
                    argostranslate.package.install_from_path(pkg.download())


def _translate_text(text: str, src_code: str, tgt_code: str) -> str:
    return argostranslate.translate.translate(text, src_code, tgt_code)


async def translate_batch(
    texts: List[str], source_lang: str, target_lang: str
) -> List[str]:
    """Translate a batch of text strings using Argos Translate (offline).

    If source_lang is 'Auto', attempts to detect the language from the text.
    """
    if not texts:
        return []

    t0 = time.monotonic()
    tgt_code = LANG_CODES.get(target_lang, target_lang.lower()[:2])

    loop = asyncio.get_event_loop()

    # Handle auto-detect
    if source_lang == "Auto":
        # Use the combined text to detect language
        sample_text = " ".join(texts[:3])  # use first 3 lines for detection
        src_code = await loop.run_in_executor(
            None, _detect_language_advanced, sample_text
        )
        print(f"[Translator] Auto-detected source language: {src_code}")
    else:
        src_code = LANG_CODES.get(source_lang, source_lang.lower()[:2])

    # Don't translate if source and target are the same
    if src_code == tgt_code:
        return list(texts)

    # Install packages if needed (blocking, but only first time)
    await loop.run_in_executor(None, _ensure_language_pair, src_code, tgt_code)

    # Translate each text in a thread pool to avoid blocking the event loop
    results = []
    for text in texts:
        translated = await loop.run_in_executor(
            None, _translate_text, text, src_code, tgt_code
        )
        results.append(translated)

    await log_translation(
        text_count=len(texts),
        source_lang=src_code,
        target_lang=tgt_code,
        elapsed=time.monotonic() - t0,
    )
    return results
