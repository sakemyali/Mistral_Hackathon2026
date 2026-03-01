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

export interface ChatResponse {
  type: 'chat_response'
  text: string
  request_id: string
}

export interface AgentAction {
  agent_name: string
  action: string | null
  data: unknown
}

export interface CodeSuggestion {
  suggestion_type?: 'code' | 'idea' | 'tip' | 'action'
  content?: string
  code_before: string
  code_after: string
  explanation: string
  context: string
}

export interface NarrationData {
  audioBuffer: string | null
  text: string
  voiceMode: string
}

export interface VibeAgentData {
  suggestion: CodeSuggestion
  narration: NarrationData | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  timestamp: number
}

export interface ErrorMessage {
  type: 'error'
  message: string
  request_id: string
}

export interface TranslatedWord {
  original: string
  translated: string
  x: number
  y: number
  width: number
  height: number
}

export interface MonitorInfo {
  index: number
  width: number
  height: number
}

export interface MonitorList {
  type: 'monitor_list'
  monitors: MonitorInfo[]
}

export type WSMessage = IntentUpdate | OCRUpdate | TranslationResult | ChatResponse | ErrorMessage | MonitorList

declare global {
  interface Window {
    electronAPI: {
      setIgnoreMouse: (ignore: boolean) => void
      setFocusable: (focusable: boolean) => void
      setOpacity: (opacity: number) => void
      quit: () => void
      copyToClipboard: (text: string) => void
      pasteToActiveWindow: (text: string) => Promise<{ success: boolean; error?: string }>
      onToggleTranslation: (callback: () => void) => () => void
      onAppQuit: (callback: () => void) => () => void
      // F6: Minimized head mode
      onToggleMinimize: (callback: () => void) => () => void
      // F7: Keyboard shortcuts
      onDismissSuggestion: (callback: () => void) => () => void
      onApplySuggestion: (callback: () => void) => () => void
      onToggleChat: (callback: () => void) => () => void
      onToggleAssistant: (callback: () => void) => () => void
    }
  }
}
