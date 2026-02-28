const BaseService = require('./base-service');
const { Mistral } = require('@mistralai/mistralai');

class MistralService extends BaseService {
  constructor() {
    super('mistral');
    this.client = null;
    this.apiKey = null;
  }

  async init() {
    this.apiKey = process.env.MISTRAL_API_KEY || null;
    if (this.apiKey) {
      this.client = new Mistral({ apiKey: this.apiKey });
    }
    this.ready = true;
    console.log(`[Mistral] initialized (key: ${this.apiKey ? 'set' : 'missing — using stubs'})`);
  }

  async process(input) {
    const { type, payload } = input;

    switch (payload?.action || type) {
      case 'analyze':
        return await this.analyzeScreen(payload.screenshot);
      case 'translate':
        return await this.translate(payload.text, payload.targetLang || 'en');
      case 'ocr':
        return await this.ocrWithBoundingBoxes(payload.screenshot);
      case 'detectLanguage':
        return await this.detectLanguage(payload.text);
      case 'capture':
        return await this.analyzeScreen(payload.screenshot);
      default:
        return await this.chat(payload?.prompt || 'Analyze the current screen context.');
    }
  }

  // Pixtral vision: analyze what's on screen
  async analyzeScreen(screenshotBase64) {
    if (!this.client) return this._stubAnalyze();

    try {
      const result = await this.client.chat.complete({
        model: 'pixtral-12b-2409',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              imageUrl: `data:image/png;base64,${screenshotBase64}`,
            },
            {
              type: 'text',
              text: 'Analyze this screenshot. Describe what you see: Is there code? Any errors or warnings? Foreign language text? Is the user stuck or actively working? Be concise (2-3 sentences).',
            },
          ],
        }],
        maxTokens: 300,
      });

      const text = result.choices?.[0]?.message?.content || 'No analysis available';
      return { success: true, data: { text, model: 'pixtral-12b-2409' } };
    } catch (err) {
      console.error('[Mistral] Vision error:', err.message);
      return this._stubAnalyze();
    }
  }

  // OCR with bounding box coordinates using Pixtral
  async ocrWithBoundingBoxes(screenshotBase64) {
    if (!this.client) return this._stubOcr();

    try {
      const result = await this.client.chat.complete({
        model: 'pixtral-12b-2409',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              imageUrl: `data:image/png;base64,${screenshotBase64}`,
            },
            {
              type: 'text',
              text: 'Extract all visible text from this screenshot. For each text block, provide: the text content, approximate bounding box as {x, y, w, h} in percentage coordinates (0-100), and the detected language. Return as JSON array: [{"text": "...", "bbox": {"x": 0, "y": 0, "w": 100, "h": 10}, "lang": "en"}]',
            },
          ],
        }],
        maxTokens: 2048,
      });

      const content = result.choices?.[0]?.message?.content || '[]';
      let blocks;
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        blocks = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch {
        blocks = [{ text: content, bbox: { x: 0, y: 0, w: 100, h: 100 }, lang: 'unknown' }];
      }

      return { success: true, data: { blocks, model: 'pixtral-12b-2409' } };
    } catch (err) {
      console.error('[Mistral] OCR error:', err.message);
      return this._stubOcr();
    }
  }

  // Translate text using Mistral Large
  async translate(text, targetLang) {
    if (!this.client) return this._stubTranslate(text, targetLang);

    try {
      const result = await this.client.chat.complete({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'system',
            content: `You are a translator. Translate the following text to ${targetLang}. Return ONLY the translated text, nothing else.`,
          },
          { role: 'user', content: text },
        ],
        maxTokens: 1024,
      });

      const translated = result.choices?.[0]?.message?.content || text;
      return {
        success: true,
        data: { original: text, translated, targetLang, model: 'mistral-large-latest' },
      };
    } catch (err) {
      console.error('[Mistral] Translation error:', err.message);
      return this._stubTranslate(text, targetLang);
    }
  }

  // Detect language of text
  async detectLanguage(text) {
    if (!this.client) return this._stubDetectLanguage(text);

    try {
      const result = await this.client.chat.complete({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'system',
            content: 'Detect the language of the following text. Return ONLY a JSON object: {"language": "English", "code": "en", "confidence": 0.95}',
          },
          { role: 'user', content: text },
        ],
        maxTokens: 64,
      });

      const content = result.choices?.[0]?.message?.content || '{}';
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { language: 'unknown', code: 'und', confidence: 0 };
      }

      return { success: true, data: parsed };
    } catch (err) {
      console.error('[Mistral] Language detection error:', err.message);
      return this._stubDetectLanguage(text);
    }
  }

  // General chat completion
  async chat(prompt) {
    if (!this.client) return this._stubChat();

    try {
      const result = await this.client.chat.complete({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 512,
      });

      const text = result.choices?.[0]?.message?.content || 'No response';
      return { success: true, data: { text, model: 'mistral-large-latest' } };
    } catch (err) {
      console.error('[Mistral] Chat error:', err.message);
      return this._stubChat();
    }
  }

  // ── Stubs (fallback when no API key) ──

  _stubAnalyze() {
    const analyses = [
      'The screen shows a code editor with JavaScript. There appears to be an incomplete function with a TODO comment. No errors visible.',
      'IDE is open with a terminal panel showing recent command output. User appears to be actively working on a Node.js project.',
      'Screen shows a web browser with developer tools open. A console error is visible in the output panel.',
    ];
    return {
      success: true,
      data: {
        text: analyses[Math.floor(Math.random() * analyses.length)],
        model: 'pixtral-stub',
      },
    };
  }

  _stubOcr() {
    return {
      success: true,
      data: {
        blocks: [
          { text: 'function calculateTotal(items) {', bbox: { x: 5, y: 30, w: 60, h: 3 }, lang: 'en' },
          { text: '// TODO: implement', bbox: { x: 8, y: 33, w: 40, h: 3 }, lang: 'en' },
          { text: 'TypeError: Cannot read property', bbox: { x: 5, y: 70, w: 65, h: 3 }, lang: 'en' },
        ],
        model: 'pixtral-stub',
      },
    };
  }

  _stubTranslate(text, targetLang) {
    return {
      success: true,
      data: {
        original: text,
        translated: `[${targetLang}] ${text} (stub translation)`,
        targetLang,
        model: 'mistral-stub',
      },
    };
  }

  _stubDetectLanguage(text) {
    const hasJapanese = /[\u3000-\u9FFF]/.test(text);
    return {
      success: true,
      data: {
        language: hasJapanese ? 'Japanese' : 'English',
        code: hasJapanese ? 'ja' : 'en',
        confidence: 0.85,
      },
    };
  }

  _stubChat() {
    const responses = [
      'The system design looks solid. Consider adding a circuit breaker between the API gateway and downstream microservices.',
      'Good approach on the caching strategy. Follow up on cache coherence in multi-region deployments.',
      'The code structure is clean. Consider extracting the validation logic into a separate utility.',
    ];
    return {
      success: true,
      data: {
        text: responses[Math.floor(Math.random() * responses.length)],
        model: 'mistral-stub',
      },
    };
  }
}

module.exports = MistralService;
