require('dotenv').config();
const { app, BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer } = require('electron');
const path = require('path');
const { initServices, routeRequest, getServiceNames, getService } = require('./services');

let overlayWindow = null;
let isVisible = true;
let isClickThrough = true;
let captureInterval = null;
let captureRunning = false;
let lastVisionTime = 0;
let lastVisionText = '';

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

  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // Content protection must be set after window is ready to render
  // This hides the window from screen recording, Zoom, OBS, etc.
  overlayWindow.once('ready-to-show', () => {
    overlayWindow.setContentProtection(true);
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    stopScreenLoop();
  });
}

// ── 2fps Screen Capture Loop ─────────────────────────────────

async function captureScreen() {
  if (!overlayWindow) return null;

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 },
    });

    if (sources.length === 0) return null;

    const screenshot = sources[0].thumbnail.toPNG();
    return screenshot.toString('base64');
  } catch (err) {
    console.error('[Capture] Error:', err.message);
    return null;
  }
}

async function runPipeline(screenshotBase64) {
  if (!overlayWindow || !screenshotBase64) return;

  const startTime = Date.now();
  const visionThrottleMs = parseInt(process.env.VISION_THROTTLE_MS, 10) || 3000;

  // Stage 0: Mistral vision analysis (throttled to every ~3s)
  let analysisText = lastVisionText;
  if (Date.now() - lastVisionTime >= visionThrottleMs) {
    const visionResult = await routeRequest('mistral', {
      type: 'request',
      payload: { action: 'analyze', screenshot: screenshotBase64 },
    });
    if (visionResult.success && visionResult.data?.text) {
      analysisText = visionResult.data.text;
      lastVisionText = analysisText;
    }
    lastVisionTime = Date.now();
  }

  // Stage 1: Classify intent (with vision analysis text)
  const classifyResult = await routeRequest('classifier', {
    type: 'classify',
    payload: { screenshot: screenshotBase64, ocrText: '', analysisText },
  });

  if (!classifyResult.success) return;

  const { intent, confidence, allIntents } = classifyResult.data;

  // Stage 2: Route to agent
  const routeResult = await routeRequest('router', {
    type: 'route',
    payload: { intent, confidence, context: {} },
  });

  if (!routeResult.success) return;

  const { agent, action, shouldAct, reason } = routeResult.data;

  // Send debug info to renderer
  overlayWindow.webContents.send('debug-info', {
    intent, confidence, agent, action, shouldAct, reason,
    latencyMs: Date.now() - startTime,
    allIntents, analysisText,
  });

  // Log to W&B
  const wandb = getService('wandb');
  if (wandb) {
    wandb.logIntent({ intent, confidence, agent });
  }

  // Stage 3: Execute agent if needed
  if (shouldAct && agent) {
    const agentStart = Date.now();
    const agentResult = await routeRequest(agent, {
      type: 'execute',
      payload: { action, screenshot: screenshotBase64 },
    });

    const agentLatency = Date.now() - agentStart;

    if (wandb) {
      wandb.logAgentPerformance({
        agent, latencyMs: agentLatency, success: agentResult.success, action,
      });
    }

    // Send result to renderer
    overlayWindow.webContents.send('agent-result', {
      agent, action, result: agentResult, intent, latencyMs: agentLatency,
    });

    // Narrate via ElevenLabs
    const elevenlabs = getService('elevenlabs');
    if (elevenlabs) {
      const narration = await routeRequest('elevenlabs', {
        type: 'execute',
        payload: { action: 'narrate', text: intent, context: { intent } },
      });
      if (narration.success && narration.data.audioBuffer) {
        overlayWindow.webContents.send('play-audio', narration.data);
      }
    }
  }
}

function startScreenLoop() {
  if (captureRunning) return;
  captureRunning = true;

  const fps = parseInt(process.env.CAPTURE_FPS, 10) || 2;
  const intervalMs = Math.round(1000 / fps);

  console.log(`[Capture] Starting screen loop at ${fps}fps (${intervalMs}ms interval)`);

  captureInterval = setInterval(async () => {
    const screenshot = await captureScreen();
    if (screenshot) {
      await runPipeline(screenshot);
    }
  }, intervalMs);
}

function stopScreenLoop() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
    captureRunning = false;
    console.log('[Capture] Screen loop stopped');
  }
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

// ── Screen Loop IPC ──────────────────────────────────────────

ipcMain.handle('start-screen-loop', async () => {
  startScreenLoop();
  return { success: true };
});

ipcMain.handle('stop-screen-loop', async () => {
  stopScreenLoop();
  return { success: true };
});

// ── User Action Logging ──────────────────────────────────────

ipcMain.on('user-action', (_event, data) => {
  const wandb = getService('wandb');
  if (wandb) {
    wandb.logUserFeedback(data);
  }
  if (process.env.DEBUG_MODE === 'true') {
    console.log(`[UserAction] ${data.action} for ${data.agent}`);
  }
});

// ── Voice Mode Toggle ────────────────────────────────────────

ipcMain.handle('toggle-voice-mode', async () => {
  const elevenlabs = getService('elevenlabs');
  if (!elevenlabs) return { success: false, error: 'ElevenLabs not loaded' };

  const modes = ['silent', 'voice', 'auto'];
  const currentIndex = modes.indexOf(elevenlabs.voiceMode);
  const nextMode = modes[(currentIndex + 1) % modes.length];

  return elevenlabs.setVoiceMode(nextMode);
});

// ── App Lifecycle ─────────────────────────────────────────────

app.whenReady().then(async () => {
  await initServices();
  createOverlayWindow();

  // Toggle visibility
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

  // Capture / trigger AI
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
  stopScreenLoop();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
});
