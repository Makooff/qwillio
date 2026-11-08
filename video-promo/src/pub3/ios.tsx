/**
 * L'iPhone, recomposé depuis le kit Figma « iOS 16 UI Kit for Figma »
 * (fichier wYf81W8x2lBtTetWj8EeuQ) :
 *  - écran verrouillé    : symbole 36:7378 (LockScreen, Notification(s)=True)
 *  - notification        : 1259:11286 (Notification, Default)
 *  - appel entrant       : 34:147 (Notification-incomingCall)
 *  - barre d'état        : 1503:15313 (Dynamic Island, Default)
 * Les cotes (393 × 852 pt, marges, rayons, tailles de texte, flous) sont celles
 * du kit, à l'échelle 1 : on met l'écran entier à l'échelle d'un coup. Les
 * icônes SVG sont les exports du kit (public/ios/). Seule la police change :
 * SF Pro n'est licenciée que sur les plateformes Apple, Inter la remplace.
 */
import React from 'react';
import { Img, staticFile } from 'remotion';

export const W = 393, H = 852;
const sf: React.CSSProperties = { fontFamily: 'Inter, sans-serif', fontFeatureSettings: '"case" 1, "cv11"' };
const icon = (n: string) => staticFile(`ios/${n}.svg`);

/** Barre d'état avec l'île dynamique (1503:15313), en mode clair comme dans le kit. */
function StatusBar({ time }: { time: string }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 59, display: 'flex', alignItems: 'flex-end', ...sf }}>
      <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 10, paddingBottom: 3 }}>
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.32, color: '#000', width: 54, textAlign: 'center' }}>{time}</span>
      </div>
      <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 125, height: 37, borderRadius: 100, background: '#000' }} />
      </div>
      <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingRight: 11 }}>
        <Img src={icon('status-right')} style={{ width: 78.4, height: 13 }} />
      </div>
    </div>
  );
}

/** L'icône d'application, au gabarit du kit (34:36 : 38 pt, rayon 10). */
export function AppIcon({ kind }: { kind: 'phone' | 'qwillio' }) {
  if (kind === 'qwillio') {
    return (
      <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FDFDFF', display: 'grid', placeItems: 'center', flex: 'none', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.08)' }}>
        <Img src={staticFile('qwillio-logo-512.svg')} style={{ width: 36, height: 36 }} />
      </div>
    );
  }
  return (
    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(180deg,#5FF777,#2BCB45)', display: 'grid', placeItems: 'center', flex: 'none' }}>
      <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#fff" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" /></svg>
    </div>
  );
}

/** La notification du kit (1259:11286) : 370 pt, rayon 23, verre clair flouté à 40. */
export function Notification({ kind, title, desc, time, top }: { kind: 'phone' | 'qwillio'; title: string; desc: string; time: string; top?: string }) {
  return (
    <div style={{ width: 373, borderRadius: 23, padding: '14px 18px 14px 14px', background: 'rgba(245,245,245,0.62)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', display: 'flex', gap: 10, alignItems: 'center', ...sf }}>
      <AppIcon kind={kind} />
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {top && <div style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px', letterSpacing: -0.078, color: 'rgba(0,0,0,0.55)' }}>{top}</div>}
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: '20px', letterSpacing: -0.5, color: '#000', paddingRight: 70 }}>{title}</div>
        <div style={{ fontSize: 13, lineHeight: '18px', letterSpacing: -0.078, color: '#000' }}>{desc}</div>
        <div style={{ position: 'absolute', right: 4, top: 0, fontSize: 13, lineHeight: '18px', letterSpacing: -0.078, color: 'rgba(0,0,0,0.5)' }}>{time}</div>
      </div>
    </div>
  );
}

/** L'appel entrant du kit (34:147) : pastille noire 359 pt, rayon 100. */
export function IncomingCall({ name, initials, sub = 'mobile' }: { name: string; initials: string; sub?: string }) {
  return (
    <div style={{ width: 373, padding: '12px 14px', borderRadius: 100, background: '#000', display: 'flex', alignItems: 'center', gap: 20, ...sf }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <div style={{ width: 45, height: 45, borderRadius: 100, background: 'linear-gradient(180deg,#A5AAB5,#858A95)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 18, fontWeight: 600, flex: 'none' }}>{initials}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 20, lineHeight: '25px', letterSpacing: 0.38, minWidth: 0 }}>
          <span style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          <span style={{ color: 'rgba(235,235,245,0.6)' }}>{sub}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <Img src={icon('call-decline')} style={{ width: 36, height: 36 }} />
        <Img src={icon('call-accept')} style={{ width: 36, height: 36 }} />
      </div>
    </div>
  );
}

/**
 * L'écran verrouillé (36:7378). `children` reçoit la pile de notifications,
 * posée comme dans le kit (10 pt des bords, 120 pt du bas) ; `banner` l'appel
 * entrant, sous l'île dynamique.
 */
export function LockScreen({ time, date, wallpaper, children, banner }: { time: string; date: string; wallpaper: string; children?: React.ReactNode; banner?: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', background: '#000' }}>
      <Img src={staticFile(wallpaper)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <StatusBar time={time} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 88, textAlign: 'center', fontSize: 22, fontWeight: 500, lineHeight: '24px', letterSpacing: 0.38, color: '#fff', mixBlendMode: 'overlay', ...sf }}>{date}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 105, textAlign: 'center', fontSize: 100, fontWeight: 500, lineHeight: '119px', letterSpacing: -2.12, color: '#fff', mixBlendMode: 'overlay', ...sf }}>{time}</div>
      <div style={{ position: 'absolute', left: 10, right: 10, bottom: 120, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>{children}</div>
      <div style={{ position: 'absolute', left: 46, right: 46, bottom: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Img src={icon('flashlight')} style={{ width: 50, height: 50 }} />
        <Img src={icon('camera')} style={{ width: 50, height: 50 }} />
      </div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 134, height: 5, marginLeft: -67, borderRadius: 100, background: '#fff' }} />
      {banner && <div style={{ position: 'absolute', left: 10, top: 11 }}>{banner}</div>}
    </div>
  );
}

/** Le boîtier : un liseré de titane et un verre noir autour de l'écran du kit. */
export function Device({ children, scale }: { children: React.ReactNode; scale: number }) {
  const b = 13; // épaisseur du cadre, en points
  return (
    <div style={{ width: (W + b * 2) * scale, height: (H + b * 2) * scale, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `scale(${scale})`, width: W + b * 2, height: H + b * 2 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 68, background: '#0B0B0C', boxShadow: 'inset 0 0 0 1.5px #5A5A60, inset 0 0 0 3px #1A1A1C, 0 40px 80px -20px rgba(40,20,80,0.35), 0 18px 36px -12px rgba(0,0,0,0.25)' }} />
        <div style={{ position: 'absolute', left: b, top: b, width: W, height: H, borderRadius: 55, overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
}
