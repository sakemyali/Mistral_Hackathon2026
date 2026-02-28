import argparse
import base64
import json
import mimetypes
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from mistralai import Mistral


def load_config(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    process = data.get("process", {})
    if not process.get("image_path"):
        raise ValueError("request_config.json process.image_path is required")
    return data


def write_json(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def image_to_data_uri(image_path: str) -> str:
    path = Path(image_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError("image file not found: " + str(path))

    mime_type, _ = mimetypes.guess_type(str(path))
    if not mime_type:
        mime_type = "image/png"

    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return "data:" + mime_type + ";base64," + encoded


def _raise_if_timeout(exc: Exception) -> None:
    msg = str(exc).lower()
    if "timeout" in msg or "timed out" in msg or "read timeout" in msg:
        raise RuntimeError("画像サイズが大きい可能性があります。画像を小さくして再実行してください。") from exc


def ask_ocr(client: Mistral, model: str, image_path: str, timeout_ms: int) -> str:
    image_data_uri = image_to_data_uri(image_path)
    try:
        res = client.ocr.process(
            model=model,
            document={
                "type": "document_url",
                "document_url": image_data_uri,
                "document_name": Path(image_path).name,
            },
            timeout_ms=timeout_ms,
        )
        return "\n".join(page.markdown for page in res.pages).strip()
    except Exception as exc:
        _raise_if_timeout(exc)
        raise


def ask_text(client: Mistral, model: str, prompt: str, timeout_ms: int) -> str:
    try:
        res = client.chat.complete(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            timeout_ms=timeout_ms,
        )
        return (res.choices[0].message.content or "").strip()
    except Exception as exc:
        _raise_if_timeout(exc)
        raise


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


def _extract_json_object(raw: str) -> dict:
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


def _normalize_or_build_text_coordination(parsed: dict, fallback_text: str) -> list:
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
                    x1, y1 = coords[0], coords[1]
                    bbox = {"x": x1, "y": y1}

            out.append(
                {
                    "text": str(text),
                    "bbox": {
                        "x": (bbox or {}).get("x"),
                        "y": (bbox or {}).get("y"),
                    },
                }
            )

    if not out:
        source = parsed.get("Content") or parsed.get("Context") or fallback_text
        sentences = _split_sentences(source)
        for i, sent in enumerate(sentences):
            out.append(
                {
                    "text": sent,
                    "bbox": {
                        "x": None,
                        "y": None,
                    },
                }
            )

    return out


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Image -> OCR + Medium JSON outputs")
    parser.add_argument("--config", default="request_config.json")
    args = parser.parse_args()

    cfg = load_config(Path(args.config))
    process = cfg["process"]
    image_path = process["image_path"]
    target_language = process.get("target_language") or "same"

    api_key = os.getenv("MISTRAL_API_KEY", "")
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY is not set")

    ocr_model = os.getenv("MISTRAL_OCR_MODEL", "mistral-ocr-latest")
    text_model = os.getenv("MISTRAL_TEXT_MODEL", "mistral-medium-latest")
    timeout_ms = int(os.getenv("MISTRAL_CALL_TIMEOUT_MS", "45000"))

    client = Mistral(api_key=api_key)

    # 1) OCR
    ocr_context = ask_ocr(client, ocr_model, image_path, timeout_ms)
    write_json(
        Path("ocr_output.json"),
        {
            "Langrage": target_language,
            "Context": ocr_context,
        },
    )

    # 2) Medium parse/generate to target schema (without pixtral)
    prompt = (
        "You are given OCR text from an image. "
        "Return strict JSON with keys exactly: Text Coordination, Context, Content, Langrage. "
        "For each sentence in Text Coordination, include bbox with x and y only. "
        "x and y must be integers and must not be null. "
        "Estimate x and y from reading order/layout even if approximate.\n\n"
        "Text Coordination item format must be: "
        "{\"text\":\"...\",\"bbox\":{\"x\":123,\"y\":45}}.\n"
        "Do not output any keys other than Text Coordination, Context, Content, Langrage.\n\n"
        "OCR:\n"
        + ocr_context
        + "\n\nTarget language: "
        + target_language
    )
    raw = ask_text(client, text_model, prompt, timeout_ms)
    parsed = _extract_json_object(raw)
    if not parsed:
        parsed = {
            "Text Coordination": [],
            "Context": ocr_context,
            "Content": "",
            "Langrage": target_language,
        }

    text_coordination = _normalize_or_build_text_coordination(parsed, ocr_context)

    context_value = parsed.get("Context", ocr_context)
    content_value = parsed.get("Content", "")
    if not isinstance(context_value, str):
        context_value = json.dumps(context_value, ensure_ascii=False)
    if not isinstance(content_value, str):
        content_value = json.dumps(content_value, ensure_ascii=False)

    # Top-level output is strictly limited to 4 keys.
    write_json(
        Path("pixtral_output.json"),
        {
            "Text Coordination": text_coordination,
            "Context": context_value,
            "Content": content_value,
            "Langrage": target_language,
        },
    )

    print("[OK] wrote ocr_output.json and pixtral_output.json (without pixtral-large-latest)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
