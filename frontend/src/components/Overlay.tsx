import { useAppStore } from '../store/appStore'
import TranslationOverlay from './TranslationOverlay'
import TranslationPanel from './TranslationPanel'
import CodeSuggestionPanel from './CodeSuggestionPanel'
import ChatWidget from './ChatWidget'
import Widget from './Widget'
import RegionSelector from './RegionSelector'
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
      <TranslationOverlay />
      <TranslationPanel />
      <CodeSuggestionPanel />
      <ChatWidget />
      <Widget />
      <RegionSelector />
    </div>
  )
}
