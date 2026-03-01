import { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import DoraimonFace from './DoraimonFace'

export default function ChatWidget() {
  const chatOpen = useAppStore((s) => s.chatOpen)
  const setChatOpen = useAppStore((s) => s.setChatOpen)
  const chatMessages = useAppStore((s) => s.chatMessages)
  const addChatMessage = useAppStore((s) => s.addChatMessage)
  const wsSend = useAppStore((s) => s.wsSend)
  const connected = useAppStore((s) => s.connected)

  const panelRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [position, setPosition] = useState(() => ({
    x: Math.min(window.screen.availWidth - 400, 400),
    y: 180,
  }))
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    // Clear waiting state when assistant message arrives
    const lastMsg = chatMessages[chatMessages.length - 1]
    if (lastMsg?.role === 'assistant') {
      setWaiting(false)
    }
  }, [chatMessages])

  // Focus input when chat opens
  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [chatOpen])

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
      if ((e.target as HTMLElement).closest('button, input')) return
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

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || !wsSend || waiting) return

    addChatMessage({ role: 'user', text, timestamp: Date.now() })
    wsSend({
      type: 'chat_message',
      text,
      request_id: `chat-${Date.now()}`,
    })
    setInput('')
    setWaiting(true)
  }, [input, wsSend, waiting, addChatMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  if (!chatOpen) return null

  return (
    <div
      ref={panelRef}
      className="fixed pointer-events-auto select-none animate-[fadeIn_0.2s_ease-out]"
      style={{
        left: position.x,
        top: position.y,
        zIndex: 99997,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="rounded-2xl border border-white/[0.08] overflow-hidden flex flex-col
          shadow-[0_8px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)]"
        style={{
          width: 380,
          height: 460,
          background: 'linear-gradient(180deg, rgba(22,22,30,0.95) 0%, rgba(16,16,24,0.97) 100%)',
          backdropFilter: 'blur(24px) saturate(1.2)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 cursor-grab"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
          }}
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <DoraimonFace intent="normal" connected={connected} size={20} />
              {connected && (
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full
                  border border-[rgba(22,22,30,0.95)]" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-white/90 text-[11px] font-semibold tracking-wide">dorAImon Chat</span>
              <span className="text-white/25 text-[8px]">Ask anything about your screen</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/15 text-[8px] mr-1">Alt+C</span>
            <button
              onClick={() => setChatOpen(false)}
              className="text-white/30 hover:text-white/70 hover:bg-white/10 w-5 h-5 flex items-center
                justify-center rounded-md text-[10px] cursor-pointer transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.1) transparent',
          }}
        >
          {chatMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
              <DoraimonFace intent="normal" connected={connected} size={40} />
              <div className="text-center">
                <p className="text-white/50 text-[11px] font-medium">No messages yet</p>
                <p className="text-white/25 text-[9px] mt-0.5">
                  Ask about what's on your screen, get help with code, or just chat
                </p>
              </div>
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-[fadeIn_0.15s_ease-out]`}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 mr-2 mt-1">
                  <DoraimonFace intent="normal" connected={connected} size={14} />
                </div>
              )}
              <div
                className={`max-w-[80%] text-[11px] leading-[1.6] ${
                  msg.role === 'user'
                    ? 'rounded-2xl rounded-br-md px-3.5 py-2 text-white/90'
                    : 'rounded-2xl rounded-bl-md px-3.5 py-2 text-white/75'
                }`}
                style={
                  msg.role === 'user'
                    ? {
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.35) 0%, rgba(99,102,241,0.3) 100%)',
                        border: '1px solid rgba(99,102,241,0.15)',
                      }
                    : {
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }
                }
              >
                {msg.text}
              </div>
            </div>
          ))}

          {waiting && (
            <div className="flex justify-start animate-[fadeIn_0.15s_ease-out]">
              <div className="flex-shrink-0 mr-2 mt-1">
                <DoraimonFace intent="normal" connected={connected} size={14} loading={true} />
              </div>
              <div
                className="rounded-2xl rounded-bl-md px-3.5 py-2 text-[11px]"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span className="text-white/30 flex items-center gap-1.5">
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  Thinking
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          className="px-3 py-2.5"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.15)',
          }}
        >
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all
              focus-within:border-blue-500/30"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message dorAImon..."
              className="flex-1 bg-transparent text-white/90 text-[11px] outline-none
                placeholder:text-white/20"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || waiting}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg
                cursor-pointer transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              style={{
                background: input.trim() && !waiting
                  ? 'linear-gradient(135deg, rgba(59,130,246,0.6) 0%, rgba(99,102,241,0.5) 100%)'
                  : 'rgba(255,255,255,0.05)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={input.trim() && !waiting ? 'text-white' : 'text-white/30'}
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
