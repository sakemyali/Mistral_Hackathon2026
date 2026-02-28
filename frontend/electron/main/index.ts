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

  if (VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    overlayWindow.loadFile(indexHtml)
  }
}

// ─── System tray ─────────────────────────────────────────────────────────────
function createTray() {
  // Create a simple 16x16 tray icon
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAARklEQVQ4y2P4z8BQz0BAwAADTAxEApIMMIIaQBYgyQArqAEkAZwGMDIyMjDgALgMYCIkF0wdBjAxkOgFJHsBUYBsLyAKAAAKJBHxDeddQAAAABJRU5ErkJggg=='
  )
  tray = new Tray(icon)
  tray.setToolTip('Doraemon')

  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: overlayVisible ? 'Hide Overlay' : 'Show Overlay',
        click: () => toggleOverlay(),
      },
      {
        label: 'Toggle Translation',
        click: () => overlayWindow?.webContents.send('toggle-translation'),
      },
      { type: 'separator' },
      {
        label: 'Quit Doraemon',
        click: () => {
          overlayWindow?.webContents.send('app-quit')
          setTimeout(() => app.quit(), 300)
        },
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
  if (!overlayWindow) return
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
function registerHotkeys() {
  globalShortcut.register('Alt+T', () => {
    overlayWindow?.webContents.send('toggle-translation')
  })
  globalShortcut.register('Alt+H', () => {
    toggleOverlay()
  })
  globalShortcut.register('Alt+Q', () => {
    overlayWindow?.webContents.send('app-quit')
    setTimeout(() => app.quit(), 300)
  })
  globalShortcut.register('Alt+R', () => {
    overlayWindow?.webContents.send('start-region-select')
  })
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

// Toggle click-through on/off for the widget area
ipcMain.on('set-ignore-mouse', (_event, ignore: boolean) => {
  if (overlayWindow) {
    if (ignore) {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true })
    } else {
      overlayWindow.setIgnoreMouseEvents(false)
    }
  }
})

// Set window opacity
ipcMain.on('set-opacity', (_event, opacity: number) => {
  overlayWindow?.setOpacity(Math.max(0.1, Math.min(1, opacity)))
})

// Quit from renderer
ipcMain.on('quit-app', () => {
  app.quit()
})

// Copy text to clipboard
ipcMain.on('copy-to-clipboard', (_event, text: string) => {
  clipboard.writeText(text)
})

// Region selection result from renderer
ipcMain.on('set-capture-region', (_event, region: { x: number; y: number; width: number; height: number } | null) => {
  // Forward to renderer for use in OCR requests
  overlayWindow?.webContents.send('capture-region-updated', region)
})

// Region selecting mode: register/unregister temporary Escape shortcut
// (overlay is focusable:false so keydown events never reach the renderer)
ipcMain.on('region-selecting', (_event, active: boolean) => {
  if (active) {
    globalShortcut.register('Escape', () => {
      overlayWindow?.webContents.send('cancel-region-select')
      globalShortcut.unregister('Escape')
    })
  } else {
    globalShortcut.unregister('Escape')
  }
})

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createOverlayWindow()
  createTray()
  registerHotkeys()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  overlayWindow = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createOverlayWindow()
  }
})
