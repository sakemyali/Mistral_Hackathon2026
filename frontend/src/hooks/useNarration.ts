import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import type { VibeAgentData } from '../types'

/**
 * Plays narration audio when an agent action contains TTS data.
 * Decodes base64 audio → Blob → Audio element → play.
 */
export function useNarration() {
  const agentAction = useAppStore((s) => s.agentAction)
  const voiceEnabled = useAppStore((s) => s.voiceEnabled)
  const setNarrationPlaying = useAppStore((s) => s.setNarrationPlaying)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!agentAction || !voiceEnabled) return

    const data = agentAction.data as VibeAgentData | undefined
    const audioBuffer = data?.narration?.audioBuffer
    if (!audioBuffer) return

    // Decode base64 → Uint8Array → Blob → object URL
    try {
      const binaryStr = atob(audioBuffer)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)

      // Cleanup previous
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio

      audio.onplay = () => setNarrationPlaying(true)
      audio.onended = () => {
        setNarrationPlaying(false)
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current)
          urlRef.current = null
        }
      }
      audio.onerror = () => {
        setNarrationPlaying(false)
        console.error('[Narration] Audio playback error')
      }

      audio.play().catch((err) => {
        console.error('[Narration] Play failed:', err)
        setNarrationPlaying(false)
      })
    } catch (err) {
      console.error('[Narration] Decode error:', err)
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
      setNarrationPlaying(false)
    }
  }, [agentAction, voiceEnabled, setNarrationPlaying])
}
