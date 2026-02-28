import { useAppStore } from '../store/appStore'

const LANGUAGES = [
  'English',
  'Japanese',
  'French',
  'Spanish',
  'German',
  'Chinese',
  'Korean',
  'Portuguese',
  'Arabic',
  'Russian',
]

export default function LanguagePicker() {
  const { sourceLang, targetLang, autoDetectLang, setLanguages, setAutoDetectLang } = useAppStore()

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-white/70 text-xs">Languages</label>
        <button
          onClick={() => setAutoDetectLang(!autoDetectLang)}
          className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
            autoDetectLang
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'bg-white/10 text-white/50 border border-white/10 hover:border-white/20'
          }`}
        >
          Auto-detect
        </button>
      </div>
      <div className="flex items-center gap-1">
        {autoDetectLang ? (
          <div className="bg-white/10 text-white/50 text-xs rounded px-1 py-0.5
            border border-white/20 flex-1 text-center italic">
            Auto
          </div>
        ) : (
          <select
            value={sourceLang}
            onChange={(e) => setLanguages(e.target.value, targetLang)}
            className="bg-white/10 text-white text-xs rounded px-1 py-0.5 border border-white/20
              outline-none cursor-pointer flex-1"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang} className="bg-gray-800">
                {lang}
              </option>
            ))}
          </select>
        )}
        <span className="text-white/50 text-xs">→</span>
        <select
          value={targetLang}
          onChange={(e) => setLanguages(sourceLang, e.target.value)}
          className="bg-white/10 text-white text-xs rounded px-1 py-0.5 border border-white/20
            outline-none cursor-pointer flex-1"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang} className="bg-gray-800">
              {lang}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
