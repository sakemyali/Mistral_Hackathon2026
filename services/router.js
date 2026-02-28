const BaseService = require('./base-service');
const { INTENTS } = require('./classifier');

// Routes classified intents to the appropriate agent service

class RouterService extends BaseService {
  constructor() {
    super('router');
  }

  async init() {
    this.ready = true;
    console.log('[Router] initialized');
  }

  async process(input) {
    const { intent, confidence, context } = input.payload || {};

    const route = this._selectAgent(intent, context);

    const debug = process.env.DEBUG_MODE === 'true';
    if (debug) {
      console.log(`[Router] ${intent} (${(confidence * 100).toFixed(0)}%) -> ${route.agent || 'none'}`);
    }

    return {
      success: true,
      data: {
        agent: route.agent,
        action: route.action,
        shouldAct: route.shouldAct,
        reason: route.reason,
        intent,
        confidence,
      },
    };
  }

  _selectAgent(intent, context) {
    switch (intent) {
      case INTENTS.HESITATION_CODING:
        return {
          agent: 'vibe',
          action: 'suggestFunction',
          shouldAct: true,
          reason: 'User appears stuck on code — triggering Vibe suggestions',
        };

      case INTENTS.FOREIGN_LANGUAGE:
        return {
          agent: 'mistral',
          action: 'translate',
          shouldAct: true,
          reason: 'Foreign text detected — triggering OCR + translation',
        };

      case INTENTS.ERROR_VISIBLE:
        return {
          agent: 'vibe',
          action: 'fixError',
          shouldAct: true,
          reason: 'Error detected on screen — triggering Vibe fix',
        };

      case INTENTS.TYPING_FLUENT:
        return {
          agent: null,
          action: null,
          shouldAct: false,
          reason: 'User is typing fluently — staying invisible',
        };

      default:
        return {
          agent: null,
          action: null,
          shouldAct: false,
          reason: `Unknown intent: ${intent}`,
        };
    }
  }
}

module.exports = RouterService;
