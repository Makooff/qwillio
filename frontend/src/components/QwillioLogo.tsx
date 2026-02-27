/**
 * Qwillio inline SVG logo — two overlapping circles with Q and W
 * Uses the brand purple gradient (indigo #6366f1 / violet #8b5cf6)
 */
export default function QwillioLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  const r = size * 0.31;        // circle radius
  const cx1 = size * 0.39;      // left circle center
  const cx2 = size * 0.61;      // right circle center
  const cy = size * 0.5;        // vertical center
  const fontSize = size * 0.28; // letter font size

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
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <clipPath id="qwIntersect">
          <circle cx={cx1} cy={cy} r={r} />
        </clipPath>
      </defs>
      {/* Left circle (indigo) */}
      <circle cx={cx1} cy={cy} r={r} fill="url(#qwLogoA)" />
      {/* Right circle (violet) */}
      <circle cx={cx2} cy={cy} r={r} fill="url(#qwLogoB)" />
      {/* Intersection overlay */}
      <circle cx={cx2} cy={cy} r={r} fill="#4338ca" opacity={0.5} clipPath="url(#qwIntersect)" />
      {/* Q letter */}
      <text
        x={cx1}
        y={cy + fontSize * 0.35}
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
        fontSize={fontSize}
        fontWeight={800}
        fill="white"
        opacity={0.95}
      >
        Q
      </text>
      {/* W letter */}
      <text
        x={cx2}
        y={cy + fontSize * 0.35}
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
        fontSize={fontSize * 0.88}
        fontWeight={800}
        fill="white"
        opacity={0.95}
      >
        W
      </text>
    </svg>
  );
}
