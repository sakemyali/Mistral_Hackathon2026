import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import type { WSMessage } from '../types'

let isAppQuitting = false

export function markQuitting() {
  isAppQuitting = true
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const { wsUrl, setConnected, setIntent, setOCRWords } = useAppStore()

  // Callback ref for translation results — set by useTranslation hook
  const translationHandlerRef = useRef<
    ((requestId: string, translations: string[]) => void) | null
  >(null)

  const connect = useCallback(() => {
    if (isAppQuitting) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('[WS] Connected')
      setConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        switch (msg.type) {
          case 'intent_update':
            setIntent(msg.intent, msg.confidence, msg.reasoning)
            useAppStore.getState().setAgentAction(msg.agent_action)
            break
          case 'ocr_update':
            setOCRWords(msg.words)
            break
          case 'translation_result':
            translationHandlerRef.current?.(msg.request_id, msg.translations)
            break
          case 'chat_response':
            useAppStore.getState().addChatMessage({
              role: 'assistant',
              text: msg.text,
              timestamp: Date.now(),
            })
            break
          case 'error':
            console.error('[WS] Backend error:', msg.message)
            useAppStore.getState().setTranslationLoading(false)
            break
        }
      } catch (e) {
        console.error('[WS] Parse error:', e)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      // Don't reconnect if app is quitting
      if (!isAppQuitting) {
        console.log('[WS] Disconnected, reconnecting in 3s...')
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    ws.onerror = () => {
      ws.close()
    }

    wsRef.current = ws
  }, [wsUrl, setConnected, setIntent, setOCRWords])

  const send = useCallback((data: object) => {
    if (!isAppQuitting && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { send, translationHandlerRef }
}
