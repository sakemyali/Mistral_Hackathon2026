import TranslationPanel from './TranslationPanel'
import CodeSuggestionPanel from './CodeSuggestionPanel'
import Widget from './Widget'
import RegionSelector from './RegionSelector'

export default function Overlay() {
  return (
    <div className="fixed inset-0 pointer-events-none">
      <TranslationPanel />
      <CodeSuggestionPanel />
      <Widget />
      <RegionSelector />
    </div>
  )
}
