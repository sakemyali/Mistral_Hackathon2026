import TranslationPanel from './TranslationPanel'
import Widget from './Widget'
import RegionSelector from './RegionSelector'

export default function Overlay() {
  return (
    <div className="fixed inset-0 pointer-events-none">
      <TranslationPanel />
      <Widget />
      <RegionSelector />
    </div>
  )
}
