import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  clipboard,
} from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Required for transparent windows on Windows/Linux
app.disableHardwareAcceleration()

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let overlayVisible = true
let isQuitting = false

const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

// ─── Multi-monitor: compute bounding box of all displays ─────────────────────
function getAllDisplayBounds() {
  const displays = screen.getAllDisplays()
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const d of displays) {
    minX = Math.min(minX, d.bounds.x)
    minY = Math.min(minY, d.bounds.y)
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width)
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function createOverlayWindow() {
  const bounds = getAllDisplayBounds()

  overlayWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setContentProtection(true)

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })

  if (VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    overlayWindow.loadFile(indexHtml)
  }
}

// ─── Graceful quit ──────────────────────────────────────────────────────────
function gracefulQuit() {
  if (isQuitting) return
  isQuitting = true

  globalShortcut.unregisterAll()

  if (tray) {
    tray.destroy()
    tray = null
  }

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy()
  }
  overlayWindow = null

  app.quit()
}

// ─── System tray ─────────────────────────────────────────────────────────────
function createTray() {
  // Create a simple 16x16 tray icon
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAARklEQVQ4y2P4z8BQz0BAwAADTAxEApIMMIIaQBYgyQArqAEkAZwGMDIyMjDgALgMYCIkF0wdBjAxkOgFJHsBUYBsLyAKAAAKJBHxDeddQAAAABJRU5ErkJggg=='
  )
  tray = new Tray(icon)
  tray.setToolTip('dorAImon')

  const updateMenu = () => {
    if (!tray || isQuitting) return
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Toggle Minimize',
        click: () => sendToRenderer('toggle-minimize'),
      },
      {
        label: 'Toggle Translation',
        click: () => {
          if (!isQuitting && overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('toggle-translation')
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit dorAImon',
        click: () => gracefulQuit(),
      },
    ])
    tray?.setContextMenu(contextMenu)
  }

  updateMenu()

  // Rebuild menu when visibility changes
  ipcMain.on('tray-update', () => updateMenu())
}

// ─── Toggle overlay visibility ───────────────────────────────────────────────
function toggleOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed() || isQuitting) return
  if (overlayVisible) {
    overlayWindow.hide()
  } else {
    overlayWindow.show()
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  }
  overlayVisible = !overlayVisible
  ipcMain.emit('tray-update')
}

// ─── Global hotkeys ──────────────────────────────────────────────────────────
function sendToRenderer(channel: string) {
  if (!isQuitting && overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(channel)
  }
}

function registerHotkeys() {
  globalShortcut.register('Alt+T', () => sendToRenderer('toggle-translation'))
  globalShortcut.register('Alt+H', () => sendToRenderer('toggle-minimize'))
  globalShortcut.register('Alt+Q', () => gracefulQuit())
  globalShortcut.register('Alt+R', () => sendToRenderer('start-region-select'))
  globalShortcut.register('Alt+D', () => sendToRenderer('dismiss-suggestion'))
  globalShortcut.register('Alt+A', () => sendToRenderer('apply-suggestion'))
  globalShortcut.register('Alt+C', () => sendToRenderer('toggle-chat'))
  globalShortcut.register('Alt+S', () => sendToRenderer('toggle-assistant'))
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

// Toggle click-through on/off for the widget area
ipcMain.on('set-ignore-mouse', (_event, ignore: boolean) => {
  if (isQuitting || !overlayWindow || overlayWindow.isDestroyed()) return
  if (ignore) {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  } else {
    overlayWindow.setIgnoreMouseEvents(false)
  }
})

// Set window opacity
ipcMain.on('set-opacity', (_event, opacity: number) => {
  if (isQuitting || !overlayWindow || overlayWindow.isDestroyed()) return
  overlayWindow.setOpacity(Math.max(0.1, Math.min(1, opacity)))
})

// Quit from renderer
ipcMain.on('quit-app', () => {
  gracefulQuit()
})

// Copy text to clipboard
ipcMain.on('copy-to-clipboard', (_event, text: string) => {
  if (isQuitting) return
  clipboard.writeText(text)
})

// Paste to active window: copy text to clipboard, then simulate Cmd+V / Ctrl+V
// Uses platform-specific commands (no native deps required)
ipcMain.handle('paste-to-active-window', async (_event, text: string) => {
  if (isQuitting) return { success: false, error: 'App is quitting' }
  try {
    const { exec } = require('child_process')

    // Step 1: Write to clipboard
    clipboard.writeText(text)

    // Step 2: Brief delay for clipboard propagation
    await new Promise(resolve => setTimeout(resolve, 100))

    // Step 3: Simulate paste keystroke via OS-level commands
    await new Promise<void>((resolve, reject) => {
      let cmd: string
      if (process.platform === 'darwin') {
        // AppleScript: tell System Events to press Cmd+V
        cmd = `osascript -e 'tell application "System Events" to keystroke "v" using command down'`
      } else if (process.platform === 'win32') {
        // PowerShell: send Ctrl+V via SendKeys
        cmd = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`
      } else {
        // Linux: xdotool
        cmd = `xdotool key ctrl+v`
      }

      exec(cmd, (error: Error | null) => {
        if (error) reject(error)
        else resolve()
      })
    })

    return { success: true }
  } catch (err) {
    console.error('[Paste] Keyboard simulation failed:', err)
    return { success: false, error: String(err) }
  }
})

// Temporarily toggle window focusable (for region selection)
ipcMain.on('set-focusable', (_event, focusable: boolean) => {
  if (isQuitting || !overlayWindow || overlayWindow.isDestroyed()) return
  overlayWindow.setFocusable(focusable)
  if (focusable) {
    overlayWindow.focus()
  } else {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  }
})

// Region selection result from renderer
ipcMain.on('set-capture-region', (_event, region: { x: number; y: number; width: number; height: number } | null) => {
  if (isQuitting || !overlayWindow || overlayWindow.isDestroyed()) return
  overlayWindow.webContents.send('capture-region-updated', region)
})

// Region selecting mode: register/unregister temporary Escape shortcut
// (overlay is focusable:false so keydown events never reach the renderer)
ipcMain.on('region-selecting', (_event, active: boolean) => {
  if (isQuitting) return
  if (active) {
    globalShortcut.register('Escape', () => {
      if (!isQuitting && overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('cancel-region-select')
      }
      globalShortcut.unregister('Escape')
    })
  } else {
    try { globalShortcut.unregister('Escape') } catch { /* already unregistered */ }
  }
})

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Request macOS Accessibility permission for keyboard simulation
  if (process.platform === 'darwin') {
    const { systemPreferences } = require('electron')
    systemPreferences.isTrustedAccessibilityClient(true)
  }

  createOverlayWindow()
  createTray()
  registerHotkeys()
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  overlayWindow = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (isQuitting) return
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createOverlayWindow()
  }
})
