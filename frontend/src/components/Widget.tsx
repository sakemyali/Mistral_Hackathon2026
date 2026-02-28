import { useRef, useState, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import IntentBadge from './IntentBadge'
import OpacitySlider from './OpacitySlider'
import LanguagePicker from './LanguagePicker'

export default function Widget() {
  const {
    connected,
    widgetExpanded,
    setWidgetExpanded,
    translationEnabled,
    setTranslationEnabled,
    translationLoading,
    captureRegion,
    setCaptureRegion,
    regionSelecting,
    setRegionSelecting,
  } = useAppStore()

  const widgetRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

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
      if ((e.target as HTMLElement).closest('button, input, select, label')) return
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

  const handleStartRegion = useCallback(() => {
    setRegionSelecting(true)
  }, [setRegionSelecting])

  const handleResetRegion = useCallback(() => {
    setCaptureRegion(null)
    window.electronAPI?.setCaptureRegion(null)
  }, [setCaptureRegion])

  const handleQuit = useCallback(() => {
    window.electronAPI?.quit()
  }, [])

  return (
    <div
      ref={widgetRef}
      className="fixed pointer-events-auto select-none"
      style={{
        left: position.x,
        top: position.y,
        zIndex: 99999,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Collapsed: small pill */}
      {!widgetExpanded && (
        <button
          onClick={() => setWidgetExpanded(true)}
          className="flex items-center gap-2 bg-gray-900/90 backdrop-blur-md
            rounded-full px-3 py-1.5 border border-white/10 hover:border-white/30
            transition-all shadow-lg cursor-pointer"
        >
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-400' : 'bg-red-400'
            }`}
          />
          <span className="text-white text-xs font-medium">Doraemon</span>
          <IntentBadge />
          {translationLoading && (
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
        </button>
      )}

      {/* Expanded: full panel */}
      {widgetExpanded && (
        <div
          className="bg-gray-900/90 backdrop-blur-md rounded-xl border border-white/10
            shadow-2xl w-[280px] overflow-hidden"
          onMouseDown={handleDragStart}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 cursor-grab">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-green-400' : 'bg-red-400'
                }`}
              />
              <span className="text-white text-xs font-semibold">Doraemon</span>
              {translationLoading && (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWidgetExpanded(false)}
                className="text-white/50 hover:text-white text-xs px-1 cursor-pointer"
                title="Minimize"
              >
                ─
              </button>
              <button
                onClick={handleQuit}
                className="text-white/50 hover:text-red-400 text-xs px-1 cursor-pointer"
                title="Quit (Alt+Q)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-3 p-3">
            {/* Intent */}
            <div>
              <label className="text-white/40 text-[10px] uppercase tracking-wider">
                Intent
              </label>
              <IntentBadge />
            </div>

            {/* Translation toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <label className="text-white/70 text-xs">Translate</label>
                <span className="text-white/30 text-[9px]">Alt+T</span>
              </div>
              <button
                onClick={() => setTranslationEnabled(!translationEnabled)}
                className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${
                  translationEnabled ? 'bg-blue-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                    translationEnabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Language picker (shown when translation is on) */}
            {translationEnabled && <LanguagePicker />}

            {/* Region selection */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label className="text-white/70 text-xs">Capture Region</label>
                  <span className="text-white/30 text-[9px]">Alt+R</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {!captureRegion ? (
                  <button
                    onClick={handleStartRegion}
                    disabled={regionSelecting}
                    className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-[10px]
                      rounded px-2 py-0.5 border border-blue-500/30 cursor-pointer
                      disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {regionSelecting ? 'Selecting...' : 'Select Region'}
                  </button>
                ) : (
                  <>
                    <span className="text-green-400/70 text-[10px]">
                      {captureRegion.width}×{captureRegion.height}
                    </span>
                    <button
                      onClick={handleStartRegion}
                      className="bg-white/10 hover:bg-white/20 text-white/70 text-[10px]
                        rounded px-2 py-0.5 cursor-pointer transition-colors"
                    >
                      Reselect
                    </button>
                    <button
                      onClick={handleResetRegion}
                      className="bg-white/10 hover:bg-red-500/20 text-white/50 hover:text-red-400
                        text-[10px] rounded px-2 py-0.5 cursor-pointer transition-colors"
                    >
                      Reset
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Opacity */}
            <OpacitySlider />

            {/* Hotkey hints */}
            <div className="border-t border-white/10 pt-2 mt-1">
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span className="text-white/30 text-[9px]">Alt+T  Translate</span>
                <span className="text-white/30 text-[9px]">Alt+H  Hide</span>
                <span className="text-white/30 text-[9px]">Alt+R  Region</span>
                <span className="text-white/30 text-[9px]">Alt+Q  Quit</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
