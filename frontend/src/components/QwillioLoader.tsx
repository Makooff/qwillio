/**
 * Qwillio boot loader — used only by AppBootOverlay on the very first
 * page load.  Shows the static brand logo with a subtle fade-in, and a
 * thin gradient arc spinner underneath.  No flying orbs, no cinematic
 * sequence — clean, minimal, professional.
 */

import QwillioLogo from './QwillioLogo';
import OrbsLoader from './OrbsLoader';

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
  // Split the requested size between the logo (larger) and the spinner
  // (smaller) so the composition stays balanced.
  const logoSize    = Math.round(size * 0.55);
  const spinnerSize = Math.round(size * 0.22);

  const content = (
    <div className="qw-boot" style={{ width: size }}>
      <div className="qw-boot__logo">
        <QwillioLogo size={logoSize} />
      </div>
      <div className="qw-boot__spinner">
        <OrbsLoader size={spinnerSize} />
      </div>
      {label ? <div className="qw-boot__label">{label}</div> : null}

      <style>{`
        .qw-boot {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
        }
        .qw-boot__logo {
          opacity: 0;
          animation: qw-boot-fade 520ms cubic-bezier(0.22, 1, 0.32, 1) 80ms 1 forwards;
        }
        .qw-boot__spinner {
          opacity: 0;
          animation: qw-boot-fade 520ms cubic-bezier(0.22, 1, 0.32, 1) 260ms 1 forwards;
        }
        .qw-boot__label {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #A1A1A8;
          letter-spacing: 0.01em;
          opacity: 0;
          animation: qw-boot-fade 520ms cubic-bezier(0.22, 1, 0.32, 1) 420ms 1 forwards;
        }
        @keyframes qw-boot-fade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .qw-boot__logo,
          .qw-boot__spinner,
          .qw-boot__label {
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
      className="qw-boot-screen"
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
