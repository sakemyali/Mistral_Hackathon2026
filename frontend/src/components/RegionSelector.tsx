import { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../store/appStore'

interface SelectionBox {
  startX: number
  startY: number
  endX: number
  endY: number
}

export default function RegionSelector() {
  const { regionSelecting, setRegionSelecting, setCaptureRegion } = useAppStore()
  const [renderBox, setRenderBox] = useState<SelectionBox | null>(null)

  // Use refs to avoid stale closures in mouse event handlers
  const selectionRef = useRef<SelectionBox | null>(null)
  const isDrawing = useRef(false)

  const cancelSelection = useCallback(() => {
    isDrawing.current = false
    selectionRef.current = null
    setRenderBox(null)
    setRegionSelecting(false)
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

    // Minimum 20x20 selection
    if (width >= 20 && height >= 20) {
      const region = { x, y, width, height }
      setCaptureRegion(region)
      window.electronAPI?.setCaptureRegion(region)
    }

    selectionRef.current = null
    setRenderBox(null)
    setRegionSelecting(false)
    window.electronAPI?.setIgnoreMouse(true)
    window.electronAPI?.setRegionSelecting(false)
  }, [setCaptureRegion, setRegionSelecting, cancelSelection])

  // When entering region-select mode, register Escape via main process
  // and attach window-level mouse listeners
  useEffect(() => {
    if (!regionSelecting) return

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

    // Use capture phase to intercept events before any child elements
    window.addEventListener('mousedown', handleMouseDown, true)
    window.addEventListener('mousemove', handleMouseMove, true)
    window.addEventListener('mouseup', handleMouseUp, true)

    // Listen for Escape from Electron main process (window is non-focusable)
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
      style={{ pointerEvents: 'auto' }}
    >
      {/* Semi-transparent overlay — pointer-events-none so it doesn't eat drags */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {/* Instructions */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md rounded-full px-4 py-1.5
          border border-white/20 text-white text-xs font-medium">
          Drag to select capture region · Press Esc to cancel
        </div>
      </div>

      {/* Selection rectangle — pointer-events-none so it doesn't interfere */}
      {rect && rect.width > 0 && rect.height > 0 && (
        <div className="pointer-events-none">
          <div
            className="absolute border-2 border-blue-400 rounded"
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)',
              backgroundColor: 'transparent',
            }}
          />
          {/* Size indicator */}
          <div
            className="absolute text-white text-[10px] bg-blue-500/80 rounded px-1.5 py-0.5"
            style={{
              left: rect.left,
              top: rect.top + rect.height + 4,
            }}
          >
            {Math.round(rect.width)} × {Math.round(rect.height)}
          </div>
        </div>
      )}
    </div>
  )
}
