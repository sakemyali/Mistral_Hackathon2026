const BaseService = require('./base-service');

// Weights & Biases logging for self-improving DorAImon
// Logs intents, agent performance, user feedback as RL training data
// Uses W&B REST API since there's no official Node.js SDK

class WandbService extends BaseService {
  constructor() {
    super('wandb');
    this.apiKey = null;
    this.project = 'doraimon-hackathon';
    this.entity = '';
    this.runId = null;
    this.baseUrl = 'https://api.wandb.ai';
    this.logs = []; // Local buffer for batch uploads
  }

  async init() {
    this.apiKey = process.env.WANDB_API_KEY || null;
    this.project = process.env.WANDB_PROJECT || 'doraimon-hackathon';
    this.entity = process.env.WANDB_ENTITY || '';
    this.runId = `doraimon-${Date.now()}`;
    this.ready = true;

    if (this.apiKey) {
      console.log(`[W&B] initialized — project: ${this.entity}/${this.project}, run: ${this.runId}`);
    } else {
      console.log('[W&B] initialized (no API key — logging to console only)');
    }
  }

  async process(input) {
    const action = input.payload?.action || 'log';

    switch (action) {
      case 'logIntent':
        return this.logIntent(input.payload);
      case 'logAgentPerformance':
        return this.logAgentPerformance(input.payload);
      case 'logUserFeedback':
        return this.logUserFeedback(input.payload);
      case 'saveTrainingExample':
        return this.saveTrainingExample(input.payload);
      default:
        return this._logGeneric(input.payload);
    }
  }

  // Log intent classification results
  logIntent(data) {
    const entry = {
      type: 'intent',
      timestamp: Date.now(),
      intent: data.intent,
      confidence: data.confidence,
      agent: data.agent || null,
    };

    this.logs.push(entry);
    this._maybeFlush();

    if (process.env.DEBUG_MODE === 'true') {
      console.log(`[W&B] intent: ${entry.intent} (${(entry.confidence * 100).toFixed(0)}%) -> ${entry.agent}`);
    }

    return { success: true, data: entry };
  }

  // Log agent execution metrics
  logAgentPerformance(data) {
    const entry = {
      type: 'agent_performance',
      timestamp: Date.now(),
      agent: data.agent,
      latencyMs: data.latencyMs,
      success: data.success,
      action: data.action,
    };

    this.logs.push(entry);
    this._maybeFlush();

    if (process.env.DEBUG_MODE === 'true') {
      console.log(`[W&B] agent: ${entry.agent} | ${entry.latencyMs}ms | ${entry.success ? 'ok' : 'fail'}`);
    }

    return { success: true, data: entry };
  }

  // Log user feedback as reward signal for RL
  // accepted: +1.0, rejected: -0.5, ignored: -0.1
  logUserFeedback(data) {
    const rewardMap = { accepted: 1.0, rejected: -0.5, ignored: -0.1 };
    const reward = rewardMap[data.action] ?? 0;

    const entry = {
      type: 'user_feedback',
      timestamp: Date.now(),
      action: data.action,
      reward,
      agent: data.agent,
      intent: data.intent,
    };

    this.logs.push(entry);
    this._maybeFlush();

    if (process.env.DEBUG_MODE === 'true') {
      console.log(`[W&B] feedback: ${entry.action} (reward: ${reward}) for ${entry.agent}`);
    }

    return { success: true, data: entry };
  }

  // Store screenshot + intent + user action as training artifact
  saveTrainingExample(data) {
    const entry = {
      type: 'training_example',
      timestamp: Date.now(),
      intent: data.intent,
      userAction: data.userAction,
      screenshotSize: data.screenshot ? data.screenshot.length : 0,
      // Don't log full screenshot to console — too large
    };

    this.logs.push(entry);

    if (process.env.DEBUG_MODE === 'true') {
      console.log(`[W&B] training example saved: ${entry.intent} -> ${entry.userAction}`);
    }

    return { success: true, data: entry };
  }

  _logGeneric(data) {
    const entry = { type: 'generic', timestamp: Date.now(), ...data };
    this.logs.push(entry);
    return { success: true, data: entry };
  }

  // Batch upload when buffer reaches 50 entries
  async _maybeFlush() {
    if (this.logs.length >= 50) {
      await this._flush();
    }
  }

  async _flush() {
    if (!this.apiKey || this.logs.length === 0) return;

    const batch = this.logs.splice(0, this.logs.length);

    try {
      // W&B REST API log endpoint
      await fetch(`${this.baseUrl}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query: `mutation LogEvents($input: LogEventsInput!) { logEvents(input: $input) { success } }`,
          variables: {
            input: {
              run: this.runId,
              project: this.project,
              entity: this.entity,
              events: batch,
            },
          },
        }),
      });
    } catch (err) {
      console.error('[W&B] Flush error:', err.message);
      // Re-queue failed entries
      this.logs.unshift(...batch);
    }
  }

  // Get summary stats
  getStats() {
    const intents = this.logs.filter((l) => l.type === 'intent');
    const feedback = this.logs.filter((l) => l.type === 'user_feedback');
    const avgReward = feedback.length > 0
      ? feedback.reduce((sum, f) => sum + (f.reward || 0), 0) / feedback.length
      : 0;

    return {
      totalLogs: this.logs.length,
      intentsClassified: intents.length,
      feedbackReceived: feedback.length,
      averageReward: avgReward.toFixed(2),
    };
  }
}

module.exports = WandbService;
