# Mistral Pixtral AI Image Translation System

このシステムは、Mistral の Pixtral AI を使用して、画像内のテキストを検出・翻訳し、翻訳結果を元の位置に描画し直す機能を提供します。

## 機能

1. **OCR処理**: Mistral OCR を使って画像からテキストとその座標を抽出
2. **翻訳処理**: Mistral Large を使ってテキストを指定言語に翻訳
3. **画像描画**: 翻訳されたテキストを元の座標に描画して新しい画像を生成
4. **比較画像**: 元画像と翻訳画像を並べた比較画像を生成

## セットアップ

### 1. 依存関係のインストール

```bash
pip install -r requirements.txt
```

### 2. 設定ファイル編集

`image_translate_config.json` を編集し、Mistral API キーを設定してください：

```json
{
  "mistral_api_key": "your_mistral_api_key_here",
  "image_translate": {
    "image_path": "screenshot.png",
    "target_language": "English",
    "ocr_model": "mistral-ocr-latest",
    "chat_model": "mistral-large-latest",
    "output_image_path": "translated_image.png",
    "comparison_image_path": "comparison_image.png",
    "font_size": 20,
    "bg_alpha": 180,
    "prompt": "Translate the following texts to English. Return a JSON object with 'translations' key containing an array of translated texts in the same order."
  }
}
```

## 使用方法

### 簡易実行（推奨）

```bash
# デフォルト画像（../screenshot.png）を使用
python run_translation.py

# 指定した画像を使用
python run_translation.py path/to/your/image.png
```

### 詳細実行

```bash
# 基本実行
python image_translate_main.py

# 設定ファイル指定
python image_translate_main.py --config custom_config.json

# 画像パス指定
python image_translate_main.py --image path/to/image.png

# 出力パス指定
python image_translate_main.py --output translated_result.png

# 比較画像も生成
python image_translate_main.py --comparison

# 全オプション組み合わせ
python image_translate_main.py --config custom_config.json --image input.png --output result.png --comparison
```

## 出力ファイル

- `translated_image.png`: 翻訳されたテキストが描画された画像
- `comparison_image.png`: 元画像と翻訳画像を並べた比較画像（`--comparison` オプション使用時）

## 設定オプション

### 必須設定
- `mistral_api_key`: Mistral AI の API キー
- `image_path`: 処理対象の画像パス
- `target_language`: 翻訳先言語
- `ocr_model`: OCR に使用する Mistral モデル
- `chat_model`: 翻訳に使用する Mistral モデル

### オプション設定
- `font_size`: 描画テキストのフォントサイズ（デフォルト: 20）
- `bg_alpha`: 背景の透明度（0-255、デフォルト: 180）
- `prompt`: 翻訳プロンプト
- `output_image_path`: 出力画像パス
- `comparison_image_path`: 比較画像パス

## サポートする画像形式

- PNG
- JPEG/JPG
- その他 PIL でサポートされる形式

## トラブルシューティング

### OCR が失敗する場合
- 画像の品質を確認してください
- 画像内のテキストが明瞭に見えることを確認してください

### 翻訳が失敗する場合
- API キーが正しく設定されているか確認してください
- ネットワーク接続を確認してください

### フォントが正しく表示されない場合
- システムにインストールされているフォントが使用されます
- macOS の場合、Helvetica や Arial Unicode フォントが自動選択されます

## ファイル構成

- `image_translate_main.py`: メインスクリプト
- `python_utils.py`: ユーティリティ関数
- `image_drawing.py`: 画像描画クラス
- `image_translate_config.json`: 設定ファイル
- `run_translation.py`: 簡易実行スクリプト
- `requirements.txt`: Python 依存関係
- `README_python.md`: このドキュメント
