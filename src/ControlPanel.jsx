import React, { useState, useRef, useEffect, useCallback } from 'react';

export default function ControlPanel({
  opacity,
  setOpacity,
  fontSize,
  setFontSize,
  onCapture,
  onScreenshot,
  onCamera,
  onAudio,
  onTextInput,
  onClear,
  onClose,
  isLoading,
  processingMode,
  aiStatus,
  realtimeEnabled = false,
  onRealtimeToggle,
  autoTranslationEnabled = false,
  fullScreenOverlay = false,
  setFullScreenOverlay
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: -1, y: 16 });
  const [textInput, setTextInput] = useState('');
  const [activeMode, setActiveMode] = useState('text');
  const [targetLanguage, setTargetLanguage] = useState('日本語'); // 翻訳言語状態を追加
  const panelRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  
  // 翻訳言語の初期化と設定
  useEffect(() => {
    const initLanguage = async () => {
      try {
        const result = await window.ghostAPI?.getTranslationLanguage();
        if (result?.language) {
          setTargetLanguage(result.language);
        }
      } catch (error) {
        console.log('翻訳言語の取得に失敗:', error);
      }
    };
    initLanguage();
  }, []);
  
  // 翻訳言語の変更
  const handleLanguageChange = async (newLanguage) => {
    try {
      await window.ghostAPI?.setTranslationLanguage(newLanguage);
      setTargetLanguage(newLanguage);
      console.log(`翻訳言語を${newLanguage}に変更しました`);
    } catch (error) {
      console.error('翻訳言語の設定に失敗:', error);
    }
  };

  // Position at top-right on mount
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
      <div className="glass-panel w-[248px] p-4 cursor-grab active:cursor-grabbing">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-400/70 shadow-[0_0_8px_rgba(167,139,250,0.4)]" />
            <span className="text-[11px] text-white/50 tracking-[0.2em] uppercase font-medium">
              Ghost
            </span>
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

        {/* Text Input Field */}
        <div className="mb-4">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">翻訳・AI質問入力</div>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="翻訳したいテキストや質問を入力してください..."
            className="w-full px-3 py-2 text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg 
                      text-white/80 placeholder-white/30 resize-none focus:outline-none 
                      focus:border-violet-500/30 focus:bg-white/[0.05] transition-colors"
            rows={3}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && textInput.trim()) {
                e.preventDefault();
                onTextInput?.(textInput.trim());
                setTextInput('');
              }
            }}
          />
          <div className="text-[8px] text-white/20 mt-1">
            💡 Enterで送信 | Shift+Enterで改行
          </div>
        </div>

        {/* Input Mode Selector */}
        <div className="mb-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">処理モード選択</div>
          <div className="grid grid-cols-2 gap-1.5">
            {/* Text Button */}
            <button
              onClick={() => {
                setActiveMode('text');
                if (textInput.trim()) {
                  onTextInput?.(textInput.trim());
                  setTextInput('');
                }
              }}
              className={`
                flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-medium
                transition-all duration-200 border
                ${activeMode === 'text' || processingMode === 'text'
                  ? 'border-green-500/30 bg-green-500/10 text-green-300/80'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-white/[0.05]'
                }
              `}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371c1.22 0 2.437.055 3.647.16l.47.025c1.12.058 2.265.07 3.368.016l.55-.027a4.26 4.26 0 0 0 .370-2.24L18 3.621a4.26 4.26 0 0 0-1.183-2.97L16 1.621A4.26 4.26 0 0 0 13.97.437L13 .621a4.26 4.26 0 0 0-2.97 1.184l-.821.821A4.26 4.26 0 0 0 8.38 4.97l-.184.001L8 5c-1.12 0-2.265-.011-3.368-.016l-.55-.027A4.26 4.26 0 0 1 3.62 2.717L3 2.621a4.26 4.26 0 0 1 0-2.486L3.62.437A4.26 4.26 0 0 1 6.59.437l.83.001c1.12.047 2.265.095 3.368.143l.55.027c1.203.06 2.438.104 3.647.128L15 .621c1.22 0 2.437-.055 3.647-.16l.47-.025c1.12-.058 2.265-.07 3.368-.016l.55.027A4.26 4.26 0 0 1 23.62 2.717L24 3.621c0 .827-.314 1.655-.93 2.274l-.821.821A4.26 4.26 0 0 1 19.03 7.9l-.184.001L19 8" />
              </svg>
              翻訳・質問
            </button>

            {/* Screenshot Button */}
            <button
              onClick={() => {
                setActiveMode('screenshot');
                onScreenshot?.();
              }}
              disabled={isLoading}
              className={`
                flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-medium
                transition-all duration-200 border
                ${activeMode === 'screenshot' || processingMode === 'screenshot'
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-300/80'
                  : isLoading
                  ? 'border-white/[0.05] bg-white/[0.01] text-white/30 cursor-not-allowed'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-white/[0.05]'
                }
              `}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H13.5m6-10.125c0-.621-.504-1.125-1.125-1.125H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a4.5 4.5 0 00-4.5-4.5H9.75a1.875 1.875 0 01-1.875-1.875V5.25c0-.621.504-1.125 1.125-1.125H12" />
              </svg>
              画面翻訳
            </button>

            {/* Camera Button */}
            <button
              onClick={() => {
                setActiveMode('camera');
                onCamera?.();
              }}
              disabled={isLoading}
              className={`
                flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-medium
                transition-all duration-200 border
                ${activeMode === 'camera' || processingMode === 'camera'
                  ? 'border-purple-500/30 bg-purple-500/10 text-purple-300/80'
                  : isLoading
                  ? 'border-white/[0.05] bg-white/[0.01] text-white/30 cursor-not-allowed'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-white/[0.05]'
                }
              `}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              カメラ解析
            </button>

            {/* Audio Button */}
            <button
              onClick={() => {
                setActiveMode('audio');
                onAudio?.();
              }}
              disabled={isLoading}
              className={`
                flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-medium
                transition-all duration-200 border
                ${activeMode === 'audio' || processingMode === 'audio'
                  ? 'border-orange-500/30 bg-orange-500/10 text-orange-300/80'
                  : isLoading
                  ? 'border-white/[0.05] bg-white/[0.01] text-white/30 cursor-not-allowed'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-white/[0.05]'
                }
              `}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 016 0v8.25a3 3 0 01-3 3z" />
              </svg>
              音声認識
            </button>

            {/* Auto Translation Button */}
            <button
              onClick={() => {
                onRealtimeToggle?.();
              }}
              disabled={isLoading}
              className={`
                flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-medium
                transition-all duration-200 border
                ${realtimeEnabled
                  ? 'border-green-500/30 bg-green-500/10 text-green-300/80'
                  : isLoading
                  ? 'border-white/[0.05] bg-white/[0.01] text-white/30 cursor-not-allowed'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-white/[0.05]'
                }
              `}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              {realtimeEnabled ? '自動翻訳停止' : '英→日自動翻訳'}
            </button>
          </div>
          
          {/* フルスクリーンオーバーレイ制御 */}
          <div className="mb-3">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">表示設定</div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="fullScreenOverlay"
                checked={fullScreenOverlay}
                onChange={(e) => setFullScreenOverlay?.(e.target.checked)}
                className="w-3 h-3 rounded border border-white/20 bg-black/20 text-violet-500 focus:ring-violet-500/50"
              />
              <label htmlFor="fullScreenOverlay" className="text-[11px] text-white/70">
                画面全体にオーバーレイ表示
              </label>
            </div>
          </div>
          
          {/* 翻訳言語選択 - 英→日固定表示 */}
          <div className="mb-3">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">翻訳設定</div>
            <div className="w-full bg-black/20 border border-white/[0.08] rounded-md py-2 px-3 text-[11px] text-white/80">
              🇺🇸 English → 🇯🇵 日本語（固定）
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        {isLoading && (
          <div className="mb-4 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-violet-500/[0.08] border border-violet-500/20">
            <svg className="w-3.5 h-3.5 animate-spin text-violet-300/80" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-[10px] text-violet-300/80 font-medium">
              {processingMode === 'text' && 'テキスト処理中...'}
              {processingMode === 'screenshot' && '画面解析・翻訳中...'}
              {processingMode === 'camera' && 'カメラ画像処理中...'}
              {processingMode === 'audio' && '音声認識処理中...'}
            </span>
          </div>
        )}

        {/* AI Status */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-white/30">状態</span>
            <span className={`
              px-1.5 py-0.5 rounded-full font-medium
              ${aiStatus?.initialized 
                ? 'bg-green-500/20 text-green-300/80' 
                : 'bg-red-500/20 text-red-300/80'
              }
            `}>
              {aiStatus?.initialized ? 'Mistral AI 接続中' : 'オフライン'}
              {aiStatus?.mode === 'live' && ' 🟢'}
              {aiStatus?.mode === 'fallback' && ' 🟡'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {/* Opacity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] text-white/30 tracking-wider uppercase">
                Opacity
              </label>
              <span className="text-[10px] text-white/25 tabular-nums">{opacity}%</span>
            </div>
            <input
              type="range"
              min={20}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Font size */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] text-white/30 tracking-wider uppercase">
                Font Size
              </label>
              <span className="text-[10px] text-white/25 tabular-nums">{fontSize}px</span>
            </div>
            <input
              type="range"
              min={11}
              max={24}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.04]">
          <button
            onClick={onClear}
            className="text-[10px] text-white/20 hover:text-red-400/60 transition-colors tracking-wider uppercase"
          >
            履歴クリア
          </button>
          <div className="flex flex-col gap-0.5 text-right">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/15">
                ⌘⇧S 表示切替
              </span>
              <span className="text-[9px] text-white/10">|</span>
              <span className="text-[9px] text-white/15">
                ⌘⇧C テキスト
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-white/12">
                ⌘⇧X 画面翻訳
              </span>
              <span className="text-[8px] text-white/08">|</span>
              <span className="text-[8px] text-white/12">
                ⌘⇧V カメラ
              </span>
              <span className="text-[8px] text-white/08">|</span>
              <span className="text-[8px] text-white/12">
                ⌘⇧A 音声
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
