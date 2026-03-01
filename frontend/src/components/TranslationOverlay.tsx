import { useAppStore } from '../store/appStore'

export default function TranslationOverlay() {
  const { translationEnabled, translatedWords } = useAppStore()

  if (!translationEnabled || translatedWords.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[99996]">
      {translatedWords.map((line, i) => (
        <div
          key={`${line.original}-${i}`}
          className="absolute rounded border border-cyan-300/70 bg-black/45 text-[12px] leading-tight text-white overflow-hidden"
          style={{
            left: line.x,
            top: line.y,
            width: Math.max(1, line.width),
            height: Math.max(1, line.height),
          }}
        >
          {line.translated}
        </div>
      ))}
    </div>
  )
}
