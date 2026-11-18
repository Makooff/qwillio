/**
 * Interfaces iOS 26 (« Liquid Glass ») : appel entrant, écran verrouillé,
 * notifications.
 *
 * Redessinées d'après le système, en verre dépoli sur ce qu'il y a derrière.
 * La police est Inter, la plus proche de SF Pro sous licence libre (SF Pro
 * n'est licenciée que pour les plateformes Apple). Si le kit officiel Apple
 * est dupliqué dans le Figma de l'équipe, ces composants s'y alignent.
 */
import React from 'react';
import { Img, staticFile } from 'remotion';

export const sf: React.CSSProperties = { fontFamily: 'Inter, sans-serif', fontFeatureSettings: '"ss01", "cv11"' };

/** Le verre iOS 26 : flou du fond, reflet en bordure, légère teinte. */
export const glass = (dark = true): React.CSSProperties => ({
  background: dark ? 'rgba(28,28,30,0.42)' : 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(28px) saturate(170%)',
  WebkitBackdropFilter: 'blur(28px) saturate(170%)',
  boxShadow: `inset 0 1px 0 rgba(255,255,255,${dark ? 0.28 : 0.7}), inset 0 0 0 1px rgba(255,255,255,${dark ? 0.12 : 0.35}), 0 20px 50px rgba(0,0,0,0.28)`,
});

const PhoneGlyph = ({ size = 40, color = '#fff', down = false }: { size?: number; color?: string; down?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: down ? 'rotate(135deg)' : undefined }}>
    <path fill={color} d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
  </svg>
);

const BubbleGlyph = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><path fill="#fff" d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.6 3.4 6.1-.2 1.4-.9 2.7-1.9 3.6 1.9 0 3.7-.7 5-1.8 1.1.3 2.3.5 3.5.5 5.5 0 10-3.6 10-8s-4.5-8-10-8z" /></svg>
);

/** L'icône d'application, au gabarit iOS (coins continus approchés). */
export function AppIcon({ kind, size = 76 }: { kind: 'phone' | 'messages' | 'qwillio'; size?: number }) {
  if (kind === 'qwillio') {
    return (
      <div style={{ width: size, height: size, borderRadius: size * 0.235, background: '#FDFDFF', display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}>
        <Img src={staticFile('qwillio-logo-512.svg')} style={{ width: size * 0.95, height: size * 0.95 }} />
      </div>
    );
  }
  const bg = 'linear-gradient(180deg, #5BF675 0%, #2BCB45 100%)';
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.235, background: bg, display: 'grid', placeItems: 'center' }}>
      {kind === 'phone' ? <PhoneGlyph size={size * 0.55} /> : <BubbleGlyph size={size * 0.6} />}
    </div>
  );
}

/** Bannière d'appel entrant (appel reçu téléphone déverrouillé). */
export function IncomingCall({ name, sub, initials }: { name: string; sub: string; initials: string }) {
  return (
    <div style={{ width: 1000, height: 168, borderRadius: 60, ...glass(true), display: 'flex', alignItems: 'center', padding: '0 28px', gap: 24, ...sf }}>
      <div style={{ width: 112, height: 112, borderRadius: 9999, background: 'linear-gradient(180deg,#A6ABB8,#868B96)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 46, fontWeight: 600, flex: 'none' }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.62)', fontWeight: 500 }}>{sub}</div>
        <div style={{ fontSize: 46, color: '#fff', fontWeight: 600, letterSpacing: '-0.01em' }}>{name}</div>
      </div>
      <div style={{ width: 112, height: 112, borderRadius: 9999, background: '#FF3B30', display: 'grid', placeItems: 'center' }}><PhoneGlyph size={52} down /></div>
      <div style={{ width: 112, height: 112, borderRadius: 9999, background: '#34C759', display: 'grid', placeItems: 'center' }}><PhoneGlyph size={52} /></div>
    </div>
  );
}

/** Une notification iOS : icône, application, heure, titre, texte. */
export function Notification({ app, icon, title, body, time = 'maintenant', dark = true, width = 980 }: {
  app: string; icon: 'phone' | 'messages' | 'qwillio'; title: string; body: string; time?: string; dark?: boolean; width?: number;
}) {
  const ink = dark ? '#fff' : '#000';
  const sub = dark ? 'rgba(255,255,255,0.62)' : 'rgba(60,60,67,0.6)';
  return (
    <div style={{ width, borderRadius: 52, ...glass(dark), padding: '28px 30px', display: 'flex', gap: 24, alignItems: 'flex-start', ...sf }}>
      <AppIcon kind={icon} size={84} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 32, fontWeight: 600, color: ink }}>{title}</span>
          <span style={{ fontSize: 26, color: sub }}>{time}</span>
        </div>
        <div style={{ fontSize: 31, color: ink, opacity: 0.92, marginTop: 4, lineHeight: 1.3 }}>{body}</div>
        <div style={{ fontSize: 24, color: sub, marginTop: 6 }}>{app}</div>
      </div>
    </div>
  );
}

/** L'heure de l'écran verrouillé, au-dessus des notifications. */
export function LockClock({ time, date }: { time: string; date: string }) {
  return (
    <div style={{ textAlign: 'center', color: '#fff', ...sf }}>
      <div style={{ fontSize: 40, fontWeight: 600, opacity: 0.9 }}>{date}</div>
      <div style={{ fontSize: 250, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', marginTop: 6 }}>{time}</div>
    </div>
  );
}
