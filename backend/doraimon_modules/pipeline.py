from pathlib import Path

from .io_utils import load_config, write_json
from .mistral_ops import ask_ocr, ask_text_from_image, create_client
from .output_processing import build_pixtral_output, extract_json_object
from .prompts import build_coordinate_prompt


def run(
    config_path: str,
    api_key: str,
    ocr_model: str,
    coord_model: str,
    timeout_ms: int,
    ocr_output_path: str = "ocr_output.json",
    coord_output_path: str = "pixtral_output.json",
) -> None:
    cfg = load_config(Path(config_path))
    process = cfg["process"]
    image_path = process["image_path"]
    target_language = process.get("target_language") or "same"

    client = create_client(api_key)

    # 1) OCR
    ocr_context = ask_ocr(client, ocr_model, image_path, timeout_ms)
    write_json(
        Path(ocr_output_path),
        {
            "Langrage": target_language,
            "Context": ocr_context,
        },
    )

    # 2) Coordinates from image model
    prompt = build_coordinate_prompt(ocr_context, target_language)
    raw = ask_text_from_image(client, coord_model, prompt, image_path, timeout_ms)
    parsed = extract_json_object(raw)
    if not parsed:
        parsed = {
            "Text Coordination": [],
            "Context": ocr_context,
            "Content": "",
            "Langrage": target_language,
        }

    output = build_pixtral_output(parsed, ocr_context, target_language)
    write_json(Path(coord_output_path), output)
