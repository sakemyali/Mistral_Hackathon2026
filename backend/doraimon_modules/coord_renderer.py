import json
from pathlib import Path


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _safe_num(v, fallback: int) -> int:
    try:
        if v is None:
            return fallback
        return int(v)
    except Exception:
        return fallback


def sort_text_coordination(items: list) -> list:
    normalized = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue

        text = str(item.get("text", "")).strip()
        bbox = item.get("bbox") if isinstance(item.get("bbox"), dict) else {}

        x = _safe_num(bbox.get("x"), 10**9)
        y = _safe_num(bbox.get("y"), 10**9)

        normalized.append(
            {
                "text": text,
                "bbox": {
                    "x": None if x == 10**9 else x,
                    "y": None if y == 10**9 else y,
                },
                "_order": i,
                "_sx": x,
                "_sy": y,
            }
        )

    normalized.sort(key=lambda a: (a["_sy"], a["_sx"], a["_order"]))
    return [{"text": n["text"], "bbox": n["bbox"]} for n in normalized]


def build_content(sorted_items: list) -> str:
    # Convert pixel coordinates into monospaced text layout.
    char_px = 8
    line_px = 28

    rows = {}
    unknown = []
    for i, item in enumerate(sorted_items):
        text = str(item.get("text", "")).strip()
        if not text:
            continue

        bbox = item.get("bbox") if isinstance(item.get("bbox"), dict) else {}
        x = bbox.get("x")
        y = bbox.get("y")

        if x is None or y is None:
            unknown.append((i, text))
            continue

        row = max(0, int(round(int(y) / line_px)))
        col = max(0, int(round(int(x) / char_px)))
        rows.setdefault(row, []).append((col, i, text))

    out_lines = []
    prev_row = None
    for row in sorted(rows.keys()):
        if prev_row is not None:
            gap = row - prev_row - 1
            # Keep readable separation without exploding blank lines.
            out_lines.extend([""] * max(0, min(gap, 2)))
        prev_row = row

        entries = sorted(rows[row], key=lambda x: (x[0], x[1]))
        line = ""
        for col, _, text in entries:
            if col > len(line):
                line += " " * (col - len(line))
            elif line:
                line += " "
            line += text
        out_lines.append(line.rstrip())

    for _, text in sorted(unknown, key=lambda x: x[0]):
        out_lines.append(text)

    return "\n".join(out_lines).strip()


def render_coordinate_output(src: dict) -> dict:
    text_coord = src.get("Text Coordination", [])
    if not isinstance(text_coord, list):
        text_coord = []

    sorted_coord = sort_text_coordination(text_coord)
    content = build_content(sorted_coord)

    return {
        "Text Coordination": sorted_coord,
        "Context": src.get("Context", ""),
        "Content": content,
    }
