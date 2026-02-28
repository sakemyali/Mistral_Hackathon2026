/**
 * Animated dorAImon reading/translating animation.
 * Shows the face scanning left-to-right across text lines.
 */
export default function DoraimonLoading({ size = 48 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <filter id="loading-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Text lines being scanned (background) */}
        <g opacity="0.15">
          <rect x="4" y="4" width="36" height="3" rx="1.5" fill="white">
            <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
          </rect>
          <rect x="4" y="11" width="28" height="3" rx="1.5" fill="white">
            <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" begin="0.3s" repeatCount="indefinite" />
          </rect>
          <rect x="4" y="18" width="32" height="3" rx="1.5" fill="white">
            <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" begin="0.6s" repeatCount="indefinite" />
          </rect>
        </g>

        {/* dorAImon face - bounces side to side reading */}
        <g filter="url(#loading-glow)">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="16,20; 36,20; 36,28; 16,28; 16,20"
            dur="3s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
          />

          {/* Face circle */}
          <circle cx="0" cy="0" r="14" fill="#3b82f6" opacity="0.9" />
          <circle cx="0" cy="2" r="9" fill="white" opacity="0.12" />

          {/* Eyes - looking in scan direction */}
          <g>
            <circle cx="-5" cy="-3" r="3" fill="white" opacity="0.9" />
            <circle cx="-4" cy="-3" r="1.5" fill="#3b82f6">
              <animate
                attributeName="cx"
                values="-4;-3.5;-4;-5.5;-4"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
            <circle cx="5" cy="-3" r="3" fill="white" opacity="0.9" />
            <circle cx="6" cy="-3" r="1.5" fill="#3b82f6">
              <animate
                attributeName="cx"
                values="6;6.5;6;4.5;6"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
          </g>

          {/* Nose */}
          <circle cx="0" cy="2" r="1.5" fill="white" opacity="0.4" />

          {/* Mouth - small focused 'o' */}
          <ellipse cx="0" cy="6" rx="2.5" ry="2" fill="none" stroke="white" strokeWidth="1.2" opacity="0.6">
            <animate
              attributeName="ry"
              values="2;1.5;2;2.5;2"
              dur="3s"
              repeatCount="indefinite"
            />
          </ellipse>

          {/* Connection dot */}
          <circle cx="10" cy="10" r="2.5" fill="#22c55e" stroke="#1e3a5f" strokeWidth="1.5" />
        </g>

        {/* Scan line effect */}
        <rect x="0" y="0" width="2" height="24" rx="1" fill="#3b82f6" opacity="0.3">
          <animate
            attributeName="x"
            values="4;40;4"
            dur="3s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
          />
          <animate
            attributeName="opacity"
            values="0.1;0.4;0.1"
            dur="3s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>

      <span className="text-white/40 text-[10px] tracking-wide">
        Translating...
      </span>
    </div>
  )
}
