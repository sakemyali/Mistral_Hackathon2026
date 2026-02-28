import argparse
import pathlib
import sys
import urllib.error

from test_common import encode_image, load_config, post_json, print_header, print_step, timed


REQUIRED_IMAGE_KEYS = ["image_path", "target_language", "model", "prompt"]


def _require_keys(obj: dict, keys: list[str], scope: str) -> None:
    missing = [k for k in keys if k not in obj or obj[k] in (None, "")]
    if missing:
        raise ValueError(f"Missing required keys in {scope}: {', '.join(missing)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Image translate API test (JSON config only)")
    parser.add_argument("--config", default="request_config.json")
    args = parser.parse_args()

    try:
        cfg = load_config(args.config)
        if "base_url" not in cfg or not cfg["base_url"]:
            raise ValueError("Missing required key in root: base_url")

        image_cfg = cfg.get("image_translate")
        if not isinstance(image_cfg, dict):
            raise ValueError("Missing required object: image_translate")

        _require_keys(image_cfg, REQUIRED_IMAGE_KEYS, "image_translate")

        image_path = pathlib.Path(image_cfg["image_path"])
        if not image_path.exists():
            raise ValueError(f"Image file not found: {image_path}")

        payload = {
            "image_base64": encode_image(image_path),
            "target_language": image_cfg["target_language"],
            "model": image_cfg["model"],
            "prompt": image_cfg["prompt"],
        }
        base_url = cfg["base_url"]

        print_header("DorAImon Image Translate Test")
        print(f"config={args.config}")
        print(f"base_url={base_url}")
        print(f"image_path={image_path}")
        print(f"target_language={payload['target_language']}")
        print(f"model={payload['model']}")
        print("-" * 64)

        (status, body), elapsed = timed(lambda: post_json(f"{base_url}/v1/image-translate", payload, timeout=60))
        ok = print_step("POST /v1/image-translate", status, body, elapsed)
        print(f"RESULT: {'PASS' if ok else 'FAIL'}")
        return 0 if ok else 1

    except urllib.error.HTTPError as exc:
        print("[FAIL] HTTP error")
        print(f"status={exc.code}")
        print(exc.read().decode("utf-8", errors="ignore"))
        return 1
    except Exception as exc:
        print("[FAIL] Request failed")
        print(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())
