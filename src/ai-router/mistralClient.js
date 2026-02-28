/**
 * Mistral AI Client
 * Handles API calls to various Mistral models
 */

const { Mistral } = require('@mistralai/mistralai');

class MistralClient {
  constructor() {
    this.client = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY || 'demo-key-placeholder'
    });
  }

  /**
   * Mistral Large 3 - Complex reasoning and coding support
   */
  async callLarge(messages, options = {}) {
    try {
      const response = await this.client.chat.complete({
        model: 'mistral-large-latest',
        messages,
        temperature: options.temperature ?? 0.1,
        maxTokens: options.maxTokens ?? 1000,
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Mistral Large API Error:', error);
      return 'エラーが発生しました。複雑な質問への対応ができませんでした。';
    }
  }

  /**
   * Pixtral - Vision model for camera/image analysis  
   */
  async callPixtral(imageData, prompt, options = {}) {
    // Check if imageData is provided and valid
    if (!imageData || (typeof imageData !== 'string')) {
      console.warn('Invalid or missing image data for Pixtral');
      return '画像データが提供されていないため、画像分析を実行できませんでした。';
    }

    try {
      // Use text-only format for now to avoid API format issues
      const messages = [
        {
          role: 'user',
          content: `${prompt}\n\n※注意: 現在画像処理機能は一時的に無効化されています。テキストベースの処理のみ利用可能です。`
        }
      ];

      const response = await this.client.chat.complete({
        model: 'mistral-large-latest',  // Use text model instead of pixtral temporarily
        messages,
        temperature: options.temperature ?? 0.1,
        maxTokens: options.maxTokens ?? 800,
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Pixtral API Error:', error);
      return 'カメラ画像の分析でエラーが発生しました。現在はテキストベースの処理のみ利用可能です。';
    }
  }

  /**
   * Simulated OCR 3 functionality 
   * (Since OCR 3 might not be publicly available, we'll use Large + vision)
   */
  async callOCR(imageData, options = {}) {
    // Check if imageData is provided and valid
    if (!imageData || (typeof imageData !== 'string')) {
      console.warn('Invalid or missing image data for OCR');
      return JSON.stringify({
        text: 'OCR処理用の画像データが提供されていません',
        coordinates: [],
        confidence: 0.0
      });
    }

    const ocrPrompt = `画像内の全ての文字を正確に抽出してください。文字の位置座標も可能な限り特定してください。
JSONフォーマットで返答してください:
{
  "text": "抽出されたテキスト",
  "coordinates": [{"text": "文字", "x": 100, "y": 200}],
  "confidence": 0.95
}`;

    try {
      return await this.callPixtral(imageData, ocrPrompt, options);
    } catch (error) {
      console.error('OCR Processing Error:', error);
      return JSON.stringify({
        text: 'OCR処理でエラーが発生しました',
        coordinates: [],
        confidence: 0.0
      });
    }
  }

  /**
   * Intent Classification using Mistral Large
   */
  async classifyIntent(inputData) {
    const intentPrompt = `以下の入力から、ユーザーの意図を分析してください。
可能な意図：
- "translation": 翻訳が必要
- "coding": プログラミングサポート・コード解説
- "ocr": 画面の文字読み取り・テキスト抽出
- "vision": 画像・カメラの内容分析
- "general": 一般的な質問・会話

入力: ${JSON.stringify(inputData)}

JSON形式で回答してください:
{
  "intent": "翻訳|coding|ocr|vision|general のいずれか",
  "confidence": 0.85,
  "reasoning": "判断理由"
}`;

    try {
      const messages = [{ role: 'user', content: intentPrompt }];
      const response = await this.callLarge(messages, { temperature: 0.1 });
      
      // Parse JSON response
      const result = JSON.parse(response);
      return result;
    } catch (error) {
      console.error('Intent Classification Error:', error);
      return {
        intent: 'general',
        confidence: 0.5,
        reasoning: 'エラーのため一般的な処理にフォールバック'
      };
    }
  }
}

module.exports = { MistralClient };