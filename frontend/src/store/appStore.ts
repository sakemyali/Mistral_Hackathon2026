import { create } from 'zustand'
import type { Intent, OCRWord, TranslatedWord, CaptureRegion, AgentAction } from '../types'

interface AppState {
  connected: boolean
  wsUrl: string
  currentIntent: Intent
  intentConfidence: number
  intentReasoning: string
  ocrWords: OCRWord[]
  translationEnabled: boolean
  translationLoading: boolean
  sourceLang: string
  targetLang: string
  autoDetectLang: boolean
  translatedWords: TranslatedWord[]
  widgetExpanded: boolean
  overlayOpacity: number
  captureRegion: CaptureRegion | null
  regionSelecting: boolean
  // Agent state
  agentAction: AgentAction | null
  codeSuggestionVisible: boolean
  narrationPlaying: boolean
  voiceEnabled: boolean
  voiceIdEn: string
  voiceIdJp: string
}

interface AppActions {
  setConnected: (connected: boolean) => void
  setIntent: (intent: Intent, confidence: number, reasoning: string) => void
  setOCRWords: (words: OCRWord[]) => void
  setTranslationEnabled: (enabled: boolean) => void
  setTranslationLoading: (loading: boolean) => void
  setLanguages: (source: string, target: string) => void
  setAutoDetectLang: (autoDetect: boolean) => void
  setTranslatedWords: (words: TranslatedWord[]) => void
  setWidgetExpanded: (expanded: boolean) => void
  setOverlayOpacity: (opacity: number) => void
  setCaptureRegion: (region: CaptureRegion | null) => void
  setRegionSelecting: (selecting: boolean) => void
  // Agent actions
  setAgentAction: (action: AgentAction | null) => void
  dismissCodeSuggestion: () => void
  setNarrationPlaying: (playing: boolean) => void
  setVoiceEnabled: (enabled: boolean) => void
  setVoiceIdEn: (id: string) => void
  setVoiceIdJp: (id: string) => void
}

export const useAppStore = create<AppState & AppActions>((set) => ({
  connected: false,
  wsUrl: 'ws://localhost:8000/ws',
  currentIntent: 'normal',
  intentConfidence: 0,
  intentReasoning: '',
  ocrWords: [],
  translationEnabled: false,
  translationLoading: false,
  sourceLang: 'English',
  targetLang: 'Japanese',
  autoDetectLang: false,
  translatedWords: [],
  widgetExpanded: false,
  overlayOpacity: 0.85,
  captureRegion: null,
  regionSelecting: false,
  // Agent defaults
  agentAction: null,
  codeSuggestionVisible: false,
  narrationPlaying: false,
  voiceEnabled: true,
  voiceIdEn: 'JBFqnCBsd6RMkjVDRZzb',
  voiceIdJp: 'pFZP5JQG7iQjIQuC4Bku',

  setConnected: (connected) => set({ connected }),
  setIntent: (intent, confidence, reasoning) =>
    set({ currentIntent: intent, intentConfidence: confidence, intentReasoning: reasoning }),
  setOCRWords: (words) => set({ ocrWords: words }),
  setTranslationEnabled: (enabled) => set({ translationEnabled: enabled }),
  setTranslationLoading: (loading) => set({ translationLoading: loading }),
  setLanguages: (source, target) => set({ sourceLang: source, targetLang: target }),
  setAutoDetectLang: (autoDetect) => set({ autoDetectLang: autoDetect }),
  setTranslatedWords: (words) => set({ translatedWords: words }),
  setWidgetExpanded: (expanded) => set({ widgetExpanded: expanded }),
  setOverlayOpacity: (opacity) => set({ overlayOpacity: opacity }),
  setCaptureRegion: (region) => set({ captureRegion: region }),
  setRegionSelecting: (selecting) => set({ regionSelecting: selecting }),
  // Agent actions
  setAgentAction: (action) => set({ agentAction: action, codeSuggestionVisible: action !== null }),
  dismissCodeSuggestion: () => set({ codeSuggestionVisible: false }),
  setNarrationPlaying: (playing) => set({ narrationPlaying: playing }),
  setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
  setVoiceIdEn: (id) => set({ voiceIdEn: id }),
  setVoiceIdJp: (id) => set({ voiceIdJp: id }),
}))
