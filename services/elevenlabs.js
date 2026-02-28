const BaseService = require('./base-service');

class ElevenLabsService extends BaseService {
  constructor() {
    super('elevenlabs');
    this.apiKey = null;
  }

  async init() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || null;
    this.ready = true;
    console.log(`[ElevenLabs] initialized (key: ${this.apiKey ? 'set' : 'missing — using stubs'})`);
  }

  async process(input) {
    // TODO: Replace with real ElevenLabs API call
    // POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
    // xi-api-key: ${this.apiKey}
    // Body: { text, model_id: 'eleven_multilingual_v2' }
    // Returns: audio buffer

    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

    return {
      success: true,
      data: {
        audioBuffer: null,
        durationMs: 2500,
        status: 'stub — no audio generated',
      },
    };
  }
}

module.exports = ElevenLabsService;
