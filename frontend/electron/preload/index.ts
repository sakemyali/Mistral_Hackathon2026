import { ipcRenderer, contextBridge } from 'electron'

// Helper to create IPC listener with cleanup
function onIpc(channel: string, callback: (...args: unknown[]) => void) {
  ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  return () => { ipcRenderer.removeAllListeners(channel) }
}

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouse: (ignore: boolean) =>
    ipcRenderer.send('set-ignore-mouse', ignore),
  setFocusable: (focusable: boolean) =>
    ipcRenderer.send('set-focusable', focusable),
  setOpacity: (opacity: number) =>
    ipcRenderer.send('set-opacity', opacity),
  quit: () =>
    ipcRenderer.send('quit-app'),
  copyToClipboard: (text: string) =>
    ipcRenderer.send('copy-to-clipboard', text),
  pasteToActiveWindow: (text: string) =>
    ipcRenderer.invoke('paste-to-active-window', text),

  // Listen for main process events
  onToggleTranslation: (callback: () => void) => onIpc('toggle-translation', callback),
  onAppQuit: (callback: () => void) => onIpc('app-quit', callback),

  // F6: Minimized head mode
  onToggleMinimize: (callback: () => void) => onIpc('toggle-minimize', callback),

  // F7: Keyboard shortcuts
  onDismissSuggestion: (callback: () => void) => onIpc('dismiss-suggestion', callback),
  onApplySuggestion: (callback: () => void) => onIpc('apply-suggestion', callback),
  onToggleChat: (callback: () => void) => onIpc('toggle-chat', callback),
  onToggleAssistant: (callback: () => void) => onIpc('toggle-assistant', callback),
})
