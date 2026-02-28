import type { Intent } from '../types'

interface DoraimonFaceProps {
  intent: Intent
  loading?: boolean
  connected?: boolean
  size?: number
}

export default function DoraimonFace({
  intent,
  loading = false,
  connected = true,
  size = 24,
}: DoraimonFaceProps) {
  const r = size / 2

  // Face color based on intent
  const faceColor = !connected
    ? '#6b7280' // gray when disconnected
    : intent === 'normal'
      ? '#3b82f6' // blue
      : intent === 'hesitant'
        ? '#eab308' // yellow
        : '#ef4444' // red for typo

  const glowColor = !connected
    ? 'rgba(107,114,128,0.3)'
    : intent === 'normal'
      ? 'rgba(59,130,246,0.4)'
      : intent === 'hesitant'
        ? 'rgba(234,179,8,0.4)'
        : 'rgba(239,68,68,0.4)'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      style={{ flexShrink: 0 }}
    >
      <defs>
        {/* Glow filter */}
        <filter id={`glow-${intent}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Face circle */}
      <circle
        cx="24"
        cy="24"
        r="22"
        fill={faceColor}
        opacity="0.9"
        filter={`url(#glow-${intent})`}
      >
        {loading && (
          <animate
            attributeName="opacity"
            values="0.9;0.5;0.9"
            dur="1.2s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Inner face (lighter) */}
      <circle cx="24" cy="26" r="14" fill="white" opacity="0.15" />

      {/* === EYES === */}
      {!connected ? (
        /* Disconnected: X eyes */
        <>
          <g stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9">
            <line x1="13" y1="17" x2="19" y2="23" />
            <line x1="19" y1="17" x2="13" y2="23" />
          </g>
          <g stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9">
            <line x1="29" y1="17" x2="35" y2="23" />
            <line x1="35" y1="17" x2="29" y2="23" />
          </g>
        </>
      ) : loading ? (
        /* Loading: spinning dot eyes */
        <>
          <circle cx="16" cy="20" r="4" fill="white" opacity="0.9">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 16 20"
              to="360 16 20"
              dur="1s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="16" cy="20" r="1.5" fill={faceColor} />
          <circle cx="32" cy="20" r="4" fill="white" opacity="0.9">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 32 20"
              to="360 32 20"
              dur="1s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="32" cy="20" r="1.5" fill={faceColor} />
        </>
      ) : intent === 'normal' ? (
        /* Normal: happy curved eyes (^  ^) */
        <>
          <path
            d="M12 22 Q16 16 20 22"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d="M28 22 Q32 16 36 22"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.9"
          />
        </>
      ) : intent === 'hesitant' ? (
        /* Hesitant: one normal eye, one squinted */
        <>
          {/* Left eye normal */}
          <circle cx="16" cy="20" r="3.5" fill="white" opacity="0.9" />
          <circle cx="16.5" cy="20" r="1.5" fill={faceColor} />
          {/* Right eye squinted */}
          <path
            d="M28 20 L36 20"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.9"
          />
        </>
      ) : (
        /* Typo: wide surprised eyes */
        <>
          <circle cx="16" cy="20" r="5" fill="white" opacity="0.9" />
          <circle cx="16" cy="20" r="2.5" fill={faceColor} />
          <circle cx="32" cy="20" r="5" fill="white" opacity="0.9" />
          <circle cx="32" cy="20" r="2.5" fill={faceColor} />
        </>
      )}

      {/* === MOUTH === */}
      {!connected ? (
        /* Disconnected: straight line */
        <line
          x1="17"
          y1="34"
          x2="31"
          y2="34"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
      ) : loading ? (
        /* Loading: small 'o' */
        <circle
          cx="24"
          cy="33"
          r="3"
          fill="none"
          stroke="white"
          strokeWidth="2"
          opacity="0.7"
        />
      ) : intent === 'normal' ? (
        /* Normal: smile */
        <path
          d="M16 31 Q24 38 32 31"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.9"
        />
      ) : intent === 'hesitant' ? (
        /* Hesitant: wavy/uncertain mouth */
        <path
          d="M15 33 Q19 30 24 33 Q29 36 33 33"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />
      ) : (
        /* Typo: open mouth (surprised) */
        <ellipse
          cx="24"
          cy="34"
          rx="5"
          ry="4"
          fill="white"
          opacity="0.3"
          stroke="white"
          strokeWidth="1.5"
        />
      )}

      {/* Nose dot */}
      <circle cx="24" cy="26" r="2" fill="white" opacity="0.5" />

      {/* Connection indicator - small dot bottom right */}
      <circle
        cx="38"
        cy="40"
        r="4"
        fill={connected ? '#22c55e' : '#ef4444'}
        stroke="#1f2937"
        strokeWidth="2"
      />
    </svg>
  )
}
