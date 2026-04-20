/**
 * Qwillio animated loader — the two brand circles slide in from left and
 * right, collide into the logo mark, then the "QW" wordmark reveals.
 * Loops infinitely while mounted. Used in place of a generic spinner on
 * dashboard and app-level loading screens.
 */
export default function QwillioLoader({
  size = 112,
  label,
  fullscreen = true,
  background = '#0A0A0F',
}: {
  size?: number;
  label?: string;
  fullscreen?: boolean;
  background?: string;
}) {
  const content = (
    <div className="qw-loader" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Loading"
        role="img"
      >
        <defs>
          <linearGradient id="qwlA" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <linearGradient id="qwlB" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#9333ea" />
          </linearGradient>
          <clipPath id="qwlClip">
            <circle cx="39" cy="50" r="34" />
          </clipPath>
        </defs>
        <g className="qw-loader__left">
          <circle cx="39" cy="50" r="34" fill="url(#qwlA)" />
        </g>
        <g className="qw-loader__right">
          <circle cx="61" cy="50" r="34" fill="url(#qwlB)" />
        </g>
        <g className="qw-loader__overlap">
          <circle cx="61" cy="50" r="34" fill="#4c1d95" opacity="0.55" clipPath="url(#qwlClip)" />
        </g>
        <text
          className="qw-loader__text"
          x="50"
          y="63"
          textAnchor="middle"
          fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
          fontSize="37"
          fontWeight={900}
          fill="#ffffff"
          letterSpacing="-1.1"
        >
          QW
        </text>
      </svg>
      {label ? <div className="qw-loader__label">{label}</div> : null}
      <style>{`
        .qw-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
        }
        .qw-loader svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .qw-loader__left {
          transform-origin: 50% 50%;
          animation: qw-slide-left 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        .qw-loader__right {
          transform-origin: 50% 50%;
          animation: qw-slide-right 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        .qw-loader__overlap {
          opacity: 0;
          animation: qw-overlap 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        .qw-loader__text {
          opacity: 0;
          transform-origin: 50% 55%;
          animation: qw-text 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        .qw-loader__label {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
          letter-spacing: 0.02em;
          color: #a1a1aa;
        }
        @keyframes qw-slide-left {
          0%   { transform: translateX(-80px); opacity: 0; }
          25%  { transform: translateX(0);     opacity: 1; }
          80%  { transform: translateX(0);     opacity: 1; }
          100% { transform: translateX(-80px); opacity: 0; }
        }
        @keyframes qw-slide-right {
          0%   { transform: translateX(80px);  opacity: 0; }
          25%  { transform: translateX(0);     opacity: 1; }
          80%  { transform: translateX(0);     opacity: 1; }
          100% { transform: translateX(80px);  opacity: 0; }
        }
        @keyframes qw-overlap {
          0%, 28% { opacity: 0; }
          38%     { opacity: 0.55; }
          80%     { opacity: 0.55; }
          100%    { opacity: 0; }
        }
        @keyframes qw-text {
          0%, 32% { opacity: 0; transform: scale(0.6); }
          55%     { opacity: 1; transform: scale(1); }
          80%     { opacity: 1; transform: scale(1); }
          100%    { opacity: 0; transform: scale(0.9); }
        }
        @media (prefers-reduced-motion: reduce) {
          .qw-loader__left,
          .qw-loader__right,
          .qw-loader__overlap,
          .qw-loader__text {
            animation: none;
            opacity: 1;
            transform: none;
          }
          .qw-loader__overlap { opacity: 0.55; }
        }
      `}</style>
    </div>
  );

  if (!fullscreen) return content;

  return (
    <div
      className="qw-loader-screen"
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background,
      }}
    >
      {content}
    </div>
  );
}
