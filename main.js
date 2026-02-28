const { app, BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

// Load environment variables from project-local .env file
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 開発モード判定 - APIキーがあれば実際のAPIを使用
console.log('🔧 MISTRAL_API_KEY from env:', process.env.MISTRAL_API_KEY ? 'SET' : 'NOT SET');
console.log('🔧 API Key length:', process.env.MISTRAL_API_KEY?.length || 0);

const isDevelopmentMode = (!process.env.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY === '' || 
                          process.env.USE_DEMO_MODE === 'true');

console.log('🔧 開発モード状態:', isDevelopmentMode);
console.log('🔧 環境変数 NODE_ENV:', process.env.NODE_ENV);
console.log('🔧 コマンドライン引数:', process.argv);
console.log('🔧 SKIP_SCREEN_PERMISSION:', process.env.SKIP_SCREEN_PERMISSION);
console.log('🔧 Mistral APIキー有効:', !!process.env.MISTRAL_API_KEY);

// Mistral AI クライアントを初期化
let mistralClient = null;
try {
  const { Mistral } = require('@mistralai/mistralai');
  
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ MISTRAL_API_KEY環境変数が設定されていません。デモモードで動作します。');
  } else {
    mistralClient = new Mistral({ apiKey });
    console.log('✅ Mistral AI クライアントが初期化されました');
  }
} catch (error) {
  console.warn('⚠️ Mistral AI ライブラリの読み込みに失敗:', error.message);
}

let overlayWindow = null;
let isVisible = true;
let isClickThrough = true;
let realtimeTranslationEnabled = false;
let translationInterval = null;
let targetLanguage = '日本語'; // 英語→日本語翻訳に固定
let lastScreenshotHash = null;

// 翻訳言語設定（英→日固定）
function setTranslationLanguage(language) {
  targetLanguage = '日本語'; // 常に日本語に固定
  console.log('🌍 翻訳言語を日本語（英語→日本語）に設定しました');
}

// ── Mistral AI Helper Functions ──────────────────────────────────

async function callMistralLarge(messages, options = {}) {
  if (!mistralClient) {
    throw new Error('Mistral AI クライアントが利用できません');
  }
  
  // 開発モードではモックレスポンスを返す
  if (isDevelopmentMode) {
    console.log('🎭 開発モード: モックAIレスポンスを使用');
    await new Promise(resolve => setTimeout(resolve, 500)); // 遅延をシミュレート
    
    // ユーザーメッセージから内容を抽出して簡易翻訳を返す
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    
    // 簡易的な翻訳パターン
    const translations = {
      'quick': '素早い',
      'brown': '茶色の',
      'fox': '狐',
      'jumps': 'ジャンプする',
      'over': 'を越える',
      'lazy': '怠け者の',
      'dog': '犬',
      'hello': 'こんにちは',
      'world': '世界',
      'settings': '設定',
      'user': 'ユーザー',
      'profile': 'プロフィール'
    };
    
    // 簡易翻訳を返す（1行ずつ）
    const lines = userMessage.split('\\n');
    const translatedLines = lines.map(line => {
      let translated = line;
      Object.entries(translations).forEach(([en, ja]) => {
        const regex = new RegExp(en, 'gi');
        translated = translated.replace(regex, ja);
      });
      return translated.trim();
    }).filter(line => line.length > 0);
    
    return translatedLines.join('\\n');
  }
  
  try {
    const response = await mistralClient.chat.complete({
      model: 'mistral-large-latest',
      messages,
      temperature: options.temperature ?? 0.1,
      maxTokens: options.maxTokens ?? 1000,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Mistral Large API Error:', error);
    throw new Error(`AI処理エラー: ${error.message}`);
  }
}

async function callMistralPixtral(imageData, prompt, options = {}) {
  if (!mistralClient) {
    throw new Error('Mistral AI クライアントが利用できません');
  }
  
  // 開発モードではモック応答を返す（APIエラーを回避）
  if (isDevelopmentMode) {
    console.log('🎭 開発モード: Pixtral OCRのモック応答を使用');
    await new Promise(resolve => setTimeout(resolve, 500)); // APIコール時間をシミュレート
    
    return JSON.stringify({
      detected_text: "The quick brown fox jumps over the lazy dog. Hello World! Settings User Profile",
      text_items: [
        { "text": "The quick brown fox", "x": 50, "y": 100, "width": 200, "height": 30 },
        { "text": "Hello World", "x": 120, "y": 180, "width": 150, "height": 25 },
        { "text": "Settings", "x": 200, "y": 250, "width": 100, "height": 20 },
        { "text": "User Profile", "x": 150, "y": 320, "width": 180, "height": 25 }
      ]
    });
  }
  
  try {
    // Base64画像データあるいはURL形式のimageDataをそのまま使用
    let imageUrl;
    if (typeof imageData === 'string') {
      if (imageData.startsWith('data:image')) {
        // Base64 data URL の場合
        imageUrl = imageData;
      } else if (imageData.startsWith('http')) {
        // HTTPS URL の場合
        imageUrl = imageData;
      } else {
        // その他の場合はそのまま使用
        imageUrl = imageData;
      }
    } else {
      throw new Error('画像データは文字列である必要があります');
    }

    console.log('🔍 Mistral Pixtralで画像をOCR処理中...');
    console.log('📷 画像フォーマット:', imageUrl.substring(0, 50) + '...');
    
    const response = await mistralClient.chat.complete({
      model: 'pixtral-12b-2409', // Mistral Vision モデル
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageUrl  // オブジェクト形式で URL を指定
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ],
      temperature: options.temperature ?? 0.1,
      maxTokens: options.maxTokens ?? 2000
    });
    
    const result = response.choices[0].message.content;
    console.log('✅ Pixtral OCR完了：', result.substring(0, 100) + '...');
    return result;
    
  } catch (error) {
    console.error('❌ Mistral Pixtral API Error:', error.message);
    console.error('❌ エラー詳細:', error);
    throw new Error(`OCR処理エラー: ${error.message}`);
  }
}

// 言語自動検出と双方向翻訳
function detectLanguage(text) {
  // 日本語文字（ひらがな、カタカナ、漢字）を含むかチェック
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  return japaneseRegex.test(text) ? 'japanese' : 'english';
}

function getTargetLanguage(sourceLanguage) {
  return sourceLanguage === 'japanese' ? 'English' : 'Japanese';
}

// 画像形式を修正してBase64をMistral APIに送信
function prepareImageForMistral(imageDataUrl) {
  // data:image/png;base64, プレフィックスを削除してBase64データのみを抽出
  const base64Data = imageDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
  
  // Mistral用の正しい形式に変換（JPEGに変換）
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // JPEGとして出力（Mistralが推奨する形式、トークン制限と品質のバランス）
      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.4);
      resolve(jpegDataUrl);
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}
// 言語自動検出と双方向翻訳
function detectLanguage(text) {
  // 日本語文字（ひらがな、カタカナ、漢字）を含むかチェック
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  return japaneseRegex.test(text) ? 'japanese' : 'english';
}

function getTargetLanguage(sourceLanguage) {
  return sourceLanguage === 'japanese' ? 'English' : 'Japanese';
}

// 正確なOCR処理（Mistral OCR + Mistral Large を使用）
async function performAccurateOCR(imageData) {
  if (!mistralClient) {
    throw new Error('Mistral AI クライアントが利用できません');
  }
  
  // 開発モードではモック結果を返す
  if (isDevelopmentMode) {
    console.log('🎭 開発モード: モック OCR 結果を使用');
    await new Promise(resolve => setTimeout(resolve, 800));

    return {
      words: [
        {
          content: 'The quick brown fox',
          coordinate: {
            top_left: { x: 50, y: 100 },
            bottom_right: { x: 250, y: 130 }
          },
          language: 'english',
          type: 'text',
          context: '画面内テキスト'
        },
        {
          content: 'Settings',
          coordinate: {
            top_left: { x: 200, y: 250 },
            bottom_right: { x: 300, y: 270 }
          },
          language: 'english',
          type: 'ui',
          context: 'メニュー項目'
        },
        {
          content: 'こんにちは世界',
          coordinate: {
            top_left: { x: 150, y: 320 },
            bottom_right: { x: 330, y: 345 }
          },
          language: 'japanese',
          type: 'text',
          context: '画面内テキスト'
        }
      ],
      overall: {
        primary_intent: 'ui_reading',
        dominant_language: 'mixed',
        screen_type: 'other',
        confidence: 0.85
      }
    };
  }
  
  try {
    console.log('🔍 Mistral OCR で画像からテキスト・座標を抽出中...');
    
    // 画像データをそのまま使用（不正な疑似変換は行わない）
    let processedImageData;
    if (imageData.startsWith('data:image/png')) {
      // main processではCanvas変換せず、PNGのままOCRへ渡す
      processedImageData = imageData;
      console.log('📷 PNGデータをそのまま使用');
    } else {
      processedImageData = imageData;
    }
    
    console.log('📤 Mistral OCR API呼び出しパラメータ:');
    console.log('- Model:', 'mistral-ocr-latest');
    console.log('- 画像データ形式:', typeof processedImageData);
    console.log('- 画像データサイズ:', processedImageData ? processedImageData.length : 'null');
    console.log('- 画像プレフィックス:', processedImageData ? processedImageData.substring(0, 30) + '...' : 'null');

    const ocrResponse = await mistralClient.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        imageUrl: processedImageData
      }
    });

    const ocrData = typeof ocrResponse?.model_dump_json === 'function'
      ? JSON.parse(ocrResponse.model_dump_json())
      : JSON.parse(JSON.stringify(ocrResponse));

    // デバッグ: OCRレスポンス全体をファイルに保存
    try {
      await fs.writeFile(
        path.join(__dirname, 'ocr_response_debug.json'),
        JSON.stringify(ocrData, null, 2),
        'utf-8'
      );
      console.log('📊 OCRレスポンスをocr_response_debug.jsonに保存しました');
    } catch (err) {
      console.warn('⚠️ OCRレスポンスの保存に失敗:', err.message);
    }
    
    // デバッグ: OCRレスポンス構造をログ出力
    console.log('📊 OCRレスポンス構造 (最初の500文字):');
    console.log(JSON.stringify(ocrData).substring(0, 500));
    console.log('📊 Pages数:', Array.isArray(ocrData?.pages) ? ocrData.pages.length : 0);
    if (Array.isArray(ocrData?.pages) && ocrData.pages.length > 0) {
      const firstPage = ocrData.pages[0];
      console.log('📊 最初のPage構造:');
      console.log('  - Keys:', Object.keys(firstPage).join(', '));
      console.log('  - Markdown全体の長さ:', (firstPage.markdown || '').length, '文字');
      console.log('  - Markdown全文:');
      console.log('--- Markdown Start ---');
      console.log(firstPage.markdown || '(empty)');
      console.log('--- Markdown End ---');
      
      // images配列の詳細確認
      if (Array.isArray(firstPage.images) && firstPage.images.length > 0) {
        console.log('📊 Images配列の最初の要素:');
        console.log('  - Keys:', Object.keys(firstPage.images[0]).join(', '));
        console.log('  - 座標値:', JSON.stringify({
          topLeftX: firstPage.images[0].topLeftX,
          topLeftY: firstPage.images[0].topLeftY,
          bottomRightX: firstPage.images[0].bottomRightX,
          bottomRightY: firstPage.images[0].bottomRightY
        }));
      }
    }

    const extractedByCoords = extractTextAndCoords(ocrData)
      .filter(item => typeof item.text === 'string' && item.text.trim())
      .map(item => ({
        text: item.text,
        normalizedText: item.text.trim(),
        xmin: Number.isFinite(item.xmin) ? item.xmin : 0,
        ymin: Number.isFinite(item.ymin) ? item.ymin : 0,
        xmax: Number.isFinite(item.xmax) ? item.xmax : 0,
        ymax: Number.isFinite(item.ymax) ? item.ymax : 0
      }));

    console.log('📊 座標ベース抽出結果:', extractedByCoords.length, '個');
    if (extractedByCoords.length > 0) {
      console.log('📊 最初の3要素サンプル:', JSON.stringify(extractedByCoords.slice(0, 3), null, 2));
    }

    const fallbackByMarkdown = extractTextAndCoordsFromPages(ocrData).map(item => ({
      text: item.text,
      normalizedText: item.text.trim(),
      xmin: Number.isFinite(item.xmin) ? item.xmin : 0,
      ymin: Number.isFinite(item.ymin) ? item.ymin : 0,
      xmax: Number.isFinite(item.xmax) ? item.xmax : 0,
      ymax: Number.isFinite(item.ymax) ? item.ymax : 0
    }));

    console.log('📊 Markdownベース抽出結果:', fallbackByMarkdown.length, '個');
    if (fallbackByMarkdown.length > 0) {
      console.log('📊 最初の3要素サンプル:', JSON.stringify(fallbackByMarkdown.slice(0, 3), null, 2));
    }

    const rawResults = extractedByCoords.length > 0 ? extractedByCoords : fallbackByMarkdown;

    const dedupedResults = [];
    const seen = new Set();
    for (const item of rawResults) {
      const key = `${item.normalizedText}__${item.xmin}__${item.ymin}__${item.xmax}__${item.ymax}`;
      if (!seen.has(key)) {
        seen.add(key);
        dedupedResults.push(item);
      }
    }

    console.log('✅ Mistral OCR完了: 単語', dedupedResults.length, '個を検出');
    if (extractedByCoords.length === 0 && fallbackByMarkdown.length > 0) {
      console.log('ℹ️ 座標付きOCRが空だったため、markdownベース抽出にフォールバックしました');
    }

    let metadataByIndex = new Map();
    let overallAnalysis = {
      primary_intent: 'ui_reading',
      dominant_language: 'mixed',
      screen_type: 'other',
      confidence: 0.7
    };

    if (dedupedResults.length > 0) {
      const metadataPrompt = `以下はMistral OCRで抽出したテキストです。contentはOCR原文として絶対に変更しないでください。
    language/type/contextのみを判定してください。

入力:
    ${JSON.stringify(dedupedResults.map((item, index) => ({ index, content: item.text })), null, 2)}

次のJSONだけを返してください:
{
  "items": [
    {
      "index": 0,
      "language": "English|Japanese|Chinese|Korean|Mixed",
      "type": "text|code|ui|button|label|heading|link",
      "context": "短く具体的に（例: メニュー項目）"
    }
  ],
  "overall_analysis": {
    "primary_intent": "translation|code_explanation|ui_reading|documentation",
    "dominant_language": "English|Japanese|Chinese|Korean|Mixed",
    "screen_type": "app|web|doc|editor|other",
    "confidence": 0.0
  }
}`;

      try {
        const metadataResponse = await mistralClient.chat.complete({
          model: 'mistral-large-latest',
          messages: [{ role: 'user', content: metadataPrompt }],
          temperature: 0.1,
          maxTokens: 2000,
          responseFormat: { type: 'json_object' }
        });

        let metadataContent = metadataResponse.choices?.[0]?.message?.content;
        if (typeof metadataContent !== 'string') {
          metadataContent = JSON.stringify(metadataContent || {});
        }

        const parsedMetadata = JSON.parse(metadataContent);
        const metaItems = Array.isArray(parsedMetadata.items) ? parsedMetadata.items : [];

        metadataByIndex = new Map(
          metaItems
            .filter(item => Number.isInteger(item.index))
            .map(item => [item.index, item])
        );

        if (parsedMetadata.overall_analysis && typeof parsedMetadata.overall_analysis === 'object') {
          overallAnalysis = {
            primary_intent: parsedMetadata.overall_analysis.primary_intent || overallAnalysis.primary_intent,
            dominant_language: parsedMetadata.overall_analysis.dominant_language || overallAnalysis.dominant_language,
            screen_type: parsedMetadata.overall_analysis.screen_type || overallAnalysis.screen_type,
            confidence: typeof parsedMetadata.overall_analysis.confidence === 'number'
              ? parsedMetadata.overall_analysis.confidence
              : overallAnalysis.confidence
          };
        }
      } catch (metadataError) {
        console.warn('⚠️ Mistral AIメタデータ整形に失敗。フォールバックを使用:', metadataError.message);
      }
    }

    const wordResults = dedupedResults.map((item, index) => {
      const metadata = metadataByIndex.get(index) || {};
      const hasJapanese = /[\u3040-\u30FF\u4E00-\u9FFF]/.test(item.text);
      const hasEnglish = /[a-zA-Z]/.test(item.text);
      const fallbackLanguage = hasJapanese && !hasEnglish
        ? 'Japanese'
        : hasEnglish && !hasJapanese
          ? 'English'
          : 'Mixed';

      // 言語値を正規化（大文字で統一）
      let language = metadata.language || fallbackLanguage;
      language = String(language)
        .replace(/^english$/i, 'English')
        .replace(/^japanese$/i, 'Japanese')
        .replace(/^chinese$/i, 'Chinese')
        .replace(/^korean$/i, 'Korean')
        .replace(/^mixed$/i, 'Mixed');

      return {
        content: item.text,
        coordinate: {
          top_left: { x: item.xmin, y: item.ymin },
          bottom_right: { x: item.xmax, y: item.ymax }
        },
        language: language,
        type: metadata.type || 'text',
        context: metadata.context || '画面内テキスト'
      };
    });

    if (overallAnalysis.dominant_language === 'mixed' && wordResults.length > 0) {
      const languageCounts = wordResults.reduce((acc, item) => {
        acc[item.language] = (acc[item.language] || 0) + 1;
        return acc;
      }, {});
      const dominant = Object.entries(languageCounts).sort((a, b) => b[1] - a[1])[0];
      if (dominant) {
        overallAnalysis.dominant_language = dominant[0];
      }
    }

    // 全体言語を正規化
    overallAnalysis.dominant_language = String(overallAnalysis.dominant_language)
      .replace(/^english$/i, 'English')
      .replace(/^japanese$/i, 'Japanese')
      .replace(/^chinese$/i, 'Chinese')
      .replace(/^korean$/i, 'Korean')
      .replace(/^mixed$/i, 'Mixed');

    console.log('📊 全体分析:', JSON.stringify(overallAnalysis, null, 2));
    
    if (wordResults.length === 0) {
      console.log('🔍 デバッグ: 分析レスポンスの詳細を確認');
      console.log(JSON.stringify(ocrData, null, 2));
    }

    // 新形式のデータを返す（単語ごとの詳細情報）
    return {
      words: wordResults,
      overall: overallAnalysis
    };
    
  } catch (error) {
    console.error('❌ Mistral OCR API Error:', error);
    
    // 詳細なエラー情報をログ出力
    if (error.statusCode) {
      console.error('📊 HTTPステータス:', error.statusCode);
    }
    if (error.body) {
      console.error('📄 エラーレスポンス:', error.body);
    }
    if (error.headers) {
      console.error('📋 レスポンスヘッダー:', Object.fromEntries(error.headers));
    }
    
    // より具体的なエラーメッセージ
    let errorMessage = `OCR処理エラー: ${error.message}`;
    if (error.statusCode === 400) {
      errorMessage = `API入力検証エラー (400): 画像フォーマットまたはリクエスト形式が無効です。${error.message}`;
    } else if (error.statusCode === 401) {
      errorMessage = 'API認証エラー (401): APIキーが無効または期限切れです。';
    } else if (error.statusCode === 429) {
      errorMessage = 'API使用量制限エラー (429): 使用量制限に達しました。';
    }
    
    throw new Error(errorMessage);
  }
}

// text.pyのextract_text_and_coords関数を移植
function extractTextAndCoords(data) {
  const results = [];
  
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      // 配列の場合、各要素を再帰処理
      for (const item of data) {
        results.push(...extractTextAndCoords(item));
      }
    } else {
      // オブジェクトの場合（OCR原文候補はcontent/textのみ）
      const content = data.content || data.text;
      const coords = data.coordinates || data.coordinate || data.bbox || data.box || data.position;
      
      if (content && coords) {
        const left = coords.x_min ?? coords.xmin ?? coords.left ?? coords.x0 ?? coords.min_x;
        const top = coords.y_min ?? coords.ymin ?? coords.top ?? coords.y0 ?? coords.min_y;
        const right = coords.x_max ?? coords.xmax ?? coords.right ?? coords.x1 ?? coords.max_x;
        const bottom = coords.y_max ?? coords.ymax ?? coords.bottom ?? coords.y1 ?? coords.max_y;

        const xmin = Number(left ?? NaN);
        const ymin = Number(top ?? NaN);
        const xmax = Number(right ?? NaN);
        const ymax = Number(bottom ?? NaN);

        if ([xmin, ymin, xmax, ymax].every(Number.isFinite) && xmax >= xmin && ymax >= ymin) {
          results.push({
            text: String(content),
            xmin,
            ymin,
            xmax,
            ymax
          });
        }
      }

      if (content && data.x != null && data.y != null && data.width != null && data.height != null) {
        const x = Number(data.x);
        const y = Number(data.y);
        const width = Number(data.width);
        const height = Number(data.height);

        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height)) {
          results.push({
            text: String(content),
            xmin: x,
            ymin: y,
            xmax: x + width,
            ymax: y + height
          });
        }
      }
      
      // さらに深い階層を探索
      for (const [key, value] of Object.entries(data)) {
        if (
          key !== 'content' &&
          key !== 'text' &&
          key !== 'coordinates' &&
          key !== 'coordinate' &&
          key !== 'bbox' &&
          key !== 'markdown' &&
          key !== 'html'
        ) {
          results.push(...extractTextAndCoords(value));
        }
      }
    }
  }
  
  return results;
}

function extractTextAndCoordsFromPages(ocrData) {
  const results = [];
  const pages = Array.isArray(ocrData?.pages) ? ocrData.pages : [];

  for (const page of pages) {
    const markdown = typeof page?.markdown === 'string' ? page.markdown : '';
    if (!markdown.trim()) {
      continue;
    }

    // Markdownから全てのテキストを抽出（マークダウン記号を除去）
    const cleanedMarkdown = markdown
      // 画像マークダウンを除去
      .replace(/!\[[^\]]*\]\([^\)]*\)/g, '')
      // リンクマークダウンをテキストのみに変換 [text](url) -> text
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // コードブロックを除去
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // 見出し記号を除去
      .replace(/^#{1,6}\s+/gm, '')
      // リスト記号を除去
      .replace(/^[\*\-\+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // 水平線を除去
      .replace(/^[\*\-_]{3,}$/gm, '')
      // 強調記号を除去
      .replace(/\*\*([^\*]+)\*\*/g, '$1')
      .replace(/\*([^\*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .trim();

    if (!cleanedMarkdown) {
      continue;
    }

    // 改行で分割して行ごとに処理
    const lines = cleanedMarkdown
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      continue;
    }

    const imageBox = Array.isArray(page?.images) && page.images.length > 0 ? page.images[0] : null;
    const left = Number(imageBox?.topLeftX ?? 0);
    const top = Number(imageBox?.topLeftY ?? 0);
    const right = Number(imageBox?.bottomRightX ?? page?.dimensions?.width ?? 960);
    const bottom = Number(imageBox?.bottomRightY ?? page?.dimensions?.height ?? 504);

    const pageWidth = right - left;
    const pageHeight = bottom - top;

    // 全ての行のテキストを単語またはフレーズレベルで分割
    const allTextElements = [];
    
    lines.forEach((line) => {
      // 日本語と英語が混在する場合を考慮して適切に分割
      // 空白で区切られたトークンに分割
      const tokens = line.split(/\s+/).filter(t => t.length > 0);
      
      if (tokens.length === 0) {
        // 空白がない場合（日本語のみなど）は行全体を1要素として扱う
        allTextElements.push(line);
      } else {
        // トークンがある場合はそれぞれを追加
        tokens.forEach(token => {
          allTextElements.push(token);
        });
      }
    });

    if (allTextElements.length === 0) {
      continue;
    }

    // 各テキスト要素に座標を割り当て
    const elementHeight = Math.max(1, Math.floor(pageHeight / allTextElements.length));

    allTextElements.forEach((text, index) => {
      const ymin = top + (index * elementHeight);
      const ymax = index === allTextElements.length - 1 ? bottom : Math.min(bottom, ymin + elementHeight);

      // テキストの長さに基づいてx座標を推定
      const textLength = Array.from(text).reduce((acc, char) => {
        return acc + (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(char) ? 2 : 1);
      }, 0);

      // 最大幅を40文字程度と仮定
      const estimatedWidthRatio = Math.min(1.0, textLength / 40);
      const estimatedWidth = pageWidth * estimatedWidthRatio * 0.8;
      
      // 左寄せを仮定
      const xmin = left + (pageWidth * 0.05);
      const xmax = Math.min(right, xmin + estimatedWidth);

      results.push({
        text: text,
        xmin: Math.round(xmin),
        ymin: Math.round(ymin),
        xmax: Math.round(xmax),
        ymax: Math.round(ymax)
      });
    });
  }

  return results;
}



// 双方向翻訳のための言語検出機能
async function detectLanguage(text) {
  // 日本語文字（ひらがな・カタカナ・漢字）の判定
  const japaneseRegex = /[ひらがなカタカナ一-龯]/;
  const hasJapanese = japaneseRegex.test(text);
  
  // 英語文字の判定
  const englishRegex = /[a-zA-Z]/;
  const hasEnglish = englishRegex.test(text);
  
  // 基本的なヒューリスティック判定
  if (hasJapanese && !hasEnglish) {
    return 'japanese';
  } else if (hasEnglish && !hasJapanese) {
    return 'english';
  } else if (hasJapanese && hasEnglish) {
    // 混在している場合は日本語文字の割合で判定
    const japaneseCount = (text.match(japaneseRegex) || []).length;
    const totalCount = text.length;
    return (japaneseCount / totalCount > 0.3) ? 'japanese' : 'english';
  } else {
    // 判定不可能な場合は英語とみなす
    return 'english';
  }
}

// ターゲット言語を決定する関数
function getTargetLanguage(detectedLanguage) {
  switch (detectedLanguage) {
    case 'japanese':
      return 'English';  // 日本語 → 英語
    case 'english':
      return 'Japanese'; // 英語 → 日本語
    default:
      return 'Japanese'; // デフォルトは日本語
  }
}

// 翻訳処理（text.pyのロジックを移植、双方向対応）
async function translateTextsWithMistral(texts, targetLanguage = null) {
  if (!mistralClient || texts.length === 0) {
    return texts;
  }
  
  // ターゲット言語が指定されていない場合は自動検出
  let finalTargetLanguage = targetLanguage;
  if (!finalTargetLanguage && texts.length > 0) {
    const detectedLang = await detectLanguage(texts.join(' '));
    finalTargetLanguage = getTargetLanguage(detectedLang);
    console.log('🔍 言語自動検出結果:', detectedLang, '→', finalTargetLanguage);
  }
  
  // 開発モードでは簡易翻訳を返す
  if (isDevelopmentMode) {
    console.log('🎭 開発モード: モック翻訳結果を使用');
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // 双方向のモック翻訳データ
    const mockTranslationsEn = {
      'The quick brown fox': '素早い茶色い狐',
      'jumps over the lazy dog': '怠けた犬を飛び越える',
      'Hello World': 'こんにちは世界',
      'Settings': '設定',
      'User Profile': 'ユーザープロフィール'
    };
    
    const mockTranslationsJa = {
      'こんにちは': 'Hello',
      'こんにちは世界': 'Hello World',
      '設定': 'Settings',
      'ユーザープロフィール': 'User Profile',
      '素早い茶色い狐': 'The quick brown fox'
    };
    
    const mockData = finalTargetLanguage === 'Japanese' ? mockTranslationsEn : mockTranslationsJa;
    return texts.map(text => mockData[text] || `翻訳: ${text} (${finalTargetLanguage})`);
  }
  
  try {
    const prompt = `Translate the following texts to ${finalTargetLanguage}. Return JSON with 'translations' key: ${JSON.stringify(texts, null, 0)}`;
    
    console.log(`🌐 Mistral Largeで翻訳処理中... (${finalTargetLanguage})`, texts.length, 'items');
    
    const response = await mistralClient.chat.complete({
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000
    });
    
    const responseContent = response.choices[0].message.content;
    
    // JSON部分のみを抽出（```json ... ```で囲まれている場合に対応）
    let jsonText = responseContent;
    const jsonMatch = responseContent.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }
    
    const translationData = JSON.parse(jsonText);
    const translations = translationData.translations || [];
    
    console.log('✅ 翻訳完了:', translations.length, 'items');
    
    // 翻訳結果の数が元のテキスト数と合わない場合の対処
    if (translations.length !== texts.length) {
      console.log('⚠️ 翻訳結果数の不一致を修正:', texts.length, '->', translations.length);
      while (translations.length < texts.length) {
        translations.push(texts[translations.length]);
      }
    }
    
    return translations;
    
  } catch (error) {
    console.error('❌ Translation Error:', error);
    // エラー時は元のテキストをそのまま返す
    return texts.map(text => `[翻訳エラー] ${text}`);
  }
}

async function classifyIntent(inputText) {
  if (!mistralClient) {
    // フォールバック: キーワードベースの簡単な分類
    const text = inputText.toLowerCase();
    if (text.includes('翻訳') || text.includes('translate') || text.includes('英語') || text.includes('日本語')) {
      return { intent: 'translation', confidence: 0.9 };
    }
    if (text.includes('コード') || text.includes('プログラム') || text.includes('バグ')) {
      return { intent: 'coding', confidence: 0.8 };
    }
    return { intent: 'general', confidence: 0.7 };
  }

  const prompt = `以下のテキストから、ユーザーの意図を分析してください。
可能な意図：
- "translation": 翻訳が必要
- "coding": プログラミングサポート・コード解説  
- "general": 一般的な質問・会話

入力: "${inputText}"

JSON形式で回答してください:
{"intent": "translation|coding|general", "confidence": 0.95}`;

  try {
    const messages = [{ role: 'user', content: prompt }];
    const response = await callMistralLarge(messages, { temperature: 0.1, maxTokens: 100 });
    return JSON.parse(response);
  } catch (error) {
    console.error('Intent classification error:', error);
    return { intent: 'general', confidence: 0.5 };
  }
}

async function captureScreenshot() {
  console.log('📸 スクリーンキャプチャを試行中...');
  
  // Screen Recording権限をチェック (macOS)
  if (process.platform === 'darwin') {
    const { systemPreferences } = require('electron');
    const hasScreenPermission = systemPreferences.getMediaAccessStatus('screen') === 'granted';
    
    if (!hasScreenPermission) {
      console.log('⚠️ Screen Recording権限が必要です');
      systemPreferences.askForMediaAccess('screen');
    }
  }
  
  try {
    // 実際のスクリーンキャプチャを試行（精度向上のため少し拡大）
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: 960,
        height: 600
      }
    });

    if (sources.length > 0) {
      const screenshot = sources[0].thumbnail;
      
      // サイズチェック - 0x0の場合は権限問題と判断
      const size = screenshot.getSize();
      if (size.width === 0 || size.height === 0) {
        throw new Error('Screen Recording権限が必要です。システム環境設定 > セキュリティとプライバシー > プライバシー > 画面収録 でこのアプリを許可してください。');
      }

      // 画面全体をOCRで解析（クロッピングなし）
      const dataURL = screenshot.toDataURL();
      
      // 実際のキャプチャ成功
      console.log('✅ 実際のスクリーンキャプチャに成功しました！');
      console.log('📊 キャプチャサイズ（画面全体）:', size);
      console.log('📄 データサイズ:', Math.round(dataURL.length / 1024), 'KB'); 
      
      // スクリーンショットを保存
      await saveScreenshot(dataURL);
      
      // Create a simple hash to detect screen changes
      const hash = require('crypto').createHash('md5').update(dataURL).digest('hex');
      
      // UIにキャプチャした画像と成功を通知
      if (overlayWindow) {
        overlayWindow.webContents.send('screenshot-status', {
          success: true,
          message: '✅ 実際のスクリーンキャプチャに成功',
          size: { width: size.width, height: size.height },
          dataSize: Math.round(dataURL.length / 1024) + 'KB',
          imagePreview: dataURL // 画面全体の画像
        });
      }
      
      return {
        dataURL,
        hash,
        timestamp: Date.now(),
        isReal: true
      };
    } else {
      throw new Error('スクリーンキャプチャソースが見つかりません');
    }
  } catch (error) {
    console.error('❌ 実際のスクリーンキャプチャに失敗:', error.message);

    // UIに失敗状態を通知
    if (overlayWindow) {
      overlayWindow.webContents.send('screenshot-status', {
        success: false,
        message: '❌ スクリーンキャプチャに失敗しました（モックは使用しません）',
        error: error.message,
        fallback: false
      });
    }

    throw error;
  }
}

// スクリーンショット保存機能
async function saveScreenshot(dataURL) {
  try {
    // Base64データから画像データを抽出
    const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 保存パス（プロジェクトルートのscreenshot.png）
    const savePathPng = path.join(__dirname, 'screenshot.png');
    
    // PNG形式で保存（上書き保存）
    await fs.promises.writeFile(savePathPng, buffer);
    console.log('💾 スクリーンショットを保存しました:', savePathPng);
    
    // ファイルサイズを確認
    const stats = await fs.promises.stat(savePathPng);
    const fileSizeKB = Math.round(stats.size / 1024);
    console.log('📏 保存ファイルサイズ:', fileSizeKB, 'KB');
    
    // UIに保存完了を通知
    if (overlayWindow) {
      overlayWindow.webContents.send('screenshot-saved', {
        success: true,
        filePath: savePathPng,
        fileName: 'screenshot.png',
        sizeKB: fileSizeKB,
        timestamp: new Date().toLocaleString()
      });
    }
    
    return {
      success: true,
      filePath: savePathPng,
      sizeKB: fileSizeKB
    };
    
  } catch (error) {
    console.error('❌ スクリーンショット保存エラー:', error.message);
    
    // UIに保存失敗を通知
    if (overlayWindow) {
      overlayWindow.webContents.send('screenshot-saved', {
        success: false,
        error: error.message
      });
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// JSON分析結果を保存する関数
function formatAnalysisText(analysisData) {
  const words = Array.isArray(analysisData?.words) ? analysisData.words : [];
  const overall = analysisData?.overall || {};
  const lines = [];

  lines.push('=== Mistral OCR Analysis Result ===');
  lines.push(`timestamp: ${analysisData?.timestamp || new Date().toISOString()}`);
  lines.push(`status: ${analysisData?.status || 'success'}`);
  lines.push(`elements_detected: ${words.length}`);
  lines.push(`primary_intent: ${overall.primary_intent || 'unknown'}`);
  lines.push(`dominant_language: ${overall.dominant_language || 'mixed'}`);
  lines.push(`screen_type: ${overall.screen_type || 'other'}`);
  lines.push('');

  if (words.length === 0) {
    lines.push('No OCR text extracted.');
  } else {
    lines.push('--- Extracted Texts (with coordinates) ---');
    words.forEach((word, index) => {
      const topLeft = word?.coordinate?.top_left || { x: 0, y: 0 };
      const bottomRight = word?.coordinate?.bottom_right || { x: 0, y: 0 };
      lines.push(`[${index + 1}] content: ${word?.content || ''}`);
      lines.push(`    top_left: (${topLeft.x}, ${topLeft.y})`);
      lines.push(`    bottom_right: (${bottomRight.x}, ${bottomRight.y})`);
      lines.push(`    language: ${word?.language || 'unknown'}`);
      lines.push(`    type: ${word?.type || 'text'}`);
      lines.push(`    context: ${word?.context || 'N/A'}`);
      lines.push('');
    });
  }

  if (analysisData?.error) {
    lines.push('--- Error ---');
    lines.push(String(analysisData.error));
  }

  return lines.join('\n');
}

async function saveAnalysisResult(analysisData) {
  try {
    // JSON形式に整形
    const jsonContent = JSON.stringify(analysisData, null, 2);
    
    // 保存パス（プロジェクトルートのanalysis_result.json）
    const savePathJson = path.join(__dirname, 'analysis_result.json');
    
    // JSON形式で保存（上書き保存）
    await fs.promises.writeFile(savePathJson, jsonContent, 'utf-8');
    console.log('💾 分析結果JSONを保存しました:', savePathJson);

    // TXT形式でも保存（抽出テキストと座標を確認しやすくする）
    const savePathTxt = path.join(__dirname, 'analysis_result.txt');
    const textContent = formatAnalysisText(analysisData);
    await fs.promises.writeFile(savePathTxt, textContent, 'utf-8');
    console.log('📝 分析結果TXTを保存しました:', savePathTxt);
    
    // ファイルサイズを確認
    const stats = await fs.promises.stat(savePathJson);
    const fileSizeKB = Math.round(stats.size / 1024);
    console.log('📏 JSONファイルサイズ:', fileSizeKB, 'KB');

    const txtStats = await fs.promises.stat(savePathTxt);
    const txtFileSizeKB = Math.round(txtStats.size / 1024);
    console.log('📏 TXTファイルサイズ:', txtFileSizeKB, 'KB');
    
    // UIに保存完了を通知
    if (overlayWindow) {
      overlayWindow.webContents.send('json-saved', {
        success: true,
        filePath: savePathJson,
        fileName: 'analysis_result.json',
        sizeKB: fileSizeKB,
        textFilePath: savePathTxt,
        textFileName: 'analysis_result.txt',
        textSizeKB: txtFileSizeKB,
        timestamp: new Date().toLocaleString()
      });
    }
    
    return {
      success: true,
      filePath: savePathJson,
      sizeKB: fileSizeKB,
      textFilePath: savePathTxt,
      textSizeKB: txtFileSizeKB
    };
    
  } catch (error) {
    console.error('❌ JSON保存エラー:', error.message);
    
    // UIに保存失敗を通知
    if (overlayWindow) {
      overlayWindow.webContents.send('json-saved', {
        success: false,
        error: error.message
      });
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// リアルタイム翻訳機能
async function startRealtimeTranslation() {
  if (realtimeTranslationEnabled) {
    console.log('リアルタイム翻訳は既に有効です');
    return;
  }
  
  realtimeTranslationEnabled = true;
  console.log('🌐 リアルタイム翻訳を開始します');
  
  // 権限を完全にスキップしてデモモードで開始
  console.log('🚀 権限チェックをスキップしてデモ翻訳を開始');
  startDemoTranslation();
  return;
  
  translationInterval = setInterval(async () => {
    try {
      const screenshot = await captureScreenshot();
      
      // 画面が変更されていない場合はスキップ
      if (lastScreenshotHash === screenshot.hash) {
        return;
      }
      
      lastScreenshotHash = screenshot.hash;
      
      // 翻訳処理
      const translationResult = await processScreenshotWithOCR({ realtime: true });
      
      // UIに結果を送信
      if (overlayWindow) {
        overlayWindow.webContents.send('realtime-translation-result', translationResult);
      }
      
    } catch (error) {
      console.error('リアルタイム翻訳エラー:', error);
      // エラー時はデモモードにフォールバック
      if (error.message.includes('Failed to get sources')) {
        console.log('📱 デモモードに切り替えます');
        startDemoTranslation();
      }
    }
  }, 3000); // 3秒間隔で実行
}

// スクリーンキャプチャ権限チェック（完全に無効化）
async function checkScreenCapturePermission() {
  // 常にtrueを返す（権限チェックを完全にスキップ）
  console.log('✅ スクリーンキャプチャ権限チェックを完全にスキップします');
  return true; // 常にtrueを返す
}

// デモ翻訳機能（権限がない場合）
function startDemoTranslation() {
  const demoTexts = [
    {
      original: "Hello World",
      japanese: "こんにちは世界",
      position: { x: 100, y: 100 }
    },
    {
      original: "Welcome to our website",
      japanese: "私たちのウェブサイトへようこそ",
      position: { x: 300, y: 200 }
    },
    {
      original: "Click here to continue",
      japanese: "続行するにはここをクリック",
      position: { x: 500, y: 300 }
    },
    {
      original: "Settings",
      japanese: "設定",
      position: { x: 200, y: 400 }
    }
  ];

  let demoIndex = 0;
  translationInterval = setInterval(() => {
    const demoData = demoTexts[demoIndex % demoTexts.length];
    const result = {
      id: Date.now(),
      translations: [demoData],
      timestamp: new Date(),
      status: 'demo',
      realtime: true
    };
    
    if (overlayWindow) {
      overlayWindow.webContents.send('realtime-translation-result', result);
    }
    
    demoIndex++;
  }, 4000); // 4秒間隔でデモデータ
}

function stopRealtimeTranslation() {
  if (!realtimeTranslationEnabled) {
    return;
  }
  
  realtimeTranslationEnabled = false;
  
  if (translationInterval) {
    clearInterval(translationInterval);
    translationInterval = null;
  }
  
  lastScreenshotHash = null;
  console.log('🛑 リアルタイム翻訳を停止しました');
}

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().bounds; // Use bounds instead of workAreaSize for full screen

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    focusable: true,
    fullscreenable: false,
    type: 'panel',
    vibrancy: undefined,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Keep on top of everything including fullscreen apps
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Start in click-through mode
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Load the webpack-built renderer
  overlayWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.on('set-click-through', (_event, enabled) => {
  if (!overlayWindow) return;
  isClickThrough = enabled;
  if (enabled) {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWindow.setIgnoreMouseEvents(false);
  }
});

ipcMain.on('set-overlay-bounds', (_event, bounds) => {
  if (!overlayWindow) return;
  overlayWindow.setBounds(bounds);
});

ipcMain.handle('get-display-size', () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { width, height };
});

ipcMain.on('hide-overlay', () => {
  if (overlayWindow) {
    overlayWindow.hide();
    isVisible = false;
  }
});

// ── Real AI Processing Handlers ──────────────────────────────────

async function processWithMistral(inputText, inputType = 'text', options = {}) {
  const startTime = Date.now();
  
  try {
    // 意図を分類
    const intent = await classifyIntent(inputText);
    console.log(`🎯 Intent: ${intent.intent} (confidence: ${intent.confidence})`);
    
    let result;
    
    if (intent.intent === 'translation') {
      // 翻訳処理
      const translationPrompt = `以下のテキストを自然な日本語に翻訳してください。既に日本語の場合は、より自然で読みやすい表現に改善してください。

テキスト: "${inputText}"

翻訳結果のみを返答してください:`;

      const messages = [{ role: 'user', content: translationPrompt }];
      result = await callMistralLarge(messages, { temperature: 0.2 });
      
    } else if (intent.intent === 'coding') {
      // プログラミングサポート
      const codingPrompt = `以下のプログラミング関連の質問に、わかりやすく日本語でお答えください。コード例があれば含めてください。

質問: "${inputText}"`;

      const messages = [{ role: 'user', content: codingPrompt }];
      result = await callMistralLarge(messages, { temperature: 0.1 });
      
    } else {
      // 一般的な質問
      const generalPrompt = `以下の質問に、親切で分かりやすい日本語でお答えください。

質問: "${inputText}"`;

      const messages = [{ role: 'user', content: generalPrompt }];
      result = await callMistralLarge(messages, { temperature: 0.3 });
    }
    
    return {
      id: Date.now(),
      text: result,
      timestamp: new Date(),
      intent: intent.intent,
      confidence: intent.confidence,
      status: 'success',
      processingTime: Date.now() - startTime,
      inputType: inputType
    };
    
  } catch (error) {
    console.error('AI Processing Error:', error);
    
    // フォールバック応答
    const fallbackMessages = {
      translation: `[フォールバック] 翻訳処理でエラーが発生しました: ${error.message}`,
      coding: `[フォールバック] コード解析でエラーが発生しました: ${error.message}`,
      general: `[フォールバック] 回答生成でエラーが発生しました: ${error.message}`
    };
    
    const intent = await classifyIntent(inputText);
    
    return {
      id: Date.now(),
      text: fallbackMessages[intent.intent] || fallbackMessages.general,
      timestamp: new Date(),
      intent: intent.intent,
      confidence: 0.1,
      status: 'error',
      processingTime: Date.now() - startTime,
      inputType: inputType,
      error: error.message
    };
  }
}

async function processScreenshotWithOCR(options = {}) {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Mistral OCR + Mistral AI 分析プロセスを開始...');
    
    // ステップ1: スクリーンショットを取得
    const screenshot = await captureScreenshot();
    console.log('📸 スクリーンショット取得完了:', screenshot.dataURL ? Math.round(screenshot.dataURL.length / 1024) + 'KB' : 'unknown');
    
    // ステップ2: Mistral OCR + Mistral AI で包括分析（OCR + 意図分析 - 単語ごと）
    const analysisResult = await performAccurateOCR(screenshot.dataURL || screenshot);
    console.log('🔍 包括分析完了:', analysisResult.words.length, '単語');
    
    if (analysisResult.words.length === 0) {
      console.log('⚠️ 分析で抽出された単語がありません');

      const emptyAnalysisResult = {
        words: [],
        overall: analysisResult.overall || {
          primary_intent: 'ui_reading',
          dominant_language: 'mixed',
          screen_type: 'other',
          confidence: 0.0
        },
        intent: {
          type: analysisResult.overall?.primary_intent || 'reading',
          confidence: analysisResult.overall?.confidence || 0.0
        },
        translation_direction: {
          source_language: analysisResult.overall?.dominant_language || 'mixed',
          target_language: 'japanese',
          reasoning: 'No OCR text extracted'
        },
        screen_context: {
          screen_type: analysisResult.overall?.screen_type || 'other',
          elements_detected: 0
        },
        status: 'no_text_found',
        error: null,
        timestamp: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime
      };

      await saveAnalysisResult(emptyAnalysisResult);

      return {
        id: Date.now(),
        text: '抽出された単語がありません',
        ocrText: '',
        imagePreview: screenshot.dataURL,
        translations: [],
        analysisResult: emptyAnalysisResult,
        timestamp: new Date(),
        intent: analysisResult.overall?.primary_intent || 'reading',
        confidence: analysisResult.overall?.confidence || 0.5,
        status: 'no_text_found',
        processingTime: Date.now() - startTime,
        inputType: 'screenshot',
        realtime: options.realtime || false,
        isScreenOverlay: true
      };
    }
    
    const targetLanguage = analysisResult.overall?.dominant_language === 'japanese' ? 'english' : 'japanese';

    console.log('✅ 包括分析処理完了:', analysisResult.words.length, '件');
    console.log('🎯 検出された意図:', analysisResult.overall?.primary_intent);
    console.log('🌐 想定翻訳方向:', `${analysisResult.overall?.dominant_language} → ${targetLanguage}`);
    
    // 分析結果をJSON形式で保存
    const finalAnalysisResult = {
      words: analysisResult.words,
      overall: analysisResult.overall,
      // 後方互換性のため古い形式も保持
      intent: {
        type: analysisResult.overall?.primary_intent || 'reading',
        confidence: analysisResult.overall?.confidence || 0.5
      },
      translation_direction: {
        source_language: analysisResult.overall?.dominant_language || 'auto',
        target_language: targetLanguage,
        reasoning: `Detected ${analysisResult.overall?.dominant_language} content`
      },
      screen_context: {
        screen_type: analysisResult.overall?.screen_type || 'other',
        elements_detected: analysisResult.words.length
      },
      timestamp: new Date().toISOString(),
      processing_time_ms: Date.now() - startTime
    };
    
    await saveAnalysisResult(finalAnalysisResult);
    
    return {
      id: Date.now(),
      analysisResult: finalAnalysisResult,
      timestamp: new Date(),
      intent: analysisResult.overall?.primary_intent || 'reading',
      confidence: analysisResult.overall?.confidence || 0.85,
      translationDirection: {
        source: analysisResult.overall?.dominant_language || 'auto',
        target: targetLanguage,
        reasoning: `Analyzed ${analysisResult.words.length} words from ${analysisResult.overall?.screen_type || 'screen'}`
      },
      screenContext: {
        screen_type: analysisResult.overall?.screen_type || 'other',
        elements_detected: analysisResult.words.length
      },
      status: 'success',
      processingTime: Date.now() - startTime,
      inputType: 'screenshot', 
      realtime: options.realtime || false,
      isScreenOverlay: true,
      ocrMethod: 'mistral_ocr_plus_mistral_large' // OCR + 分類の2段構成
    };
    
  } catch (error) {
    console.error('❌ Mistral OCR + AI 包括分析エラー:', error);

    const errorAnalysisResult = {
      words: [],
      overall: {
        primary_intent: 'unknown',
        dominant_language: 'mixed',
        screen_type: 'other',
        confidence: 0
      },
      intent: {
        type: 'unknown',
        confidence: 0
      },
      translation_direction: {
        source_language: 'mixed',
        target_language: 'japanese',
        reasoning: 'OCR or analysis failed'
      },
      screen_context: {
        screen_type: 'other',
        elements_detected: 0
      },
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
      processing_time_ms: Date.now() - startTime
    };

    try {
      await saveAnalysisResult(errorAnalysisResult);
    } catch (saveError) {
      console.error('❌ エラー結果のJSON保存にも失敗:', saveError.message);
    }
    
    return {
      id: Date.now(),
      text: `包括分析エラー: ${error.message}`,
      ocrText: '',
      translations: [],
      analysisResult: errorAnalysisResult,
      timestamp: new Date(),
      intent: 'unknown',
      confidence: 0,
      translationDirection: null,
      screenContext: null,
      status: 'error',
      processingTime: Date.now() - startTime,
      inputType: 'screenshot',
      error: error.message,
      realtime: options.realtime || false,
      isScreenOverlay: true
    };
  }
}

// テキストから翻訳情報を抽出するヘルパー関数
function extractTranslationsFromText(text) {
  const translations = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // "English text" -> "日本語" のパターンを検出
    const match = line.match(/["']([^"']+)["']\s*[-→]\s*["']([^"']+)["']/);
    if (match) {
      translations.push({
        original: match[1],
        japanese: match[2],
        position: {
          x: 50 + (translations.length * 150) % 800,
          y: 100 + Math.floor(translations.length / 5) * 80,
          width: match[1].length * 8,
          height: 30
        },
        confidence: 0.7
      });
    }
  }
  
  // 翻訳が見つからない場合はデフォルトを返す
  if (translations.length === 0) {
    return [
      { original: "Sample Text", japanese: "サンプルテキスト", position: { x: 100, y: 100, width: 120, height: 30 }, confidence: 0.5 }
    ];
  }
  
  return translations;
}

// IPC ハンドラー
ipcMain.handle('ai-process-text', async (_event, text, options) => {
  console.log('🔤 Processing text:', text.slice(0, 100));
  return await processWithMistral(text, 'text', options);
});

ipcMain.handle('ai-process-screenshot', async (_event, options) => {
  console.log('📸 Processing screenshot');
  try {
    const result = await processScreenshotWithOCR(options);
    
    // UIに翻訳結果を送信
    if (overlayWindow && overlayWindow.webContents) {
      overlayWindow.webContents.send('screenshot-status', {
        success: true,
        message: 'OCR and translation completed',
        imagePreview: result.imagePreview, // captureScreenshotから含まれるはず
        text: result.text, // 翻訳結果（日本語）
        ocrText: result.ocrText, // 抽出されたOCRテキスト（元のテキスト）
        translations: result.translations,
        timestamp: result.timestamp,
        processingTime: result.processingTime
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Screenshot processing error:', error);
    if (overlayWindow && overlayWindow.webContents) {
      overlayWindow.webContents.send('screenshot-status', {
        success: false,
        message: `Error: ${error.message}`,
        error: error.message
      });
    }
    throw error;
  }
});

ipcMain.handle('ai-process-camera', async (_event, options) => {
  // カメラ機能は今後実装
  return {
    id: Date.now(),
    text: '[開発中] カメラ機能は現在実装中です。スクリーンショット機能をお試しください。',
    timestamp: new Date(),
    intent: 'vision',
    confidence: 0.5,
    status: 'pending',
    processingTime: 100,
    inputType: 'camera'
  };
});

ipcMain.handle('ai-process-audio', async (_event, options) => {
  // 音声機能は今後実装
  return {
    id: Date.now(),
    text: '[開発中] 音声認識機能は現在実装中です。テキスト入力をお试しください。',
    timestamp: new Date(),
    intent: 'audio',
    confidence: 0.5,
    status: 'pending',
    processingTime: 100,
    inputType: 'audio'
  };
});
// 翻訳言語設定のIPCハンドラー
ipcMain.handle('set-translation-language', async (_event, language) => {
  setTranslationLanguage(language);
  return { success: true, language: targetLanguage };
});

ipcMain.handle('get-translation-language', async () => {
  return { language: targetLanguage };
});
ipcMain.handle('ai-process-file', async (_event, filePath, type, options) => {
  return {
    id: Date.now(),
    text: `[開発中] ファイル処理機能は現在実装中です: ${type}`,
    timestamp: new Date(),
    intent: 'general',
    confidence: 0.5,
    status: 'pending',
    processingTime: 100,
    inputType: 'file'
  };
});

ipcMain.handle('ai-get-status', async () => {
  return {
    initialized: mistralClient !== null,
    mode: mistralClient ? 'live' : 'fallback',
    apiKey: process.env.MISTRAL_API_KEY ? '設定済み' : '未設定',
    realtimeTranslation: realtimeTranslationEnabled,
    timestamp: new Date()
  };
});

// リアルタイム翻訳のコントロール
ipcMain.handle('realtime-translation-start', async () => {
  try {
    await startRealtimeTranslation();
    return { success: true, message: 'リアルタイム翻訳を開始しました' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('realtime-translation-stop', async () => {
  stopRealtimeTranslation();
  return { success: true, message: 'リアルタイム翻訳を停止しました' };
});

ipcMain.handle('realtime-translation-status', async () => {
  return {
    enabled: realtimeTranslationEnabled,
    interval: translationInterval !== null
  };
});

// ── App Lifecycle ─────────────────────────────────────────────

app.whenReady().then(async () => {
  createOverlayWindow();

  // Toggle visibility: Ctrl+Shift+S (Cmd+Shift+S on macOS)
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (!overlayWindow) return;
    if (isVisible) {
      overlayWindow.hide();
      isVisible = false;
    } else {
      overlayWindow.show();
      isVisible = true;
    }
  });

  // Capture / trigger AI: Ctrl+Shift+C
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    if (overlayWindow && isVisible) {
      overlayWindow.webContents.send('capture-trigger');
    }
  });

  // Screenshot capture: Ctrl+Shift+X
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    if (overlayWindow && isVisible) {
      overlayWindow.webContents.send('screenshot-trigger');
    }
  });

  // Camera capture: Ctrl+Shift+V
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (overlayWindow && isVisible) {
      overlayWindow.webContents.send('camera-trigger');
    }
  });

  // Real-time translation toggle: Ctrl+Shift+R
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (overlayWindow && isVisible) {
      overlayWindow.webContents.send('realtime-translation-toggle');
    }
  });
  globalShortcut.register('Escape', () => {
    if (overlayWindow && isVisible) {
      overlayWindow.webContents.send('escape-pressed');
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
});
