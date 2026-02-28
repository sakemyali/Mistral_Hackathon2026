/**
 * Action Nodes for LangGraph
 * Each action corresponds to different AI models and processing types
 */

const { MistralClient } = require('./mistralClient');

class ActionNodes {
  constructor() {
    this.mistral = new MistralClient();
  }

  /**
   * Route A: OCR Processing (Mistral OCR 3)
   * Extracts text and coordinates from images/screenshots
   */
  async processOCR(state) {
    console.log('🔍 Processing OCR request...');
    
    try {
      const { input, metadata } = state;
      
      if (!input.data && input.type !== 'screenshot') {
        throw new Error('OCR requires image data');
      }

      let imageData = input.data;
      
      // If screenshot requested, we'll handle this in the main process
      if (input.type === 'screenshot') {
        return {
          ...state,
          result: {
            type: 'ocr',
            status: 'screenshot-required',
            message: 'スクリーンショットを取得して文字を抽出します...',
            action: 'capture-screen-for-ocr'
          },
          completed: false
        };
      }

      const ocrResult = await this.mistral.callOCR(imageData);
      
      return {
        ...state,
        result: {
          type: 'ocr',
          status: 'success',
          data: ocrResult,
          message: '画面の文字を抽出しました。',
          extractedText: typeof ocrResult === 'string' ? ocrResult : ocrResult.text,
          processingTime: Date.now() - (metadata?.startTime || Date.now())
        },
        completed: true
      };
      
    } catch (error) {
      console.error('OCR processing error:', error);
      return {
        ...state,
        result: {
          type: 'ocr',
          status: 'error',
          message: `OCR処理エラー: ${error.message}`,
          error: error.message
        },
        completed: true
      };
    }
  }

  /**
   * Route B: Vision Analysis (Pixtral)
   * Analyzes camera images and visual content
   */
  async processVision(state) {
    console.log('👁️ Processing vision analysis...');
    
    try {
      const { input, intent, metadata } = state;
      
      if (input.type === 'camera-request') {
        return {
          ...state,
          result: {
            type: 'vision',
            status: 'camera-required',
            message: 'カメラを起動して画像を分析します...',
            action: 'activate-camera'
          },
          completed: false
        };
      }
      
      if (!input.data) {
        throw new Error('Vision analysis requires image data');
      }

      // Customize prompt based on context
      let analysisPrompt = '画像の内容を詳しく分析して説明してください。';
      
      if (metadata?.context === 'presentation') {
        analysisPrompt = 'このプレゼンテーションスライドの内容を要約し、重要なポイントを説明してください。';
      } else if (metadata?.context === 'code') {
        analysisPrompt = 'この画面に表示されているコードを分析し、何をしているのか説明してください。';
      } else if (metadata?.context === 'document') {
        analysisPrompt = 'この文書の内容を分析し、重要な情報を抽出してください。';
      }

      const visionResult = await this.mistral.callPixtral(input.data, analysisPrompt);
      
      return {
        ...state,
        result: {
          type: 'vision',
          status: 'success',
          message: '画像の分析が完了しました。',
          analysis: visionResult,
          processingTime: Date.now() - (metadata?.startTime || Date.now())
        },
        completed: true
      };
      
    } catch (error) {
      console.error('Vision processing error:', error);
      return {
        ...state,
        result: {
          type: 'vision',
          status: 'error',
          message: `画像分析エラー: ${error.message}`,
          error: error.message
        },
        completed: true
      };
    }
  }

  /**
   * Route C: Complex Reasoning (Mistral Large 3)
   * Handles coding support, complex questions, and general reasoning
   */
  async processGeneral(state) {
    console.log('🧠 Processing with Mistral Large...');
    
    try {
      const { input, intent, metadata } = state;
      
      let systemPrompt = "";
      let userPrompt = "";
      
      switch (intent.intent) {
        case 'translation':
          systemPrompt = "あなたは高精度の翻訳アシスタントです。文脈を考慮した自然な翻訳を提供してください。";
          userPrompt = `以下のテキストを翻訳してください:\\n\\n${input.data}`;
          break;
          
        case 'coding':
          systemPrompt = "あなたは経験豊富なソフトウェアエンジニアリングアシスタントです。コードの説明、デバッグ、最適化のアドバイスを提供してください。";
          userPrompt = `以下のプログラミング関連の質問にお答えください:\\n\\n${input.data}`;
          break;
          
        default:
          systemPrompt = "あなたは知識豊富で親切なAIアシスタントです。正確で有用な情報を提供してください。";
          userPrompt = input.data;
      }
      
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      
      const response = await this.mistral.callLarge(messages, {
        temperature: intent.intent === 'coding' ? 0.1 : 0.3
      });
      
      return {
        ...state,
        result: {
          type: 'general',
          intent: intent.intent,
          status: 'success',
          message: intent.intent === 'translation' ? '翻訳が完了しました。' : 
                  intent.intent === 'coding' ? 'コード解析が完了しました。' : 
                  '回答を生成しました。',
          response: response,
          processingTime: Date.now() - (metadata?.startTime || Date.now())
        },
        completed: true
      };
      
    } catch (error) {
      console.error('General processing error:', error);
      return {
        ...state,
        result: {
          type: 'general',
          status: 'error',
          message: `処理エラー: ${error.message}`,
          error: error.message
        },
        completed: true
      };
    }
  }

  /**
   * Audio Processing Node
   * Handles audio transcription and analysis
   */
  async processAudio(state) {
    console.log('🎤 Processing audio input...');
    
    try {
      const { input, intent, metadata } = state;
      
      if (input.type === 'audio-setup') {
        return {
          ...state,
          result: {
            type: 'audio',
            status: 'recording-required',
            message: '音声録音を開始します...',
            action: 'start-audio-recording',
            config: input.config
          },
          completed: false
        };
      }
      
      // For now, return a placeholder - actual audio transcription would need
      // integration with speech-to-text services
      return {
        ...state,
        result: {
          type: 'audio',
          status: 'success',
          message: '音声処理は現在開発中です。テキスト入力をお試しください。',
          transcription: '[音声転写機能は開発中]',
          processingTime: Date.now() - (metadata?.startTime || Date.now())
        },
        completed: true
      };
      
    } catch (error) {
      console.error('Audio processing error:', error);
      return {
        ...state,
        result: {
          type: 'audio',
          status: 'error',
          message: `音声処理エラー: ${error.message}`,
          error: error.message
        },
        completed: true
      };
    }
  }

  /**
   * Output Formatting Node
   * Formats the final result for the UI
   */
  formatOutput(state) {
    console.log('📄 Formatting output...');
    
    const { result, intent, input } = state;
    
    return {
      ...state,
      output: {
        id: Date.now(),
        timestamp: new Date(),
        intent: intent?.intent || 'unknown',
        confidence: intent?.confidence || 0,
        inputType: input.type,
        result: result,
        // UI-friendly message
        displayMessage: result.response || result.analysis || result.extractedText || result.message,
        status: result.status,
        processingTime: result.processingTime || 0
      },
      completed: true
    };
  }
}

module.exports = { ActionNodes };