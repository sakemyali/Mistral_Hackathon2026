import { useState, useEffect, useRef } from 'react'

/**
 * Character-by-character typewriter animation hook.
 * Returns a progressively longer substring of `text`.
 * Resets on `text` change. Skips animation if `enabled` is false.
 */
export function useTypewriter(text: string, speed = 30, enabled = true): string {
  const [displayed, setDisplayed] = useState('')
  const indexRef = useRef(0)
  const prevTextRef = useRef('')

  useEffect(() => {
    // If disabled or empty, show full text immediately
    if (!enabled || !text) {
      setDisplayed(text || '')
      prevTextRef.current = text || ''
      return
    }

    // Only reset animation if the text actually changed
    if (text === prevTextRef.current) return
    prevTextRef.current = text

    setDisplayed('')
    indexRef.current = 0

    const interval = setInterval(() => {
      indexRef.current++
      if (indexRef.current >= text.length) {
        setDisplayed(text)
        clearInterval(interval)
      } else {
        setDisplayed(text.slice(0, indexRef.current))
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed, enabled])

  return displayed
}
