/**
 * Qwillio inline SVG logo — two overlapping gradient circles with a centered
 * "QW" wordmark. Transparent background so it adapts to light or dark surfaces.
 */
export default function QwillioLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  const r = size * 0.344;
  const cx1 = size * 0.391;
  const cx2 = size * 0.609;
  const cy = size * 0.5;
  const fontSize = size * 0.37;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      aria-label="Qwillio logo"
    >
      <defs>
        <linearGradient id="qwLogoA" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id="qwLogoB" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>
        <clipPath id="qwIntersect">
          <circle cx={cx1} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx1} cy={cy} r={r} fill="url(#qwLogoA)" />
      <circle cx={cx2} cy={cy} r={r} fill="url(#qwLogoB)" />
      <circle cx={cx2} cy={cy} r={r} fill="#4c1d95" opacity={0.55} clipPath="url(#qwIntersect)" />
      <text
        x={size * 0.5}
        y={cy + fontSize * 0.35}
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
        fontSize={fontSize}
        fontWeight={900}
        fill="#ffffff"
        letterSpacing={-fontSize * 0.03}
      >
        QW
      </text>
    </svg>
  );
}
