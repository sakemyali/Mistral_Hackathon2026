import React, { useState, useEffect, useCallback } from 'react';
import OverlayRenderer from './OverlayRenderer';
import ControlPanel from './ControlPanel';
import TextOverlay from './components/TextOverlay';
import SuggestionCard from './components/SuggestionCard';
import DebugPanel from './components/DebugPanel';

export default function App() {
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [opacity, setOpacity] = useState(85);
  const [fontSize, setFontSize] = useState(15);
  const [panelOpen, setPanelOpen] = useState(true);
  const [subtitlePosition, setSubtitlePosition] = useState({ x: 0, y: 0 });

  // DorAImon pipeline state
  const [debugInfo, setDebugInfo] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [translationBlocks, setTranslationBlocks] = useState([]);
  const [voiceMode, setVoiceMode] = useState('auto');
  const [currentAgent, setCurrentAgent] = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState('idle');

  // Manual capture (Ctrl+Shift+C)
  const handleCapture = useCallback(async () => {
    setIsLoading(true);
    setIsVisible(true);

    try {
      const result = await window.ghostAPI?.aiCapture({
        context: 'screen-capture',
        timestamp: Date.now(),
      });

      const text = result?.success
        ? result.data.text || result.data.result || 'No response'
        : `Error: ${result?.error || 'Unknown error'}`;

      setMessages((prev) => [
        ...prev.slice(-4),
        { id: Date.now(), text, timestamp: new Date() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(-4),
        { id: Date.now(), text: `Capture failed: ${err.message}`, timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleEscape = useCallback(() => {
    if (suggestion) {
      setSuggestion(null);
      return;
    }
    setPanelOpen(false);
    if (!panelOpen) {
      setIsVisible(false);
      window.ghostAPI?.hideOverlay();
    }
  }, [panelOpen, suggestion]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setSuggestion(null);
    setTranslationBlocks([]);
  }, []);

  const handleAcceptSuggestion = useCallback((data) => {
    window.ghostAPI?.acceptSuggestion(data);
    setSuggestion(null);
  }, []);

  const handleRejectSuggestion = useCallback((data) => {
    window.ghostAPI?.rejectSuggestion(data);
    setSuggestion(null);
  }, []);

  const handleToggleVoice = useCallback(async () => {
    const result = await window.ghostAPI?.toggleVoiceMode();
    if (result?.success) {
      setVoiceMode(result.data.voiceMode);
    }
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

  // Pipeline events from main process
  useEffect(() => {
    const unsubDebug = window.ghostAPI?.onDebugInfo((data) => {
      setDebugInfo(data);
      if (data.agent) {
        setCurrentAgent(data.agent);
        setPipelineStatus(data.shouldAct ? 'acting' : 'routing');
      } else {
        setPipelineStatus('analyzing');
      }
    });

    const unsubAgent = window.ghostAPI?.onAgentResult((data) => {
      const { agent, action, result } = data;

      if (agent === 'vibe' && result?.success) {
        setSuggestion({
          ...result.data.suggestion,
          action: result.data.action,
        });
      } else if (agent === 'mistral' && action === 'translate' && result?.success) {
        if (result.data.blocks) {
          setTranslationBlocks(result.data.blocks);
        }
      } else if (result?.success && result.data?.text) {
        setMessages((prev) => [
          ...prev.slice(-4),
          { id: Date.now(), text: result.data.text, timestamp: new Date() },
        ]);
      }

      setCurrentAgent(null);
      setPipelineStatus('idle');
    });

    return () => {
      unsubDebug?.();
      unsubAgent?.();
    };
  }, []);

  // Start screen capture loop on mount
  useEffect(() => {
    window.ghostAPI?.startScreenLoop();
    return () => {
      window.ghostAPI?.stopScreenLoop();
    };
  }, []);

  // Mouse region detection
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
          voiceMode={voiceMode}
          onToggleVoice={handleToggleVoice}
          currentAgent={currentAgent}
          pipelineStatus={pipelineStatus}
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

      {/* ── Debug panel ── */}
      <DebugPanel debugInfo={debugInfo} />

      {/* ── Translation overlays (Google Lens-style) ── */}
      <TextOverlay blocks={translationBlocks} opacity={opacity} />

      {/* ── Suggestion card (Vibe) ── */}
      {suggestion && (
        <SuggestionCard
          suggestion={suggestion}
          agent={currentAgent || 'vibe'}
          intent={debugInfo?.intent}
          onAccept={handleAcceptSuggestion}
          onReject={handleRejectSuggestion}
        />
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
