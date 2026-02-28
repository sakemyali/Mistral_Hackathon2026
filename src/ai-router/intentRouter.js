/**
 * LangGraph Intent Router
 * Main workflow orchestrator for AI-powered intent-based routing
 */

const { StateGraph, START, END } = require('@langchain/langgraph');
const { MistralClient } = require('./mistralClient');
const { InputProcessor } = require('./inputProcessors');
const { ActionNodes } = require('./actionNodes');

// State interface definition
const AgentState = {
  input: null,          // User input (text, image, audio, etc.)
  intent: null,         // Classified intent with confidence
  metadata: {},         // Additional context and timing info
  result: null,         // Processing result
  output: null,         // Final formatted output
  completed: false,     // Process completion status
  error: null          // Error information if any
};

class IntentRouter {
  constructor() {
    this.mistral = new MistralClient();
    this.inputProcessor = new InputProcessor();
    this.actionNodes = new ActionNodes();
    this.workflow = null;
    this.app = null;
    this.initializeWorkflow();
  }

  /**
   * Initialize the LangGraph workflow
   */
  initializeWorkflow() {
    console.log('🚀 Initializing LangGraph Intent Router...');
    
    // Create the state graph
    this.workflow = new StateGraph(AgentState);

    // Add nodes to the workflow
    this.workflow.addNode('input_validation', this.validateInput.bind(this));
    this.workflow.addNode('intent_classifier', this.classifyIntent.bind(this));
    this.workflow.addNode('ocr_processor', this.actionNodes.processOCR.bind(this.actionNodes));
    this.workflow.addNode('vision_processor', this.actionNodes.processVision.bind(this.actionNodes));
    this.workflow.addNode('general_processor', this.actionNodes.processGeneral.bind(this.actionNodes));
    this.workflow.addNode('audio_processor', this.actionNodes.processAudio.bind(this.actionNodes));
    this.workflow.addNode('output_formatter', this.actionNodes.formatOutput.bind(this.actionNodes));

    // Define the workflow edges
    this.workflow.addEdge(START, 'input_validation');
    this.workflow.addEdge('input_validation', 'intent_classifier');
    
    // Conditional routing from intent classifier
    this.workflow.addConditionalEdges(
      'intent_classifier',
      this.routeByIntent.bind(this),
      {
        'ocr': 'ocr_processor',
        'vision': 'vision_processor', 
        'general': 'general_processor',
        'translation': 'general_processor',
        'coding': 'general_processor',
        'audio': 'audio_processor',
        'error': END
      }
    );

    // All processors lead to output formatter
    this.workflow.addEdge('ocr_processor', 'output_formatter');
    this.workflow.addEdge('vision_processor', 'output_formatter');
    this.workflow.addEdge('general_processor', 'output_formatter');
    this.workflow.addEdge('audio_processor', 'output_formatter');
    this.workflow.addEdge('output_formatter', END);

    try {
      // Compile the workflow
      this.app = this.workflow.compile();
      console.log('✅ LangGraph workflow compiled successfully');
    } catch (error) {
      console.error('❌ Failed to compile LangGraph workflow:', error);
      throw error;
    }
  }

  /**
   * Input Validation Node
   */
  async validateInput(state) {
    console.log('🔍 Validating input...');
    
    try {
      const { input } = state;
      
      const validation = this.inputProcessor.validateInput(input);
      
      if (!validation.valid) {
        return {
          ...state,
          error: validation.error,
          completed: true
        };
      }

      return {
        ...state,
        metadata: {
          ...state.metadata,
          startTime: Date.now(),
          validated: true
        }
      };
      
    } catch (error) {
      console.error('Input validation error:', error);
      return {
        ...state,
        error: `入力検証エラー: ${error.message}`,
        completed: true
      };
    }
  }

  /**
   * Intent Classification Node
   */
  async classifyIntent(state) {
    console.log('🎯 Classifying user intent...');
    
    try {
      const { input, metadata } = state;
      
      // Prepare input for intent classification
      const inputForClassification = {
        type: input.type,
        data: input.type === 'text' ? input.data : `[${input.type} input]`,
        metadata: input.metadata || {}
      };

      const intent = await this.mistral.classifyIntent(inputForClassification);
      
      console.log(`🎯 Intent classified as: ${intent.intent} (confidence: ${intent.confidence})`);
      
      return {
        ...state,
        intent,
        metadata: {
          ...metadata,
          intentClassificationTime: Date.now() - metadata.startTime
        }
      };
      
    } catch (error) {
      console.error('Intent classification error:', error);
      return {
        ...state,
        intent: {
          intent: 'general',
          confidence: 0.3,
          reasoning: `エラーによる一般処理へのフォールバック: ${error.message}`
        }
      };
    }
  }

  /**
   * Route Selection Logic
   */
  routeByIntent(state) {
    const { intent, input, error } = state;
    
    if (error) {
      console.log('❌ Routing to error due to:', error);
      return 'error';
    }
    
    if (!intent) {
      console.log('⚠️ No intent found, defaulting to general');
      return 'general';
    }
    
    // Handle audio inputs
    if (input.type === 'audio' || input.type === 'audio-setup') {
      console.log('🎤 Routing to audio processor');
      return 'audio';
    }
    
    // Route based on intent
    switch (intent.intent) {
      case 'ocr':
        console.log('🔍 Routing to OCR processor');
        return 'ocr';
        
      case 'vision':
        console.log('👁️ Routing to vision processor');
        return 'vision';
        
      case 'translation':
      case 'coding':
        console.log(`🧠 Routing to general processor for ${intent.intent}`);
        return 'general';
        
      default:
        console.log('🔄 Routing to general processor (default)');
        return 'general';
    }
  }

  /**
   * Main process method - execute the workflow
   */
  async process(inputData, options = {}) {
    console.log('🚀 Starting intent-based processing...');
    
    try {
      const initialState = {
        input: inputData,
        intent: null,
        metadata: {
          processId: Date.now(),
          options,
          ...options.metadata
        },
        result: null,
        output: null,
        completed: false,
        error: null
      };

      // Execute the workflow
      const result = await this.app.invoke(initialState);
      
      console.log('✅ Processing completed:', result.output?.status || 'success');
      return result;
      
    } catch (error) {
      console.error('❌ Workflow execution error:', error);
      return {
        input: inputData,
        error: error.message,
        output: {
          id: Date.now(),
          timestamp: new Date(),
          status: 'error',
          displayMessage: `処理中にエラーが発生しました: ${error.message}`,
          error: error.message
        },
        completed: true
      };
    }
  }

  /**
   * Quick text processing shortcut
   */
  async processText(text, options = {}) {
    const input = this.inputProcessor.processTextInput(text, options);
    return await this.process(input, options);
  }

  /**
   * Quick screenshot processing shortcut
   */
  async processScreenshot(options = {}) {
    const input = await this.inputProcessor.captureScreenshot(options);
    return await this.process(input, options);
  }

  /**
   * Health check method
   */
  async healthCheck() {
    try {
      const testInput = this.inputProcessor.processTextInput('test');
      const result = await this.process(testInput);
      return {
        status: 'healthy',
        workflow: this.app !== null,
        testResult: result.output?.status === 'success'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = { IntentRouter, AgentState };