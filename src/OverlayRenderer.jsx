import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Typewriter hook ──
function useTypewriter(text, speed = 22) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    if (!text) return;

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        setDone(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}

// ── Single subtitle message ──
function SubtitleMessage({ message, fontSize, isLatest }) {
  const { displayed, done } = useTypewriter(
    isLatest ? message.text : null,
    18
  );
  const text = isLatest ? displayed : message.text;

  return (
    <div className="animate-fade-up mb-2 last:mb-0">
      <p
        className="leading-relaxed tracking-wide"
        style={{ fontSize: `${fontSize}px` }}
      >
        <span className={isLatest && !done ? 'text-white/95' : 'text-white/70'}>
          {text}
        </span>
        {isLatest && !done && (
          <span className="cursor-blink text-violet-400 ml-0.5 font-light">|</span>
        )}
      </p>
    </div>
  );
}

// ── Loading dots ──
function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2 animate-fade-up">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="loading-dot w-2 h-2 rounded-full bg-violet-400/80"
        />
      ))}
      <span className="ml-2 text-xs text-white/30 tracking-wider uppercase">
        Processing
      </span>
    </div>
  );
}

// ── Resize handle ──
function ResizeHandle({ position, onResizeStart }) {
  const cursorMap = {
    'top-left': 'nwse-resize',
    'top-right': 'nesw-resize',
    'bottom-left': 'nesw-resize',
    'bottom-right': 'nwse-resize',
  };
  const positionClasses = {
    'top-left': '-top-1 -left-1',
    'top-right': '-top-1 -right-1',
    'bottom-left': '-bottom-1 -left-1',
    'bottom-right': '-bottom-1 -right-1',
  };

  return (
    <div
      className={`absolute w-3 h-3 ${positionClasses[position]} z-50`}
      style={{ cursor: cursorMap[position] }}
      onMouseDown={(e) => onResizeStart(e, position)}
    >
      <div className="w-full h-full rounded-sm bg-violet-400/30 hover:bg-violet-400/60 transition-colors" />
    </div>
  );
}

// ── Main overlay renderer ──
export default function OverlayRenderer({
  messages,
  isLoading,
  opacity,
  fontSize,
  position,
  onPositionChange,
}) {
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState({ width: 700, height: 160 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, corner: '' });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Center horizontally on mount
  useEffect(() => {
    const center = async () => {
      const display = await window.ghostAPI?.getDisplaySize();
      if (display) {
        onPositionChange({
          x: Math.round((display.width - size.width) / 2),
          y: display.height - size.height - 60,
        });
      }
    };
    center();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag logic ──
  const handleDragStart = useCallback((e) => {
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - (containerRef.current?.getBoundingClientRect().left || 0),
      y: e.clientY - (containerRef.current?.getBoundingClientRect().top || 0),
    };
  }, []);

  // ── Resize logic ──
  const handleResizeStart = useCallback((e, corner) => {
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: size.width,
      h: size.height,
      corner,
    };
  }, [size]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        onPositionChange({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        });
      }
      if (isResizing) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        const { w, h, corner } = resizeStart.current;

        let newW = w;
        let newH = h;

        if (corner.includes('right')) newW = Math.max(400, w + dx);
        if (corner.includes('left')) newW = Math.max(400, w - dx);
        if (corner.includes('bottom')) newH = Math.max(80, h + dy);
        if (corner.includes('top')) newH = Math.max(80, h - dy);

        setSize({ width: newW, height: newH });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, onPositionChange]);

  const hasContent = messages.length > 0 || isLoading;

  if (!hasContent) {
    return (
      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 animate-fade-up">
        <div data-interactive className="pointer-events-auto">
          <div className="glass-panel-light px-5 py-2.5 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400/60 animate-pulse" />
            <span className="text-xs text-white/30 tracking-widest uppercase font-light">
              DorAImon Active
            </span>
            <span className="text-[10px] text-white/20 ml-2">
              Ctrl+Shift+C to capture
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-interactive
      className="pointer-events-auto fixed"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        opacity: opacity / 100,
        zIndex: 9999,
      }}
    >
      {/* Resize handles */}
      <ResizeHandle position="top-left" onResizeStart={handleResizeStart} />
      <ResizeHandle position="top-right" onResizeStart={handleResizeStart} />
      <ResizeHandle position="bottom-left" onResizeStart={handleResizeStart} />
      <ResizeHandle position="bottom-right" onResizeStart={handleResizeStart} />

      {/* Drag handle bar */}
      <div
        className="flex items-center justify-center py-1.5 cursor-grab active:cursor-grabbing select-none group"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-1">
          <div className="w-6 h-[2px] rounded-full bg-white/10 group-hover:bg-violet-400/30 transition-colors" />
          <div className="w-3 h-[2px] rounded-full bg-white/10 group-hover:bg-violet-400/30 transition-colors" />
          <div className="w-6 h-[2px] rounded-full bg-white/10 group-hover:bg-violet-400/30 transition-colors" />
        </div>
      </div>

      {/* Content area */}
      <div
        className="glass-panel glow-border px-6 py-4"
        style={{ maxHeight: size.height }}
      >
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ maxHeight: size.height - 32 }}
        >
          {messages.map((msg, i) => (
            <SubtitleMessage
              key={msg.id}
              message={msg}
              fontSize={fontSize}
              isLatest={i === messages.length - 1 && !isLoading}
            />
          ))}
          {isLoading && <LoadingDots />}
        </div>
      </div>

      {/* Message count badge */}
      {messages.length > 0 && (
        <div className="flex justify-end mt-1 pr-1">
          <span className="text-[10px] text-white/15 tabular-nums">
            {messages.length} response{messages.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
