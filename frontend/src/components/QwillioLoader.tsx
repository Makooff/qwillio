/**
 * Qwillio animated loader — the two brand circles (each with its own letter
 * baked in: Q on the left, W on the right) slide in from the left and right
 * edges, meet in the middle, the overlap intersection fades in, and the
 * final settled state is the exact static Qwillio logo. Plays once and
 * holds until the component is unmounted.
 */

const Q_PATH =
  'M0 75.10L0 75.10Q-19.82 75.10-35.89 66.41Q-51.95 57.71-61.33 40.97Q-70.70 24.22-70.70 0.10L-70.70 0.10Q-70.70-24.22-61.33-41.02Q-51.95-57.81-35.89-66.46Q-19.82-75.10 0-75.10L0-75.10Q19.82-75.10 35.84-66.46Q51.86-57.81 61.28-41.02Q70.70-24.22 70.70 0.10L70.70 0.10Q70.70 19.14 64.70 33.59Q58.69 48.05 48.34 57.52L48.34 57.52L70.51 83.50L36.33 83.50L25.88 70.90Q13.87 75.10 0 75.10ZM0.78 39.94L-15.23 18.85L15.43 18.85L22.95 28.13Q29.69 17.87 29.69 0.10L29.69 0.10Q29.69-18.85 22.02-29.39Q14.36-39.94 0-39.94L0-39.94Q-14.26-39.94-21.97-29.39Q-29.69-18.85-29.69 0.10L-29.69 0.10Q-29.69 18.95-21.97 29.44Q-14.26 39.94 0 39.94L0 39.94Q0.39 39.94 0.78 39.94L0.78 39.94Z';

const W_PATH =
  'M-20.51 72.75L-65.14 72.75L-103.71-72.75L-59.57-72.75L-47.95-16.31Q-46.00-6.74-44.19 2.88Q-42.38 12.50-40.63 22.07L-40.63 22.07Q-38.77 12.50-36.77 2.88Q-34.77-6.74-32.62-16.31L-32.62-16.31L-19.73-72.75L19.73-72.75L32.62-16.31Q34.77-6.74 36.77 2.78Q38.77 12.30 40.63 21.78L40.63 21.78Q42.29 12.30 44.09 2.78Q45.90-6.74 47.85-16.31L47.85-16.31L59.57-72.75L103.71-72.75L65.14 72.75L20.51 72.75L4.00 5.57Q3.03 1.76 2.10-2.93Q1.17-7.62 0-13.28L0-13.28Q-1.17-7.62-2.10-2.93Q-3.03 1.76-4.00 5.57L-4.00 5.57L-20.51 72.75Z';

export default function QwillioLoader({
  size = 128,
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
          <radialGradient id="qwlHi" cx="35%" cy="25%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <clipPath id="qwlClip">
            <circle cx="200" cy="256" r="176" />
          </clipPath>
        </defs>

        {/* Left half — circle + Q letter, slide in from the left together */}
        <g className="qw-loader__left">
          <circle cx="200" cy="256" r="176" fill="url(#qwlA)" />
          <circle cx="200" cy="256" r="176" fill="url(#qwlHi)" />
          <g transform="translate(200 256)">
            <path fill="#ffffff" d={Q_PATH} />
          </g>
        </g>

        {/* Right half — circle + W letter, slide in from the right together */}
        <g className="qw-loader__right">
          <circle cx="312" cy="256" r="176" fill="url(#qwlB)" />
          <circle cx="312" cy="256" r="176" fill="url(#qwlHi)" />
          <g transform="translate(312 256)">
            <path fill="#ffffff" d={W_PATH} />
          </g>
        </g>

        {/* Intersection overlay — fades in once the halves meet */}
        <g className="qw-loader__overlap">
          <circle cx="312" cy="256" r="176" fill="#3B1976" opacity="0.62" clipPath="url(#qwlClip)" />
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

        .qw-loader__left,
        .qw-loader__right,
        .qw-loader__overlap {
          transform-box: fill-box;
          transform-origin: center;
        }

        .qw-loader__left {
          opacity: 0;
          animation: qw-slide-left 950ms cubic-bezier(0.22, 1, 0.36, 1) 0ms 1 forwards;
        }
        .qw-loader__right {
          opacity: 0;
          animation: qw-slide-right 950ms cubic-bezier(0.22, 1, 0.36, 1) 0ms 1 forwards;
        }
        .qw-loader__overlap {
          opacity: 0;
          animation: qw-overlap 550ms ease-out 750ms 1 forwards;
        }

        .qw-loader__label {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: #a1a1aa;
          opacity: 0;
          animation: qw-label-in 400ms ease-out 1200ms 1 forwards;
        }

        @keyframes qw-slide-left {
          0%   { transform: translateX(-360px); opacity: 0; }
          60%  { transform: translateX(18px);   opacity: 1; }
          100% { transform: translateX(0);      opacity: 1; }
        }
        @keyframes qw-slide-right {
          0%   { transform: translateX(360px);  opacity: 0; }
          60%  { transform: translateX(-18px);  opacity: 1; }
          100% { transform: translateX(0);      opacity: 1; }
        }
        @keyframes qw-overlap {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes qw-label-in {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .qw-loader__left,
          .qw-loader__right,
          .qw-loader__overlap,
          .qw-loader__label {
            animation: none;
            opacity: 1;
            transform: none;
          }
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
