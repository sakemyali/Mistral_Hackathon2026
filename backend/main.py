import argparse
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request
from typing import Any


DEFAULT_CONFIG = "request_config.json"
TMP_OUTPUT = "tmp_output.json"
FINAL_OUTPUT = "output.json"


def load_json(path: pathlib.Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: pathlib.Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def post_json(url: str, payload: dict[str, Any], timeout: int = 120) -> tuple[int, dict[str, Any]]:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.status, json.loads(res.read().decode("utf-8"))


def validate_process(process: dict[str, Any]) -> None:
    if not process.get("base_url"):
        raise ValueError("process.base_url is required")
    if not process.get("image_path") and not process.get("audio_path"):
        raise ValueError("Either process.image_path or process.audio_path is required")


def build_tmp_output(body: dict[str, Any]) -> dict[str, Any]:
    p = body.get("process", {})
    return {
        "Context": p.get("source_text", ""),
        "model": p.get("model", ""),
        "todo": p.get("todo", ""),
    }


def build_final_output(body: dict[str, Any]) -> dict[str, Any]:
    p = body.get("process", {})
    out = p.get("output", {}) if isinstance(p.get("output"), dict) else {}
    return {
        "Text Coordination": out.get("Text Coordination", []),
        "Context": out.get("Context", p.get("source_text", "")),
        "Content": out.get("Content", ""),
        "Langrage": out.get("Langrage", "source"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Loop caller for /v1/process-unified")
    parser.add_argument("--config", default=DEFAULT_CONFIG, help="Path to request config JSON")
    parser.add_argument("--max-iterations", type=int, default=1, help="Number of calls (ignored with --forever)")
    parser.add_argument("--interval-sec", type=float, default=0.0, help="Sleep seconds between calls")
    parser.add_argument("--forever", action="store_true", help="Run indefinitely")
    args = parser.parse_args()

    cfg_path = pathlib.Path(args.config)

    try:
        cfg = load_json(cfg_path)
        process = cfg.get("process")
        if not isinstance(process, dict):
            raise ValueError("request_config.json must contain 'process' object")
        validate_process(process)

        base_url = str(process["base_url"]).rstrip("/")
        endpoint = f"{base_url}/v1/process-unified"

        iteration = 0
        while True:
            iteration += 1
            payload = {"process": process}

            t0 = time.perf_counter()
            status, body = post_json(endpoint, payload)
            elapsed_ms = int((time.perf_counter() - t0) * 1000)

            print("=" * 64)
            print(f"Iteration {iteration}")
            print(f"POST {endpoint}")
            print(f"status={status} time={elapsed_ms}ms")
            print(json.dumps(body, ensure_ascii=False, indent=2))

            if status != 200:
                print("[STOP] Non-200 response")
                return 1

            tmp_output = build_tmp_output(body)
            final_output = build_final_output(body)

            save_json(pathlib.Path(TMP_OUTPUT), tmp_output)
            save_json(pathlib.Path(FINAL_OUTPUT), final_output)

            print(f"Saved: {TMP_OUTPUT}")
            print(f"Saved: {FINAL_OUTPUT}")

            # Feed next iteration with generated todo
            if tmp_output.get("todo"):
                process["todo"] = tmp_output["todo"]

            if not args.forever and iteration >= args.max_iterations:
                break

            if args.interval_sec > 0:
                time.sleep(args.interval_sec)

        print("Completed")
        return 0

    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        print("[FAIL] HTTP error")
        print(f"status={exc.code}")
        print(detail)
        return 1
    except Exception as exc:
        print("[FAIL] Request failed")
        print(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())
