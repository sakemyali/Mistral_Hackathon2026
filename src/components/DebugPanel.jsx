import React, { useState, useEffect, useRef } from 'react';

// Top-right debug panel showing agent routing in real-time
// Displays: Intent -> Confidence -> Agent -> Latency

export default function DebugPanel({ debugInfo }) {
  const [history, setHistory] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!debugInfo) return;
    setHistory((prev) => [...prev.slice(-9), { ...debugInfo, id: Date.now() }]);
  }, [debugInfo]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  if (history.length === 0) return null;

  const latest = history[history.length - 1];

  const intentColors = {
    hesitation_coding: 'text-amber-400/70',
    foreign_language: 'text-blue-400/70',
    error_visible: 'text-red-400/70',
    typing_fluent: 'text-emerald-400/70',
  };

  return (
    <div
      data-interactive
      className="pointer-events-auto fixed top-16 right-4 z-[10002] animate-slide-in"
    >
      <div className="glass-panel-light w-[260px]">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${latest.shouldAct ? 'bg-emerald-400/70 animate-pulse' : 'bg-white/20'}`} />
            <span className="text-[9px] text-white/30 tracking-[0.2em] uppercase">Pipeline</span>
          </div>
          <span className="text-[9px] text-white/15 tabular-nums">{latest.latencyMs}ms</span>
        </div>

        {/* Current state */}
        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-white/20 uppercase tracking-wider">Intent</span>
            <span className={`text-[10px] font-mono ${intentColors[latest.intent] || 'text-white/40'}`}>
              {latest.intent?.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[9px] text-white/20 uppercase tracking-wider">Confidence</span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-400/50 transition-all duration-300"
                  style={{ width: `${(latest.confidence || 0) * 100}%` }}
                />
              </div>
              <span className="text-[9px] text-white/25 tabular-nums w-7 text-right">
                {Math.round((latest.confidence || 0) * 100)}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[9px] text-white/20 uppercase tracking-wider">Agent</span>
            <span className="text-[10px] text-white/40 font-mono">
              {latest.agent || 'none'}
            </span>
          </div>

          {latest.action && (
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-white/20 uppercase tracking-wider">Action</span>
              <span className="text-[10px] text-white/30 font-mono">{latest.action}</span>
            </div>
          )}
        </div>

        {/* History log */}
        {history.length > 1 && (
          <div
            ref={scrollRef}
            className="border-t border-white/[0.04] px-3 py-1.5 max-h-[100px] overflow-y-auto"
          >
            {history.slice(0, -1).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-0.5">
                <span className={`text-[8px] font-mono ${intentColors[entry.intent] || 'text-white/20'}`}>
                  {entry.intent?.replace('_', ' ')}
                </span>
                <span className="text-[8px] text-white/15 tabular-nums">
                  {entry.agent || '-'} {entry.latencyMs}ms
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
