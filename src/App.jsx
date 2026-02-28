import React, { useState, useEffect, useCallback, useRef } from 'react';
import OverlayRenderer from './OverlayRenderer';
import ControlPanel from './ControlPanel';

const DEMO_RESPONSES = [
  "The candidate is describing a distributed caching strategy using Redis with write-through invalidation. Consider asking about cache coherence in multi-region deployments.",
  "They mentioned event sourcing \u2014 a strong architectural pattern. Follow up on how they'd handle event replay and schema evolution over time.",
  "Good answer on database indexing. They could strengthen it by discussing partial indexes and covering indexes for their specific query patterns.",
  "The system design looks solid. Key improvement: add a circuit breaker between the API gateway and downstream microservices to handle cascading failures.",
];

export default function App() {
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [opacity, setOpacity] = useState(85);
  const [fontSize, setFontSize] = useState(15);
  const [panelOpen, setPanelOpen] = useState(true);
  const [subtitlePosition, setSubtitlePosition] = useState({ x: 0, y: 0 });
  const demoIndex = useRef(0);

  // Simulate AI capture with demo responses
  const handleCapture = useCallback(() => {
    setIsLoading(true);
    setIsVisible(true);

    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      setIsLoading(false);
      const text = DEMO_RESPONSES[demoIndex.current % DEMO_RESPONSES.length];
      demoIndex.current += 1;
      setMessages((prev) => [
        ...prev.slice(-4), // keep last 5 total
        { id: Date.now(), text, timestamp: new Date() },
      ]);
    }, delay);
  }, []);

  const handleEscape = useCallback(() => {
    setPanelOpen(false);
    // Double-tap ESC hides entirely
    if (!panelOpen) {
      setIsVisible(false);
      window.ghostAPI?.hideOverlay();
    }
  }, [panelOpen]);

  const handleClear = useCallback(() => {
    setMessages([]);
  }, []);

  // IPC listeners
  useEffect(() => {
    const unsubCapture = window.ghostAPI?.onCaptureTrigger(handleCapture);
    const unsubEscape = window.ghostAPI?.onEscapePressed(handleEscape);
    return () => {
      unsubCapture?.();
      unsubEscape?.();
    };
  }, [handleCapture, handleEscape]);

  // Mouse region detection: enable click-through when outside interactive areas
  useEffect(() => {
    const handleMouseMove = (e) => {
      const interactive = e.target.closest('[data-interactive]');
      if (interactive) {
        window.ghostAPI?.setClickThrough(false);
      } else {
        window.ghostAPI?.setClickThrough(true);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="relative w-screen h-screen pointer-events-none">
      {/* ── Control panel (top-right) ── */}
      {panelOpen && (
        <ControlPanel
          opacity={opacity}
          setOpacity={setOpacity}
          fontSize={fontSize}
          setFontSize={setFontSize}
          onCapture={handleCapture}
          onClear={handleClear}
          onClose={() => setPanelOpen(false)}
          isLoading={isLoading}
        />
      )}

      {/* Toggle panel button when closed */}
      {!panelOpen && (
        <div
          data-interactive
          className="pointer-events-auto fixed top-4 right-4 animate-slide-in"
        >
          <button
            onClick={() => setPanelOpen(true)}
            className="glass-panel-light p-2 hover:bg-white/[0.06] transition-colors group"
            title="Open controls (Ctrl+Shift+S)"
          >
            <svg
              className="w-4 h-4 text-white/40 group-hover:text-violet-400 transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Subtitle area (bottom) ── */}
      <OverlayRenderer
        messages={messages}
        isLoading={isLoading}
        opacity={opacity}
        fontSize={fontSize}
        position={subtitlePosition}
        onPositionChange={setSubtitlePosition}
      />
    </div>
  );
}
