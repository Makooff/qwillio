/**
 * Qwillio minimal loader — the two logo orbs (blue + violet) pulsing
 * and drifting together/apart in a gentle breathing loop.
 *
 * Use this EVERYWHERE except the initial site-boot overlay
 * (AppBootOverlay keeps the full cinematic QwillioLoader).
 */

export default function OrbsLoader({
  size = 72,
  label,
  fullscreen = false,
}: {
  size?: number;
  label?: string;
  fullscreen?: boolean;
}) {
  const svg = (
    <div className="qw-orbs" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" aria-label="Chargement" role="img">
        <defs>
          <linearGradient id="orbsA" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%"   stopColor="#7D7CFB" />
            <stop offset="55%"  stopColor="#6366F1" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient id="orbsB" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%"   stopColor="#C286FA" />
            <stop offset="55%"  stopColor="#A855F7" />
            <stop offset="100%" stopColor="#9333EA" />
          </linearGradient>
          <radialGradient id="orbsHi" cx="35%" cy="25%" r="60%">
            <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <clipPath id="orbsClip">
            <circle cx="80" cy="50" r="38" />
          </clipPath>
        </defs>

        {/* Right orb (violet) — underneath */}
        <g className="qw-orbs__right">
          <circle cx="120" cy="50" r="38" fill="url(#orbsB)" opacity="0.92" />
          <circle cx="120" cy="50" r="38" fill="url(#orbsHi)" />
        </g>

        {/* Left orb (blue) — on top */}
        <g className="qw-orbs__left">
          <circle cx="80" cy="50" r="38" fill="url(#orbsA)" opacity="0.92" />
          <circle cx="80" cy="50" r="38" fill="url(#orbsHi)" />
        </g>

        {/* Overlap deepening — visible only when the orbs meet */}
        <g className="qw-orbs__overlap">
          <circle cx="120" cy="50" r="38" fill="#3D2F9E" opacity="0.55" clipPath="url(#orbsClip)" />
        </g>
      </svg>
      {label ? <div className="qw-orbs__label">{label}</div> : null}

      <style>{`
        .qw-orbs {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        .qw-orbs svg {
          width: 100%;
          height: auto;
          overflow: visible;
        }
        .qw-orbs__left,
        .qw-orbs__right,
        .qw-orbs__overlap {
          transform-box: fill-box;
          transform-origin: center;
          will-change: transform, opacity;
        }
        .qw-orbs__left {
          animation: qw-orbs-left 1800ms cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        .qw-orbs__right {
          animation: qw-orbs-right 1800ms cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        .qw-orbs__overlap {
          opacity: 0;
          animation: qw-orbs-overlap 1800ms cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        .qw-orbs__label {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          font-size: 12.5px;
          font-weight: 500;
          color: #A1A1A8;
          letter-spacing: 0.01em;
        }
        @keyframes qw-orbs-left {
          0%   { transform: translateX(0);      opacity: 0.85; }
          50%  { transform: translateX(22px);   opacity: 1; }
          100% { transform: translateX(0);      opacity: 0.85; }
        }
        @keyframes qw-orbs-right {
          0%   { transform: translateX(0);      opacity: 0.85; }
          50%  { transform: translateX(-22px);  opacity: 1; }
          100% { transform: translateX(0);      opacity: 0.85; }
        }
        @keyframes qw-orbs-overlap {
          0%, 100% { opacity: 0; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .qw-orbs__left,
          .qw-orbs__right,
          .qw-orbs__overlap {
            animation: none;
          }
          .qw-orbs__overlap { opacity: 0.6; }
        }
      `}</style>
    </div>
  );

  if (!fullscreen) return svg;
  return (
    <div
      className="qw-orbs-screen"
      style={{
        minHeight: '60vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {svg}
    </div>
  );
}
