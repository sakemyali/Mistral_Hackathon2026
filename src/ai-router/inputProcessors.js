/**
 * Input Processors
 * Handles audio, camera, and screenshot inputs
 */

const { desktopCapturer } = require('electron');
const fs = require('fs').promises;

class InputProcessor {
  constructor() {
    this.audioRecorder = null;
    this.isRecording = false;
  }

  /**
   * Screenshot Capture
   * Captures the current screen and returns base64 image data
   */
  async captureScreenshot(options = {}) {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: options.width || 1920,
          height: options.height || 1080
        }
      });

      if (sources.length > 0) {
        const screenshot = sources[0].thumbnail;
        return {
          type: 'screenshot',
          data: screenshot.toDataURL(),
          timestamp: new Date().toISOString(),
          size: {
            width: screenshot.getSize().width,
            height: screenshot.getSize().height
          }
        };
      }
      throw new Error('No screen sources available');
    } catch (error) {
      console.error('Screenshot capture error:', error);
      return {
        type: 'screenshot',
        data: null,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Camera Access
   * Captures from webcam (requires getUserMedia in renderer process)
   */
  async captureCamera(config = {}) {
    // This will be handled in renderer process due to browser APIs
    return {
      type: 'camera-request',
      config: {
        width: config.width || 640,
        height: config.height || 480,
        facingMode: config.facingMode || 'user'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Audio Recording Setup
   * Returns configuration for audio recording in renderer
   */
  async setupAudioRecording(config = {}) {
    return {
      type: 'audio-setup',
      config: {
        sampleRate: config.sampleRate || 44100,
        channels: config.channels || 1,
        bitsPerSample: config.bitsPerSample || 16,
        duration: config.duration || 30000, // 30 seconds max
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process Text Input
   * Handles direct text input from user
   */
  processTextInput(text, metadata = {}) {
    return {
      type: 'text',
      data: text.trim(),
      metadata: {
        length: text.length,
        language: metadata.language || 'auto-detect',
        source: metadata.source || 'direct-input',
        ...metadata
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * File Input Processing
   * Handles uploaded files (images, audio, text)
   */
  async processFileInput(filePath, type) {
    try {
      const stats = await fs.stat(filePath);
      
      if (type === 'image' || filePath.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
        const buffer = await fs.readFile(filePath);
        const base64 = buffer.toString('base64');
        const mimeType = this.getMimeType(filePath);
        
        return {
          type: 'image',
          data: `data:${mimeType};base64,${base64}`,
          metadata: {
            filename: filePath.split('/').pop(),
            size: stats.size,
            mimeType
          },
          timestamp: new Date().toISOString()
        };
      }
      
      if (type === 'audio' || filePath.match(/\.(mp3|wav|m4a|ogg)$/i)) {
        const buffer = await fs.readFile(filePath);
        const base64 = buffer.toString('base64');
        const mimeType = this.getMimeType(filePath);
        
        return {
          type: 'audio',
          data: `data:${mimeType};base64,${base64}`,
          metadata: {
            filename: filePath.split('/').pop(),
            size: stats.size,
            mimeType,
            duration: null // Would need audio analysis library
          },
          timestamp: new Date().toISOString()
        };
      }
      
      if (type === 'text' || filePath.match(/\.(txt|md|js|json|html|css)$/i)) {
        const content = await fs.readFile(filePath, 'utf8');
        
        return {
          type: 'text',
          data: content,
          metadata: {
            filename: filePath.split('/').pop(),
            size: stats.size,
            lines: content.split('\\n').length
          },
          timestamp: new Date().toISOString()
        };
      }
      
      throw new Error(`Unsupported file type: ${filePath}`);
      
    } catch (error) {
      console.error('File processing error:', error);
      return {
        type: 'error',
        error: error.message,
        filePath,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
      'ogg': 'audio/ogg'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Validate and prepare input for AI processing
   */
  validateInput(input) {
    const requiredFields = ['type', 'timestamp'];
    const isValid = requiredFields.every(field => input[field]);
    
    if (!isValid) {
      return {
        valid: false,
        error: 'Missing required fields: ' + requiredFields.filter(field => !input[field]).join(', ')
      };
    }

    if (input.type === 'text' && (!input.data || input.data.trim().length === 0)) {
      return {
        valid: false,
        error: 'Text input cannot be empty'
      };
    }

    if (['image', 'audio'].includes(input.type) && !input.data) {
      return {
        valid: false,
        error: `${input.type} data is required`
      };
    }

    return { valid: true };
  }
}

module.exports = { InputProcessor };