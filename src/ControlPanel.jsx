import React, { useState, useRef, useEffect, useCallback } from 'react';

const voiceModeLabels = { silent: 'Silent', voice: 'Voice', auto: 'Auto' };
const voiceModeColors = {
  silent: 'text-white/30',
  voice: 'text-emerald-400/70',
  auto: 'text-violet-400/70',
};

const pipelineStatusColors = {
  idle: 'bg-white/20',
  analyzing: 'bg-amber-400/70 animate-breathe',
  routing: 'bg-blue-400/70 animate-breathe',
  acting: 'bg-emerald-400/70 animate-breathe',
};

export default function ControlPanel({
  opacity,
  setOpacity,
  fontSize,
  setFontSize,
  onCapture,
  onClear,
  onClose,
  isLoading,
  voiceMode = 'auto',
  onToggleVoice,
  currentAgent,
  pipelineStatus = 'idle',
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: -1, y: 16 });
  const panelRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const init = async () => {
      const display = await window.ghostAPI?.getDisplaySize();
      if (display && position.x === -1) {
        setPosition({ x: display.width - 280, y: 16 });
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragStart = useCallback((e) => {
    if (e.target.closest('button, input')) return;
    setIsDragging(true);
    const rect = panelRef.current?.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0),
    };
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };
    const handleUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={panelRef}
      data-interactive
      className="pointer-events-auto fixed animate-slide-in z-[10000]"
      style={{ left: position.x, top: position.y }}
      onMouseDown={handleDragStart}
    >
      <div className={`glass-panel w-[248px] p-4 cursor-grab active:cursor-grabbing ${pipelineStatus !== 'idle' ? 'glow-active' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${pipelineStatusColors[pipelineStatus] || 'bg-violet-400/70'} shadow-[0_0_8px_rgba(167,139,250,0.4)]`} />
            <span className="text-[11px] text-white/50 tracking-[0.2em] uppercase font-medium">
              DorAImon
            </span>
            {currentAgent && (
              <span className="text-[9px] text-violet-400/50 animate-pulse">
                {currentAgent}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/20 hover:text-white/50 transition-colors p-1 -m-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Capture button */}
        <button
          onClick={onCapture}
          disabled={isLoading}
          className={`
            w-full rounded-xl py-2.5 mb-4 text-xs font-medium tracking-wider uppercase
            transition-all duration-200 border
            ${isLoading
              ? 'border-violet-500/20 bg-violet-500/10 text-violet-300/50 cursor-wait'
              : 'border-violet-500/20 bg-violet-500/[0.08] text-violet-300/80 hover:bg-violet-500/20 hover:border-violet-500/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] active:scale-[0.98]'
            }
          `}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Capturing...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
              </svg>
              Capture
            </span>
          )}
        </button>

        {/* Controls */}
        <div className="space-y-3">
          {/* Opacity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] text-white/30 tracking-wider uppercase">Opacity</label>
              <span className="text-[10px] text-white/25 tabular-nums">{opacity}%</span>
            </div>
            <input
              type="range" min={20} max={100} value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Font size */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] text-white/30 tracking-wider uppercase">Font Size</label>
              <span className="text-[10px] text-white/25 tabular-nums">{fontSize}px</span>
            </div>
            <input
              type="range" min={11} max={24} value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Voice mode toggle */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-white/30 tracking-wider uppercase">Voice</label>
            <button
              onClick={onToggleVoice}
              className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded border border-white/[0.06] hover:border-violet-500/20 transition-colors ${voiceModeColors[voiceMode] || 'text-white/30'}`}
            >
              {voiceModeLabels[voiceMode] || voiceMode}
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.04]">
          <button
            onClick={onClear}
            className="text-[10px] text-white/20 hover:text-red-400/60 transition-colors tracking-wider uppercase"
          >
            Clear
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/15">{'\u2318\u21E7'}S toggle</span>
            <span className="text-[9px] text-white/10">|</span>
            <span className="text-[9px] text-white/15">{'\u2318\u21E7'}C capture</span>
          </div>
        </div>
      </div>
    </div>
  );
}
