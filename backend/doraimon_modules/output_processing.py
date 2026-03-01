import json
import re


def extract_json_object(raw: str) -> dict:
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, flags=re.DOTALL | re.IGNORECASE)
    if m:
        try:
            data = json.loads(m.group(1))
            if isinstance(data, dict):
                return data
        except Exception:
            pass

    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            data = json.loads(raw[start : end + 1])
            if isinstance(data, dict):
                return data
        except Exception:
            pass

    return {}


def _split_sentences(text: str) -> list:
    text = (text or "").replace("\r", " ").replace("\n", " ").strip()
    if not text:
        return []

    seps = ["。", "！", "？", ".", "!", "?"]
    out = []
    cur = ""
    for ch in text:
        cur += ch
        if ch in seps:
            sent = cur.strip()
            if sent:
                out.append(sent)
            cur = ""
    tail = cur.strip()
    if tail:
        out.append(tail)
    return out


def normalize_or_build_text_coordination(parsed: dict, fallback_text: str) -> list:
    tc = parsed.get("Text Coordination") if isinstance(parsed, dict) else None
    out = []

    if isinstance(tc, list):
        for item in tc:
            if not isinstance(item, dict):
                continue
            text = item.get("text") or item.get("Text") or ""

            bbox = item.get("bbox") if isinstance(item.get("bbox"), dict) else None
            if not bbox:
                coords = item.get("Coordinates")
                if isinstance(coords, list) and len(coords) >= 4:
                    x1, y1, x2, y2 = coords[0], coords[1], coords[2], coords[3]
                    bbox = {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1}

            out.append(
                {
                    "text": str(text),
                    "bbox": {
                        "x": (bbox or {}).get("x"),
                        "y": (bbox or {}).get("y"),
                        "w": (bbox or {}).get("w"),
                        "h": (bbox or {}).get("h"),
                    },
                }
            )

    if not out:
        source = parsed.get("Content") or parsed.get("Context") or fallback_text
        sentences = _split_sentences(source)
        for sent in sentences:
            out.append(
                {
                    "text": sent,
                    "bbox": {
                        "x": None,
                        "y": None,
                        "w": None,
                        "h": None,
                    },
                }
            )

    return out


def build_pixtral_output(parsed: dict, ocr_context: str, target_language: str) -> dict:
    text_coordination = normalize_or_build_text_coordination(parsed, ocr_context)

    context_value = parsed.get("Context", ocr_context)
    content_value = parsed.get("Content", "")
    if not isinstance(context_value, str):
        context_value = json.dumps(context_value, ensure_ascii=False)
    if not isinstance(content_value, str):
        content_value = json.dumps(content_value, ensure_ascii=False)

    return {
        "Text Coordination": text_coordination,
        "Context": context_value,
        "Content": content_value,
        "Langrage": target_language,
    }
