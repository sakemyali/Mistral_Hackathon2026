const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ghostAPI', {
  // Click-through control
  setClickThrough: (enabled) => ipcRenderer.send('set-click-through', enabled),

  // Window bounds
  setOverlayBounds: (bounds) => ipcRenderer.send('set-overlay-bounds', bounds),
  getDisplaySize: () => ipcRenderer.invoke('get-display-size'),

  // Visibility
  hideOverlay: () => ipcRenderer.send('hide-overlay'),

  // ── AI Processing APIs ──
  processText: (text, options) => ipcRenderer.invoke('ai-process-text', text, options),
  processScreenshot: (options) => ipcRenderer.invoke('ai-process-screenshot', options),
  processCamera: (options) => ipcRenderer.invoke('ai-process-camera', options),
  processAudio: (options) => ipcRenderer.invoke('ai-process-audio', options),
  processFile: (filePath, type, options) => ipcRenderer.invoke('ai-process-file', filePath, type, options),
  getAIStatus: () => ipcRenderer.invoke('ai-get-status'),

  // Translation Language Setting APIs
  setTranslationLanguage: (language) => ipcRenderer.invoke('set-translation-language', language),
  getTranslationLanguage: () => ipcRenderer.invoke('get-translation-language'),

  // Realtime Translation APIs
  startRealtimeTranslation: () => ipcRenderer.invoke('realtime-translation-start'),
  stopRealtimeTranslation: () => ipcRenderer.invoke('realtime-translation-stop'),
  getRealtimeTranslationStatus: () => ipcRenderer.invoke('realtime-translation-status'),

  // Events from main process
  onCaptureTrigger: (callback) => {
    ipcRenderer.on('capture-trigger', () => callback());
    return () => ipcRenderer.removeAllListeners('capture-trigger');
  },
  onScreenshotTrigger: (callback) => {
    ipcRenderer.on('screenshot-trigger', () => callback());
    return () => ipcRenderer.removeAllListeners('screenshot-trigger');
  },
  onCameraTrigger: (callback) => {
    ipcRenderer.on('camera-trigger', () => callback());
    return () => ipcRenderer.removeAllListeners('camera-trigger');
  },
  onAudioTrigger: (callback) => {
    ipcRenderer.on('audio-trigger', () => callback());
    return () => ipcRenderer.removeAllListeners('audio-trigger');
  },
  onEscapePressed: (callback) => {
    ipcRenderer.on('escape-pressed', () => callback());
    return () => ipcRenderer.removeAllListeners('escape-pressed');
  },
  onRealtimeTranslationToggle: (callback) => {
    ipcRenderer.on('realtime-translation-toggle', () => callback());
    return () => ipcRenderer.removeAllListeners('realtime-translation-toggle');
  },
  onRealtimeTranslationResult: (callback) => {
    ipcRenderer.on('realtime-translation-result', (event, result) => callback(result));
    return () => ipcRenderer.removeAllListeners('realtime-translation-result');
  },
  
  // Screenshot status events
  onScreenshotStatus: (callback) => {
    ipcRenderer.on('screenshot-status', (event, status) => callback(status));
    return () => ipcRenderer.removeAllListeners('screenshot-status');
  },
  
  // Screenshot save notification events
  onScreenshotSaved: (callback) => {
    ipcRenderer.on('screenshot-saved', (event, saveInfo) => callback(saveInfo));
    return () => ipcRenderer.removeAllListeners('screenshot-saved');
  },
  
  // JSON save notification events
  onJsonSaved: (callback) => {
    ipcRenderer.on('json-saved', (event, saveInfo) => callback(saveInfo));
    return () => ipcRenderer.removeAllListeners('json-saved');
  }
});
