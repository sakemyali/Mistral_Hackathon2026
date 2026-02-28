const BaseService = require('./base-service');

// Heuristic intent detection — no VLM needed for MVP
// Compares frames to detect user state changes

const INTENTS = {
  HESITATION_CODING: 'hesitation_coding',
  FOREIGN_LANGUAGE: 'foreign_language',
  ERROR_VISIBLE: 'error_visible',
  TYPING_FLUENT: 'typing_fluent',
};

class ClassifierService extends BaseService {
  constructor() {
    super('classifier');
    this.frameHistory = [];
    this.maxFrames = 3;
    this.confidenceThreshold = 0.7;
  }

  async init() {
    this.confidenceThreshold = parseFloat(process.env.INTENT_CONFIDENCE_THRESHOLD) || 0.7;
    this.ready = true;
    console.log(`[Classifier] initialized (threshold: ${this.confidenceThreshold})`);
  }

  // Store frame for temporal comparison
  pushFrame(frameBase64) {
    this.frameHistory.push({
      data: frameBase64,
      timestamp: Date.now(),
    });
    if (this.frameHistory.length > this.maxFrames) {
      this.frameHistory.shift();
    }
  }

  async process(input) {
    const { screenshot, ocrText, analysisText } = input.payload || {};

    if (screenshot) {
      this.pushFrame(screenshot);
    }

    const intents = [];

    // Use combined text from both OCR and Mistral vision analysis
    const combinedText = [ocrText, analysisText].filter(Boolean).join('\n');

    // Heuristic 1: Error detection via keywords
    if (combinedText) {
      const errorScore = this._detectErrors(combinedText);
      if (errorScore > 0) {
        intents.push({
          intent: INTENTS.ERROR_VISIBLE,
          confidence: Math.min(1.0, errorScore),
          context: { source: analysisText ? 'vision_analysis' : 'ocr_keywords' },
        });
      }

      // Heuristic 2: Foreign language detection
      const langScore = this._detectForeignLanguage(combinedText);
      if (langScore > 0) {
        intents.push({
          intent: INTENTS.FOREIGN_LANGUAGE,
          confidence: Math.min(1.0, langScore),
          context: { source: 'character_analysis' },
        });
      }

      // Heuristic 2b: Vision-based foreign language signal
      if (analysisText && /foreign|non-english|japanese|chinese|korean|arabic/i.test(analysisText)) {
        const existing = intents.find((i) => i.intent === INTENTS.FOREIGN_LANGUAGE);
        if (existing) {
          existing.confidence = Math.min(1.0, existing.confidence + 0.2);
        } else {
          intents.push({
            intent: INTENTS.FOREIGN_LANGUAGE,
            confidence: 0.7,
            context: { source: 'vision_language_hint' },
          });
        }
      }
    }

    // Heuristic 3: Hesitation detection (low frame diff = user stuck)
    if (this.frameHistory.length >= 2) {
      const hesitationScore = this._detectHesitation();
      if (hesitationScore > 0) {
        intents.push({
          intent: INTENTS.HESITATION_CODING,
          confidence: Math.min(1.0, hesitationScore),
          context: { source: 'frame_comparison', frames: this.frameHistory.length },
        });
      }
    }

    // If no strong signals, user is probably typing fluently
    if (intents.length === 0 || intents.every((i) => i.confidence < this.confidenceThreshold)) {
      intents.push({
        intent: INTENTS.TYPING_FLUENT,
        confidence: 0.9,
        context: { source: 'default' },
      });
    }

    // Sort by confidence, pick top intent
    intents.sort((a, b) => b.confidence - a.confidence);
    const top = intents[0];

    return {
      success: true,
      data: {
        intent: top.intent,
        confidence: top.confidence,
        context: top.context,
        allIntents: intents,
      },
    };
  }

  _detectErrors(text) {
    const errorPatterns = [
      /error/i, /exception/i, /traceback/i, /failed/i,
      /undefined is not/i, /cannot read propert/i, /segmentation fault/i,
      /syntax error/i, /type error/i, /reference error/i,
      /ENOENT/i, /EACCES/i, /ECONNREFUSED/i,
      /stack overflow/i, /out of memory/i, /null pointer/i,
    ];
    let score = 0;
    for (const pattern of errorPatterns) {
      if (pattern.test(text)) score += 0.3;
    }
    return score;
  }

  _detectForeignLanguage(text) {
    // Detect CJK characters (Japanese, Chinese, Korean)
    const cjkPattern = /[\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/;
    // Detect Arabic
    const arabicPattern = /[\u0600-\u06FF]/;
    // Detect Cyrillic
    const cyrillicPattern = /[\u0400-\u04FF]/;
    // Detect Thai
    const thaiPattern = /[\u0E00-\u0E7F]/;

    const totalChars = text.replace(/\s/g, '').length;
    if (totalChars === 0) return 0;

    let foreignChars = 0;
    for (const char of text) {
      if (cjkPattern.test(char) || arabicPattern.test(char) ||
          cyrillicPattern.test(char) || thaiPattern.test(char)) {
        foreignChars++;
      }
    }

    const ratio = foreignChars / totalChars;
    return ratio > 0.1 ? ratio * 1.2 : 0;
  }

  _detectHesitation() {
    if (this.frameHistory.length < 2) return 0;

    const recent = this.frameHistory;
    const timeDiffs = [];
    for (let i = 1; i < recent.length; i++) {
      timeDiffs.push(recent[i].timestamp - recent[i - 1].timestamp);
    }

    // If frames span > 3 seconds with no significant change, user may be stuck
    const totalTime = recent[recent.length - 1].timestamp - recent[0].timestamp;
    if (totalTime > 3000) {
      // Simple heuristic: compare base64 lengths as proxy for content change
      const lengths = recent.map((f) => f.data.length);
      const maxDiff = Math.max(...lengths) - Math.min(...lengths);
      const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const changeRatio = maxDiff / avgLen;

      // Low change ratio = user is staring at screen
      if (changeRatio < 0.02) return 0.8;
      if (changeRatio < 0.05) return 0.5;
    }

    return 0;
  }
}

module.exports = ClassifierService;
module.exports.INTENTS = INTENTS;
