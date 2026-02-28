import React from 'react';

// Google Lens-style translation overlay
// Renders bounding boxes with translated text at OCR coordinates

export default function TextOverlay({ blocks, opacity }) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9998]" style={{ opacity: opacity / 100 }}>
      {blocks.map((block, i) => (
        <div
          key={`${block.text?.slice(0, 10)}-${i}`}
          data-interactive
          className="pointer-events-auto absolute animate-fade-up"
          style={{
            left: `${block.bbox?.x || 0}%`,
            top: `${block.bbox?.y || 0}%`,
            width: `${block.bbox?.w || 20}%`,
            minHeight: `${block.bbox?.h || 3}%`,
          }}
        >
          <div className="glass-panel-light px-3 py-1.5 group cursor-pointer hover:scale-[1.02] transition-transform">
            {/* Original text (small, faded) */}
            {block.original && (
              <p className="text-[9px] text-white/25 truncate mb-0.5">
                {block.original}
              </p>
            )}

            {/* Translated text */}
            <p className="text-xs text-white/90 leading-snug">
              {block.translated || block.text}
            </p>

            {/* Language badge */}
            {block.lang && block.lang !== 'en' && (
              <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-violet-500/30 text-violet-300/80 px-1.5 py-0.5 rounded-full border border-violet-500/20">
                {block.lang}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
