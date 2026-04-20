/**
 * Qwillio animated loader — two luminous bubbles enter from the left and
 * right edges of the screen. They start slightly smaller than the final
 * logo and grow progressively as they travel toward the centre, reaching
 * full size exactly at the crossing point where they form the logo.
 * The Q and W letters then fade in on top.
 *
 * Plays once and holds the final logo until unmount.
 */

const Q_PATH =
  'M0 75.10L0 75.10Q-19.82 75.10-35.89 66.41Q-51.95 57.71-61.33 40.97Q-70.70 24.22-70.70 0.10L-70.70 0.10Q-70.70-24.22-61.33-41.02Q-51.95-57.81-35.89-66.46Q-19.82-75.10 0-75.10L0-75.10Q19.82-75.10 35.84-66.46Q51.86-57.81 61.28-41.02Q70.70-24.22 70.70 0.10L70.70 0.10Q70.70 19.14 64.70 33.59Q58.69 48.05 48.34 57.52L48.34 57.52L70.51 83.50L36.33 83.50L25.88 70.90Q13.87 75.10 0 75.10ZM0.78 39.94L-15.23 18.85L15.43 18.85L22.95 28.13Q29.69 17.87 29.69 0.10L29.69 0.10Q29.69-18.85 22.02-29.39Q14.36-39.94 0-39.94L0-39.94Q-14.26-39.94-21.97-29.39Q-29.69-18.85-29.69 0.10L-29.69 0.10Q-29.69 18.95-21.97 29.44Q-14.26 39.94 0 39.94L0 39.94Q0.39 39.94 0.78 39.94L0.78 39.94Z';

const W_PATH =
  'M-20.51 72.75L-65.14 72.75L-103.71-72.75L-59.57-72.75L-47.95-16.31Q-46.00-6.74-44.19 2.88Q-42.38 12.50-40.63 22.07L-40.63 22.07Q-38.77 12.50-36.77 2.88Q-34.77-6.74-32.62-16.31L-32.62-16.31L-19.73-72.75L19.73-72.75L32.62-16.31Q34.77-6.74 36.77 2.78Q38.77 12.30 40.63 21.78L40.63 21.78Q42.29 12.30 44.09 2.78Q45.90-6.74 47.85-16.31L47.85-16.31L59.57-72.75L103.71-72.75L65.14 72.75L20.51 72.75L4.00 5.57Q3.03 1.76 2.10-2.93Q1.17-7.62 0-13.28L0-13.28Q-1.17-7.62-2.10-2.93Q-3.03 1.76-4.00 5.57L-4.00 5.57L-20.51 72.75Z';

export default function QwillioLoader({
  size = 140,
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
        viewBox="0 0 512 512"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Loading"
        role="img"
      >
        <defs>
          <linearGradient id="qwCircleA" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#7D7CFB" />
            <stop offset="55%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient id="qwCircleB" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#C286FA" />
            <stop offset="55%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#9333EA" />
          </linearGradient>
          <radialGradient id="qwHaloA" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#A5A4FF" />
            <stop offset="55%" stopColor="#6366F1" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="qwHaloB" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#DDB0FF" />
            <stop offset="55%" stopColor="#A855F7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#9333EA" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="qwHi" cx="35%" cy="25%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <clipPath id="qwClip">
            <circle cx="198" cy="256" r="176" />
          </clipPath>
          <filter id="qwGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>

        {/* ══════ LEFT BUBBLE ══════ */}
        <g className="qw-orb qw-orb--left">
          <circle className="qw-orb__halo" cx="198" cy="256" r="176" fill="url(#qwHaloA)" filter="url(#qwGlow)" />
          <circle cx="198" cy="256" r="176" fill="url(#qwCircleA)" opacity="0.82" />
          <circle cx="198" cy="256" r="176" fill="url(#qwHi)" />
        </g>

        {/* ══════ RIGHT BUBBLE ══════ */}
        <g className="qw-orb qw-orb--right">
          <circle className="qw-orb__halo" cx="314" cy="256" r="176" fill="url(#qwHaloB)" filter="url(#qwGlow)" />
          <circle cx="314" cy="256" r="176" fill="url(#qwCircleB)" opacity="0.92" />
          <circle cx="314" cy="256" r="176" fill="url(#qwHi)" />
        </g>

        {/* Venn intersection — appears once the bubbles have reached full size */}
        <g className="qw-loader__overlap">
          <circle cx="314" cy="256" r="176" fill="#2B1166" opacity="0.65" clipPath="url(#qwClip)" />
        </g>

        {/* Q and W — pure fade-in after the logo has settled */}
        <g className="qw-loader__letters">
          <g transform="translate(198 256) scale(0.680)">
            <path fill="#ffffff" d={Q_PATH} />
          </g>
          <g transform="translate(314 256) scale(0.680)">
            <path fill="#ffffff" d={W_PATH} />
          </g>
        </g>
      </svg>
      {label ? <div className="qw-loader__label">{label}</div> : null}

      <style>{`
        .qw-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
        }
        .qw-loader svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .qw-orb,
        .qw-orb__halo,
        .qw-loader__overlap,
        .qw-loader__letters {
          transform-box: fill-box;
          transform-origin: center;
        }

        /* Bubbles start slightly smaller than final (scale 0.72) at the far
           edges of the screen, and grow progressively as they travel in,
           reaching full size (scale 1) at the crossing point where they
           form the logo. */
        .qw-orb--left {
          opacity: 0;
          animation: qw-orb-left 2000ms cubic-bezier(0.22, 0.9, 0.32, 1) 0ms 1 forwards;
        }
        .qw-orb--right {
          opacity: 0;
          animation: qw-orb-right 2000ms cubic-bezier(0.22, 0.9, 0.32, 1) 0ms 1 forwards;
        }

        /* Halo is strong during travel (luminous-bubble look), fades as the
           bubbles settle into their final logo positions. */
        .qw-orb__halo {
          opacity: 0;
          animation: qw-halo 2000ms ease-out 0ms 1 forwards;
        }

        .qw-loader__overlap {
          opacity: 0;
          animation: qw-overlap 500ms ease-out 1700ms 1 forwards;
        }
        .qw-loader__letters {
          opacity: 0;
          animation: qw-letters 700ms ease-out 2000ms 1 forwards;
        }

        .qw-loader__label {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: #a1a1aa;
          opacity: 0;
          animation: qw-label 400ms ease-out 2400ms 1 forwards;
        }

        /*
         * Left bubble trajectory:
         *   0%  -> off-screen left, slightly smaller (0.72)
         *   70% -> at crossing point (overshot to +40), at full size
         *   85% -> pulled back slightly past final position
         *   100%-> settled at final Venn position (translateX=0), scale 1
         */
        @keyframes qw-orb-left {
          0%   { transform: translateX(-420px) scale(0.72); opacity: 0; }
          8%   { transform: translateX(-380px) scale(0.74); opacity: 1; }
          45%  { transform: translateX(-80px)  scale(0.88); opacity: 1; }
          70%  { transform: translateX(40px)   scale(1);    opacity: 1; }
          85%  { transform: translateX(-8px)   scale(1);    opacity: 1; }
          100% { transform: translateX(0)      scale(1);    opacity: 1; }
        }
        @keyframes qw-orb-right {
          0%   { transform: translateX(420px)  scale(0.72); opacity: 0; }
          8%   { transform: translateX(380px)  scale(0.74); opacity: 1; }
          45%  { transform: translateX(80px)   scale(0.88); opacity: 1; }
          70%  { transform: translateX(-40px)  scale(1);    opacity: 1; }
          85%  { transform: translateX(8px)    scale(1);    opacity: 1; }
          100% { transform: translateX(0)      scale(1);    opacity: 1; }
        }

        /* Aura glow during flight → subtle at rest. */
        @keyframes qw-halo {
          0%   { opacity: 0; }
          10%  { opacity: 0.8; }
          55%  { opacity: 0.75; }
          85%  { opacity: 0.15; }
          100% { opacity: 0; }
        }

        @keyframes qw-overlap {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes qw-letters {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes qw-label {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .qw-orb--left,
          .qw-orb--right,
          .qw-orb__halo,
          .qw-loader__overlap,
          .qw-loader__letters,
          .qw-loader__label {
            animation: none;
            opacity: 1;
            transform: none;
          }
          .qw-orb__halo { opacity: 0; }
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
