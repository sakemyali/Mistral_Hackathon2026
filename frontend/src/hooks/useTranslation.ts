import { useEffect, useRef, MutableRefObject } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useAppStore } from '../store/appStore'
import type { OCRWord, TranslatedWord } from '../types'

const DEBOUNCE_MS = 600
const STALE_SIMILARITY_THRESHOLD = 0.3 // if less than 30% of words match, clear overlays

/**
 * Group OCR words into lines based on vertical proximity.
 */
function groupWordsIntoLines(words: OCRWord[], threshold = 12): OCRWord[][] {
  if (words.length === 0) return []
  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: OCRWord[][] = [[sorted[0]]]
  for (let i = 1; i < sorted.length; i++) {
    const lastLine = lines[lines.length - 1]
    const lastWord = lastLine[lastLine.length - 1]
    if (Math.abs(sorted[i].y - lastWord.y) <= threshold) {
      lastLine.push(sorted[i])
    } else {
      lines.push([sorted[i]])
    }
  }
  return lines
}

/**
 * Compute word overlap ratio between two sets of text.
 */
function wordSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const setA = new Set(a.toLowerCase().split(/\s+/))
  const setB = new Set(b.toLowerCase().split(/\s+/))
  if (setA.size === 0 || setB.size === 0) return 0
  let overlap = 0
  for (const w of setA) if (setB.has(w)) overlap++
  return overlap / Math.max(setA.size, setB.size)
}

export function useTranslation(
  send: (data: object) => void,
  translationHandlerRef: MutableRefObject<
    ((requestId: string, translations: string[]) => void) | null
  >,
) {
  const {
    translationEnabled,
    ocrWords,
    sourceLang,
    targetLang,
    autoDetectLang,
    prevOcrText,
    setTranslatedWords,
    setTranslationLoading,
    setPrevOcrText,
  } = useAppStore()

  const pendingRef = useRef<Map<string, OCRWord[][]>>(new Map())
  const lastTextRef = useRef<string>('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Register the translation result handler
  useEffect(() => {
    translationHandlerRef.current = (requestId: string, translations: string[]) => {
      const lines = pendingRef.current.get(requestId)
      if (!lines) return
      pendingRef.current.delete(requestId)

      const result: TranslatedWord[] = lines.map((lineWords, i) => {
        const minX = Math.min(...lineWords.map((w) => w.x))
        const minY = Math.min(...lineWords.map((w) => w.y))
        const maxRight = Math.max(...lineWords.map((w) => w.x + w.width))
        const maxBottom = Math.max(...lineWords.map((w) => w.y + w.height))
        return {
          original: lineWords.map((w) => w.text).join(' '),
          translated: translations[i] || lineWords.map((w) => w.text).join(' '),
          x: minX,
          y: minY,
          width: maxRight - minX,
          height: maxBottom - minY,
        }
      })
      setTranslatedWords(result)
      setTranslationLoading(false)
    }

    return () => {
      translationHandlerRef.current = null
    }
  }, [translationHandlerRef, setTranslatedWords, setTranslationLoading])

  // Request translation when OCR words change, debounced and deduped
  useEffect(() => {
    if (!translationEnabled || ocrWords.length === 0) {
      setTranslatedWords([])
      setTranslationLoading(false)
      lastTextRef.current = ''
      return
    }

    const currentText = ocrWords.map((w) => w.text).join(' ')

    // Stale detection: if screen changed drastically, clear old overlays immediately
    if (prevOcrText && wordSimilarity(currentText, prevOcrText) < STALE_SIMILARITY_THRESHOLD) {
      setTranslatedWords([])
    }
    setPrevOcrText(currentText)

    if (currentText === lastTextRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)

    setTranslationLoading(true)

    timerRef.current = setTimeout(() => {
      lastTextRef.current = currentText
      const lines = groupWordsIntoLines(ocrWords)
      const texts = lines.map((lineWords) => lineWords.map((w) => w.text).join(' '))

      const requestId = uuidv4()
      pendingRef.current.set(requestId, lines)

      send({
        type: 'translate',
        texts,
        source_lang: autoDetectLang ? 'Auto' : sourceLang,
        target_lang: targetLang,
        request_id: requestId,
      })
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [ocrWords, translationEnabled, sourceLang, targetLang, autoDetectLang, send, setTranslatedWords, setTranslationLoading, prevOcrText, setPrevOcrText])
}
