import { useEffect, useRef, MutableRefObject } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useAppStore } from '../store/appStore'
import type { OCRWord, TranslatedWord } from '../types'

const THROTTLE_MS = 800
const STALE_SIMILARITY_THRESHOLD = 0.3
const MIN_LINE_LENGTH = 3

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

function mergeIntoParagraphs(lines: OCRWord[][]): OCRWord[][][] {
  if (lines.length === 0) return []
  const paragraphs: OCRWord[][][] = [[lines[0]]]
  for (let i = 1; i < lines.length; i++) {
    const prevLine = lines[i - 1]
    const currLine = lines[i]
    const prevBottom = Math.max(...prevLine.map((w) => w.y + w.height))
    const currTop = Math.min(...currLine.map((w) => w.y))
    const prevAvgHeight = prevLine.reduce((s, w) => s + w.height, 0) / prevLine.length
    const gap = currTop - prevBottom
    const prevLeft = Math.min(...prevLine.map((w) => w.x))
    const currLeft = Math.min(...currLine.map((w) => w.x))
    const xAligned = Math.abs(prevLeft - currLeft) < 100
    if (gap < prevAvgHeight * 1.5 && xAligned) {
      paragraphs[paragraphs.length - 1].push(currLine)
    } else {
      paragraphs.push([currLine])
    }
  }
  return paragraphs
}

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
  // Only subscribe to the values the effect actually needs as triggers
  const translationEnabled = useAppStore((s) => s.translationEnabled)
  const ocrWords = useAppStore((s) => s.ocrWords)
  const sourceLang = useAppStore((s) => s.sourceLang)
  const targetLang = useAppStore((s) => s.targetLang)
  const autoDetectLang = useAppStore((s) => s.autoDetectLang)

  // Stable setters (never change)
  const setTranslatedWords = useAppStore((s) => s.setTranslatedWords)
  const setTranslationLoading = useAppStore((s) => s.setTranslationLoading)

  // Refs for tracking — NO store deps, no re-render cycles
  const pendingRef = useRef<Map<string, { paragraphs: OCRWord[][][] }>>(new Map())
  const lastTextRef = useRef('')
  const prevTextRef = useRef('')  // stale detection — ref instead of store
  const lastSentRef = useRef(0)
  const trailingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Register the translation result handler
  useEffect(() => {
    translationHandlerRef.current = (requestId: string, translations: string[]) => {
      const pending = pendingRef.current.get(requestId)
      if (!pending) return
      pendingRef.current.delete(requestId)

      const { paragraphs } = pending
      // OCR coordinates are in physical pixels (mss captures at native resolution),
      // but the Electron overlay uses CSS/logical pixels. Divide by devicePixelRatio
      // to convert (e.g., 2× on Retina displays).
      const dpr = window.devicePixelRatio || 1
      const result: TranslatedWord[] = paragraphs.map((paraLines, i) => {
        const allWords = paraLines.flat()
        const minX = Math.min(...allWords.map((w) => w.x)) / dpr
        const minY = Math.min(...allWords.map((w) => w.y)) / dpr
        const maxRight = Math.max(...allWords.map((w) => w.x + w.width)) / dpr
        const maxBottom = Math.max(...allWords.map((w) => w.y + w.height)) / dpr
        const original = paraLines
          .map((lineWords) => lineWords.map((w) => w.text).join(' '))
          .join(' ')
        return {
          original,
          translated: translations[i] || original,
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

  // Fire a translation request
  const sendRef = useRef(send)
  sendRef.current = send
  const sourceLangRef = useRef(sourceLang)
  sourceLangRef.current = sourceLang
  const targetLangRef = useRef(targetLang)
  targetLangRef.current = targetLang
  const autoDetectRef = useRef(autoDetectLang)
  autoDetectRef.current = autoDetectLang

  const fireTranslation = useRef((words: OCRWord[], text: string) => {
    lastTextRef.current = text
    lastSentRef.current = Date.now()

    const lines = groupWordsIntoLines(words)
    const meaningfulLines = lines.filter((lineWords) => {
      const lineText = lineWords.map((w) => w.text).join(' ').trim()
      return lineText.length >= MIN_LINE_LENGTH
    })

    if (meaningfulLines.length === 0) {
      setTranslationLoading(false)
      return
    }

    const paragraphs = mergeIntoParagraphs(meaningfulLines)
    const texts = paragraphs.map((paraLines) =>
      paraLines.map((lineWords) => lineWords.map((w) => w.text).join(' ')).join(' '),
    )

    const requestId = uuidv4()
    pendingRef.current.set(requestId, { paragraphs })

    console.log(`[Translation] Sending ${texts.length} paragraphs, id=${requestId.slice(0, 8)}`)

    sendRef.current({
      type: 'translate',
      texts,
      source_lang: autoDetectRef.current ? 'Auto' : sourceLangRef.current,
      target_lang: targetLangRef.current,
      request_id: requestId,
    })
  }).current

  // Throttle effect — only depends on ocrWords and translationEnabled (no store cycle)
  useEffect(() => {
    if (!translationEnabled || ocrWords.length === 0) {
      setTranslatedWords([])
      setTranslationLoading(false)
      lastTextRef.current = ''
      prevTextRef.current = ''
      return
    }

    const currentText = ocrWords.map((w) => w.text).join(' ')

    // Stale detection using ref (no store update = no re-render cycle)
    if (prevTextRef.current && wordSimilarity(currentText, prevTextRef.current) < STALE_SIMILARITY_THRESHOLD) {
      setTranslatedWords([])
    }
    prevTextRef.current = currentText

    // Skip if text hasn't changed
    if (currentText === lastTextRef.current) return

    setTranslationLoading(true)

    // Clear any pending trailing call
    if (trailingRef.current) clearTimeout(trailingRef.current)

    const elapsed = Date.now() - lastSentRef.current

    if (elapsed >= THROTTLE_MS) {
      fireTranslation(ocrWords, currentText)
    } else {
      trailingRef.current = setTimeout(() => {
        const latest = useAppStore.getState()
        const latestText = latest.ocrWords.map((w) => w.text).join(' ')
        if (latestText !== lastTextRef.current && latest.ocrWords.length > 0) {
          fireTranslation(latest.ocrWords, latestText)
        }
      }, THROTTLE_MS - elapsed)
    }

    return () => {
      if (trailingRef.current) clearTimeout(trailingRef.current)
    }
  }, [ocrWords, translationEnabled, setTranslatedWords, setTranslationLoading])
}
