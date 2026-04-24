/**
 * Qwillio minimal loader — a thin gradient arc (blue → violet) rotating
 * inside a neutral ring.  Used everywhere except the initial site boot.
 *
 * Size prop is diameter in px.  Background ring stays faint so it reads
 * on any page surface.
 */

export default function OrbsLoader({
  size = 32,
  label,
  fullscreen = false,
}: {
  size?: number;
  label?: string;
  fullscreen?: boolean;
}) {
  // Stroke scales with size so the ring stays visually consistent.
  const stroke = Math.max(1.5, Math.round(size / 18));
  const radius = 50 - stroke;            // viewBox = 100
  const circ = 2 * Math.PI * radius;
  const arcLen = circ * 0.25;            // 25% of the circle

  const spinner = (
    <div className="qw-loader" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-label="Chargement" role="img">
        <defs>
          <linearGradient id="qwLoaderArc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#7D7CFB" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>
        </defs>
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke="url(#qwLoaderArc)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circ - arcLen}`}
          className="qw-loader__arc"
        />
      </svg>
      {label ? <div className="qw-loader__label">{label}</div> : null}

      <style>{`
        .qw-loader {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        .qw-loader svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .qw-loader__arc {
          transform-origin: 50% 50%;
          animation: qw-loader-spin 0.9s linear infinite;
          will-change: transform;
        }
        .qw-loader__label {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          font-size: 12.5px;
          font-weight: 500;
          color: #A1A1A8;
          letter-spacing: 0.01em;
        }
        @keyframes qw-loader-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .qw-loader__arc {
            animation-duration: 3s;
          }
        }
      `}</style>
    </div>
  );

  if (!fullscreen) return spinner;
  return (
    <div
      className="qw-loader-screen"
      style={{
        minHeight: '60vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {spinner}
    </div>
  );
}
