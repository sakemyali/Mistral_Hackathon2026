/**
 * AI Service Integration for Main Process
 * Handles LangGraph integration and IPC for AI processing
 */

const { IntentRouter } = require('./ai-router/intentRouter');
const { InputProcessor } = require('./ai-router/inputProcessors');

class AIService {
  constructor() {
    this.intentRouter = null;
    this.inputProcessor = new InputProcessor();
    this.isInitialized = false;
    this.initializeService();
  }

  async initializeService() {
    try {
      console.log('🤖 Initializing AI Service...');
      this.intentRouter = new IntentRouter();
      
      // Health check
      const health = await this.intentRouter.healthCheck();
      if (health.status === 'healthy') {
        this.isInitialized = true;
        console.log('✅ AI Service initialized successfully');
      } else {
        console.warn('⚠️ AI Service health check failed:', health.error);
      }
    } catch (error) {
      console.error('❌ AI Service initialization failed:', error);
    }
  }

  /**
   * Process text input through LangGraph
   */
  async processText(text, options = {}) {
    if (!this.isInitialized) {
      return this.createFallbackResponse('AI Service not initialized');
    }

    try {
      const result = await this.intentRouter.processText(text, options);
      return this.formatResponse(result);
    } catch (error) {
      console.error('Text processing error:', error);
      return this.createFallbackResponse(error.message);
    }
  }

  /**
   * Process screenshot capture
   */
  async processScreenshot(options = {}) {
    if (!this.isInitialized) {
      return this.createFallbackResponse('AI Service not initialized');
    }

    try {
      const result = await this.intentRouter.processScreenshot(options);
      return this.formatResponse(result);
    } catch (error) {
      console.error('Screenshot processing error:', error);
      return this.createFallbackResponse(error.message);
    }
  }

  /**
   * Process camera input (setup)
   */
  async processCameraRequest(options = {}) {
    if (!this.isInitialized) {
      return this.createFallbackResponse('AI Service not initialized');
    }

    try {
      const cameraInput = await this.inputProcessor.captureCamera(options);
      const result = await this.intentRouter.process(cameraInput, options);
      return this.formatResponse(result);
    } catch (error) {
      console.error('Camera setup error:', error);
      return this.createFallbackResponse(error.message);
    }
  }

  /**
   * Process audio input (setup)
   */
  async processAudioRequest(options = {}) {
    if (!this.isInitialized) {
      return this.createFallbackResponse('AI Service not initialized');
    }

    try {
      const audioInput = await this.inputProcessor.setupAudioRecording(options);
      const result = await this.intentRouter.process(audioInput, options);
      return this.formatResponse(result);
    } catch (error) {
      console.error('Audio setup error:', error);
      return this.createFallbackResponse(error.message);
    }
  }

  /**
   * Process file upload
   */
  async processFile(filePath, type, options = {}) {
    if (!this.isInitialized) {
      return this.createFallbackResponse('AI Service not initialized');
    }

    try {
      const fileInput = await this.inputProcessor.processFileInput(filePath, type);
      const result = await this.intentRouter.process(fileInput, options);
      return this.formatResponse(result);
    } catch (error) {
      console.error('File processing error:', error);
      return this.createFallbackResponse(error.message);
    }
  }

  /**
   * Format response for UI consumption
   */
  formatResponse(result) {
    if (!result || !result.output) {
      return this.createFallbackResponse('Invalid processing result');
    }

    return {
      id: result.output.id,
      text: result.output.displayMessage,
      timestamp: result.output.timestamp,
      intent: result.output.intent,
      confidence: result.output.confidence,
      status: result.output.status,
      processingTime: result.output.processingTime,
      inputType: result.output.inputType,
      metadata: {
        processId: result.metadata?.processId,
        routing: result.intent?.reasoning
      }
    };
  }

  /**
   * Create fallback response for errors
   */
  createFallbackResponse(errorMessage) {
    console.log('🔄 Creating fallback response for:', errorMessage);
    
    const fallbackResponses = [
      "申し訳ありません。処理中にエラーが発生しました。テキスト入力をお試しください。",
      "AI処理システムに問題があります。しばらくしてからお試しください。",
      "現在、高度な処理機能が利用できません。基本的な質問にお答えします。"
    ];

    return {
      id: Date.now(),
      text: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
      timestamp: new Date(),
      intent: 'error',
      confidence: 0,
      status: 'fallback',
      processingTime: 0,
      inputType: 'error',
      metadata: {
        error: errorMessage,
        fallback: true
      }
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      timestamp: new Date()
    };
  }
}

module.exports = { AIService };