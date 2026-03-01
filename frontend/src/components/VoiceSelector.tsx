import { useCallback } from 'react'
import { useAppStore } from '../store/appStore'

const VOICES = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (EN)', lang: 'en' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily (JP)', lang: 'jp' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (EN)', lang: 'en' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (EN)', lang: 'en' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte (EN)', lang: 'en' },
]

export default function VoiceSelector() {
  const voiceEnabled = useAppStore((s) => s.voiceEnabled)
  const setVoiceEnabled = useAppStore((s) => s.setVoiceEnabled)
  const selectedVoiceId = useAppStore((s) => s.selectedVoiceId)
  const setSelectedVoiceId = useAppStore((s) => s.setSelectedVoiceId)
  const wsSend = useAppStore((s) => s.wsSend)

  const handleToggle = useCallback(() => {
    setVoiceEnabled(!voiceEnabled)
  }, [voiceEnabled, setVoiceEnabled])

  const handleVoiceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value
      setSelectedVoiceId(id)
      wsSend?.({ type: 'set_voice', voice_id: id })
    },
    [setSelectedVoiceId, wsSend],
  )

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-white/70 text-xs">Voice</label>
        <button
          onClick={handleToggle}
          className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${
            voiceEnabled ? 'bg-blue-500' : 'bg-white/20'
          }`}
        >
          <div
            className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
              voiceEnabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      {voiceEnabled && (
        <select
          value={selectedVoiceId}
          onChange={handleVoiceChange}
          className="bg-white/10 text-white/80 text-[10px] rounded px-1.5 py-0.5
            border border-white/10 cursor-pointer outline-none
            focus:border-blue-500/50 transition-colors"
        >
          {VOICES.map((v) => (
            <option key={v.id} value={v.id} className="bg-gray-900 text-white">
              {v.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
