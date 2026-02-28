import argparse
import sys
import urllib.error

from test_common import get_json, load_config, post_json, print_header, print_step, timed


REQUIRED_PROCESS_KEYS = ["input_type", "target_language", "prompt", "session_id"]


def _require_keys(obj: dict, keys: list[str], scope: str) -> None:
    missing = [k for k in keys if k not in obj or obj[k] in (None, "")]
    if missing:
        raise ValueError(f"Missing required keys in {scope}: {', '.join(missing)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Process API smoke test (JSON config only)")
    parser.add_argument("--config", default="request_config.json")
    args = parser.parse_args()

    try:
        cfg = load_config(args.config)
        if "base_url" not in cfg or not cfg["base_url"]:
            raise ValueError("Missing required key in root: base_url")

        process_cfg = cfg.get("process")
        if not isinstance(process_cfg, dict):
            raise ValueError("Missing required object: process")

        _require_keys(process_cfg, REQUIRED_PROCESS_KEYS, "process")

        payload = {
            "input_type": process_cfg["input_type"],
            "content": process_cfg["prompt"],
            "target_language": process_cfg["target_language"],
            "session_id": process_cfg["session_id"],
        }
        base_url = cfg["base_url"]

        print_header("DorAImon API Smoke Test")
        print(f"config={args.config}")
        print(f"base_url={base_url}")
        print(f"input_type={payload['input_type']}  target_language={payload['target_language']}")
        print("-" * 64)

        (s1, b1), t1 = timed(lambda: get_json(f"{base_url}/health/live"))
        (s2, b2), t2 = timed(lambda: get_json(f"{base_url}/health/ready"))
        (s3, b3), t3 = timed(lambda: post_json(f"{base_url}/v1/process", payload))

        ok = all([
            print_step("GET /health/live", s1, b1, t1),
            print_step("GET /health/ready", s2, b2, t2),
            print_step("POST /v1/process", s3, b3, t3),
        ])
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
