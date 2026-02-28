import { useAppStore } from '../store/appStore'
import type { Intent } from '../types'

const INTENT_CONFIG: Record<Intent, { bg: string; label: string; animation: string }> = {
  normal: {
    bg: 'bg-green-500',
    label: 'Normal',
    animation: 'pulse-green',
  },
  hesitant: {
    bg: 'bg-yellow-500',
    label: 'Hesitant',
    animation: 'pulse-yellow',
  },
  typo: {
    bg: 'bg-red-500',
    label: 'Typo',
    animation: 'pulse-red',
  },
}

export default function IntentBadge() {
  const { currentIntent, intentConfidence, intentReasoning } = useAppStore()
  const config = INTENT_CONFIG[currentIntent]

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${config.bg}`}
          style={{ animation: `${config.animation} 2s infinite` }}
        />
        <span className="text-white text-sm font-semibold">{config.label}</span>
        <span className="text-white/60 text-xs">
          {Math.round(intentConfidence * 100)}%
        </span>
      </div>
      {intentReasoning && (
        <p className="text-white/50 text-xs leading-tight truncate max-w-[200px]">
          {intentReasoning}
        </p>
      )}
    </div>
  )
}
