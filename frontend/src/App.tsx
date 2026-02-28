import { useEffect } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import { useTranslation } from './hooks/useTranslation'
import { useAppStore } from './store/appStore'
import Overlay from './components/Overlay'

function App() {
  const { send, translationHandlerRef } = useWebSocket()
  useTranslation(send, translationHandlerRef)

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
          setTranslationEnabled(!translationEnabled)
        }),
      )

      // Alt+Q: quit notification
      cleanups.push(
        window.electronAPI.onAppQuit(() => {
          window.electronAPI?.quit()
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
  }, [translationEnabled, setTranslationEnabled, setRegionSelecting, setCaptureRegion])

  return <Overlay />
}

export default App
