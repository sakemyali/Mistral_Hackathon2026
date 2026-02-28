const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ghostAPI', {
  // Click-through control
  setClickThrough: (enabled) => ipcRenderer.send('set-click-through', enabled),

  // Window bounds
  setOverlayBounds: (bounds) => ipcRenderer.send('set-overlay-bounds', bounds),
  getDisplaySize: () => ipcRenderer.invoke('get-display-size'),

  // Visibility
  hideOverlay: () => ipcRenderer.send('hide-overlay'),

  // Events from main process
  onCaptureTrigger: (callback) => {
    ipcRenderer.on('capture-trigger', () => callback());
    return () => ipcRenderer.removeAllListeners('capture-trigger');
  },
  onEscapePressed: (callback) => {
    ipcRenderer.on('escape-pressed', () => callback());
    return () => ipcRenderer.removeAllListeners('escape-pressed');
  },

  // AI services
  aiCapture: (payload) => ipcRenderer.invoke('ai-capture', payload),
  aiRequest: (service, payload) => ipcRenderer.invoke('ai-request', { service, payload }),
  getAIServices: () => ipcRenderer.invoke('ai-services'),

  // Screen capture loop
  startScreenLoop: () => ipcRenderer.invoke('start-screen-loop'),
  stopScreenLoop: () => ipcRenderer.invoke('stop-screen-loop'),

  // Pipeline events from main process
  onAgentResult: (callback) => {
    ipcRenderer.on('agent-result', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('agent-result');
  },
  onDebugInfo: (callback) => {
    ipcRenderer.on('debug-info', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('debug-info');
  },
  onPlayAudio: (callback) => {
    ipcRenderer.on('play-audio', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('play-audio');
  },

  // User actions (feedback for W&B)
  acceptSuggestion: (data) => ipcRenderer.send('user-action', { action: 'accepted', ...data }),
  rejectSuggestion: (data) => ipcRenderer.send('user-action', { action: 'rejected', ...data }),

  // Voice mode
  toggleVoiceMode: () => ipcRenderer.invoke('toggle-voice-mode'),
});
