import argparse
import pathlib
import sys
import json
import base64
from typing import List, Dict, Any

from mistralai import Mistral
from python_utils import load_config, encode_image, print_header, print_step, timed, extract_text_and_coords
from image_drawing import ImageTranslationRenderer


REQUIRED_IMAGE_KEYS = ["image_path", "target_language", "ocr_model", "chat_model"]


def _require_keys(obj: dict, keys: list[str], scope: str) -> None:
    """必要なキーが存在することを確認"""
    missing = [k for k in keys if k not in obj or obj[k] in (None, "")]
    if missing:
        raise ValueError(f"Missing required keys in {scope}: {', '.join(missing)}")


def perform_ocr_with_mistral(client: Mistral, image_path: str, ocr_model: str) -> List[Dict[str, Any]]:
    """Mistral OCRを使ってテキストと座標を抽出"""
    with open(image_path, "rb") as f:
        base64_image = base64.b64encode(f.read()).decode('utf-8')

    # OCR実行
    ocr_response = client.ocr.process(
        model=ocr_model,
        document={"type": "image_url", "image_url": f"data:image/jpeg;base64,{base64_image}"}
    )
    
    # 構造を解析して全テキスト・座標を取得
    ocr_dict = json.loads(ocr_response.model_dump_json())
    raw_results = extract_text_and_coords(ocr_dict)

    if not raw_results:
        print("デバッグ: OCRレスポンスの生データを確認します。")
        print(json.dumps(ocr_dict, indent=2, ensure_ascii=False))
        return []

    return raw_results


def translate_texts_with_mistral(client: Mistral, texts: List[str], target_language: str, chat_model: str, prompt: str) -> List[str]:
    """Mistralを使ってテキストを翻訳"""
    if not texts:
        return []
    
    translation_prompt = f"{prompt}\n\nTexts to translate: {json.dumps(texts, ensure_ascii=False)}\nTarget language: {target_language}"
    
    chat_response = client.chat.complete(
        model=chat_model,
        messages=[{"role": "user", "content": translation_prompt}],
        response_format={"type": "json_object"}
    )

    try:
        response_content = chat_response.choices[0].message.content
        response_json = json.loads(response_content)
        translations = response_json.get('translations', [])
        
        # 翻訳結果の数が元のテキスト数と一致しない場合の対処
        if len(translations) != len(texts):
            print(f"Warning: Translation count mismatch. Expected {len(texts)}, got {len(translations)}")
            # 不足分は元のテキストで埋める
            while len(translations) < len(texts):
                translations.append(texts[len(translations)])
        
        return translations
    except Exception as e:
        print(f"Error parsing translation response: {e}")
        print(f"Response content: {chat_response.choices[0].message.content}")
        # エラーの場合は元のテキストをそのまま返す
        return texts


def perform_translate_with_position(client: Mistral, image_cfg: Dict[str, Any]) -> List[Dict[str, Any]]:
    """画像からテキストを抽出し、翻訳結果と座標を返す"""
    image_path = image_cfg["image_path"]
    target_language = image_cfg["target_language"]
    ocr_model = image_cfg["ocr_model"]
    chat_model = image_cfg["chat_model"]
    prompt = image_cfg.get("prompt", "Translate the following texts. Return a JSON object with 'translations' key.")

    # 1. OCR実行
    ocr_results, ocr_time = timed(lambda: perform_ocr_with_mistral(client, image_path, ocr_model))
    print_step("OCR Processing", "success" if ocr_results else "failed", 
               {"extracted_texts": len(ocr_results)}, ocr_time)

    if not ocr_results:
        return []

    # 2. 翻訳実行
    texts = [r['text'] for r in ocr_results]
    translations, trans_time = timed(lambda: translate_texts_with_mistral(client, texts, target_language, chat_model, prompt))
    print_step("Translation Processing", "success" if translations else "failed", 
               {"translated_texts": len(translations)}, trans_time)

    # 3. 結果を結合
    final_results = []
    for i, ocr_result in enumerate(ocr_results):
        final_results.append({
            "original": ocr_result['text'],
            "translated": translations[i] if i < len(translations) else "N/A",
            "xmin": ocr_result['xmin'],
            "ymin": ocr_result['ymin'],
            "xmax": ocr_result['xmax'],
            "ymax": ocr_result['ymax']
        })
    
    return final_results


def main() -> int:
    parser = argparse.ArgumentParser(description="Mistral Pixtral AI Image Translate with Position Rendering")
    parser.add_argument("--config", default="image_translate_config.json", help="Configuration file path")
    parser.add_argument("--image", help="Image path (overrides config)")
    parser.add_argument("--output", help="Output image path (overrides config)")
    parser.add_argument("--comparison", action="store_true", help="Create comparison image")
    args = parser.parse_args()

    try:
        # 設定ファイル読み込み
        cfg = load_config(args.config)
        
        if "mistral_api_key" not in cfg or not cfg["mistral_api_key"]:
            raise ValueError("Missing required key in root: mistral_api_key")

        image_cfg = cfg.get("image_translate")
        if not isinstance(image_cfg, dict):
            raise ValueError("Missing required object: image_translate")

        _require_keys(image_cfg, REQUIRED_IMAGE_KEYS, "image_translate")

        # コマンドライン引数で設定を上書き
        if args.image:
            image_cfg["image_path"] = args.image
        if args.output:
            image_cfg["output_image_path"] = args.output

        image_path = pathlib.Path(image_cfg["image_path"])
        if not image_path.exists():
            raise ValueError(f"Image file not found: {image_path}")

        # Mistralクライアント初期化
        client = Mistral(api_key=cfg["mistral_api_key"])

        print_header("Mistral Pixtral AI Image Translation with Position Rendering")
        print(f"config={args.config}")
        print(f"image_path={image_path}")
        print(f"target_language={image_cfg['target_language']}")
        print(f"ocr_model={image_cfg['ocr_model']}")
        print(f"chat_model={image_cfg['chat_model']}")
        print("-" * 64)

        # 翻訳処理実行
        translation_results, total_time = timed(lambda: perform_translate_with_position(client, image_cfg))
        
        if not translation_results:
            print("No text found or translation failed.")
            return 1

        # 結果表示
        print(f"\nExtracted and translated {len(translation_results)} text elements:")
        for i, result in enumerate(translation_results, 1):
            print(f"{i:2d}. '{result['original']}' -> '{result['translated']}'")
            print(f"     Position: ({result['xmin']}, {result['ymin']}) to ({result['xmax']}, {result['ymax']})")

        # 画像に翻訳結果を描画
        renderer = ImageTranslationRenderer(
            font_size=image_cfg.get("font_size", 20),
            bg_alpha=image_cfg.get("bg_alpha", 180)
        )

        output_path = image_cfg.get("output_image_path", "translated_image.png")
        rendered_path, render_time = timed(lambda: renderer.draw_translated_text(
            str(image_path), translation_results, output_path
        ))
        print_step("Image Rendering", "success", {"output_path": rendered_path}, render_time)

        # 比較画像作成（オプション）
        if args.comparison:
            comparison_path = image_cfg.get("comparison_image_path", "comparison_image.png")
            comp_path, comp_time = timed(lambda: renderer.create_comparison_image(
                str(image_path), rendered_path, comparison_path
            ))
            print_step("Comparison Image Creation", "success", {"comparison_path": comp_path}, comp_time)

        print(f"\nTotal processing time: {total_time}ms")
        print(f"RESULT: PASS")
        return 0

    except Exception as exc:
        print("[FAIL] Processing failed")
        print(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())