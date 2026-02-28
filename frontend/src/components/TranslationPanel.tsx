import { useRef, useState, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import type { TranslatedWord } from '../types'
import DoraimonFace from './DoraimonFace'
import DoraimonLoading from './DoraimonLoading'

export default function TranslationPanel() {
  const {
    translatedWords,
    translationEnabled,
    translationLoading,
  } = useAppStore()

  // Dragging
  const panelRef = useRef<HTMLDivElement>(null)
  // Use screen.availWidth (primary monitor) instead of window.innerWidth (all monitors)
  const [position, setPosition] = useState(() => ({
    x: Math.min(window.screen.availWidth - 340, 1200),
    y: 80,
  }))
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [collapsed, setCollapsed] = useState(false)

  // Highlight: show where the original text is on screen
  const [highlight, setHighlight] = useState<TranslatedWord | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      if ((e.target as HTMLElement).closest('button')) return
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

  const handleLineClick = useCallback((line: TranslatedWord) => {
    // Toggle: click same line again to dismiss
    setHighlight((prev) => (prev === line ? null : line))
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlight(null), 2500)
  }, [])

  if (!translationEnabled) return null

  const hasContent = translatedWords.length > 0

  return (
    <>
      {/* Highlight rectangle on screen — pointer-events-none */}
      {highlight && (
        <div
          className="fixed pointer-events-none"
          style={{
            left: highlight.x - 4,
            top: highlight.y - 3,
            width: highlight.width + 8,
            height: highlight.height + 6,
            zIndex: 99997,
            border: '2px solid rgba(59, 130, 246, 0.7)',
            borderRadius: 4,
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            boxShadow: '0 0 12px rgba(59, 130, 246, 0.3)',
            animation: 'highlightPulse 2.5s ease-out forwards',
          }}
        />
      )}

      {/* Panel */}
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
          style={{ width: collapsed ? 160 : 320 }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 cursor-grab"
            onMouseDown={handleDragStart}
          >
            <div className="flex items-center gap-1.5">
              <DoraimonFace intent="normal" loading={translationLoading} size={18} />
              <span className="text-white/80 text-[10px] font-semibold uppercase tracking-wider">
                Translation
              </span>
            </div>
            <div className="flex items-center gap-1">
              {hasContent && (
                <span className="text-white/30 text-[9px]">
                  {translatedWords.length} line{translatedWords.length !== 1 ? 's' : ''}
                </span>
              )}
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="text-white/40 hover:text-white text-xs px-1 cursor-pointer transition-colors"
                title={collapsed ? 'Expand' : 'Collapse'}
              >
                {collapsed ? '◂' : '▸'}
              </button>
            </div>
          </div>

          {/* Content */}
          {!collapsed && (
            <div
              className="overflow-y-auto overscroll-contain"
              style={{ maxHeight: 'min(60vh, 500px)' }}
            >
              {!hasContent && !translationLoading && (
                <div className="px-3 py-4 text-center">
                  <span className="text-white/25 text-xs">
                    No text detected
                  </span>
                </div>
              )}

              {!hasContent && translationLoading && (
                <div className="px-3 py-2 flex items-center justify-center">
                  <DoraimonLoading size={52} />
                </div>
              )}

              {hasContent && (
                <div className="flex flex-col">
                  {translatedWords.map((line, i) => (
                    <div
                      key={`${line.original}-${i}`}
                      className={`px-3 py-2 border-b border-white/5 last:border-b-0
                        cursor-pointer transition-colors ${
                          highlight === line
                            ? 'bg-blue-500/15'
                            : 'hover:bg-white/5'
                        }`}
                      onClick={() => handleLineClick(line)}
                    >
                      {/* Translated text */}
                      <div
                        className="text-white text-sm leading-relaxed"
                        style={{ fontWeight: 450 }}
                      >
                        {line.translated}
                      </div>
                      {/* Original text (subtle) */}
                      <div className="text-white/30 text-[10px] leading-snug mt-0.5 truncate">
                        {line.original}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
