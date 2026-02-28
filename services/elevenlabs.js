const BaseService = require('./base-service');

// DorAImon's voice personality — conversational assistant, NOT TTS reader
// Narrates what DorAImon is doing: "I noticed you're stuck on line 47..."

const VOICE_MODES = { SILENT: 'silent', VOICE: 'voice', AUTO: 'auto' };

class ElevenLabsService extends BaseService {
  constructor() {
    super('elevenlabs');
    this.apiKey = null;
    this.voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Default: Sarah
    this.modelId = 'eleven_multilingual_v2';
    this.voiceMode = VOICE_MODES.AUTO;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
  }

  async init() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || null;
    this.voiceMode = process.env.VOICE_MODE || VOICE_MODES.AUTO;
    this.ready = true;
    console.log(`[ElevenLabs] initialized (key: ${this.apiKey ? 'set' : 'missing — using stubs'}, mode: ${this.voiceMode})`);
  }

  async process(input) {
    const action = input.payload?.action || 'narrate';

    switch (action) {
      case 'narrate':
        return await this.narrateAction(input.payload.text, input.payload.context);
      case 'setVoiceMode':
        return this.setVoiceMode(input.payload.mode);
      default:
        return await this.narrateAction(input.payload?.text, input.payload?.context);
    }
  }

  // Narrate what DorAImon is doing — personality-driven
  async narrateAction(actionText, context) {
    if (this.voiceMode === VOICE_MODES.SILENT) {
      return {
        success: true,
        data: { status: 'silent_mode', audioBuffer: null, text: actionText },
      };
    }

    const narration = this._generateNarration(actionText, context);

    if (!this.apiKey) {
      return this._stubNarrate(narration);
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${this.voiceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify({
            text: narration,
            model_id: this.modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      return {
        success: true,
        data: {
          audioBuffer: audioBuffer.toString('base64'),
          text: narration,
          durationMs: Math.round(narration.length * 65),
          voiceMode: this.voiceMode,
        },
      };
    } catch (err) {
      console.error('[ElevenLabs] Narration error:', err.message);
      return { success: false, error: err.message };
    }
  }

  setVoiceMode(mode) {
    if (Object.values(VOICE_MODES).includes(mode)) {
      this.voiceMode = mode;
      console.log(`[ElevenLabs] Voice mode: ${mode}`);
      return { success: true, data: { voiceMode: mode } };
    }
    return { success: false, error: `Invalid voice mode: ${mode}` };
  }

  // Generate personality-driven narration
  _generateNarration(action, context) {
    const narrations = {
      hesitation_coding: [
        "I noticed you've been paused for a while. Let me check with Vibe for some suggestions.",
        "Looks like you might be stuck. I'll pull up some code ideas.",
        "Taking a moment? I'll see if Vibe has something helpful.",
      ],
      foreign_language: [
        "I see some text that isn't in English. Let me translate that for you.",
        "Found some foreign text on screen. Translating now.",
      ],
      error_visible: [
        "I spotted an error on your screen. Let me check what's going on.",
        "Looks like there's an error. I'll ask Vibe for a fix.",
        "Error detected. Let me see if I can help with that.",
      ],
      suggestion_ready: [
        "Got a suggestion for you. Take a look when you're ready.",
        "Vibe came back with something. Check the suggestion card.",
      ],
    };

    const key = context?.intent || action || 'suggestion_ready';
    const options = narrations[key] || narrations.suggestion_ready;
    return options[Math.floor(Math.random() * options.length)];
  }

  _stubNarrate(text) {
    return {
      success: true,
      data: {
        audioBuffer: null,
        text,
        durationMs: Math.round(text.length * 65),
        voiceMode: this.voiceMode,
        status: 'stub — no audio generated',
      },
    };
  }
}

module.exports = ElevenLabsService;
module.exports.VOICE_MODES = VOICE_MODES;
