import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame } from 'remotion';
import { Phone } from '../../frontend/src/components/icons';
import { BookingsPage, CallDrawer, CallsPage, Cursor, H, navY, OverviewPage, Page, Sidebar, W } from './app-ui';
import { C, EASE_EXPO, EASE_IN_OUT, mix, p, rise, useOutfit } from './lib';
import frames from './logo-frames.json';
import { FPS, T } from './timeline';

const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };

/* ---------------------------------------------------------------- l'ouverture de l'app */

// framer-motion répartit les images clés à intervalles égaux et interpole chaque
// nombre linéairement : on fait la même chose sur les chemins de liquidJourney.
type Compiled = { nums: number[][]; parts: string[] };
const compile = (fr: string[]): Compiled => ({
  nums: fr.map((f) => (f.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)),
  parts: fr[0].split(/-?\d+(?:\.\d+)?/),
});
const pathAt = (c: Compiled, k: number) => {
  const n = c.nums.length - 1, x = Math.max(0, Math.min(1, k)) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
  const a = c.nums[i], b = c.nums[i + 1];
  let s = c.parts[0];
  for (let j = 0; j < a.length; j++) s += (a[j] + (b[j] - a[j]) * f).toFixed(2) + c.parts[j + 1];
  return s;
};
const JOURNEYS = {
  open: { left: compile(frames.open.left), right: compile(frames.open.right), lobeR: frames.open.lobeR, y: frames.open.markY },
  close: { left: compile(frames.close.left), right: compile(frames.close.right), lobeR: frames.close.lobeR, y: frames.close.markY },
};
const FORMED = 2.5; // travel 1,6 s + settle 0,9 s, comme SplashScreen.tsx

function Mark({ which, k, id }: { which: 'open' | 'close'; k: number; id: string }) {
  const j = JOURNEYS[which];
  const L = pathAt(j.left, k), R = pathAt(j.right, k);
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
      <defs><clipPath id={id}><path d={L} /></clipPath></defs>
      <path d={R} fill="#CD6BFB" />
      <path d={L} fill="#7A5FFF" />
      <g clipPath={`url(#${id})`}><path d={R} fill="#7349FE" /></g>
    </svg>
  );
}

/* ---------------------------------------------------------------- ouverture : le téléphone sonne */

function Opening({ t }: { t: number }) {
  const fade = 1 - p(t, T.openingEnd - 0.35, 0.35);
  const ring = (rt: number) => (t >= rt && t < rt + 1.4 ? (t - rt) / 1.4 : -1);
  return (
    <AbsoluteFill style={{ background: C.panel, opacity: fade, ...ff }}>
      <AbsoluteFill style={{ background: 'radial-gradient(60% 60% at 50% 42%, rgba(122,95,255,0.12), transparent 70%)' }} />
      {[T.ring1, T.ring2].flatMap((rt) => [0, 0.14, 0.28].map((d) => {
        const k = ring(rt + d);
        if (k < 0) return null;
        return <div key={rt + '-' + d} style={{ position: 'absolute', left: 960 - 80, top: 440 - 80, width: 160, height: 160, borderRadius: 9999, border: '1.5px solid rgba(185,168,255,0.6)', transform: `scale(${1 + k * 2.6})`, opacity: 1 - k }} />;
      }))}
      {(() => {
        const shake = [T.ring1, T.ring2].some((rt) => t >= rt && t < rt + 0.6) ? Math.sin(t * 60) * 9 : 0;
        return (
          <div style={{ position: 'absolute', left: 960 - 60, top: 440 - 60, width: 120, height: 120, borderRadius: 9999, background: C.sidebar, border: `1px solid ${C.line}`, display: 'grid', placeItems: 'center', transform: `rotate(${shake}deg)`, ...rise(t, 0.1, 0.5, 0) }}>
            <Phone size={46} color="#F2F2F2" />
          </div>
        );
      })()}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 580, textAlign: 'center', fontSize: 56, fontWeight: 300, letterSpacing: '-0.02em', color: '#fff', ...rise(t, 0.4, 0.8) }}>
        19 h 42. Vous êtes encore avec un client.
      </div>
      {/* Les notifications du téléphone, comme le système les empile */}
      {T.missed.map((mt, i) => {
        const k = p(t, mt, 0.55, EASE_EXPO);
        if (k <= 0) return null;
        const after = T.missed.filter((m) => t >= m && m > mt).length;
        return (
          <div key={mt} style={{ position: 'absolute', right: 64, top: 64 + after * 18, width: 420, padding: '18px 20px', borderRadius: 18, background: '#161616', border: `1px solid ${C.lineStrong}`, display: 'flex', gap: 14, alignItems: 'center', opacity: k * (1 - after * 0.18), transform: `translateY(${(1 - k) * -30}px) scale(${1 - after * 0.04})`, transformOrigin: 'top center', zIndex: 10 - after, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(248,113,113,0.12)', display: 'grid', placeItems: 'center' }}><Phone size={20} color={C.red} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: C.text }}>Appel manqué</div>
              <div style={{ fontSize: 14, color: C.text3, marginTop: 2 }}>{['+32 471 •• •• 12', '+32 486 •• •• 07', 'Numéro masqué', '+32 470 •• •• 63'][i]}</div>
            </div>
            <div style={{ fontSize: 13, color: C.text4, alignSelf: 'flex-start' }}>maintenant</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

/* ---------------------------------------------------------------- la caméra sur l'app */

type Key = [number, number, number, number]; // temps, x, y, zoom (coordonnées de l'app 1600×900)
const CAMERA: Key[] = [
  [T.shellIn, 800, 450, 1],
  [T.callAnswered - 0.3, 800, 450, 1],
  [T.callAnswered + 0.8, 720, 360, 1.45],
  [T.clickBookings - 0.9, 720, 360, 1.45],
  [T.clickBookings - 0.2, 800, 450, 1],
  [T.bookingsIn + 0.6, 800, 450, 1],
  [T.badgeBump - 0.4, 985, 430, 1.3],
  [T.clickCalls - 0.7, 985, 430, 1.3],
  [T.clickCalls - 0.1, 800, 450, 1],
  [T.drawerIn + 0.3, 800, 450, 1],
  [T.drawerIn + 1.0, 1007, 430, 1.35],
  [T.clickOverview - 0.8, 1007, 430, 1.35],
  [T.clickOverview - 0.1, 800, 450, 1],
  [T.overviewIn + 0.3, 800, 450, 1],
  [T.outro, 760, 430, 1.08],
];
function camera(t: number) {
  let a = CAMERA[0], b = CAMERA[0];
  for (let i = 0; i < CAMERA.length - 1; i++) if (t >= CAMERA[i][0]) { a = CAMERA[i]; b = CAMERA[i + 1]; }
  if (t >= CAMERA[CAMERA.length - 1][0]) a = b = CAMERA[CAMERA.length - 1];
  const k = a === b ? 0 : p(t, a[0], b[0] - a[0], EASE_IN_OUT);
  return { x: mix(a[1], b[1], k), y: mix(a[2], b[2], k), z: mix(a[3], b[3], k) };
}

type CKey = [number, number, number];
const CURSOR: CKey[] = [
  [T.clickBookings - 1.0, 980, 560],
  [T.clickBookings - 0.05, 110, navY('bookings')],
  [T.badgeBump - 0.2, 972, 420],
  [T.clickCalls - 0.75, 972, 420],
  [T.clickCalls - 0.05, 110, navY('calls')],
  [T.rowIn + 0.4, 600, 520],
  [T.clickRow - 0.05, 520, 345],
  [T.clickOverview - 0.8, 760, 420],
  [T.clickOverview - 0.05, 110, navY('overview')],
  [T.overviewIn + 0.9, 420, 520],
];
const CLICKS = [T.clickBookings, T.clickCalls, T.clickRow, T.clickOverview];
function cursorAt(t: number) {
  let a = CURSOR[0], b = CURSOR[0];
  for (let i = 0; i < CURSOR.length - 1; i++) if (t >= CURSOR[i][0]) { a = CURSOR[i]; b = CURSOR[i + 1]; }
  if (t >= CURSOR[CURSOR.length - 1][0]) a = b = CURSOR[CURSOR.length - 1];
  const k = a === b ? 0 : p(t, a[0], b[0] - a[0], EASE_IN_OUT);
  const press = Math.max(0, ...CLICKS.map((c) => 1 - Math.abs(t - c) / 0.1));
  return { x: mix(a[1], b[1], k), y: mix(a[2], b[2], k), press };
}

function App({ t }: { t: number }) {
  const page: Page = t < T.bookingsIn ? 'calls' : t < T.callsIn ? 'bookings' : t < T.overviewIn ? 'calls' : 'overview';
  const active: Page = t < T.clickBookings ? 'calls' : t < T.clickCalls ? 'bookings' : t < T.clickOverview ? 'calls' : 'overview';
  const cam = camera(t);
  const enter = p(t, T.shellIn, 0.8, EASE_EXPO);
  const leave = p(t, T.outro, 0.5);
  const S = 1.2 * cam.z * (0.94 + 0.06 * enter) * (1 - 0.06 * leave);
  const cur = cursorAt(t);
  const cursorOn = t > CURSOR[0][0] && t < T.overviewIn + 1.6;
  // Un changement de page est instantané dans l'app ; un fondu de 120 ms suffit à l'œil.
  const swap = [T.bookingsIn, T.callsIn, T.overviewIn].reduce((m, s) => Math.min(m, Math.abs(t - s)), 9);
  const pageFade = swap < 0.12 ? 0.6 + swap * 3.3 : 1;
  return (
    <AbsoluteFill style={{ background: '#000', opacity: enter * (1 - leave) }}>
      <div style={{ position: 'absolute', left: 960, top: 540, width: W, height: H, transformOrigin: '0 0', transform: `scale(${S}) translate(${-cam.x}px, ${-cam.y}px)`, background: C.sidebar, overflow: 'hidden' }}>
        <Sidebar active={active} />
        <div style={{ position: 'absolute', left: 222, top: 0, width: W - 222, height: H, background: C.panel, borderTopLeftRadius: 45, borderTop: `2px solid ${C.panelBorder}`, borderLeft: `2px solid ${C.panelBorder}`, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: pageFade }}>
            {page === 'calls' && <CallsPage t={t} />}
            {page === 'bookings' && <BookingsPage t={t} />}
            {page === 'overview' && <OverviewPage t={t} />}
          </div>
        </div>
        {page === 'calls' && t >= T.callsIn && <CallDrawer t={t} />}
        {cursorOn && <Cursor x={cur.x} y={cur.y} press={cur.press} />}
      </div>
    </AbsoluteFill>
  );
}

/* ---------------------------------------------------------------- légendes */

const CAPTIONS: Array<[number, number, string]> = [
  [T.callAnswered + 0.6, T.clickBookings - 1.0, 'Un client appelle. Elle décroche.'],
  [T.badgeBump - 0.2, T.clickCalls - 0.8, 'Le rendez-vous est déjà dans l’agenda.'],
  [T.summaryStart, T.clickOverview - 0.8, 'Le résumé vous attend.'],
  [T.overviewIn + 0.5, T.outro - 0.1, 'Vous, vous travaillez.'],
];
function Captions({ t }: { t: number }) {
  return (
    <>
      {CAPTIONS.map(([a, b, text]) => {
        if (t < a - 0.1 || t > b + 0.5) return null;
        const k = p(t, a, 0.6, EASE_EXPO) * (1 - p(t, b, 0.4));
        return (
          <AbsoluteFill key={text} style={{ pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 360, background: 'linear-gradient(0deg, rgba(0,0,0,0.82), rgba(0,0,0,0))', opacity: k }} />
            <div style={{ position: 'absolute', left: 96, bottom: 84, fontSize: 76, fontWeight: 300, letterSpacing: '-0.025em', color: '#fff', opacity: k, transform: `translateY(${(1 - k) * 24}px)`, ...ff }}>{text}</div>
          </AbsoluteFill>
        );
      })}
    </>
  );
}

/* ---------------------------------------------------------------- le film */

export const Film: React.FC = () => {
  useOutfit();
  const t = useCurrentFrame() / FPS;
  const splashOn = t >= T.splashStart - 0.1 && t < T.shellIn + 0.8;
  const splashFade = 1 - p(t, T.shellIn - 0.1, 0.7);
  const endOn = t >= T.outro + 0.3;
  const jo = JOURNEYS.open, jc = JOURNEYS.close;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {t < T.openingEnd && <Opening t={t} />}
      {t >= T.shellIn && t < T.endSplashStart + 0.5 && <App t={t} />}
      {splashOn && (
        <AbsoluteFill style={{ background: '#000', opacity: splashFade }}>
          <Mark which="open" id="mo" k={(t - T.splashStart) / FORMED} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: (jo.y + jo.lobeR + 1080) / 2 - 40, textAlign: 'center', fontSize: 72, fontWeight: 600, letterSpacing: '-0.025em', color: '#FDFDFF', opacity: p(t, T.splashFormed, 0.5, (x) => x), ...ff }}>Qwillio</div>
        </AbsoluteFill>
      )}
      <Captions t={t} />
      {endOn && (
        <AbsoluteFill style={{ background: '#000', opacity: p(t, T.outro + 0.3, 0.4) }}>
          <Mark which="close" id="mc" k={(t - T.endSplashStart) / FORMED} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: jc.y + jc.lobeR + 56, textAlign: 'center', fontSize: 64, fontWeight: 600, letterSpacing: '-0.025em', color: '#FDFDFF', opacity: p(t, T.endSplashFormed, 0.5, (x) => x), ...ff }}>Qwillio</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: jc.y + jc.lobeR + 170, textAlign: 'center', fontSize: 44, fontWeight: 300, letterSpacing: '-0.02em', color: C.text2, ...rise(t, T.endLine, 0.7), ...ff }}>Votre réceptionniste. Toujours là.</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: jc.y + jc.lobeR + 250, textAlign: 'center', fontSize: 24, color: C.text3, letterSpacing: '0.02em', ...rise(t, T.endSub, 0.7), ...ff }}>Essai gratuit 7 jours · qwillio.com</div>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: '#000', opacity: p(t, T.fadeOut, 0.7), pointerEvents: 'none' }} />
      <Audio src={staticFile('sounds.wav')} />
    </AbsoluteFill>
  );
};
