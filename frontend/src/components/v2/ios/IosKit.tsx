/**
 * Le kit iOS des publicités (video-promo/src/pub3/ios.tsx), repris tel quel
 * pour le site: écran verrouillé, notification, appel entrant, écran d'appel
 * en cours et boîtier, aux cotes du kit Figma « iOS 16 UI Kit ». Seuls
 * changent le chargement des images (fichiers de public/ios-kit au lieu de
 * `staticFile` de Remotion), la police (celle du système, donc SF Pro sur
 * les appareils Apple) l'ombre du boîtier, neutre au lieu de mauve, et la notification: un fond
 * presque opaque au lieu du verre flouté, que Safari rend mal dans un
 * téléphone incliné en 3D (backdrop-filter sous transformation).
 * Toute retouche se fait dans les DEUX fichiers, pour que le site et les
 * pubs montrent le même téléphone.
 */
import React from 'react';

export const W = 393, H = 852;
export const sf: React.CSSProperties = { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif' };
const icon = (n: string) => `/ios-kit/${n}.svg`;

/** Barre d'état avec l'île dynamique (1503:15313), en mode clair comme dans le kit. */
export function StatusBar({ time }: { time: string }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 59, display: 'flex', alignItems: 'flex-end', ...sf }}>
      <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 10, paddingBottom: 3 }}>
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.32, color: '#000', width: 54, textAlign: 'center' }}>{time}</span>
      </div>
      <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 125, height: 37, borderRadius: 100, background: '#000' }} />
      </div>
      <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingRight: 11 }}>
        <img alt="" src={icon('status-right')} style={{ width: 78.4, height: 13 }} />
      </div>
    </div>
  );
}

/** L'icône d'application, au gabarit du kit (34:36 : 38 pt, rayon 10). */
export function AppIcon({ kind }: { kind: 'phone' | 'qwillio' | 'messages' }) {
  if (kind === 'qwillio') {
    return (
      <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FDFDFF', display: 'grid', placeItems: 'center', flex: 'none', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.08)' }}>
        <img alt="" src={'/qwillio-logo-512.svg'} style={{ width: 36, height: 36 }} />
      </div>
    );
  }
  if (kind === 'messages') {
    return (
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(180deg,#5FF777,#2BCB45)', display: 'grid', placeItems: 'center', flex: 'none' }}>
        <svg width="24" height="24" viewBox="0 0 24 24"><path fill="#fff" d="M12 3.5c-5.2 0-9.4 3.5-9.4 7.9 0 2.5 1.4 4.7 3.6 6.2-.2 1.2-.8 2.3-1.7 3.1 1.7 0 3.3-.6 4.5-1.6 1 .2 2 .3 3 .3 5.2 0 9.4-3.5 9.4-7.9S17.2 3.5 12 3.5z" /></svg>
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
export function Notification({ kind, title, desc, time, top }: { kind: 'phone' | 'qwillio' | 'messages'; title: string; desc: string; time: string; top?: string }) {
  return (
    <div style={{ width: 373, borderRadius: 23, padding: '14px 18px 14px 14px', background: 'rgba(246,246,248,0.94)', boxShadow: '0 6px 20px -10px rgba(0,0,0,0.35)', display: 'flex', gap: 10, alignItems: 'center', ...sf }}>
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
        <img alt="" src={icon('call-decline')} style={{ width: 36, height: 36 }} />
        <img alt="" src={icon('call-accept')} style={{ width: 36, height: 36 }} />
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
      <img alt="" src={wallpaper} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <StatusBar time={time} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 88, textAlign: 'center', fontSize: 22, fontWeight: 500, lineHeight: '24px', letterSpacing: 0.38, color: '#fff', mixBlendMode: 'overlay', ...sf }}>{date}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 105, textAlign: 'center', fontSize: 100, fontWeight: 500, lineHeight: '119px', letterSpacing: -2.12, color: '#fff', mixBlendMode: 'overlay', ...sf }}>{time}</div>
      <div style={{ position: 'absolute', left: 10, right: 10, bottom: 120, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>{children}</div>
      <div style={{ position: 'absolute', left: 46, right: 46, bottom: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img alt="" src={icon('flashlight')} style={{ width: 50, height: 50 }} />
        <img alt="" src={icon('camera')} style={{ width: 50, height: 50 }} />
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
        <div style={{ position: 'absolute', inset: 0, borderRadius: 68, background: '#0B0B0C', boxShadow: 'inset 0 0 0 1.5px #5A5A60, inset 0 0 0 3px #1A1A1C, 0 40px 80px -20px rgba(0,0,0,0.32), 0 18px 36px -12px rgba(0,0,0,0.25)' }} />
        <div style={{ position: 'absolute', left: b, top: b, width: W, height: H, borderRadius: 55, overflow: 'hidden', isolation: 'isolate', WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>{children}</div>
      </div>
    </div>
  );
}

/**
 * L'écran d'appel en cours. Le kit n'en a pas : il est recomposé avec les
 * pièces du modèle « Phone », mode sombre (1118:8444) : fond noir du système,
 * touches rondes de 78 pt en #333 (1118:7170), barre d'état claire avec l'île
 * dynamique (2012:16930), le nom au gabarit du numéro composé (36 pt), la
 * durée au gabarit secondaire, et le bouton raccrocher du kit (call-decline).
 * La disposition (deux rangées de trois, raccrocher au centre) est celle de
 * l'app Téléphone d'iOS pendant un appel.
 */
export function InCallScreen({ name, duration, labels, banner }: { name: string; duration: string; labels: [string, string, string, string, string, string]; banner?: React.ReactNode }) {
  const glyph = (k: number) => {
    const s = { width: 30, height: 30, display: 'block' } as React.CSSProperties;
    if (k === 0) return <svg viewBox="0 0 24 24" style={s} fill="white"><path d="M3 9h4l5-4v14l-5-4H3z" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>;
    if (k === 1) return <svg viewBox="0 0 24 24" style={s} fill="white"><rect x="2" y="6" width="14" height="12" rx="3" /><path d="M17 10.5l5-3v9l-5-3z" /></svg>;
    if (k === 2) return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" fill="white" stroke="none" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M4 4l16 16" /></svg>;
    if (k === 3) return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
    return <img alt="" src={icon('keypad-white')} style={{ width: 27, height: 27 }} />;
  };
  const key = (k: number) => (
    <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 78 }}>
      <div style={{ width: 78, height: 78, borderRadius: 100, background: '#333', display: 'grid', placeItems: 'center' }}>{glyph(k)}</div>
      <span style={{ fontSize: 13, color: '#fff', letterSpacing: -0.08 }}>{labels[k]}</span>
    </div>
  );
  return (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', background: '#000', ...sf }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 59, display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 10, paddingBottom: 3 }}>
          <span style={{ width: 54, textAlign: 'center', fontSize: 16, fontWeight: 600, letterSpacing: -0.32, color: '#fff', background: '#30D158', borderRadius: 24, lineHeight: '21px' }}>{duration.slice(0, 5)}</span>
        </div>
        <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}><div style={{ width: 125, height: 37, borderRadius: 100, background: '#000' }} /></div>
        <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingRight: 11 }}>
          <img alt="" src={icon('signal-dark')} style={{ width: 78.4, height: 13 }} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 97, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11 }}>
        <span style={{ fontSize: 18, lineHeight: '22px', letterSpacing: -0.6, color: 'rgba(235,235,245,0.6)' }}>{duration}</span>
        <span style={{ fontSize: 36, lineHeight: '41px', letterSpacing: 0.2, color: '#fff' }}>{name}</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 470, display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 24 }}>{[0, 1, 2].map(key)}</div>
        <div style={{ display: 'flex', gap: 24 }}>
          {key(3)}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 78 }}>
            <img alt="" src={icon('call-decline')} style={{ width: 78, height: 78 }} />
            <span style={{ fontSize: 13, color: '#fff', letterSpacing: -0.08 }}>{labels[5]}</span>
          </div>
          {key(4)}
        </div>
      </div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 134, height: 5, marginLeft: -67, borderRadius: 100, background: '#fff' }} />
      {banner && <div style={{ position: 'absolute', left: 10, top: 11 }}>{banner}</div>}
    </div>
  );
}
