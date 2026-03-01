import { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import DoraimonFace from './DoraimonFace'

interface SelectionBox {
  startX: number
  startY: number
  endX: number
  endY: number
}

export default function RegionSelector() {
  const { regionSelecting, setRegionSelecting, setCaptureRegion } = useAppStore()
  const [renderBox, setRenderBox] = useState<SelectionBox | null>(null)

  const selectionRef = useRef<SelectionBox | null>(null)
  const isDrawing = useRef(false)

  const cancelSelection = useCallback(() => {
    isDrawing.current = false
    selectionRef.current = null
    setRenderBox(null)
    setRegionSelecting(false)
    window.electronAPI?.setFocusable(false)
    window.electronAPI?.setIgnoreMouse(true)
    window.electronAPI?.setRegionSelecting(false)
  }, [setRegionSelecting])

  const finishSelection = useCallback(() => {
    const sel = selectionRef.current
    if (!sel) {
      cancelSelection()
      return
    }

    isDrawing.current = false

    const x = Math.min(sel.startX, sel.endX)
    const y = Math.min(sel.startY, sel.endY)
    const width = Math.abs(sel.endX - sel.startX)
    const height = Math.abs(sel.endY - sel.startY)

    if (width >= 20 && height >= 20) {
      const region = { x, y, width, height }
      setCaptureRegion(region)
      window.electronAPI?.setCaptureRegion(region)
    }

    selectionRef.current = null
    setRenderBox(null)
    setRegionSelecting(false)
    window.electronAPI?.setFocusable(false)
    window.electronAPI?.setIgnoreMouse(true)
    window.electronAPI?.setRegionSelecting(false)
  }, [setCaptureRegion, setRegionSelecting, cancelSelection])

  useEffect(() => {
    if (!regionSelecting) return

    // Make window focusable + capture mouse events for reliable drag
    window.electronAPI?.setFocusable(true)
    window.electronAPI?.setIgnoreMouse(false)
    window.electronAPI?.setRegionSelecting(true)

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      isDrawing.current = true
      const box: SelectionBox = {
        startX: e.clientX,
        startY: e.clientY,
        endX: e.clientX,
        endY: e.clientY,
      }
      selectionRef.current = box
      setRenderBox(box)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawing.current || !selectionRef.current) return
      e.preventDefault()
      const updated = {
        ...selectionRef.current,
        endX: e.clientX,
        endY: e.clientY,
      }
      selectionRef.current = updated
      setRenderBox(updated)
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDrawing.current) return
      e.preventDefault()
      finishSelection()
    }

    window.addEventListener('mousedown', handleMouseDown, true)
    window.addEventListener('mousemove', handleMouseMove, true)
    window.addEventListener('mouseup', handleMouseUp, true)

    const cleanupCancel = window.electronAPI?.onCancelRegionSelect(() => {
      cancelSelection()
    })

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true)
      window.removeEventListener('mousemove', handleMouseMove, true)
      window.removeEventListener('mouseup', handleMouseUp, true)
      cleanupCancel?.()
    }
  }, [regionSelecting, finishSelection, cancelSelection])

  if (!regionSelecting) return null

  const rect = renderBox
    ? {
        left: Math.min(renderBox.startX, renderBox.endX),
        top: Math.min(renderBox.startY, renderBox.endY),
        width: Math.abs(renderBox.endX - renderBox.startX),
        height: Math.abs(renderBox.endY - renderBox.startY),
      }
    : null

  return (
    <div
      className="fixed inset-0 z-[100000] cursor-crosshair"
      style={{ pointerEvents: 'auto', background: 'transparent' }}
    >
      {/* Instruction pill — top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-md rounded-full
          px-4 py-1.5 border border-white/20 shadow-lg">
          <DoraimonFace intent="normal" connected={true} size={16} />
          <span className="text-white text-xs font-medium">
            Drag to capture · Esc to cancel
          </span>
        </div>
      </div>

      {/* Selection rectangle — marching ants border, fully transparent background */}
      {rect && rect.width > 0 && rect.height > 0 && (
        <div className="pointer-events-none">
          {/* SVG marching ants border */}
          <svg
            className="absolute"
            style={{
              left: rect.left - 2,
              top: rect.top - 2,
              width: rect.width + 4,
              height: rect.height + 4,
            }}
          >
            {/* White background stroke for visibility on dark/light backgrounds */}
            <rect
              x="2" y="2"
              width={rect.width}
              height={rect.height}
              fill="none"
              stroke="white"
              strokeWidth="2"
              rx="3"
              opacity="0.4"
            />
            {/* Animated blue marching ants */}
            <rect
              x="2" y="2"
              width={rect.width}
              height={rect.height}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2"
              strokeDasharray="6 6"
              rx="3"
              style={{ animation: 'marchingAnts 0.4s linear infinite' }}
            />
          </svg>

          {/* Corner handles */}
          {[
            { x: rect.left, y: rect.top },
            { x: rect.left + rect.width, y: rect.top },
            { x: rect.left, y: rect.top + rect.height },
            { x: rect.left + rect.width, y: rect.top + rect.height },
          ].map((corner, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-blue-400 rounded-full border border-white/60"
              style={{ left: corner.x - 4, top: corner.y - 4 }}
            />
          ))}

          {/* Doraemon with camera — bottom right of selection */}
          <div
            className="absolute flex items-center gap-1"
            style={{
              left: rect.left + rect.width - 48,
              top: rect.top + rect.height + 6,
            }}
          >
            <DoraimonFace intent="normal" connected={true} size={20} />
            <span className="text-sm" style={{ lineHeight: 1 }}>📸</span>
          </div>

          {/* Size badge — bottom left */}
          <div
            className="absolute bg-blue-500/90 text-white text-[10px] font-mono
              rounded px-1.5 py-0.5 shadow-md"
            style={{
              left: rect.left,
              top: rect.top + rect.height + 6,
            }}
          >
            {Math.round(rect.width)} × {Math.round(rect.height)}
          </div>
        </div>
      )}
    </div>
  )
}
