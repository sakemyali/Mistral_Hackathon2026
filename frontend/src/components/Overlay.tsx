import { useAppStore } from '../store/appStore'
import TranslationPanel from './TranslationPanel'
import CodeSuggestionPanel from './CodeSuggestionPanel'
import ChatWidget from './ChatWidget'
import Widget from './Widget'
import MinimizedHead from './MinimizedHead'

export default function Overlay() {
  const minimized = useAppStore((s) => s.minimized)

  if (minimized) {
    return (
      <div className="fixed inset-0 pointer-events-none">
        <MinimizedHead />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 pointer-events-none">
      <TranslationPanel />
      <CodeSuggestionPanel />
      <ChatWidget />
      <Widget />
    </div>
  )
}
