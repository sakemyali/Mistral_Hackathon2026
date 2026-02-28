import json
import pathlib
import time
import base64
from typing import Tuple, Dict, Any


def load_config(config_path: str) -> dict:
    """設定ファイルを読み込む"""
    path = pathlib.Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def encode_image(path: pathlib.Path) -> str:
    """画像をbase64エンコードする"""
    return base64.b64encode(path.read_bytes()).decode("utf-8")


def print_header(title: str) -> None:
    """ヘッダーを出力"""
    line = "=" * 64
    print(line)
    print(title)
    print(line)


def print_step(name: str, status: str, body: Dict[str, Any], elapsed_ms: int) -> bool:
    """処理ステップの結果を出力"""
    ok = status == "success"
    print(f"[{'OK' if ok else 'FAIL'}] {name}  status={status}  time={elapsed_ms}ms")
    if isinstance(body, dict):
        print(json.dumps(body, ensure_ascii=False, indent=2))
    else:
        print(str(body))
    print("-" * 64)
    return ok


def timed(func):
    """関数の実行時間を測定"""
    start = time.time()
    result = func()
    end = time.time()
    elapsed_ms = int((end - start) * 1000)
    return result, elapsed_ms


def extract_text_and_coords(data):
    """JSON内を再帰的に探索して、テキストと座標のセットを見つける"""
    results = []
    
    if isinstance(data, dict):
        # 'content' または 'text' があり、かつ 'coordinates' がある場合
        content = data.get('content') or data.get('text')
        coords = data.get('coordinates')
        
        if content and coords:
            results.append({
                "text": content,
                "xmin": coords.get('x_min') or coords.get('xmin'),
                "ymin": coords.get('y_min') or coords.get('ymin'),
                "xmax": coords.get('x_max') or coords.get('xmax'),
                "ymax": coords.get('y_max') or coords.get('ymax')
            })
        
        # さらに深い階層を探索
        for key, value in data.items():
            results.extend(extract_text_and_coords(value))
            
    elif isinstance(data, list):
        for item in data:
            results.extend(extract_text_and_coords(item))
            
    return results
