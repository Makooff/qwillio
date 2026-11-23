import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { EASE_OUT, p } from '../lib';
import { spring } from '../pub3/Pub3';
import { Device, H, InCallScreen, IncomingCall, LockScreen, Notification, StatusBar, W, sf } from '../pub3/ios';
import { buildTimeline, SHORT_FPS, type TScene } from './Short';
import { LiveCall } from './campaign';
import { CineCtx, LookCtx, Phone3D, lookFor } from './cine';

/**
 * L'illustration du site, section « Le principe » : une vidéo ORIGINALE (demande
 * du propriétaire : « compose une vidéo qui montre, en interface iOS,
 * l'expérience client Qwillio »). Un seul iPhone, en 3D, sur fond transparent,
 * et quatre temps lisibles sans un mot de narration :
 *   1. vous êtes déjà en ligne, un deuxième appel arrive, Qwillio le prend ;
 *   2. elle répond, en direct (la vraie conversation de la vidéo c01) ;
 *   3. la réservation tombe sur votre téléphone, et l'appelant reçoit son SMS ;
 *   4. le rendez-vous est dans l'agenda.
 * Des cartes flottent autour du téléphone pour nommer ce qui se passe.
 * Tout ce qui est montré correspond à ce que le produit fait (CLAUDE.md).
 */
export const SITE_EXP_SIZE = { w: 1400, h: 1060 };
const INK = '#1D1D1F';
const INDIGO = '#7A5FFF';
const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };
const WALL = 'ios/wallpaper-iphone14-midnight.png';
const PX = 484, PY = 40, PW = 432, PH = 904;

const TXT = {
  fr: {
    date: 'vendredi 14 novembre', busy: 'Vous êtes déjà en ligne', lineBusy: 'ligne occupée', took: 'Qwillio a pris l’appel',
    checked: '21:00 est libre', booking: 'Nouvelle réservation', bookingDesc: 'Sophie Lambert · 2 pers. · 21:00',
    smsTo: 'SMS envoyé à Sophie', sms: 'Votre table pour 2 ce soir à 21:00 est confirmée. À tantôt !', added: 'Ajouté à votre agenda',
    day: 'Vendredi 14', keys: ['haut-parleur', 'FaceTime', 'silence', 'ajouter', 'clavier', 'fin'] as [string, string, string, string, string, string],
    events: [{ h: 19, txt: 'Martin · 4 pers.' }, { h: 20, txt: 'Dubois · 2 pers.' }], now: 'maintenant', guests: '2 pers.',
  },
  en: {
    date: 'Friday 14 November', busy: 'You’re already on a call', lineBusy: 'line busy', took: 'Qwillio took the call',
    checked: '9 p.m. is free', booking: 'New booking', bookingDesc: 'Sophie Lambert · 2 people · 21:00',
    smsTo: 'Text sent to Sophie', sms: 'Your table for 2 tonight at 9 p.m. is confirmed. See you tonight!', added: 'Added to your calendar',
    day: 'Friday 14', keys: ['speaker', 'FaceTime', 'mute', 'add', 'keypad', 'end'] as [string, string, string, string, string, string],
    events: [{ h: 19, txt: 'Martin · 4 people' }, { h: 20, txt: 'Dubois · 2 people' }], now: 'now', guests: '2 people',
  },
};

export function experienceTimeline(id: string) {
  const T = buildTimeline(id);
  const talk = T.scenes.find((s) => s.visual.kind === 'x' && s.visual.scene === 'split' && (s.visual.opts as any)?.stage === 'talk')!;
  const b1 = 0, b2 = 3.6;
  const shift = b2 - talk.at;
  const talkScene: TScene = { ...talk, at: b2, out: talk.out + shift, tlines: talk.tlines.map((l) => ({ ...l, at: l.at + shift, end: l.end + shift, until: l.until + shift })) };
  const b3 = talkScene.out, b4 = b3 + 3.8, end = b4 + 3.8;
  return { lang: T.lang as 'fr' | 'en', talkScene, beats: [b1, b2, b3, b4, end] };
}
export const experienceFrames = (id: string) => Math.round(experienceTimeline(id).beats[4] * SHORT_FPS);

/** Une carte qui sort vers la caméra, à côté du téléphone. */
function Float({ t, at, out, x, y, w = 360, children }: { t: number; at: number; out: number; x: number; y: number; w?: number; children: React.ReactNode }) {
  if (t < at || t > out + 0.4) return null;
  const k = spring(p(t, at, 0.9, (v) => v));
  const o = Math.min(1, p(t, at, 0.3, EASE_OUT)) * (1 - p(t, out, 0.35, EASE_OUT));
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, opacity: o, transformStyle: 'preserve-3d', transform: `translateZ(${60 * k}px) translateY(${(1 - k) * 40}px) rotateX(${(1 - k) * 18}deg) scale(${0.9 + 0.1 * k})`, filter: 'drop-shadow(0 30px 40px rgba(40,20,80,0.22))' }}>
      {children}
    </div>
  );
}
const Chip = ({ children, dot = INDIGO }: { children: React.ReactNode; dot?: string }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '20px 30px', borderRadius: 999, background: '#fff', boxShadow: '0 0 0 1px #EBE8E4', fontSize: 34, fontWeight: 600, color: INK, letterSpacing: '-0.01em', whiteSpace: 'nowrap', ...ff }}>
    <span style={{ width: 16, height: 16, borderRadius: 16, background: dot }} />{children}
  </div>
);

/** L'agenda du jour, dans le téléphone : le nouveau rendez-vous se pose à 21:00. */
function DayCalendar({ t, at, L }: { t: number; at: number; L: (typeof TXT)['fr'] }) {
  const hours = [18, 19, 20, 21, 22];
  const top = 150, row = 120;
  const k = spring(p(t, at + 0.5, 0.9, (v) => v));
  return (
    <div style={{ position: 'relative', width: W, height: H, background: '#fff', overflow: 'hidden', ...sf }}>
      <StatusBar time="19:05" />
      <div style={{ position: 'absolute', left: 20, top: 62, fontSize: 32, fontWeight: 700, letterSpacing: -0.6, color: '#000' }}>{L.day}</div>
      <div style={{ position: 'absolute', left: 20, top: 104, fontSize: 15, color: '#FF3B30', fontWeight: 600 }}>{L.date}</div>
      {hours.map((h, i) => (
        <React.Fragment key={h}>
          <div style={{ position: 'absolute', left: 16, top: top + i * row - 9, fontSize: 13, color: 'rgba(60,60,67,0.6)' }}>{h}:00</div>
          <div style={{ position: 'absolute', left: 64, right: 0, top: top + i * row, borderTop: '1px solid rgba(60,60,67,0.18)' }} />
        </React.Fragment>
      ))}
      {L.events.map((e) => (
        <div key={e.h} style={{ position: 'absolute', left: 70, right: 12, top: top + (e.h - 18) * row + 4, height: row - 10, borderRadius: 8, background: 'rgba(0,122,255,0.14)', borderLeft: '4px solid #007AFF', padding: '8px 10px', fontSize: 15, fontWeight: 600, color: '#0A4FA8' }}>{e.txt}</div>
      ))}
      <div style={{ position: 'absolute', left: 70, right: 12, top: top + 3 * row + 4, height: row - 10, borderRadius: 8, background: 'rgba(122,95,255,0.16)', borderLeft: `4px solid ${INDIGO}`, padding: '8px 10px', fontSize: 15, fontWeight: 600, color: '#3E2BB0', transformOrigin: '0 50%', transform: `scale(${0.7 + 0.3 * k})`, opacity: Math.min(1, k * 2) }}>
        Sophie Lambert · {L.guests}
        <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4, color: INDIGO }}>Qwillio</div>
      </div>
    </div>
  );
}

export const SiteExperience: React.FC<{ id: string }> = ({ id }) => {
  const { fps } = useVideoConfig();
  const X = React.useMemo(() => experienceTimeline(id), [id]);
  const L = TXT[X.lang];
  const [b1, b2, b3, b4, end] = X.beats;
  const t = useCurrentFrame() / fps;
  const ring = { at: 0.5, out: 2.5 };
  const sec = 134 + Math.floor(t);
  const fadeIn = (at: number) => p(t, at, 0.35, EASE_OUT);
  // l'écran du téléphone, en fondu d'un temps à l'autre
  const screens: [number, number, React.ReactNode][] = [
    [b1, b2, (
      <InCallScreen name="Marc Peeters" duration={`${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`} labels={L.keys}
        banner={t >= ring.at && t < ring.out ? <IncomingCall name="Sophie Lambert" initials="SL" sub={L.lineBusy} /> : t >= ring.out ? <Notification kind="qwillio" title={L.took} desc="Sophie Lambert" time={L.now} /> : undefined} />
    )],
    [b2, b3, <LiveCall t={t} s={X.talkScene} who="Sophie Lambert" />],
    [b3, b4, (
      <LockScreen time="19:04" date={L.date} wallpaper={WALL}>
        {t >= b3 + 0.4 && <div style={{ opacity: fadeIn(b3 + 0.4) }}><Notification kind="qwillio" title={L.booking} desc={L.bookingDesc} time={L.now} /></div>}
      </LockScreen>
    )],
    [b4, end, <DayCalendar t={t} at={b4} L={L} />],
  ];
  // le dernier temps s'efface vers le premier, pour une boucle sans saut
  const loopOut = 1 - p(t, end - 0.5, 0.5, EASE_OUT);
  return (
    <CineCtx.Provider value>
      <LookCtx.Provider value={lookFor(id)}>
        <AbsoluteFill style={{ backgroundColor: 'transparent', perspective: 1600 }}>
          <AbsoluteFill style={{ transformStyle: 'preserve-3d', opacity: Math.min(1, p(t, 0, 0.4, EASE_OUT) + 0) * loopOut }}>
            <Phone3D t={t} inAt={-5} outAt={1e6} x={PX} y={PY} w={PW} h={PH} angle={0}>
              <Device scale={1.03}>
                <div style={{ position: 'relative', width: W, height: H }}>
                  {screens.map(([a, b, node], i) => (t >= a - 0.05 && t < b + 0.35) ? (
                    <div key={i} style={{ position: 'absolute', inset: 0, opacity: i === 0 ? 1 : fadeIn(a) }}>{node}</div>
                  ) : null)}
                </div>
              </Device>
            </Phone3D>
            {/* 1. vous êtes en ligne, elle prend le deuxième appel */}
            <Float t={t} at={0.25} out={b2 - 0.3} x={70} y={200}><Chip dot="#8E8E93">{L.busy}</Chip></Float>
            <Float t={t} at={2.7} out={b2 + 1.4} x={890} y={560}><Chip>{L.took}</Chip></Float>
            {/* 2. elle répond et vérifie l'agenda */}
            <Float t={t} at={b2 + 3.2} out={b3 - 0.2} x={890} y={300}><Chip>{L.checked}</Chip></Float>
            {/* 3. la réservation tombe, l'appelant reçoit son SMS */}
            <Float t={t} at={b3 + 0.9} out={b4 + 0.3} x={70} y={560}><Chip>{L.booking}</Chip></Float>
            <Float t={t} at={b3 + 1.8} out={b4 + 0.3} x={890} y={240} w={420}>
              <div style={{ background: '#fff', borderRadius: 34, padding: '18px 18px 20px', boxShadow: '0 0 0 1px #EBE8E4' }}>
                <div style={{ ...ff, fontSize: 24, fontWeight: 600, color: 'rgba(29,29,31,0.6)', margin: '0 0 12px 8px' }}>{L.smsTo}</div>
                <div style={{ background: '#E9E9EB', color: '#000', borderRadius: 26, padding: '18px 22px', fontSize: 28, lineHeight: '36px', ...sf }}>{L.sms}</div>
              </div>
            </Float>
            {/* 4. c'est dans l'agenda */}
            <Float t={t} at={b4 + 1.2} out={end} x={70} y={320}><Chip>{L.added}</Chip></Float>
          </AbsoluteFill>
        </AbsoluteFill>
      </LookCtx.Provider>
    </CineCtx.Provider>
  );
};
