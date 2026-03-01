import { useEffect } from 'react'
import { useWebSocket, markQuitting } from './hooks/useWebSocket'
import { useTranslation } from './hooks/useTranslation'
import { useNarration } from './hooks/useNarration'
import { useAppStore } from './store/appStore'
import Overlay from './components/Overlay'

function App() {
  const { send, translationHandlerRef } = useWebSocket()
  useTranslation(send, translationHandlerRef)
  useNarration()

  const {
    translationEnabled,
    setTranslationEnabled,
    setRegionSelecting,
    setCaptureRegion,
  } = useAppStore()

  // Wire up IPC listeners from Electron main process
  useEffect(() => {
    const cleanups: (() => void)[] = []

    if (window.electronAPI) {
      // Alt+T: toggle translation
      cleanups.push(
        window.electronAPI.onToggleTranslation(() => {
          const current = useAppStore.getState().translationEnabled
          setTranslationEnabled(!current)
        }),
      )

      // Main process tells us app is quitting — stop WS reconnects
      cleanups.push(
        window.electronAPI.onAppQuit(() => {
          markQuitting()
        }),
      )

      // Alt+R: start region selection
      cleanups.push(
        window.electronAPI.onStartRegionSelect(() => {
          setRegionSelecting(true)
        }),
      )

      // Capture region update from main process
      cleanups.push(
        window.electronAPI.onCaptureRegionUpdated((region) => {
          setCaptureRegion(region)
        }),
      )
    }

    return () => {
      cleanups.forEach((fn) => fn())
    }
  }, [setTranslationEnabled, setRegionSelecting, setCaptureRegion])

  return <Overlay />
}

export default App
