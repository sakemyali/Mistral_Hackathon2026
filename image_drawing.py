from PIL import Image, ImageDraw, ImageFont
import pathlib
from typing import List, Dict, Any, Tuple


class ImageTranslationRenderer:
    """翻訳結果を画像に描画するクラス"""
    
    def __init__(self, font_size: int = 20, bg_alpha: int = 180):
        self.font_size = font_size
        self.bg_alpha = bg_alpha
        self.font = self._load_font()
    
    def _load_font(self):
        """フォントを読み込む（日本語対応）"""
        try:
            # macOSの場合
            font_paths = [
                "/System/Library/Fonts/Helvetica.ttc",
                "/System/Library/Fonts/Arial Unicode.ttf",
                "/Library/Fonts/Arial.ttf"
            ]
            
            for font_path in font_paths:
                if pathlib.Path(font_path).exists():
                    return ImageFont.truetype(font_path, self.font_size)
            
            # デフォルトフォント
            return ImageFont.load_default()
        except:
            return ImageFont.load_default()
    
    def calculate_text_size(self, text: str) -> Tuple[int, int]:
        """テキストのサイズを計算"""
        bbox = self.font.getbbox(text)
        return bbox[2] - bbox[0], bbox[3] - bbox[1]
    
    def draw_translated_text(self, image_path: str, translation_results: List[Dict[str, Any]], output_path: str = None) -> str:
        """翻訳結果を元画像に描画して保存"""
        # 元画像を読み込み
        original_image = Image.open(image_path)
        
        # RGBA モードに変換（透明度対応）
        if original_image.mode != 'RGBA':
            original_image = original_image.convert('RGBA')
        
        # オーバーレイ用の透明レイヤーを作成
        overlay = Image.new('RGBA', original_image.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)
        
        for result in translation_results:
            try:
                # 座標を取得
                x1, y1 = int(result.get('xmin', 0)), int(result.get('ymin', 0))
                x2, y2 = int(result.get('xmax', 0)), int(result.get('ymax', 0))
                
                # 翻訳されたテキスト
                translated_text = result.get('translated', '')
                if not translated_text or translated_text == 'N/A':
                    continue
                
                # テキストサイズを計算
                text_width, text_height = self.calculate_text_size(translated_text)
                
                # 元のテキスト領域のサイズ
                original_width = x2 - x1
                original_height = y2 - y1
                
                # テキストが元の領域より大きい場合、フォントサイズを調整
                scale_factor = min(original_width / text_width, original_height / text_height) if text_width > 0 and text_height > 0 else 1
                if scale_factor < 1:
                    adjusted_font_size = int(self.font_size * scale_factor * 0.8)  # 少し小さめに調整
                    try:
                        adjusted_font = ImageFont.truetype(self.font.path, adjusted_font_size) if hasattr(self.font, 'path') else self.font
                    except:
                        adjusted_font = self.font
                else:
                    adjusted_font = self.font
                
                # 背景矩形を描画（元のテキストを隠す）
                draw.rectangle([x1, y1, x2, y2], fill=(255, 255, 255, self.bg_alpha))
                
                # 翻訳されたテキストを描画
                text_x = x1 + (original_width - text_width) // 2
                text_y = y1 + (original_height - text_height) // 2
                
                draw.text((text_x, text_y), translated_text, fill=(0, 0, 0, 255), font=adjusted_font)
                
                print(f"Drawn: '{result.get('original', '')}' -> '{translated_text}' at ({x1},{y1})-({x2},{y2})")
                
            except Exception as e:
                print(f"Error drawing text for result {result}: {e}")
                continue
        
        # オーバーレイを元画像に合成
        final_image = Image.alpha_composite(original_image, overlay)
        
        # 出力パスを決定
        if output_path is None:
            input_path = pathlib.Path(image_path)
            output_path = input_path.parent / f"{input_path.stem}_translated{input_path.suffix}"
        
        # RGB モードに変換して保存 (JPEG対応)
        if str(output_path).lower().endswith('.jpg') or str(output_path).lower().endswith('.jpeg'):
            # JPEGの場合は背景を白にする
            white_bg = Image.new('RGB', final_image.size, (255, 255, 255))
            white_bg.paste(final_image, mask=final_image.split()[-1])  # アルファチャンネルをマスクとして使用
            white_bg.save(output_path, 'JPEG', quality=95)
        else:
            # PNGの場合はそのまま保存
            final_image.save(output_path, 'PNG')
        
        print(f"Translated image saved: {output_path}")
        return str(output_path)
    
    def create_comparison_image(self, original_path: str, translated_path: str, output_path: str = None) -> str:
        """元画像と翻訳画像を並べた比較画像を作成"""
        original = Image.open(original_path)
        translated = Image.open(translated_path)
        
        # 同じサイズに調整
        width, height = original.size
        translated = translated.resize((width, height))
        
        # 横に並べた画像を作成
        comparison = Image.new('RGB', (width * 2, height))
        comparison.paste(original, (0, 0))
        comparison.paste(translated, (width, 0))
        
        # 境界線を描画
        draw = ImageDraw.Draw(comparison)
        draw.line([(width, 0), (width, height)], fill=(0, 0, 0), width=2)
        
        if output_path is None:
            input_path = pathlib.Path(original_path)
            output_path = input_path.parent / f"{input_path.stem}_comparison{input_path.suffix}"
        
        comparison.save(output_path)
        print(f"Comparison image saved: {output_path}")
        return str(output_path)
