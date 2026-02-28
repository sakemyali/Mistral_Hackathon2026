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
});
