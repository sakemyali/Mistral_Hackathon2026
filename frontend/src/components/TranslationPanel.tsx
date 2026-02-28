import { useAppStore } from '../store/appStore'

export default function TranslationPanel() {
  const {
    translatedWords,
    translationEnabled,
    translationLoading,
  } = useAppStore()

  if (!translationEnabled) return null

  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* Loading indicator */}
      {translationLoading && translatedWords.length === 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-black/75 backdrop-blur-md rounded-full px-4 py-1.5
            flex items-center gap-2 border border-white/15">
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white text-xs font-medium">Translating...</span>
          </div>
        </div>
      )}

      {/* Translation overlays — fully click-through */}
      {translatedWords.map((line, i) => (
        <div
          key={`${line.x}-${line.y}-${i}`}
          className="absolute pointer-events-none animate-[fadeIn_0.25s_ease-out]"
          style={{
            left: line.x,
            top: line.y,
            width: line.width,
            height: line.height,
          }}
        >
          {/* Soft blur to obscure original text */}
          <div
            className="absolute inset-0"
            style={{
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              borderRadius: 2,
            }}
          />

          {/* Translated text */}
          <span
            className="absolute inset-0 flex items-center text-gray-900 leading-none"
            style={{
              fontSize: Math.max(10, Math.min(line.height * 0.78, 18)),
              fontWeight: 500,
              letterSpacing: '0.01em',
              paddingLeft: 1,
              paddingRight: 1,
            }}
          >
            {line.translated}
          </span>
        </div>
      ))}
    </div>
  )
}
