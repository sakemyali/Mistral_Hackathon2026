import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict

from doraimon_modules.pipeline import run


def run_doraimon_pipeline(
    image_path: str,
    target_language: str,
    ocr_output_path: str,
    coord_output_path: str,
) -> Dict[str, Any]:
    img = Path(image_path).expanduser()
    if not img.exists():
        raise RuntimeError(f"image_path not found: {img}")

    payload = {
        "process": {
            "base_url": "http://localhost:8000",
            "image_path": str(img),
            "target_language": target_language,
        }
    }

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tmp:
        json.dump(payload, tmp, ensure_ascii=False)
        config_path = tmp.name

    try:
        run(
            config_path=config_path,
            api_key=os.getenv("MISTRAL_API_KEY", ""),
            ocr_model=os.getenv("MISTRAL_OCR_MODEL", "mistral-ocr-latest"),
            coord_model=os.getenv("MISTRAL_TEXT_MODEL", "mistral-large-latest"),
            timeout_ms=int(os.getenv("MISTRAL_CALL_TIMEOUT_MS", "45000")),
            ocr_output_path=ocr_output_path,
            coord_output_path=coord_output_path,
        )
    finally:
        Path(config_path).unlink(missing_ok=True)

    ocr_data: Dict[str, Any] = {}
    coord_data: Dict[str, Any] = {}

    ocr_path = Path(ocr_output_path)
    coord_path = Path(coord_output_path)

    if ocr_path.exists():
        ocr_data = json.loads(ocr_path.read_text(encoding="utf-8"))
    if coord_path.exists():
        coord_data = json.loads(coord_path.read_text(encoding="utf-8"))

    return {
        "ocr_output_path": str(ocr_path.resolve()),
        "coord_output_path": str(coord_path.resolve()),
        "ocr_output": ocr_data,
        "coord_output": coord_data,
    }
