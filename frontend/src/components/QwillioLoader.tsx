/**
 * Qwillio animated loader — the two brand circles slide in from the left and
 * the right, settle into the final logo position with a subtle bounce, then
 * the "QW" wordmark reveals. After the intro the loader holds the exact
 * final logo indefinitely (no loop) until it unmounts when loading finishes.
 *
 * The "QW" is drawn as an Inter Display Black outline path so the
 * typography is identical regardless of whether the web font has loaded yet.
 */

const QW_PATH =
  'M-98.53 71.34L-98.53 71.34Q-117.36 71.34-132.62 63.09Q-147.88 54.83-156.79 38.92Q-165.69 23.01-165.69 0.09L-165.69 0.09Q-165.69-23.01-156.79-38.96Q-147.88-54.92-132.62-63.13Q-117.36-71.34-98.53-71.34L-98.53-71.34Q-79.69-71.34-64.48-63.13Q-49.26-54.92-40.31-38.96Q-31.36-23.01-31.36 0.09L-31.36 0.09Q-31.36 18.18-37.06 31.91Q-42.77 45.64-52.60 54.64L-52.60 54.64L-31.54 79.32L-64.01 79.32L-73.94 67.35Q-85.35 71.34-98.53 71.34ZM-97.78 37.94L-113.00 17.91L-83.87 17.91L-76.72 26.72Q-70.32 16.98-70.32 0.09L-70.32 0.09Q-70.32-17.91-77.60-27.92Q-84.89-37.94-98.53-37.94L-98.53-37.94Q-112.07-37.94-119.40-27.92Q-126.73-17.91-126.73 0.09L-126.73 0.09Q-126.73 18.00-119.40 27.97Q-112.07 37.94-98.53 37.94L-98.53 37.94Q-98.15 37.94-97.78 37.94L-97.78 37.94ZM51.40 69.12L9.00 69.12L-27.65-69.12L14.29-69.12L25.33-15.49Q27.18-6.40 28.90 2.74Q30.62 11.88 32.29 20.97L32.29 20.97Q34.05 11.88 35.95 2.74Q37.85-6.40 39.89-15.49L39.89-15.49L52.14-69.12L89.62-69.12L101.87-15.49Q103.91-6.40 105.81 2.64Q107.71 11.69 109.47 20.69L109.47 20.69Q111.05 11.69 112.77 2.64Q114.48-6.40 116.34-15.49L116.34-15.49L127.47-69.12L169.40-69.12L132.76 69.12L90.36 69.12L74.68 5.29Q73.75 1.67 72.87-2.78Q71.99-7.24 70.88-12.62L70.88-12.62Q69.77-7.24 68.88-2.78Q68.00 1.67 67.08 5.29L67.08 5.29L51.40 69.12Z';

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
          <linearGradient id="qwlA" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <linearGradient id="qwlB" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#9333ea" />
          </linearGradient>
          <clipPath id="qwlClip">
            <circle cx="200" cy="256" r="176" />
          </clipPath>
        </defs>

        <g className="qw-loader__left">
          <circle cx="200" cy="256" r="176" fill="url(#qwlA)" />
        </g>
        <g className="qw-loader__right">
          <circle cx="312" cy="256" r="176" fill="url(#qwlB)" />
        </g>
        <g className="qw-loader__overlap">
          <circle cx="312" cy="256" r="176" fill="#4c1d95" opacity="0.55" clipPath="url(#qwlClip)" />
        </g>

        <g transform="translate(256 272)">
          <g className="qw-loader__text">
            <path fill="#ffffff" d={QW_PATH} />
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

        .qw-loader__left,
        .qw-loader__right,
        .qw-loader__overlap,
        .qw-loader__text {
          transform-box: fill-box;
          transform-origin: center;
        }

        .qw-loader__left {
          opacity: 0;
          animation: qw-slide-left 900ms cubic-bezier(0.22, 1, 0.36, 1) 0ms 1 forwards;
        }
        .qw-loader__right {
          opacity: 0;
          animation: qw-slide-right 900ms cubic-bezier(0.22, 1, 0.36, 1) 0ms 1 forwards;
        }
        .qw-loader__overlap {
          opacity: 0;
          animation: qw-overlap 500ms ease-out 700ms 1 forwards;
        }
        .qw-loader__text {
          opacity: 0;
          animation: qw-text-in 650ms cubic-bezier(0.34, 1.56, 0.64, 1) 950ms 1 forwards;
        }

        .qw-loader__label {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: #a1a1aa;
          opacity: 0;
          animation: qw-label-in 400ms ease-out 1300ms 1 forwards;
        }

        @keyframes qw-slide-left {
          0%   { transform: translateX(-340px); opacity: 0; }
          60%  { transform: translateX(16px);   opacity: 1; }
          100% { transform: translateX(0);      opacity: 1; }
        }
        @keyframes qw-slide-right {
          0%   { transform: translateX(340px);  opacity: 0; }
          60%  { transform: translateX(-16px);  opacity: 1; }
          100% { transform: translateX(0);      opacity: 1; }
        }
        @keyframes qw-overlap {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes qw-text-in {
          0%   { opacity: 0; transform: scale(0.55); }
          70%  { opacity: 1; transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes qw-label-in {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .qw-loader__left,
          .qw-loader__right,
          .qw-loader__overlap,
          .qw-loader__text,
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
