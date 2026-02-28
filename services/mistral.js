const BaseService = require('./base-service');

const STUB_RESPONSES = [
  'The candidate is describing a distributed caching strategy using Redis with write-through invalidation. Consider asking about cache coherence in multi-region deployments.',
  'They mentioned event sourcing — a strong architectural pattern. Follow up on how they\'d handle event replay and schema evolution over time.',
  'Good answer on database indexing. They could strengthen it by discussing partial indexes and covering indexes for their specific query patterns.',
  'The system design looks solid. Key improvement: add a circuit breaker between the API gateway and downstream microservices to handle cascading failures.',
];

class MistralService extends BaseService {
  constructor() {
    super('mistral');
    this.apiKey = null;
  }

  async init() {
    this.apiKey = process.env.MISTRAL_API_KEY || null;
    this.ready = true;
    console.log(`[Mistral] initialized (key: ${this.apiKey ? 'set' : 'missing — using stubs'})`);
  }

  async process(input) {
    // TODO: Replace with real Mistral API call
    // POST https://api.mistral.ai/v1/chat/completions
    // Authorization: Bearer ${this.apiKey}
    // Body: { model: 'mistral-large-latest', messages: [...] }

    await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));

    return {
      success: true,
      data: {
        text: STUB_RESPONSES[Math.floor(Math.random() * STUB_RESPONSES.length)],
        model: 'mistral-stub',
      },
    };
  }
}

module.exports = MistralService;
