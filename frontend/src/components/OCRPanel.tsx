import { useRef, useState, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import type { OCRWord } from '../types'

export default function OCRPanel() {
  const ocrWords = useAppStore((s) => s.ocrWords)
  const translationEnabled = useAppStore((s) => s.translationEnabled)

  // Dragging
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(() => ({
    x: 40,
    y: 80,
  }))
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [collapsed, setCollapsed] = useState(false)

  // Highlight word on screen
  const [highlight, setHighlight] = useState<OCRWord | null>(null)
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

  const handleWordClick = useCallback((word: OCRWord) => {
    setHighlight((prev) => (prev === word ? null : word))
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlight(null), 2500)
  }, [])

  if (ocrWords.length === 0) return null

  const hasTranslation = translationEnabled
  const panelWidth = hasTranslation ? 300 : 280

  return (
    <>
      {/* Highlight rectangle on screen */}
      {highlight && (
        <div
          className="fixed border-2 border-green-400 rounded pointer-events-none"
          style={{
            left: `${highlight.x}px`,
            top: `${highlight.y}px`,
            width: `${highlight.width}px`,
            height: `${highlight.height}px`,
            boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)',
            zIndex: 40,
          }}
        />
      )}

      {/* OCR Panel */}
      <div
        ref={panelRef}
        className="fixed bg-gradient-to-b from-slate-900 to-slate-800 text-white rounded-lg shadow-2xl border border-slate-700 pointer-events-auto"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${panelWidth}px`,
          maxHeight: collapsed ? '40px' : '400px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 50,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-slate-700 cursor-move hover:bg-slate-700 transition-colors"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-green-400">OCR</span>
            <span className="text-xs text-slate-400">
              {ocrWords.length} {ocrWords.length === 1 ? 'word' : 'words'}
            </span>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-white transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>

        {/* Content */}
        {!collapsed && (
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-xs">
            {ocrWords.map((word, index) => (
              <div
                key={index}
                onClick={() => handleWordClick(word)}
                className={`cursor-pointer p-2 rounded transition-all ${
                  highlight === word
                    ? 'bg-green-500 text-white font-semibold'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                }`}
              >
                <div className="font-mono truncate">{word.text}</div>
                <div className="text-slate-400 text-xs mt-0.5">
                  Conf: {(word.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
