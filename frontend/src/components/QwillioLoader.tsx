/**
 * Qwillio animated loader — two luminous orbs enter from opposite sides,
 * cross paths through the middle, settle into the final logo position as
 * their glow fades, then the Q and W letters fade in. Plays once and
 * holds the final logo until the component is unmounted.
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
          <radialGradient id="qwOrbA" cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#A5A4FF" />
            <stop offset="45%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#3730A3" />
          </radialGradient>
          <radialGradient id="qwOrbB" cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#DDB0FF" />
            <stop offset="45%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#6B21A8" />
          </radialGradient>
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
          <filter id="qwOrbGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        {/* Left orb — glow halo underneath, then translucent circle on top */}
        <g className="qw-orb qw-orb--left">
          <circle className="qw-orb__halo" cx="198" cy="256" r="176" fill="url(#qwOrbA)" filter="url(#qwOrbGlow)" />
          <circle className="qw-orb__core" cx="198" cy="256" r="176" fill="url(#qwCircleA)" opacity="0.82" />
          <circle className="qw-orb__core" cx="198" cy="256" r="176" fill="url(#qwHi)" />
        </g>

        {/* Right orb */}
        <g className="qw-orb qw-orb--right">
          <circle className="qw-orb__halo" cx="314" cy="256" r="176" fill="url(#qwOrbB)" filter="url(#qwOrbGlow)" />
          <circle className="qw-orb__core" cx="314" cy="256" r="176" fill="url(#qwCircleB)" opacity="0.92" />
          <circle className="qw-orb__core" cx="314" cy="256" r="176" fill="url(#qwHi)" />
        </g>

        {/* Intersection — appears once the orbs have settled */}
        <g className="qw-loader__overlap">
          <circle cx="314" cy="256" r="176" fill="#2B1166" opacity="0.65" clipPath="url(#qwClip)" />
        </g>

        {/* Letters — pure fade-in after the logo has settled */}
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
        .qw-loader__overlap,
        .qw-loader__letters {
          transform-box: fill-box;
          transform-origin: center;
        }

        /* Orbs enter from outside, cross each other in the centre, then
           settle into their final positions. Total: 1300ms. */
        .qw-orb--left {
          opacity: 0;
          animation: qw-orb-left 1300ms cubic-bezier(0.25, 1, 0.3, 1) 0ms 1 forwards;
        }
        .qw-orb--right {
          opacity: 0;
          animation: qw-orb-right 1300ms cubic-bezier(0.25, 1, 0.3, 1) 0ms 1 forwards;
        }

        /* Halo is strongest as the orbs approach and cross, then dissipates
           as they settle. Independently animated on the halo circle. */
        .qw-orb__halo {
          opacity: 0;
          animation: qw-halo 1300ms ease-out 0ms 1 forwards;
        }

        /* Intersection fades in near the end of the orb travel. */
        .qw-loader__overlap {
          opacity: 0;
          animation: qw-overlap 500ms ease-out 1100ms 1 forwards;
        }

        /* Letters: pure opacity fade-in after the logo is fully settled. */
        .qw-loader__letters {
          opacity: 0;
          animation: qw-letters 700ms ease-out 1400ms 1 forwards;
        }

        .qw-loader__label {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: #a1a1aa;
          opacity: 0;
          animation: qw-label 400ms ease-out 1700ms 1 forwards;
        }

        @keyframes qw-orb-left {
          0%   { transform: translateX(-380px) scale(0.85); opacity: 0; }
          22%  { transform: translateX(-180px) scale(1.05); opacity: 1; }
          55%  { transform: translateX(80px)   scale(1.05); opacity: 1; }
          75%  { transform: translateX(-14px)  scale(1);    opacity: 1; }
          100% { transform: translateX(0)      scale(1);    opacity: 1; }
        }
        @keyframes qw-orb-right {
          0%   { transform: translateX(380px)  scale(0.85); opacity: 0; }
          22%  { transform: translateX(180px)  scale(1.05); opacity: 1; }
          55%  { transform: translateX(-80px)  scale(1.05); opacity: 1; }
          75%  { transform: translateX(14px)   scale(1);    opacity: 1; }
          100% { transform: translateX(0)      scale(1);    opacity: 1; }
        }
        @keyframes qw-halo {
          0%   { opacity: 0; }
          20%  { opacity: 0.85; }
          55%  { opacity: 0.7; }
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
