import json
import mimetypes
from pathlib import Path
from typing import Any, Optional

from mistralai import Mistral

from .config import DEFAULT_CODE_MODEL, DEFAULT_TEXT_MODEL, MISTRAL_API_KEY


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
    return _extract_text_from_content(res.choices[0].message.content) or ""


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

    return _extract_text_from_content(res.choices[0].message.content) or ""


def ocr_image_from_path(ocr_model: str, image_path: str) -> dict:
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image file not found: {path}")

    client = _client()
    image_b64 = _to_base64(path.read_bytes())
    ocr_res = client.ocr.process(
        model=ocr_model,
        document={"type": "image_url", "image_url": f"data:image/png;base64,{image_b64}"},
    )

    pages = getattr(ocr_res, "pages", []) or []
    page_texts = []
    dimensions = []
    for p in pages:
        markdown = getattr(p, "markdown", "") or ""
        if markdown.strip():
            page_texts.append(markdown.strip())
        dims = getattr(p, "dimensions", None)
        if dims is not None:
            dimensions.append(
                {
                    "dpi": getattr(dims, "dpi", None),
                    "height": getattr(dims, "height", None),
                    "width": getattr(dims, "width", None),
                }
            )

    return {
        "text": "\n\n".join(page_texts).strip(),
        "text_coordination": dimensions,
        "model": getattr(ocr_res, "model", ocr_model),
    }


def transcribe_audio_from_path(audio_model: str, audio_path: str) -> dict:
    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {path}")

    mime_type = mimetypes.guess_type(path.name)[0] or "audio/mpeg"
    client = _client()
    res = client.audio.transcriptions.complete(
        model=audio_model,
        file={
            "file_name": path.name,
            "content": path.read_bytes(),
            "content_type": mime_type,
        },
    )

    return {
        "text": getattr(res, "text", "") or "",
        "language": getattr(res, "language", None),
        "model": getattr(res, "model", audio_model),
    }


def choose_task_from_text(source_text: str, todo: Optional[str]) -> dict:
    # Requirement: no todo -> translation
    todo_text = (todo or "").strip()
    if not todo_text:
        return {
            "task_type": "translate",
            "selected_model": DEFAULT_TEXT_MODEL,
            "todo": "Translate content",
        }

    lowered_todo = todo_text.lower()

    # Explicit model override in todo
    import re

    m = re.search(r"(mistral-[a-z0-9-]+|devstral-[a-z0-9-]+|codestral-[a-z0-9-]+)", lowered_todo)
    if m:
        return {
            "task_type": "special",
            "selected_model": m.group(1),
            "todo": todo_text,
        }

    # Code request
    if any(k in lowered_todo for k in ["code", "python", "javascript", "fix", "refactor", "bug", "エラー", "コード"]):
        return {
            "task_type": "code",
            "selected_model": DEFAULT_CODE_MODEL,
            "todo": todo_text,
        }

    return {
        "task_type": "translate",
        "selected_model": DEFAULT_TEXT_MODEL,
        "todo": todo_text,
    }


def run_code_generation(source_text: str, todo: Optional[str], model: str = DEFAULT_CODE_MODEL) -> dict:
    prompt = f"""
Generate code based on the input. Return JSON only:
{{"code":"...","explanation":"..."}}

Instruction: {todo or 'Generate code and explain briefly.'}
Input:
{source_text}
""".strip()
    raw = complete_text(model, prompt)
    return {
        "model": model,
        "todo": todo or "Generate code and explain briefly.",
        "output": _parse_json_text(raw) or {"code": raw, "explanation": "Response was not strict JSON."},
    }


def run_special_instruction(source_text: str, todo: Optional[str], model: str) -> dict:
    prompt = f"""
Follow the instruction and return JSON only with keys:
{{"response":"...","notes":"..."}}
Instruction: {todo or ''}
Input:
{source_text}
""".strip()
    raw = complete_text(model, prompt)
    return {
        "model": model,
        "todo": todo or "Follow special instruction.",
        "output": _parse_json_text(raw) or {"response": raw, "notes": "Response was not strict JSON."},
    }


def run_translation_output(source_text: str, target_language: Optional[str], text_coordination: Any) -> dict:
    target = (target_language or "").strip()
    if not target:
        target = "same as source"

    # Single LLM call in translation phase (3-call budget total).
    prompt = f"""
Return JSON only with exact keys:
- Text Coordination
- Context
- Content
- Langrage

Rules:
- If target is 'same as source', keep original language/content.
- Otherwise translate to target language.
- Context must be one short sentence summary.

Target: {target}
Source text:
{source_text}

Text coordination metadata:
{json.dumps(text_coordination, ensure_ascii=False)}
""".strip()

    raw = complete_text(DEFAULT_TEXT_MODEL, prompt)
    parsed = _parse_json_text(raw)
    if parsed:
        output = {
            "Text Coordination": parsed.get("Text Coordination", text_coordination),
            "Context": parsed.get("Context", ""),
            "Content": parsed.get("Content", source_text if target == "same as source" else ""),
            "Langrage": parsed.get("Langrage", "source" if target == "same as source" else target),
        }
    else:
        output = {
            "Text Coordination": text_coordination,
            "Context": "Fallback output",
            "Content": source_text if target == "same as source" else raw,
            "Langrage": "source" if target == "same as source" else target,
        }

    return {
        "model": DEFAULT_TEXT_MODEL,
        "todo": "Translate content" if target != "same as source" else "Keep source language",
        "output": output,
    }


def _parse_json_text(text: str) -> Optional[dict]:
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            return None
    return None


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


def _to_base64(data: bytes) -> str:
    import base64

    return base64.b64encode(data).decode("utf-8")
