import json
import pathlib
import time
import urllib.request


def load_config(config_path: str) -> dict:
    path = pathlib.Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def get_json(url: str, timeout: int = 10) -> tuple[int, dict]:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.status, json.loads(res.read().decode("utf-8"))


def post_json(url: str, payload: dict, timeout: int = 30) -> tuple[int, dict]:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.status, json.loads(res.read().decode("utf-8"))


def encode_image(path: pathlib.Path) -> str:
    import base64

    return base64.b64encode(path.read_bytes()).decode("utf-8")


def print_header(title: str) -> None:
    line = "=" * 64
    print(line)
    print(title)
    print(line)


def print_step(name: str, status: int, body: dict, elapsed_ms: int) -> bool:
    ok = status == 200
    print(f"[{'OK' if ok else 'FAIL'}] {name}  status={status}  time={elapsed_ms}ms")
    print(json.dumps(body, ensure_ascii=False, indent=2))
    print("-" * 64)
    return ok


def timed(callable_fn):
    t0 = time.perf_counter()
    result = callable_fn()
    return result, int((time.perf_counter() - t0) * 1000)
