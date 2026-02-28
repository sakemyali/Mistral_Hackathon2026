export type Intent = 'normal' | 'hesitant' | 'typo'

export interface OCRWord {
  text: string
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

export interface IntentUpdate {
  type: 'intent_update'
  intent: Intent
  confidence: number
  reasoning: string
  agent_action: AgentAction | null
}

export interface OCRUpdate {
  type: 'ocr_update'
  words: OCRWord[]
  full_text: string
  timestamp: number
}

export interface TranslationResult {
  type: 'translation_result'
  translations: string[]
  request_id: string
}

export interface AgentAction {
  agent_name: string
  action: string | null
  data: unknown
}

export interface ErrorMessage {
  type: 'error'
  message: string
  request_id: string
}

export type WSMessage = IntentUpdate | OCRUpdate | TranslationResult | ErrorMessage

export interface TranslatedWord {
  original: string
  translated: string
  x: number
  y: number
  width: number
  height: number
}

export interface CaptureRegion {
  x: number
  y: number
  width: number
  height: number
}

declare global {
  interface Window {
    electronAPI: {
      setIgnoreMouse: (ignore: boolean) => void
      setOpacity: (opacity: number) => void
      quit: () => void
      copyToClipboard: (text: string) => void
      setCaptureRegion: (region: CaptureRegion | null) => void
      setRegionSelecting: (active: boolean) => void
      onToggleTranslation: (callback: () => void) => () => void
      onAppQuit: (callback: () => void) => () => void
      onStartRegionSelect: (callback: () => void) => () => void
      onCaptureRegionUpdated: (callback: (region: CaptureRegion | null) => void) => () => void
      onCancelRegionSelect: (callback: () => void) => () => void
    }
  }
}
