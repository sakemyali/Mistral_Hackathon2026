import { useAppStore } from '../store/appStore'

export default function OpacitySlider() {
  const { overlayOpacity, setOverlayOpacity } = useAppStore()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    setOverlayOpacity(value)
    window.electronAPI?.setOpacity(value)
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/70 text-xs">
        Opacity: {Math.round(overlayOpacity * 100)}%
      </label>
      <input
        type="range"
        min="0.1"
        max="1"
        step="0.05"
        value={overlayOpacity}
        onChange={handleChange}
        className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:bg-white
          [&::-webkit-slider-thumb]:rounded-full"
      />
    </div>
  )
}
