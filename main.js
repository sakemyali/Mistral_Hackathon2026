require('dotenv').config();
const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');
const { initServices, routeRequest, getServiceNames } = require('./services');

let overlayWindow = null;
let isVisible = true;
let isClickThrough = true;

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    focusable: true,
    fullscreenable: false,
    type: 'panel',
    vibrancy: undefined,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Keep on top of everything including fullscreen apps
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Start in click-through mode
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Load the webpack-built renderer
  overlayWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.on('set-click-through', (_event, enabled) => {
  if (!overlayWindow) return;
  isClickThrough = enabled;
  if (enabled) {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWindow.setIgnoreMouseEvents(false);
  }
});

ipcMain.on('set-overlay-bounds', (_event, bounds) => {
  if (!overlayWindow) return;
  overlayWindow.setBounds(bounds);
});

ipcMain.handle('get-display-size', () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { width, height };
});

ipcMain.on('hide-overlay', () => {
  if (overlayWindow) {
    overlayWindow.hide();
    isVisible = false;
  }
});

// ── AI Service IPC Handlers ──────────────────────────────────

ipcMain.handle('ai-capture', async (_event, payload) => {
  return await routeRequest('mistral', { type: 'capture', payload });
});

ipcMain.handle('ai-request', async (_event, { service, payload }) => {
  return await routeRequest(service, { type: 'request', payload });
});

ipcMain.handle('ai-services', async () => {
  return getServiceNames();
});

// ── App Lifecycle ─────────────────────────────────────────────

app.whenReady().then(async () => {
  await initServices();
  createOverlayWindow();

  // Toggle visibility: Ctrl+Shift+S (Cmd+Shift+S on macOS)
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (!overlayWindow) return;
    if (isVisible) {
      overlayWindow.hide();
      isVisible = false;
    } else {
      overlayWindow.show();
      isVisible = true;
    }
  });

  // Capture / trigger AI: Ctrl+Shift+C
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    if (overlayWindow && isVisible) {
      overlayWindow.webContents.send('capture-trigger');
    }
  });

  // ESC hides overlay
  globalShortcut.register('Escape', () => {
    if (overlayWindow && isVisible) {
      overlayWindow.webContents.send('escape-pressed');
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
});
