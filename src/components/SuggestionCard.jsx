import React, { useState } from 'react';

// Center glassmorphism card for Vibe code suggestions
// Shows code diff with accept/reject buttons

export default function SuggestionCard({ suggestion, agent, intent, onAccept, onReject }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  if (!suggestion || !isVisible) return null;

  const { additions = [], removals = [], context, action } = suggestion;

  const handleAccept = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onAccept?.({ agent, intent, action });
    }, 300);
  };

  const handleReject = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onReject?.({ agent, intent, action });
    }, 300);
  };

  const actionLabels = {
    suggestFunction: 'Code Suggestion',
    fixError: 'Error Fix',
    refactor: 'Refactor',
  };

  return (
    <div
      data-interactive
      className={`pointer-events-auto fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001] ${
        isExiting ? 'animate-fade-out' : 'animate-fade-up'
      }`}
    >
      <div className="glass-panel glow-border w-[520px] max-h-[400px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400/70 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
            <span className="text-[11px] text-white/50 tracking-[0.15em] uppercase font-medium">
              {actionLabels[action] || 'Suggestion'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/20 uppercase tracking-wider">
              {agent}
            </span>
          </div>
        </div>

        {/* Context */}
        {context && (
          <div className="px-5 py-2 border-b border-white/[0.04]">
            <p className="text-[10px] text-white/30 font-mono">{context}</p>
          </div>
        )}

        {/* Diff */}
        <div className="px-5 py-3 max-h-[220px] overflow-y-auto font-mono text-xs leading-relaxed">
          {removals.map((line, i) => (
            <div key={`rem-${i}`} className="flex">
              <span className="text-red-400/60 mr-2 select-none">-</span>
              <span className="text-red-400/50 line-through">{line}</span>
            </div>
          ))}
          {additions.map((line, i) => (
            <div key={`add-${i}`} className="flex">
              <span className="text-emerald-400/60 mr-2 select-none">+</span>
              <span className="text-emerald-400/80">{line}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/[0.06]">
          <button
            onClick={handleReject}
            className="px-4 py-1.5 text-[10px] text-white/30 hover:text-red-400/60 tracking-wider uppercase transition-colors border border-white/[0.06] rounded-lg hover:border-red-400/20"
          >
            Reject
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-1.5 text-[10px] text-emerald-300/80 tracking-wider uppercase transition-all border border-emerald-500/20 rounded-lg bg-emerald-500/[0.08] hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:shadow-[0_0_15px_rgba(52,211,153,0.15)]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
