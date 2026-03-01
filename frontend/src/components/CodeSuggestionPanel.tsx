import { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import type { VibeAgentData } from '../types'
import DoraimonFace from './DoraimonFace'
import { useTypewriter } from '../hooks/useTypewriter'

const AUTO_DISMISS_MS = 30_000
const APPLIED_DISMISS_MS = 2_000

// ── Inline diff renderer (no external lib) ──────────────────────────────────
function InlineDiff({ before, after }: { before: string; after: string }) {
  const diff = computeLineDiff(before, after)

  return (
    <pre className="px-3 py-2 text-[11px] font-mono leading-relaxed whitespace-pre-wrap">
      {diff.map((d, i) => (
        <div
          key={i}
          className={
            d.type === 'remove'
              ? 'bg-red-500/20 text-red-300'
              : d.type === 'add'
                ? 'bg-green-500/20 text-green-300'
                : 'text-white/50'
          }
        >
          <span className="select-none text-white/20 mr-2 inline-block w-3 text-right">
            {d.type === 'remove' ? '-' : d.type === 'add' ? '+' : ' '}
          </span>
          {d.text}
        </div>
      ))}
    </pre>
  )
}

function computeLineDiff(before: string, after: string) {
  const bLines = before.split('\n')
  const aLines = after.split('\n')
  const result: Array<{ type: 'remove' | 'add' | 'same'; text: string }> = []

  let bi = 0
  let ai = 0
  while (bi < bLines.length || ai < aLines.length) {
    if (bi < bLines.length && ai < aLines.length && bLines[bi] === aLines[ai]) {
      result.push({ type: 'same', text: bLines[bi] })
      bi++
      ai++
    } else if (bi < bLines.length && !aLines.slice(ai).includes(bLines[bi])) {
      result.push({ type: 'remove', text: bLines[bi] })
      bi++
    } else if (ai < aLines.length) {
      result.push({ type: 'add', text: aLines[ai] })
      ai++
    } else {
      result.push({ type: 'remove', text: bLines[bi] })
      bi++
    }
  }
  return result
}

// ── Badge helpers ─────────────────────────────────────────────────────────
function getBadge(actionType: string | null, suggestionType?: string) {
  if (actionType === 'fixError') return { label: 'Fix Error', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
  switch (suggestionType) {
    case 'idea': return { label: 'Idea', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' }
    case 'tip': return { label: 'Tip', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
    case 'action': return { label: 'Action', color: 'bg-green-500/20 text-green-400 border-green-500/30' }
    default: return { label: 'Suggestion', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
  }
}

// ── Panel states ─────────────────────────────────────────────────────────────
type PanelView = 'suggestion' | 'diff' | 'applied'

export default function CodeSuggestionPanel() {
  const agentAction = useAppStore((s) => s.agentAction)
  const codeSuggestionVisible = useAppStore((s) => s.codeSuggestionVisible)
  const narrationPlaying = useAppStore((s) => s.narrationPlaying)
  const dismissCodeSuggestion = useAppStore((s) => s.dismissCodeSuggestion)
  const wsSend = useAppStore((s) => s.wsSend)

  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(() => ({
    x: Math.min(window.screen.availWidth - 400, 800),
    y: 120,
  }))
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [view, setView] = useState<PanelView>('suggestion')

  // Reset view when new suggestion arrives
  useEffect(() => {
    if (codeSuggestionVisible) setView('suggestion')
  }, [agentAction, codeSuggestionVisible])

  // Auto-dismiss timer (paused during diff view or while narration is playing)
  useEffect(() => {
    if (!codeSuggestionVisible || view === 'diff') return
    // Pause auto-dismiss while narration is playing so user can listen
    if (view === 'suggestion' && narrationPlaying) return
    const ms = view === 'applied' ? APPLIED_DISMISS_MS : AUTO_DISMISS_MS
    const timer = setTimeout(() => {
      // Send feedback to backend so pending_suggestion is cleared
      wsSend?.({ type: 'suggestion_feedback', action: 'auto_dismissed' })
      dismissCodeSuggestion()
    }, ms)
    return () => clearTimeout(timer)
  }, [codeSuggestionVisible, agentAction, dismissCodeSuggestion, view, narrationPlaying, wsSend])

  // Listen for Alt+A (apply-suggestion) custom event from App.tsx
  useEffect(() => {
    const handler = () => {
      if (!codeSuggestionVisible) return
      if (view === 'suggestion') {
        setView('diff')
      } else if (view === 'diff') {
        handleConfirmApplyRef.current?.()
      }
    }
    window.addEventListener('doraemon-apply-suggestion', handler)
    return () => window.removeEventListener('doraemon-apply-suggestion', handler)
  }, [codeSuggestionVisible, view])

  const handleMouseEnter = useCallback(() => {
    window.electronAPI?.setIgnoreMouse(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (!dragging) {
      window.electronAPI?.setIgnoreMouse(true)
    }
  }, [dragging])

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, pre')) return
      setDragging(true)
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      }

      const handleMove = (ev: MouseEvent) => {
        setPosition({
          x: ev.clientX - dragOffset.current.x,
          y: ev.clientY - dragOffset.current.y,
        })
      }

      const handleUp = () => {
        setDragging(false)
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [position],
  )

  const handleCopy = useCallback(() => {
    const d = agentAction?.data as VibeAgentData | undefined
    const text = d?.suggestion?.code_after || d?.suggestion?.content
    if (text) {
      window.electronAPI?.copyToClipboard(text)
    }
  }, [agentAction])

  const handleApply = useCallback(() => {
    setView('diff')
  }, [])

  const handleConfirmApply = useCallback(async () => {
    const d = agentAction?.data as VibeAgentData | undefined
    const code = d?.suggestion?.code_after
    if (!code) return

    // Send feedback to backend
    wsSend?.({ type: 'suggestion_feedback', action: 'applied' })

    // Make overlay transparent FIRST so Cmd+V reaches the editor
    window.electronAPI?.setIgnoreMouse(true)

    try {
      const result = await window.electronAPI?.pasteToActiveWindow(code)
      if (result?.success) {
        setView('applied')
      } else {
        window.electronAPI?.copyToClipboard(code)
        setView('applied')
      }
    } catch {
      window.electronAPI?.copyToClipboard(code)
      setView('applied')
    }
  }, [agentAction, wsSend])

  // Keep a ref for the event listener
  const handleConfirmApplyRef = useRef(handleConfirmApply)
  handleConfirmApplyRef.current = handleConfirmApply

  const handleDismiss = useCallback(() => {
    wsSend?.({ type: 'suggestion_feedback', action: 'dismissed' })
    dismissCodeSuggestion()
  }, [wsSend, dismissCodeSuggestion])

  const handleCancelDiff = useCallback(() => {
    setView('suggestion')
  }, [])

  // Typewriter animations
  const data = (codeSuggestionVisible && agentAction?.agent_name === 'vibe')
    ? agentAction.data as VibeAgentData | undefined
    : undefined
  const narrationText = useTypewriter(data?.narration?.text || '', 25, narrationPlaying)
  const explanationText = useTypewriter(data?.suggestion?.explanation || '', 20, codeSuggestionVisible)

  if (!codeSuggestionVisible || !agentAction || agentAction.agent_name !== 'vibe') {
    return null
  }

  const suggestion = data?.suggestion
  const narration = data?.narration
  const actionType = agentAction.action

  // Determine suggestion type (F9: flexible suggestions)
  const suggestionType = suggestion?.suggestion_type || 'code'
  const isCodeSuggestion = suggestionType === 'code'
  const { label: badge, color: badgeColor } = getBadge(actionType, suggestionType)

  const hasCode = isCodeSuggestion && !!(suggestion?.code_after)
  const hasDiff = isCodeSuggestion && !!(suggestion?.code_before && suggestion?.code_after && suggestion.code_before !== suggestion.code_after)

  return (
    <div
      ref={panelRef}
      className="fixed pointer-events-auto select-none animate-[fadeIn_0.2s_ease-out]"
      style={{
        left: position.x,
        top: position.y,
        zIndex: 99998,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="bg-gray-900/90 backdrop-blur-md rounded-xl border border-white/10
          shadow-2xl overflow-hidden transition-all"
        style={{ width: 400 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 cursor-grab"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2">
            <DoraimonFace
              intent={actionType === 'fixError' ? 'typo' : 'hesitant'}
              loading={false}
              connected={true}
              size={18}
              talking={narrationPlaying}
            />
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeColor}`}>
              {badge}
            </span>
            {view === 'diff' && (
              <span className="text-yellow-400/70 text-[9px] font-medium">PREVIEW</span>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/40 hover:text-white text-xs px-1 cursor-pointer transition-colors"
            title="Dismiss (Alt+D)"
          >
            ✕
          </button>
        </div>

        {/* Narration bar */}
        {narration?.text && view === 'suggestion' && (
          <div className="px-3 py-1.5 border-b border-white/5 flex items-center gap-2">
            <span className={`text-[11px] ${narrationPlaying ? 'text-blue-300 animate-pulse' : 'text-white/40'}`}>
              {narrationPlaying ? '🔊' : '💬'}
            </span>
            <span className="text-white/60 text-[11px] italic leading-snug">
              {narrationText}
              {narrationText.length < (narration.text?.length || 0) && (
                <span className="animate-pulse ml-0.5">|</span>
              )}
            </span>
          </div>
        )}

        {/* Explanation */}
        {suggestion?.explanation && view !== 'applied' && (
          <div className="px-3 py-1.5 border-b border-white/5">
            <span className="text-white/70 text-[11px] leading-snug">
              {explanationText}
              {explanationText.length < (suggestion.explanation?.length || 0) && (
                <span className="animate-pulse ml-0.5">|</span>
              )}
            </span>
          </div>
        )}

        {/* Content area */}
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'min(50vh, 400px)' }}>
          {/* Applied state */}
          {view === 'applied' && (
            <div className="px-3 py-6 text-center">
              <span className="text-green-400 text-sm font-medium">Applied!</span>
              <p className="text-white/30 text-[10px] mt-1">Code pasted to your editor</p>
            </div>
          )}

          {/* Suggestion view */}
          {view === 'suggestion' && (
            isCodeSuggestion && hasCode ? (
              <pre className="px-3 py-2.5 text-[11px] leading-relaxed text-green-300/90 font-mono whitespace-pre-wrap break-words">
                {suggestion!.code_after}
              </pre>
            ) : !isCodeSuggestion && suggestion?.content ? (
              // Non-code suggestion: show content text
              <div className="px-3 py-3">
                <p className="text-white/80 text-[12px] leading-relaxed">
                  {suggestion.content}
                </p>
              </div>
            ) : (
              <div className="px-3 py-4 text-center">
                <span className="text-white/25 text-xs">
                  {suggestion?.explanation || 'No suggestion available'}
                </span>
              </div>
            )
          )}

          {/* Diff view: show before vs after */}
          {view === 'diff' && hasDiff && (
            <InlineDiff
              before={suggestion!.code_before}
              after={suggestion!.code_after}
            />
          )}

          {/* Diff view but no diff (code_before === code_after) */}
          {view === 'diff' && !hasDiff && hasCode && (
            <div className="px-3 py-4 text-center">
              <span className="text-white/40 text-xs">No changes — code looks good</span>
            </div>
          )}
        </div>

        {/* Footer for code suggestions */}
        {view === 'suggestion' && isCodeSuggestion && hasCode && (
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/10">
            <span className="text-white/20 text-[9px]">Alt+D dismiss · Alt+A apply</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="bg-white/10 hover:bg-white/20 text-white/70 text-[10px]
                  rounded px-2 py-0.5 cursor-pointer transition-colors"
              >
                Copy
              </button>
              <button
                onClick={handleApply}
                className="bg-green-500/20 hover:bg-green-500/30 text-green-400 text-[10px]
                  rounded px-2 py-0.5 border border-green-500/30 cursor-pointer transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Footer for non-code suggestions */}
        {view === 'suggestion' && !isCodeSuggestion && (
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/10">
            <span className="text-white/20 text-[9px]">Alt+D to dismiss</span>
            <button
              onClick={handleDismiss}
              className="bg-white/10 hover:bg-white/20 text-white/70 text-[10px]
                rounded px-2 py-0.5 cursor-pointer transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Diff footer */}
        {view === 'diff' && (
          <div className="flex items-center justify-end gap-1.5 px-3 py-1.5 border-t border-white/10">
            <button
              onClick={handleCancelDiff}
              className="bg-white/10 hover:bg-white/20 text-white/70 text-[10px]
                rounded px-2 py-0.5 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmApply}
              className="bg-green-500/20 hover:bg-green-500/30 text-green-400 text-[10px]
                rounded px-2.5 py-0.5 border border-green-500/30 cursor-pointer transition-colors font-medium"
            >
              Confirm Apply
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
