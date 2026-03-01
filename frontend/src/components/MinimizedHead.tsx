import { useRef, useState, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import DoraimonFace from './DoraimonFace'

export default function MinimizedHead() {
  const {
    connected,
    currentIntent,
    translationLoading,
    narrationPlaying,
    setMinimized,
  } = useAppStore()

  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const clickStart = useRef({ x: 0, y: 0 })

  const handleMouseEnter = useCallback(() => {
    window.electronAPI?.setIgnoreMouse(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (!dragging) {
      window.electronAPI?.setIgnoreMouse(true)
    }
  }, [dragging])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setDragging(true)
      clickStart.current = { x: e.clientX, y: e.clientY }
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

      const handleUp = (ev: MouseEvent) => {
        setDragging(false)
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)

        // If barely moved, treat as click → restore full overlay
        const dx = ev.clientX - clickStart.current.x
        const dy = ev.clientY - clickStart.current.y
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
          setMinimized(false)
        }
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [position, setMinimized],
  )

  return (
    <div
      className="fixed pointer-events-auto select-none cursor-pointer"
      style={{
        left: position.x,
        top: position.y,
        zIndex: 99999,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      title="Click to restore dorAImon"
    >
      <div className="bg-gray-900/80 backdrop-blur-md rounded-full p-1.5
        border border-white/10 hover:border-white/30 shadow-lg transition-all
        hover:scale-110 active:scale-95">
        <DoraimonFace
          intent={currentIntent}
          loading={translationLoading}
          connected={connected}
          size={36}
          talking={narrationPlaying}
        />
      </div>
    </div>
  )
}
