from pathlib import Path

from mistralai import Mistral

from .io_utils import image_to_data_uri


def create_client(api_key: str) -> Mistral:
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY is not set")
    return Mistral(api_key=api_key)


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


def ask_text_from_image(client: Mistral, model: str, prompt: str, image_path: str, timeout_ms: int) -> str:
    image_data_uri = image_to_data_uri(image_path)
    try:
        res = client.chat.complete(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": image_data_uri},
                    ],
                }
            ],
            timeout_ms=timeout_ms,
        )
        return (res.choices[0].message.content or "").strip()
    except Exception as exc:
        _raise_if_timeout(exc)
        raise
