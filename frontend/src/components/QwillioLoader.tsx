/**
 * Qwillio animated loader — each bubble enters from its edge of the
 * screen as a blurry, glowing orb (heavy Gaussian blur + large radial
 * halo behind it), and as it travels toward the centre it sharpens
 * progressively: blur → 0 and glow → 0. By the time both bubbles have
 * met and settled, the image is the exact static Qwillio logo. The
 * overlap deepening fades in, then the Q and W letters fade in.
 *
 * Z-order is the same as the static logo: violet (right) sits under
 * the blue (left) bubble, both in the final frame AND throughout the
 * animation. Plays once and holds until unmount.
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
          <linearGradient id="qwlA" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#7D7CFB" />
            <stop offset="55%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient id="qwlB" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#C286FA" />
            <stop offset="55%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#9333EA" />
          </linearGradient>
          {/* Soft aura gradients — lighter at the core, fade to transparent */}
          <radialGradient id="qwlAuraA" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#A5A4FF" />
            <stop offset="55%" stopColor="#6366F1" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="qwlAuraB" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#DDB0FF" />
            <stop offset="55%" stopColor="#A855F7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#9333EA" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="qwlHi" cx="35%" cy="25%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <clipPath id="qwlClip">
            <circle cx="196" cy="256" r="176" />
          </clipPath>
          <filter id="qwlAuraBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>

        {/* ══════ RIGHT bubble (violet) — underneath ══════ */}
        <g className="qw-orb qw-orb--right">
          <g className="qw-orb__aura">
            <circle cx="316" cy="256" r="176" fill="url(#qwlAuraB)" filter="url(#qwlAuraBlur)" />
          </g>
          <g className="qw-orb__body">
            <circle cx="316" cy="256" r="176" fill="url(#qwlB)" opacity="0.92" />
            <circle cx="316" cy="256" r="176" fill="url(#qwlHi)" />
          </g>
        </g>

        {/* ══════ LEFT bubble (blue) — on top of violet ══════ */}
        <g className="qw-orb qw-orb--left">
          <g className="qw-orb__aura">
            <circle cx="196" cy="256" r="176" fill="url(#qwlAuraA)" filter="url(#qwlAuraBlur)" />
          </g>
          <g className="qw-orb__body">
            <circle cx="196" cy="256" r="176" fill="url(#qwlA)" opacity="0.92" />
            <circle cx="196" cy="256" r="176" fill="url(#qwlHi)" />
          </g>
        </g>

        {/* Overlap deepening — fades in once the bubbles have settled */}
        <g className="qw-loader__overlap">
          <circle cx="316" cy="256" r="176" fill="#3D2F9E" opacity="0.58" clipPath="url(#qwlClip)" />
        </g>

        {/* Letters — pure fade-in after the logo has formed */}
        <g className="qw-loader__letters">
          <g transform="translate(196 256) scale(0.685)">
            <path fill="#ffffff" d={Q_PATH} />
          </g>
          <g transform="translate(316 256) scale(0.685)">
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
        .qw-orb__aura,
        .qw-orb__body,
        .qw-loader__overlap,
        .qw-loader__letters {
          transform-box: fill-box;
          transform-origin: center;
          will-change: transform, filter, opacity;
        }

        /* Each orb is a group that slides in from its edge of the screen
           and simultaneously sharpens from heavy blur to crisp. */
        .qw-orb--left {
          opacity: 0;
          animation: qw-slide-left 1400ms cubic-bezier(0.22, 1, 0.32, 1) 0ms 1 forwards;
        }
        .qw-orb--right {
          opacity: 0;
          animation: qw-slide-right 1400ms cubic-bezier(0.22, 1, 0.32, 1) 0ms 1 forwards;
        }

        /* Blur on the actual bubble body — strong at the start, clears as
           the bubble approaches its final position. */
        .qw-orb__body {
          animation: qw-sharpen 1400ms ease-out 0ms 1 forwards;
        }

        /* Large blurred aura halo behind each orb — bright during travel,
           fades out once the logo has formed. */
        .qw-orb__aura {
          opacity: 0;
          animation: qw-aura 1400ms ease-out 0ms 1 forwards;
        }

        .qw-loader__overlap {
          opacity: 0;
          animation: qw-overlap 500ms ease-out 1350ms 1 forwards;
        }
        .qw-loader__letters {
          opacity: 0;
          animation: qw-letters 700ms ease-out 1650ms 1 forwards;
        }

        .qw-loader__label {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: #a1a1aa;
          opacity: 0;
          animation: qw-label 400ms ease-out 2000ms 1 forwards;
        }

        /* Bubbles approach from off-screen, overshoot a touch, then bounce
           back to their final Venn positions. */
        @keyframes qw-slide-left {
          0%   { transform: translateX(-440px); opacity: 0; }
          15%  { transform: translateX(-360px); opacity: 1; }
          62%  { transform: translateX(14px);   opacity: 1; }
          80%  { transform: translateX(-4px);   opacity: 1; }
          100% { transform: translateX(0);      opacity: 1; }
        }
        @keyframes qw-slide-right {
          0%   { transform: translateX(440px);  opacity: 0; }
          15%  { transform: translateX(360px);  opacity: 1; }
          62%  { transform: translateX(-14px);  opacity: 1; }
          80%  { transform: translateX(4px);    opacity: 1; }
          100% { transform: translateX(0);      opacity: 1; }
        }

        /* Blur on the bubble body — progressively sharpens during travel. */
        @keyframes qw-sharpen {
          0%   { filter: blur(18px); }
          25%  { filter: blur(12px); }
          55%  { filter: blur(5px); }
          80%  { filter: blur(1px); }
          100% { filter: blur(0); }
        }

        /* Aura halo — bright during travel, gone when settled. */
        @keyframes qw-aura {
          0%   { opacity: 0; transform: scale(0.9); }
          15%  { opacity: 0.9; transform: scale(1.05); }
          55%  { opacity: 0.75; transform: scale(1.05); }
          80%  { opacity: 0.25; transform: scale(1); }
          100% { opacity: 0; transform: scale(1); }
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
          .qw-orb__body,
          .qw-orb__aura,
          .qw-loader__overlap,
          .qw-loader__letters,
          .qw-loader__label {
            animation: none;
            opacity: 1;
            transform: none;
            filter: none;
          }
          .qw-orb__aura { opacity: 0; }
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
