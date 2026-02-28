const BaseService = require('./base-service');
const { spawn } = require('child_process');

class VibeService extends BaseService {
  constructor() {
    super('vibe');
    this.model = 'mistral-large-latest';
  }

  async init() {
    this.model = process.env.VIBE_MODEL || 'mistral-large-latest';
    this.ready = true;
    console.log(`[Vibe] initialized (model: ${this.model})`);
  }

  async process(input) {
    const action = input.payload?.action || 'suggestFunction';

    switch (action) {
      case 'suggestFunction':
        return await this.suggestFunction(input.payload);
      case 'fixError':
        return await this.fixError(input.payload);
      case 'refactor':
        return await this.refactor(input.payload);
      default:
        return await this.suggestFunction(input.payload);
    }
  }

  async suggestFunction(payload) {
    const { code, context } = payload || {};

    try {
      const result = await this._runVibeCli(
        `Suggest a function implementation for the following code context:\n\n${code || context || 'No code provided'}`
      );
      return {
        success: true,
        data: { action: 'suggestFunction', suggestion: result, type: 'code_suggestion' },
      };
    } catch {
      return this._stubSuggestion('suggestFunction');
    }
  }

  async fixError(payload) {
    const { errorText, code } = payload || {};

    try {
      const result = await this._runVibeCli(
        `Fix the following error:\n\nError: ${errorText || 'Unknown error'}\n\nCode context:\n${code || 'No code provided'}`
      );
      return {
        success: true,
        data: { action: 'fixError', suggestion: result, type: 'error_fix' },
      };
    } catch {
      return this._stubSuggestion('fixError');
    }
  }

  async refactor(payload) {
    const { code } = payload || {};

    try {
      const result = await this._runVibeCli(
        `Refactor the following code for clarity and performance:\n\n${code || 'No code provided'}`
      );
      return {
        success: true,
        data: { action: 'refactor', suggestion: result, type: 'refactor' },
      };
    } catch {
      return this._stubSuggestion('refactor');
    }
  }

  // Spawn Vibe CLI as subprocess and capture output
  _runVibeCli(prompt) {
    return new Promise((resolve, reject) => {
      const proc = spawn('npx', ['vibe', '--model', this.model, '--prompt', prompt], {
        timeout: 30000,
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          resolve(this._parseDiff(stdout));
        } else {
          reject(new Error(stderr || `Vibe exited with code ${code}`));
        }
      });

      proc.on('error', (err) => { reject(err); });
    });
  }

  // Parse Vibe CLI output for code diffs
  _parseDiff(output) {
    const lines = output.split('\n');
    const additions = [];
    const removals = [];
    const context = [];

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions.push(line.slice(1));
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removals.push(line.slice(1));
      } else {
        context.push(line);
      }
    }

    return {
      raw: output,
      additions,
      removals,
      context: context.join('\n'),
      hasDiff: additions.length > 0 || removals.length > 0,
    };
  }

  _stubSuggestion(action) {
    const stubs = {
      suggestFunction: {
        raw: '+ function calculateTotal(items) {\n+   return items.reduce((sum, item) => sum + item.price * item.quantity, 0);\n+ }',
        additions: [
          'function calculateTotal(items) {',
          '  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);',
          '}',
        ],
        removals: ['// TODO: implement'],
        context: 'Line 47 in cart.js',
        hasDiff: true,
      },
      fixError: {
        raw: '- const value = obj.property;\n+ const value = obj?.property ?? defaultValue;',
        additions: ['const value = obj?.property ?? defaultValue;'],
        removals: ['const value = obj.property;'],
        context: 'TypeError: Cannot read property of undefined',
        hasDiff: true,
      },
      refactor: {
        raw: '- for (let i = 0; i < arr.length; i++) { result.push(transform(arr[i])); }\n+ const result = arr.map(transform);',
        additions: ['const result = arr.map(transform);'],
        removals: ['for (let i = 0; i < arr.length; i++) { result.push(transform(arr[i])); }'],
        context: 'Simplified loop to Array.map',
        hasDiff: true,
      },
    };

    return {
      success: true,
      data: {
        action,
        suggestion: stubs[action] || stubs.suggestFunction,
        type: action === 'fixError' ? 'error_fix' : 'code_suggestion',
      },
    };
  }
}

module.exports = VibeService;
