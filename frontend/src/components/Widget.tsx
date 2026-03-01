import { useRef, useState, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import IntentBadge from './IntentBadge'
import DoraimonFace from './DoraimonFace'
import OpacitySlider from './OpacitySlider'
import LanguagePicker from './LanguagePicker'
import VoiceSelector from './VoiceSelector'

export default function Widget() {
  const {
    connected,
    currentIntent,
    widgetExpanded,
    setWidgetExpanded,
    translationEnabled,
    setTranslationEnabled,
    translationLoading,
    availableMonitors,
    selectedMonitor,
    setSelectedMonitor,
    agentAction,
    narrationPlaying,
    assistantEnabled,
    setAssistantEnabled,
    wsSend,
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

  const handleMonitorChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const idx = Number(e.target.value)
      setSelectedMonitor(idx)
      wsSend?.({ type: 'set_capture_monitor', monitor_index: idx })
    },
    [setSelectedMonitor, wsSend],
  )

  const handleQuit = useCallback(() => {
    window.electronAPI?.quit()
  }, [])

  const handleToggleTranslation = useCallback(() => {
    const next = !translationEnabled
    setTranslationEnabled(next)
    wsSend?.({ type: 'toggle_translation', enabled: next })
  }, [translationEnabled, setTranslationEnabled, wsSend])

  const handleToggleAssistant = useCallback(() => {
    const next = !assistantEnabled
    setAssistantEnabled(next)
    wsSend?.({ type: 'toggle_assistant', enabled: next })
  }, [assistantEnabled, setAssistantEnabled, wsSend])

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
          <DoraimonFace
            intent={currentIntent}
            loading={translationLoading}
            connected={connected}
            size={22}
            talking={narrationPlaying}
          />
          <span className="text-white text-xs font-medium">dorAImon</span>
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
              <DoraimonFace
                intent={currentIntent}
                loading={translationLoading}
                connected={connected}
                size={26}
                talking={narrationPlaying}
              />
              <span className="text-white text-xs font-semibold">dorAImon</span>
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

            {/* Assistant toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <label className="text-white/70 text-xs">Assistant</label>
                <span className="text-white/30 text-[9px]">Alt+S</span>
              </div>
              <button
                onClick={handleToggleAssistant}
                className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${
                  assistantEnabled ? 'bg-green-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                    assistantEnabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Translation toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <label className="text-white/70 text-xs">Translate</label>
                <span className="text-white/30 text-[9px]">Alt+T</span>
              </div>
              <button
                onClick={handleToggleTranslation}
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

            {/* Monitor selector */}
            {availableMonitors.length > 0 && (
              <div className="flex items-center justify-between">
                <label className="text-white/70 text-xs">Monitor</label>
                {availableMonitors.length === 1 ? (
                  <span className="text-white/40 text-[10px]">
                    {availableMonitors[0].width}×{availableMonitors[0].height}
                  </span>
                ) : (
                  <select
                    value={selectedMonitor}
                    onChange={handleMonitorChange}
                    className="bg-white/10 text-white text-[10px] rounded px-1.5 py-0.5
                      border border-white/20 cursor-pointer outline-none
                      hover:border-white/30 transition-colors"
                  >
                    {availableMonitors.map((m) => (
                      <option key={m.index} value={m.index} className="bg-gray-900 text-white">
                        Monitor {m.index} ({m.width}×{m.height})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Voice selector */}
            <VoiceSelector />

            {/* Agent status */}
            {agentAction && (
              <div className="flex items-center gap-1.5">
                <span className="text-white/40 text-[10px] uppercase tracking-wider">Agent</span>
                <span className="text-blue-400/80 text-[10px] font-medium">
                  {agentAction.agent_name}
                </span>
                {agentAction.action && (
                  <span className="text-white/30 text-[9px]">
                    {agentAction.action}
                  </span>
                )}
              </div>
            )}

            {/* Opacity */}
            <OpacitySlider />

            {/* Hotkey hints */}
            <div className="border-t border-white/10 pt-2 mt-1">
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span className="text-white/30 text-[9px]">Alt+T  Translate</span>
                <span className="text-white/30 text-[9px]">Alt+H  Minimize</span>
                <span className="text-white/30 text-[9px]">Alt+S  Assistant</span>
                <span className="text-white/30 text-[9px]">Alt+D  Dismiss</span>
                <span className="text-white/30 text-[9px]">Alt+A  Apply</span>
                <span className="text-white/30 text-[9px]">Alt+C  Chat</span>
                <span className="text-white/30 text-[9px]">Alt+Q  Quit</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
