import { ipcRenderer, contextBridge } from 'electron'

// Helper to create IPC listener with cleanup
function onIpc(channel: string, callback: (...args: unknown[]) => void) {
  ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  return () => { ipcRenderer.removeAllListeners(channel) }
}

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouse: (ignore: boolean) =>
    ipcRenderer.send('set-ignore-mouse', ignore),
  setOpacity: (opacity: number) =>
    ipcRenderer.send('set-opacity', opacity),
  quit: () =>
    ipcRenderer.send('quit-app'),
  copyToClipboard: (text: string) =>
    ipcRenderer.send('copy-to-clipboard', text),
  setCaptureRegion: (region: { x: number; y: number; width: number; height: number } | null) =>
    ipcRenderer.send('set-capture-region', region),
  setRegionSelecting: (active: boolean) =>
    ipcRenderer.send('region-selecting', active),
  setFocusable: (focusable: boolean) =>
    ipcRenderer.send('set-focusable', focusable),
  pasteToActiveWindow: (text: string) =>
    ipcRenderer.invoke('paste-to-active-window', text),

  // Listen for main process events
  onToggleTranslation: (callback: () => void) => onIpc('toggle-translation', callback),
  onAppQuit: (callback: () => void) => onIpc('app-quit', callback),
  onStartRegionSelect: (callback: () => void) => onIpc('start-region-select', callback),
  onCaptureRegionUpdated: (callback: (region: { x: number; y: number; width: number; height: number } | null) => void) =>
    onIpc('capture-region-updated', callback as (...args: unknown[]) => void),
  onCancelRegionSelect: (callback: () => void) => onIpc('cancel-region-select', callback),

  // F6: Minimized head mode
  onToggleMinimize: (callback: () => void) => onIpc('toggle-minimize', callback),

  // F7: Keyboard shortcuts
  onDismissSuggestion: (callback: () => void) => onIpc('dismiss-suggestion', callback),
  onApplySuggestion: (callback: () => void) => onIpc('apply-suggestion', callback),
  onToggleChat: (callback: () => void) => onIpc('toggle-chat', callback),
  onToggleAssistant: (callback: () => void) => onIpc('toggle-assistant', callback),
})
