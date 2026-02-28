#!/usr/bin/env python3
"""
簡易実行スクリプト - 画像翻訳システムの実行例

Usage:
    python run_translation.py [image_path]
"""

import sys
import pathlib
import subprocess

def main():
    # 引数チェック
    if len(sys.argv) > 2:
        print("Usage: python run_translation.py [image_path]")
        return 1
    
    # デフォルト画像パス
    image_path = sys.argv[1] if len(sys.argv) == 2 else "../screenshot.png"
    
    # 画像ファイル存在確認
    if not pathlib.Path(image_path).exists():
        print(f"Error: Image file not found: {image_path}")
        print("\nPlease provide a valid image path or place 'screenshot.png' in the parent directory.")
        return 1
    
    print(f"Processing image: {image_path}")
    print("Running Mistral Pixtral AI Image Translation...")
    print("=" * 60)
    
    # メインスクリプト実行
    cmd = [
        sys.executable, "image_translate_main.py",
        "--image", image_path,
        "--comparison"  # 比較画像も生成
    ]
    
    try:
        result = subprocess.run(cmd, check=True)
        print("\n" + "=" * 60)
        print("Translation completed successfully!")
        print("Check the output files:")
        print("  - translated_image.png (translated version)")
        print("  - comparison_image.png (side-by-side comparison)")
        return result.returncode
    except subprocess.CalledProcessError as e:
        print(f"\nError: Translation failed with exit code {e.returncode}")
        return e.returncode
    except Exception as e:
        print(f"\nError: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
