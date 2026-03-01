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
    setTranslationEnabled,
    setAssistantEnabled,
    setWsSend,
    setMinimized,
    setChatOpen,
    dismissCodeSuggestion,
  } = useAppStore()

  // Register wsSend in store so Widget/ChatWidget can use it
  useEffect(() => {
    setWsSend(send)
  }, [send, setWsSend])

  // Wire up IPC listeners from Electron main process
  useEffect(() => {
    const cleanups: (() => void)[] = []

    if (window.electronAPI) {
      // Alt+T: toggle translation + notify backend
      cleanups.push(
        window.electronAPI.onToggleTranslation(() => {
          const next = !useAppStore.getState().translationEnabled
          setTranslationEnabled(next)
          send({ type: 'toggle_translation', enabled: next })
        }),
      )

      // Main process tells us app is quitting — stop WS reconnects
      cleanups.push(
        window.electronAPI.onAppQuit(() => {
          markQuitting()
        }),
      )

      // Alt+H: toggle minimized mode
      if (window.electronAPI.onToggleMinimize) {
        cleanups.push(
          window.electronAPI.onToggleMinimize(() => {
            const current = useAppStore.getState().minimized
            setMinimized(!current)
          }),
        )
      }

      // Alt+D: dismiss suggestion + notify backend
      if (window.electronAPI.onDismissSuggestion) {
        cleanups.push(
          window.electronAPI.onDismissSuggestion(() => {
            send({ type: 'suggestion_feedback', action: 'dismissed' })
            dismissCodeSuggestion()
          }),
        )
      }

      // Alt+A: apply suggestion
      if (window.electronAPI.onApplySuggestion) {
        cleanups.push(
          window.electronAPI.onApplySuggestion(() => {
            window.dispatchEvent(new CustomEvent('doraemon-apply-suggestion'))
          }),
        )
      }

      // Alt+C: toggle chat
      if (window.electronAPI.onToggleChat) {
        cleanups.push(
          window.electronAPI.onToggleChat(() => {
            const current = useAppStore.getState().chatOpen
            setChatOpen(!current)
          }),
        )
      }

      // Alt+S: toggle assistant
      if (window.electronAPI.onToggleAssistant) {
        cleanups.push(
          window.electronAPI.onToggleAssistant(() => {
            const next = !useAppStore.getState().assistantEnabled
            setAssistantEnabled(next)
            send({ type: 'toggle_assistant', enabled: next })
          }),
        )
      }
    }

    return () => {
      cleanups.forEach((fn) => fn())
    }
  }, [send, setTranslationEnabled, setAssistantEnabled, setMinimized, setChatOpen, dismissCodeSuggestion])

  return <Overlay />
}

export default App
