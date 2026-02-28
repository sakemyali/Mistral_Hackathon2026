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
  const [processingMode, setProcessingMode] = useState('text'); // 'text', 'screenshot', 'camera', 'audio'
  const [aiStatus, setAiStatus] = useState({ initialized: false });
  const [realtimeTranslations, setRealtimeTranslations] = useState([]);
  const [showRealtimeOverlay, setShowRealtimeOverlay] = useState(false);
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [screenshotStatus, setScreenshotStatus] = useState(null); // スクリーンキャプチャ状況
  const [fullScreenOverlay, setFullScreenOverlay] = useState(true); // 画面全体オーバーレイ
  const [autoTranslationEnabled, setAutoTranslationEnabled] = useState(true); // 自動翻訳
  const [translationResults, setTranslationResults] = useState(null); // OCR翻訳結果（非表示）
  const [ocrText, setOcrText] = useState(null); // OCR抽出テキスト（非表示）
  const [capturedImage, setCapturedImage] = useState(null); // キャプチャした画像（非表示）
  const [saveStatus, setSaveStatus] = useState(null); // スクリーンショット保存状態
  const [jsonSaveStatus, setJsonSaveStatus] = useState(null); // JSON保存状態
  const [analysisResult, setAnalysisResult] = useState(null); // Pixtral包括分析結果
  const [showJsonRaw, setShowJsonRaw] = useState(false); // JSON生データ表示フラグ
  const demoIndex = useRef(0);

  // AI Processing with LangGraph
  const processWithAI = useCallback(async (inputText, inputType = 'text', options = {}) => {
    setIsLoading(true);
    setIsVisible(true);

    try {
      let result;
      
      switch (inputType) {
        case 'text':
          result = await window.ghostAPI?.processText(inputText, options);
          break;
        case 'screenshot':
          result = await window.ghostAPI?.processScreenshot(options);
          break;
        case 'camera':
          result = await window.ghostAPI?.processCamera(options);
          break;
        case 'audio':
          result = await window.ghostAPI?.processAudio(options);
          break;
        default:
          result = await window.ghostAPI?.processText(inputText, options);
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      if (inputType !== 'screenshot') {
        setMessages((prev) => [
          ...prev.slice(-4),
          {
            id: result.id || Date.now(),
            text: result.text,
            timestamp: result.timestamp || new Date(),
            intent: result.intent,
            confidence: result.confidence,
            processingTime: result.processingTime,
            inputType: result.inputType
          },
        ]);
      }
    } catch (error) {
      console.error('AI Processing error:', error);
      
      // Fallback to demo response
      const text = DEMO_RESPONSES[demoIndex.current % DEMO_RESPONSES.length];
      demoIndex.current += 1;
      
      if (inputType !== 'screenshot') {
        setMessages((prev) => [
          ...prev.slice(-4),
          {
            id: Date.now(),
            text: `[デモモード] ${text}`,
            timestamp: new Date(),
            intent: 'fallback',
            confidence: 0,
            error: error.message
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Legacy text capture handler
  const handleCapture = useCallback(() => {
    processWithAI('一般的な質問への回答をお願いします。', 'text');
  }, [processWithAI]);

  // New input handlers
  const handleScreenshotCapture = useCallback(() => {
    setProcessingMode('screenshot');
    setMessages([]);
    processWithAI('', 'screenshot', { context: 'screen-analysis' });
  }, [processWithAI]);

  const handleCameraCapture = useCallback(() => {
    setProcessingMode('camera');
    processWithAI('', 'camera', { context: 'camera-analysis' });
  }, [processWithAI]);

  const handleAudioCapture = useCallback(() => {
    setProcessingMode('audio');
    processWithAI('', 'audio', { context: 'audio-transcription' });
  }, [processWithAI]);

  // Text input handler for manual input
  const handleTextInput = useCallback((text) => {
    setProcessingMode('text');
    processWithAI(text, 'text', { source: 'manual-input' });
  }, [processWithAI]);

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

  // 自動英語→日本語翻訳コントロール
  const toggleRealtimeTranslation = useCallback(async () => {
    try {
      if (!realtimeEnabled) {
        const result = await window.ghostAPI?.startRealtimeTranslation();
        if (result?.success) {
          setRealtimeEnabled(true);
          setAutoTranslationEnabled(true);
          setFullScreenOverlay(true);
          setShowRealtimeOverlay(true);
          console.log('🌐 自動英語→日本語翻訳を開始しました');
        }
      } else {
        const result = await window.ghostAPI?.stopRealtimeTranslation();
        if (result?.success) {
          setRealtimeEnabled(false);
          setAutoTranslationEnabled(false);
          setShowRealtimeOverlay(false);
          setRealtimeTranslations([]);
          console.log('🛑 自動翻訳を停止しました');
        }
      }
    } catch (error) {
      console.error('Failed to toggle realtime translation:', error);
    }
  }, [realtimeEnabled]);

  // IPC listeners for all input methods
  useEffect(() => {
    const unsubCapture = window.ghostAPI?.onCaptureTrigger(handleCapture);
    const unsubScreenshot = window.ghostAPI?.onScreenshotTrigger(handleScreenshotCapture);
    const unsubCamera = window.ghostAPI?.onCameraTrigger(handleCameraCapture);
    const unsubAudio = window.ghostAPI?.onAudioTrigger(handleAudioCapture);
    const unsubEscape = window.ghostAPI?.onEscapePressed(handleEscape);
    
    // リアルタイム翻訳トグル
    const unsubRealtimeToggle = window.ghostAPI?.onRealtimeTranslationToggle?.(toggleRealtimeTranslation);
    
    // リアルタイム翻訳結果のリスナー
    const unsubRealtimeResult = window.ghostAPI?.onRealtimeTranslationResult?.((result) => {
      if (result?.text) {
        setRealtimeTranslations(prev => [...prev.slice(-9), result]); // Keep last 10 translations
      }
    });
    
    // スクリーンキャプチャ状況のリスナー
    const unsubScreenshotStatus = window.ghostAPI?.onScreenshotStatus?.((status) => {
      setScreenshotStatus(status);
      
      // キャプチャした画像を保存
      if (status.imagePreview) {
        setCapturedImage(status.imagePreview);
      }
      
      // OCR翻訳結果を保存
      if (status.text) {
        setTranslationResults(status.text);
      }
      if (status.ocrText) {
        setOcrText(status.ocrText);
      }
      
      // Pixtral包括分析結果を保存
      if (status.analysisResult) {
        setAnalysisResult(status.analysisResult);
      }
      
      // 5秒後に自動で非表示
      setTimeout(() => {
        setScreenshotStatus(null);
      }, 5000);
    });
    
    // スクリーンショット保存通知のリスナー
    const unsubScreenshotSaved = window.ghostAPI?.onScreenshotSaved?.((saveInfo) => {
      setSaveStatus(saveInfo);
      
      // 3秒後に保存通知を非表示
      setTimeout(() => {
        setSaveStatus(null);
      }, 3000);
    });
    
    // JSON保存通知のリスナー
    const unsubJsonSaved = window.ghostAPI?.onJsonSaved?.((saveInfo) => {
      setJsonSaveStatus(saveInfo);
      
      // 3秒後に保存通知を非表示
      setTimeout(() => {
        setJsonSaveStatus(null);
      }, 3000);
    });
    
    return () => {
      unsubCapture?.();
      unsubScreenshot?.();
      unsubCamera?.();
      unsubAudio?.();
      unsubEscape?.();
      unsubRealtimeToggle?.();
      unsubRealtimeResult?.();
      unsubScreenshotStatus?.();
      unsubScreenshotSaved?.();
      unsubJsonSaved?.();
    };
  }, [handleCapture, handleScreenshotCapture, handleCameraCapture, handleAudioCapture, handleEscape, toggleRealtimeTranslation]);

  // Check AI status on mount
  useEffect(() => {
    const checkAIStatus = async () => {
      try {
        const status = await window.ghostAPI?.getAIStatus();
        setAiStatus(status || { initialized: false });
      } catch (error) {
        console.warn('Could not check AI status:', error);
        setAiStatus({ initialized: false, error: error.message });
      }
    };
    
    checkAIStatus();
    
    // Periodic status check
    const interval = setInterval(checkAIStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

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
          onScreenshot={handleScreenshotCapture}
          onCamera={handleCameraCapture}
          onAudio={handleAudioCapture}
          onTextInput={handleTextInput}
          onClear={handleClear}
          onClose={() => setPanelOpen(false)}
          isLoading={isLoading}
          processingMode={processingMode}
          aiStatus={aiStatus}
          realtimeEnabled={realtimeEnabled}
          onRealtimeToggle={toggleRealtimeTranslation}
          autoTranslationEnabled={autoTranslationEnabled}
          fullScreenOverlay={fullScreenOverlay}
          setFullScreenOverlay={setFullScreenOverlay}
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
      {processingMode !== 'screenshot' && (
        <OverlayRenderer
          messages={messages}
          isLoading={isLoading}
          opacity={opacity}
          fontSize={fontSize}
          position={subtitlePosition}
          onPositionChange={setSubtitlePosition}
        />
      )}

      {/* ── Full Screen Translation Overlay ── */}
      {(fullScreenOverlay || Boolean(capturedImage) || Boolean(screenshotStatus)) && (
        <div className="fixed inset-0 pointer-events-none z-20" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
          {/* 英語→日本語翻訳オーバーレイ */}
          {realtimeTranslations
            .filter(translation => translation.translations && translation.isScreenOverlay)
            .slice(-1) // 最新の翻訳結果のみ表示
            .map((translation) => 
              translation.translations?.map((item, itemIndex) => (
                <div
                  key={`overlay-${translation.id}-${itemIndex}`}
                  className="absolute animate-fade-in"
                  style={{
                    left: item.position?.x || 50 + (itemIndex * 200),
                    top: (item.position?.y || 100) + (item.position?.height || 30) + 5, // 元のテキストの下に配置
                    fontSize: `${Math.max(fontSize - 2, 12)}px`,
                    maxWidth: `${item.position?.width ? item.position.width + 50 : 200}px`
                  }}
                >
                  {/* 日本語翻訳（元のテキストの下に表示） */}
                  <div 
                    className="bg-blue-600/80 text-white px-2 py-1 rounded-md shadow-lg backdrop-blur-sm border border-blue-400/30"
                    style={{ 
                      fontSize: `${Math.max(fontSize - 1, 11)}px`,
                      lineHeight: 1.2
                    }}
                  >
                    {item.japanese}
                  </div>
                  
                  {/* 信頼度表示 */}
                  {item.confidence && (
                    <div className="text-xs text-white/60 mt-1 bg-black/20 px-1 rounded">
                      {Math.round(item.confidence * 100)}%
                    </div>
                  )}
                </div>
              ))
            )}
        </div>
      )}

      {/* ── Accurate Pixtral OCR Translation Overlay ── */}
      {showRealtimeOverlay && !fullScreenOverlay && (
        <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
          {/* 座標ベースの正確な翻訳オーバーレイ（Pixtral OCR結果） */}
          {realtimeTranslations.map((translation, index) => {
            if (translation.translations && translation.ocrMethod === 'mistral_ocr_api') {
              return translation.translations.map((item, itemIndex) => {
                const pos = item.position || {};
                // xmin, ymin, xmax, ymax を使用した正確な位置計算
                const x = pos.xmin || pos.x || 50 + (itemIndex * 100);
                const y = pos.ymin || pos.y || 50 + (itemIndex * 50);
                const width = pos.xmax ? pos.xmax - pos.xmin : pos.width || 200;
                const height = pos.ymax ? pos.ymax - pos.ymin : pos.height || 30;
                
                return (
                  <div
                    key={`pixtral-${translation.id}-${itemIndex}`}
                    className="absolute animate-fade-in"
                    style={{
                      left: x,
                      top: y,
                      minWidth: Math.max(width, 100),
                      fontSize: `${Math.max(fontSize * 0.8, 12)}px`
                    }}
                  >
                    {/* 元のテキストエリア（背景を薄く白で隠す） */}
                    <div 
                      className="absolute bg-white/85 rounded-sm backdrop-blur-sm border border-gray-300/50"
                      style={{
                        width: width + 'px',
                        height: height + 'px',
                        left: 0,
                        top: 0
                      }}
                    />
                    
                    {/* 翻訳テキスト（メイン表示） */}
                    <div 
                      className="relative bg-gradient-to-r from-blue-600/95 to-purple-600/95 text-white px-2 py-1 rounded-md shadow-lg backdrop-blur-sm border border-white/30 z-10"
                      style={{
                        maxWidth: Math.max(width * 1.2, 150) + 'px'
                      }}
                    >
                      {/* 小さく元のテキストも表示 */}
                      <div className="text-xs text-white/70 mb-0.5 truncate">
                        {item.original}
                      </div>
                      {/* 翻訳結果 */}
                      <div className="font-medium leading-tight">
                        {item.japanese}
                      </div>
                    </div>
                  </div>
                );
              });
            }
            
            // 従来の翻訳結果（座標付き）の表示
            if (translation.translations && translation.ocrMethod !== 'mistral_ocr_api') {
              return translation.translations.map((item, itemIndex) => (
                <div
                  key={`legacy-${translation.id}-${itemIndex}`}
                  className="absolute animate-fade-in"
                  style={{
                    left: item.position?.x || 50 + (itemIndex * 100),
                    top: item.position?.y || 50 + (itemIndex * 50),
                    fontSize: `${fontSize}px`
                  }}
                >
                  {/* 元のテキスト（薄く表示） */}
                  <div className="bg-black/40 text-white/50 px-2 py-1 rounded-md text-sm mb-1 backdrop-blur-sm">
                    {item.original}
                  </div>
                  {/* 翻訳テキスト（メイン表示） */}
                  <div className="bg-gradient-to-r from-blue-600/90 to-purple-600/90 text-white px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm border border-white/20">
                    {item.japanese}
                  </div>
                </div>
              ));
            }
            return null;
          })}

          {/* 従来の形式の翻訳結果も表示 */}
          {realtimeTranslations.filter(t => !t.translations).length > 0 && (
            <div className="absolute top-20 right-4 max-w-md space-y-2">
              {realtimeTranslations.filter(t => !t.translations).slice(-3).map((translation, index) => (
                <div
                  key={translation.id || index}
                  className="bg-gradient-to-r from-purple-900/80 to-blue-900/80 backdrop-blur-sm border border-white/20 rounded-lg p-3 animate-slide-in text-white shadow-lg"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  <div className="text-xs text-white/60 mb-1">
                    📱 {translation.status === 'demo' ? 'デモ翻訳' : 'リアルタイム翻訳'} {new Date(translation.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="whitespace-pre-wrap break-words">
                    {translation.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* リアルタイム翻訳ステータス */}
          {realtimeEnabled && (
            <div className="absolute top-4 left-4">
              <div className="glass-panel-light p-2 text-white text-sm flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>リアルタイム翻訳中...</span>
                <kbd className="text-xs bg-white/10 px-1 rounded">Ctrl+Shift+R</kbd>
              </div>
            </div>
          )}

          {/* 権限案内メッセージ - 開発モードでは非表示 */}
          {false && ( // 権限メッセージを完全に無効化
          <div className="absolute bottom-4 left-4 right-4 pointer-events-auto">
            <div className="max-w-md mx-auto bg-green-900/80 border border-green-600/50 rounded-lg p-3 text-green-200 text-sm backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold">翻訳機能が有効です</span>
              </div>
              <p className="text-xs leading-relaxed">
                ✨ <strong>画面翻訳機能</strong>が正常に動作しています。
                <br />言語選択後、「画面翻訳」ボタンをお試しください。
              </p>
            </div>
          </div>
          )}
          
        </div>
      )}

      {/* スクリーンキャプチャ状況表示 */}
      {screenshotStatus && (
        <div className="absolute top-4 left-4 right-4 pointer-events-auto z-40">
          <div className={`max-w-md mx-auto rounded-lg p-3 text-sm backdrop-blur-sm animate-slide-in ${
            screenshotStatus.success 
              ? 'bg-green-900/80 border border-green-600/50 text-green-200'
              : 'bg-amber-900/80 border border-amber-600/50 text-amber-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <svg className={`w-4 h-4 ${screenshotStatus.success ? 'text-green-400' : 'text-amber-400'}`} fill="currentColor" viewBox="0 0 20 20">
                {screenshotStatus.success ? (
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                )}
              </svg>
              <span className="font-semibold">スクリーンキャプチャ状況</span>
            </div>
            <p className="text-xs leading-relaxed">
              📸 <strong>{screenshotStatus.message}</strong>
              {screenshotStatus.size && (
                <><br />📐 サイズ: {screenshotStatus.size.width}×{screenshotStatus.size.height}</>
              )}
              {screenshotStatus.dataSize && (
                <><br />💾 データサイズ: {screenshotStatus.dataSize}</>
              )}
              {screenshotStatus.error && (
                <><br />⚠️ エラー: {screenshotStatus.error}</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* スクリーンショット保存状況表示 */}
      {saveStatus && (
        <div className="absolute top-20 left-4 right-4 pointer-events-auto z-40">
          <div className={`max-w-md mx-auto rounded-lg p-3 text-sm backdrop-blur-sm animate-slide-in ${
            saveStatus.success 
              ? 'bg-blue-900/80 border border-blue-600/50 text-blue-200'
              : 'bg-red-900/80 border border-red-600/50 text-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <svg className={`w-4 h-4 ${saveStatus.success ? 'text-blue-400' : 'text-red-400'}`} fill="currentColor" viewBox="0 0 20 20">
                {saveStatus.success ? (
                  <path d="M7.707 10.293a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L9 11.586l-1.293-1.293z"/>
                ) : (
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                )}
              </svg>
              <span className="font-semibold">ファイル保存</span>
            </div>
            {saveStatus.success ? (
              <div className="text-xs leading-relaxed">
                <p>💾 <strong>保存完了: {saveStatus.fileName}</strong></p>
                <p>📁 パス: {saveStatus.filePath}</p>
                <p>📏 サイズ: {saveStatus.sizeKB}KB</p>
                <p>⏰ {saveStatus.timestamp}</p>
              </div>
            ) : (
              <div className="text-xs leading-relaxed">
                <p>❌ <strong>保存失敗</strong></p>
                <p>⚠️ エラー: {saveStatus.error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* JSON保存状況表示 */}
      {jsonSaveStatus && (
        <div className="absolute top-36 left-4 right-4 pointer-events-auto z-40">
          <div className={`max-w-md mx-auto rounded-lg p-3 text-sm backdrop-blur-sm animate-slide-in ${
            jsonSaveStatus.success 
              ? 'bg-green-900/80 border border-green-600/50 text-green-200'
              : 'bg-red-900/80 border border-red-600/50 text-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <svg className={`w-4 h-4 ${jsonSaveStatus.success ? 'text-green-400' : 'text-red-400'}`} fill="currentColor" viewBox="0 0 20 20">
                {jsonSaveStatus.success ? (
                  <path d="M7.707 10.293a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L9 11.586l-1.293-1.293z"/>
                ) : (
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                )}
              </svg>
              <span className="font-semibold">JSON保存</span>
            </div>
            {jsonSaveStatus.success ? (
              <div className="text-xs leading-relaxed">
                <p>💾 <strong>保存完了: {jsonSaveStatus.fileName}</strong></p>
                <p>📁 パス: {jsonSaveStatus.filePath}</p>
                <p>📏 サイズ: {jsonSaveStatus.sizeKB}KB</p>
                <p>⏰ {jsonSaveStatus.timestamp}</p>
              </div>
            ) : (
              <div className="text-xs leading-relaxed">
                <p>❌ <strong>保存失敗</strong></p>
                <p>⚠️ エラー: {jsonSaveStatus.error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pixtral包括分析結果表示 */}
      {analysisResult && (
        <div className="fixed bottom-4 right-4 pointer-events-auto z-50 max-w-3xl animate-slide-in">
          <div className="bg-gradient-to-br from-purple-900/90 to-indigo-900/90 backdrop-blur-sm border border-purple-500/30 rounded-lg shadow-xl">
            {/* ヘッダー */}
            <div className="bg-purple-900/95 border-b border-purple-500/20 px-4 py-3 flex items-center justify-between">
              <h3 className="text-purple-100 font-semibold text-sm">🧠 Pixtral AI分析結果</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowJsonRaw(!showJsonRaw)}
                  className="text-purple-300/80 hover:text-purple-300 text-xs px-2 py-1 rounded bg-purple-800/40 transition-colors"
                >
                  {showJsonRaw ? '📊 表示' : '📝 JSON'}
                </button>
                <button
                  onClick={() => setAnalysisResult(null)}
                  className="text-purple-300/60 hover:text-purple-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 分析結果コンテンツ */}
            {showJsonRaw ? (
              <div className="p-4 max-h-[600px] overflow-y-auto">
                {/* JSON生データ */}
                <h4 className="text-purple-200 font-medium mb-2 text-xs">📄 Pixtral API レスポンス (JSON)</h4>
                <pre className="text-purple-100 text-xs font-mono bg-black/40 p-3 rounded border border-purple-500/20 overflow-x-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(analysisResult, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="p-4 space-y-3 text-xs max-h-[600px] overflow-y-auto">
                {/* 全体分析 */}
                {analysisResult.overall && (
                  <div>
                    <h4 className="text-purple-200 font-medium mb-1">🎯 全体分析</h4>
                    <div className="bg-purple-950/40 border border-purple-500/20 rounded px-2 py-1 text-purple-100 space-y-1">
                      <div>
                        <span className="text-purple-300/80">意図:</span> 
                        <span className="font-medium ml-1">{analysisResult.overall.primary_intent}</span>
                      </div>
                      <div>
                        <span className="text-purple-300/80">言語:</span> 
                        <span className="font-medium ml-1">{analysisResult.overall.dominant_language}</span>
                      </div>
                      <div>
                        <span className="text-purple-300/80">画面タイプ:</span> 
                        <span className="font-medium ml-1">{analysisResult.overall.screen_type}</span>
                      </div>
                      <div>
                        <span className="text-purple-300/80">信頼度:</span> 
                        <span className="font-medium ml-1">{Math.round((analysisResult.overall.confidence || 0) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 単語ごとの詳細情報 */}
                <div>
                  <h4 className="text-purple-200 font-medium mb-1">
                    📝 検出されたテキスト ({analysisResult.words?.length || 0}個)
                  </h4>
                  <div className="bg-purple-950/40 border border-purple-500/20 rounded px-2 py-1 text-purple-100 max-h-64 overflow-y-auto">
                    {analysisResult.words && analysisResult.words.length > 0 ? (
                      <ul className="space-y-2">
                        {analysisResult.words.map((word, idx) => (
                          <li key={idx} className="text-xs border-b border-purple-500/10 pb-1 last:border-0">
                            <div className="font-medium text-purple-100">
                              <span className="text-purple-300">[{idx + 1}]</span> {word.content}
                            </div>
                            <div className="text-purple-300/70 mt-0.5 space-y-0.5">
                              <div>
                                📍 左上: ({word.coordinate?.top_left?.x}, {word.coordinate?.top_left?.y}) | 右下: ({word.coordinate?.bottom_right?.x}, {word.coordinate?.bottom_right?.y})
                              </div>
                              <div>
                                🌐 言語: <span className="text-purple-200">{word.language}</span>
                              </div>
                              <div>
                                📄 タイプ: <span className="text-purple-200">{word.type}</span>
                              </div>
                              <div>
                                🎯 意図: <span className="text-purple-200">{word.context}</span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-purple-300/60">テキストが検出されませんでした</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
