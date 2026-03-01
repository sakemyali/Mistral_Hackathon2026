import { ipcRenderer, contextBridge } from 'electron'

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
  pasteToActiveWindow: (text: string) =>
    ipcRenderer.invoke('paste-to-active-window', text),

  // Listen for main process events
  onToggleTranslation: (callback: () => void) => {
    ipcRenderer.on('toggle-translation', () => callback())
    return () => { ipcRenderer.removeAllListeners('toggle-translation') }
  },
  onAppQuit: (callback: () => void) => {
    ipcRenderer.on('app-quit', () => callback())
    return () => { ipcRenderer.removeAllListeners('app-quit') }
  },
  onStartRegionSelect: (callback: () => void) => {
    ipcRenderer.on('start-region-select', () => callback())
    return () => { ipcRenderer.removeAllListeners('start-region-select') }
  },
  onCaptureRegionUpdated: (callback: (region: { x: number; y: number; width: number; height: number } | null) => void) => {
    ipcRenderer.on('capture-region-updated', (_event, region) => callback(region))
    return () => { ipcRenderer.removeAllListeners('capture-region-updated') }
  },
  onCancelRegionSelect: (callback: () => void) => {
    ipcRenderer.on('cancel-region-select', () => callback())
    return () => { ipcRenderer.removeAllListeners('cancel-region-select') }
  },
})
