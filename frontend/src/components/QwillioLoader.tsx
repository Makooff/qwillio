/**
 * Qwillio animated loader — two firefly-like luminous orbs fly in from
 * the left and right edges of the screen, cross paths through the
 * centre, and at the moment they cross they bloom open into the final
 * Qwillio logo. The Q and W letters fade in after the logo has fully
 * settled.
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
          {/* Firefly core — bright, nearly white at centre, indigo-tinted edge */}
          <radialGradient id="qwFireflyA" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#A5A4FF" />
            <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.9" />
          </radialGradient>
          {/* Firefly core — bright, nearly white at centre, violet-tinted edge */}
          <radialGradient id="qwFireflyB" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#DDB0FF" />
            <stop offset="100%" stopColor="#9333EA" stopOpacity="0.9" />
          </radialGradient>

          {/* Final bubble gradients (shown after the firefly blooms) */}
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
          <radialGradient id="qwHi" cx="35%" cy="25%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          <clipPath id="qwClip">
            <circle cx="198" cy="256" r="176" />
          </clipPath>

          {/* Strong glow — the firefly's aura */}
          <filter id="qwGlowHeavy" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>

        {/* ══════ LEFT FIREFLY / ORB ══════ */}
        <g className="qw-orb qw-orb--left">
          {/* Large blurred glow halo — the firefly's aura */}
          <circle className="qw-orb__glow" cx="198" cy="256" r="176" fill="url(#qwFireflyA)" filter="url(#qwGlowHeavy)" />
          {/* Bright firefly core — dominant while the orb is small and traveling */}
          <circle className="qw-orb__spark" cx="198" cy="256" r="176" fill="url(#qwFireflyA)" />
          {/* Final bubble — fades in as the orb "blooms" into the logo */}
          <circle className="qw-orb__bubble" cx="198" cy="256" r="176" fill="url(#qwCircleA)" opacity="0.82" />
          <circle className="qw-orb__bubble" cx="198" cy="256" r="176" fill="url(#qwHi)" />
        </g>

        {/* ══════ RIGHT FIREFLY / ORB ══════ */}
        <g className="qw-orb qw-orb--right">
          <circle className="qw-orb__glow" cx="314" cy="256" r="176" fill="url(#qwFireflyB)" filter="url(#qwGlowHeavy)" />
          <circle className="qw-orb__spark" cx="314" cy="256" r="176" fill="url(#qwFireflyB)" />
          <circle className="qw-orb__bubble" cx="314" cy="256" r="176" fill="url(#qwCircleB)" opacity="0.92" />
          <circle className="qw-orb__bubble" cx="314" cy="256" r="176" fill="url(#qwHi)" />
        </g>

        {/* Venn intersection — appears once the orbs bloom */}
        <g className="qw-loader__overlap">
          <circle cx="314" cy="256" r="176" fill="#2B1166" opacity="0.65" clipPath="url(#qwClip)" />
        </g>

        {/* Q and W — pure fade-in after the logo has fully settled */}
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
        .qw-orb__glow,
        .qw-orb__spark,
        .qw-orb__bubble,
        .qw-loader__overlap,
        .qw-loader__letters {
          transform-box: fill-box;
          transform-origin: center;
        }

        /* Fireflies fly in from the far edges, cross through the centre,
           overshoot slightly, then pull back to their final Venn positions. */
        .qw-orb--left {
          opacity: 0;
          animation: qw-firefly-left 2000ms cubic-bezier(0.25, 1, 0.3, 1) 0ms 1 forwards;
        }
        .qw-orb--right {
          opacity: 0;
          animation: qw-firefly-right 2000ms cubic-bezier(0.25, 1, 0.3, 1) 0ms 1 forwards;
        }

        /* The aura — bright while the firefly is small, fades as it blooms. */
        .qw-orb__glow {
          opacity: 0;
          animation: qw-glow 2000ms ease-out 0ms 1 forwards;
        }
        /* The bright core — dominant during firefly phase, fades when the
           bubble takes over. */
        .qw-orb__spark {
          opacity: 0;
          animation: qw-spark 2000ms ease-out 0ms 1 forwards;
        }
        /* The final bubble gradient — grows in as the firefly "opens" into
           the logo at the crossing point. */
        .qw-orb__bubble {
          opacity: 0;
          animation: qw-bubble 2000ms ease-out 0ms 1 forwards;
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
          animation: qw-label 400ms ease-out 2300ms 1 forwards;
        }

        /*
         * Left firefly trajectory:
         *   0-5%   : invisible, off screen far left, tiny
         *   5-60%  : travels fast to the right, tiny + glowing
         *   60-70% : crosses past centre (to x=+30)
         *   70-85% : pulls back toward final position, starts to expand
         *   85-100%: fully bloomed at final position
         */
        @keyframes qw-firefly-left {
          0%   { transform: translateX(-520px) scale(0.12); opacity: 0; }
          5%   { transform: translateX(-480px) scale(0.14); opacity: 1; }
          60%  { transform: translateX(60px)   scale(0.18); opacity: 1; }
          72%  { transform: translateX(-12px)  scale(0.45); opacity: 1; }
          85%  { transform: translateX(0)      scale(1);    opacity: 1; }
          100% { transform: translateX(0)      scale(1);    opacity: 1; }
        }
        @keyframes qw-firefly-right {
          0%   { transform: translateX(520px)  scale(0.12); opacity: 0; }
          5%   { transform: translateX(480px)  scale(0.14); opacity: 1; }
          60%  { transform: translateX(-60px)  scale(0.18); opacity: 1; }
          72%  { transform: translateX(12px)   scale(0.45); opacity: 1; }
          85%  { transform: translateX(0)      scale(1);    opacity: 1; }
          100% { transform: translateX(0)      scale(1);    opacity: 1; }
        }

        /* Aura: softly breathing during firefly phase, then fades when the
           logo takes over. */
        @keyframes qw-glow {
          0%   { opacity: 0; }
          10%  { opacity: 0.95; }
          55%  { opacity: 0.9; }
          75%  { opacity: 0.55; }
          90%  { opacity: 0; }
          100% { opacity: 0; }
        }

        /* Bright firefly core — dominant while traveling, fades as the
           bubble gradient appears. */
        @keyframes qw-spark {
          0%   { opacity: 0; }
          8%   { opacity: 1; }
          60%  { opacity: 1; }
          78%  { opacity: 0.5; }
          90%  { opacity: 0; }
          100% { opacity: 0; }
        }

        /* Final bubble gradient — hidden during firefly phase, fades up
           once the orb has "bloomed" at centre. */
        @keyframes qw-bubble {
          0%, 60% { opacity: 0; }
          78%     { opacity: 0.5; }
          90%     { opacity: 1; }
          100%    { opacity: 1; }
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
          .qw-orb__glow,
          .qw-orb__spark,
          .qw-orb__bubble,
          .qw-loader__overlap,
          .qw-loader__letters,
          .qw-loader__label {
            animation: none;
            opacity: 1;
            transform: none;
          }
          .qw-orb__glow,
          .qw-orb__spark { opacity: 0; }
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
