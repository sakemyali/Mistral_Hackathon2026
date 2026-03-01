import { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import type { VibeAgentData } from '../types'
import DoraimonFace from './DoraimonFace'

const AUTO_DISMISS_MS = 30_000

export default function CodeSuggestionPanel() {
  const agentAction = useAppStore((s) => s.agentAction)
  const codeSuggestionVisible = useAppStore((s) => s.codeSuggestionVisible)
  const narrationPlaying = useAppStore((s) => s.narrationPlaying)
  const dismissCodeSuggestion = useAppStore((s) => s.dismissCodeSuggestion)

  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(() => ({
    x: Math.min(window.screen.availWidth - 380, 800),
    y: 120,
  }))
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Auto-dismiss timer
  useEffect(() => {
    if (!codeSuggestionVisible) return
    const timer = setTimeout(dismissCodeSuggestion, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [codeSuggestionVisible, agentAction, dismissCodeSuggestion])

  const handleMouseEnter = useCallback(() => {
    window.electronAPI?.setIgnoreMouse(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (!dragging) {
      window.electronAPI?.setIgnoreMouse(true)
    }
  }, [dragging])

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, pre')) return
      setDragging(true)
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      }

      const handleMove = (ev: MouseEvent) => {
        setPosition({
          x: ev.clientX - dragOffset.current.x,
          y: ev.clientY - dragOffset.current.y,
        })
      }

      const handleUp = () => {
        setDragging(false)
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [position],
  )

  const handleCopy = useCallback(() => {
    const data = agentAction?.data as VibeAgentData | undefined
    const text = data?.suggestion?.raw
    if (text) {
      window.electronAPI?.copyToClipboard(text)
    }
  }, [agentAction])

  if (!codeSuggestionVisible || !agentAction || agentAction.agent_name !== 'vibe') {
    return null
  }

  const data = agentAction.data as VibeAgentData | undefined
  const suggestion = data?.suggestion
  const narration = data?.narration
  const actionType = agentAction.action

  const isFixError = actionType === 'fixError'
  const badge = isFixError ? 'Fix Error' : 'Suggestion'
  const badgeColor = isFixError
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'

  return (
    <div
      ref={panelRef}
      className="fixed pointer-events-auto select-none animate-[fadeIn_0.2s_ease-out]"
      style={{
        left: position.x,
        top: position.y,
        zIndex: 99998,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="bg-gray-900/90 backdrop-blur-md rounded-xl border border-white/10
          shadow-2xl overflow-hidden transition-all"
        style={{ width: 360 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 cursor-grab"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2">
            <DoraimonFace
              intent={isFixError ? 'typo' : 'hesitant'}
              loading={false}
              connected={true}
              size={18}
            />
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeColor}`}>
              {badge}
            </span>
          </div>
          <button
            onClick={dismissCodeSuggestion}
            className="text-white/40 hover:text-white text-xs px-1 cursor-pointer transition-colors"
            title="Dismiss"
          >
            ✕
          </button>
        </div>

        {/* Narration bar */}
        {narration?.text && (
          <div className="px-3 py-1.5 border-b border-white/5 flex items-center gap-2">
            <span className={`text-[11px] ${narrationPlaying ? 'text-blue-300 animate-pulse' : 'text-white/40'}`}>
              {narrationPlaying ? '🔊' : '💬'}
            </span>
            <span className="text-white/60 text-[11px] italic leading-snug">
              {narration.text}
            </span>
          </div>
        )}

        {/* Code suggestion */}
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'min(50vh, 400px)' }}>
          {suggestion?.raw ? (
            <pre className="px-3 py-2.5 text-[11px] leading-relaxed text-green-300/90 font-mono whitespace-pre-wrap break-words">
              {suggestion.raw}
            </pre>
          ) : (
            <div className="px-3 py-4 text-center">
              <span className="text-white/25 text-xs">No suggestion available</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {suggestion?.raw && (
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/10">
            <span className="text-white/20 text-[9px]">Auto-dismiss in 30s</span>
            <button
              onClick={handleCopy}
              className="bg-white/10 hover:bg-white/20 text-white/70 text-[10px]
                rounded px-2 py-0.5 cursor-pointer transition-colors"
            >
              Copy
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
