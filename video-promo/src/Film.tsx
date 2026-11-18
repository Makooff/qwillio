import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame } from 'remotion';
import { Calendar, Phone } from '../../frontend/src/components/icons';
import { BookedChip, CALLER, CallerHead, CallsChart, CELL, Gauge, Kpi, LeadChip, LiveCallCard, MonthGrid, Positive, SAT7, ScoreBar, StatBox, SummaryBox, UpCard } from './elements';
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
          <div style={{ position: 'absolute', left: 960 - 60, top: 440 - 60, width: 120, height: 120, borderRadius: 9999, background: C.sidebar, border: `1px solid ${C.line}`, display: 'grid', placeItems: 'center', ...rise(t, 0.1, 0.5, 0) }}>
            <div style={{ transform: `rotate(${shake}deg)`, display: 'grid' }}><Phone size={46} color="#F2F2F2" /></div>
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

/* ---------------------------------------------------------------- les scènes : des éléments, pas des pages */

const S = { call: 2.05, grid: 1.05, up: 1.35, sheet: 1.6 };

/** Entrée et sortie d'une scène : fondu, légère montée, et une poussée lente de caméra. */
function stage(t: number, a: number, b: number) {
  const inK = p(t, a, 0.6, EASE_EXPO);
  const outK = p(t, b - 0.45, 0.45);
  const push = 1 + 0.035 * p(t, a, b - a, (x) => x);
  return { opacity: inK * (1 - outK), scale: (0.96 + 0.04 * inK) * push * (1 - 0.03 * outK) };
}

function Backdrop({ hue = 'rgba(122,95,255,0.10)' }: { hue?: string }) {
  return (
    <AbsoluteFill style={{ background: C.panel }}>
      <AbsoluteFill style={{ background: `radial-gradient(55% 55% at 50% 45%, ${hue}, transparent 70%)` }} />
    </AbsoluteFill>
  );
}

function CallScene({ t }: { t: number }) {
  const st = stage(t, T.callIn, T.callOut);
  const chipK = p(t, T.bookedChip, 0.5, EASE_EXPO);
  return (
    <AbsoluteFill style={{ opacity: st.opacity }}>
      <Backdrop />
      <div style={{ position: 'absolute', left: 960, top: 450, transform: `translate(-50%, -50%) scale(${S.call * st.scale})` }}>
        <LiveCallCard t={t} />
      </div>
      {t >= T.bookedChip && (
        <div style={{ position: 'absolute', left: 960, top: 450 + 125 * S.call, transform: `translate(-50%, ${(1 - chipK) * -40}px) scale(${1.7 * (0.9 + 0.1 * chipK)})`, opacity: chipK, ...ff }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#fff', padding: '7px 14px', borderRadius: 9999, background: C.deep, boxShadow: '0 12px 30px rgba(115,73,254,0.35)' }}>
            <Calendar size={15} color="#fff" />Rendez-vous créé · samedi 9 h 30
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
}

function GridScene({ t }: { t: number }) {
  const st = stage(t, T.gridIn, T.gridOut);
  const gx = 140, gy = 150; // coin de la grille à l'écran
  const colX = 1130, colY = 230; // colonne « À venir »
  const fly = p(t, T.upcomingIn, 0.75, EASE_IN_OUT);
  const land = p(t, T.upcomingIn + 0.55, 0.5, EASE_EXPO);
  // La carte part du centre de la case du samedi 7 et se pose en tête de colonne.
  const fromX = gx + (SAT7.x + CELL.w / 2) * S.grid, fromY = gy + (SAT7.y + CELL.h / 2) * S.grid;
  const toX = colX + 210 * S.up, toY = colY + 76 + 33 * S.up;
  const x = mix(fromX, toX, fly), y = mix(fromY, toY, fly) - Math.sin(Math.PI * fly) * 90;
  const sc = mix(0.25, S.up, fly);
  const glow = 1 - p(t, T.upcomingIn + 1.6, 1.4);
  return (
    <AbsoluteFill style={{ opacity: st.opacity }}>
      <Backdrop hue="rgba(122,95,255,0.07)" />
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${st.scale})`, transformOrigin: '50% 45%' }}>
        <div style={{ position: 'absolute', left: gx, top: gy, transform: `scale(${S.grid})`, transformOrigin: '0 0' }}><MonthGrid t={t} /></div>
        <div style={{ position: 'absolute', left: colX, top: colY - 70, fontSize: 15 * S.up, fontWeight: 600, color: C.text, ...rise(t, T.gridIn + 0.4, 0.6, 14), ...ff }}>À venir</div>
        <div style={{ position: 'absolute', left: colX, top: colY + 40, fontSize: 12.5 * S.up, fontWeight: 600, color: C.text, ...rise(t, T.gridIn + 0.5, 0.6, 14), ...ff }}>Samedi 7 novembre</div>
        {/* les cartes déjà là, poussées vers le bas quand la nouvelle se pose */}
        {[['16:00', 'Inès Haddad', 'Coupe et barbe · +32 471 00 70 00'], ['10:00', 'Chloé Wouters', 'Brushing · +32 471 00 90 00']].map(([tm, n, sub], i) => (
          <div key={n} style={{ position: 'absolute', left: colX, top: colY + 76 + (i + land) * 80 * S.up + (i === 1 ? 40 : 0), ...rise(t, T.gridIn + 0.6 + i * 0.08, 0.6, 14) }}>
            <div style={{ transform: `scale(${S.up})`, transformOrigin: '0 0', position: 'relative' }}>
              {i === 1 && <div style={{ position: 'absolute', top: -34, fontSize: 12.5, fontWeight: 600, color: C.text, ...ff }}>Lundi 9 novembre</div>}
              <UpCard time={tm} name={n} sub={sub} />
            </div>
          </div>
        ))}
        {t >= T.upcomingIn && (
          <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${sc})`, opacity: Math.min(1, fly * 3) }}>
            <UpCard time="09:30" name={CALLER.name} sub={`Coupe · ${CALLER.num}`} style={{ background: `rgba(122,95,255,${0.06 + 0.14 * glow})`, border: `1px solid rgba(122,95,255,${0.2 + 0.5 * glow})`, boxShadow: `0 20px 50px rgba(0,0,0,${0.5 * (1 - land)})` }} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

function SheetScene({ t }: { t: number }) {
  const st = stage(t, T.sheetIn, T.sheetOut);
  // Chaque pièce arrive de son côté, puis tout se range : la fiche se construit.
  const piece = (a: number, dx: number, dy: number) => {
    const k = p(t, a, 0.7, EASE_EXPO);
    return { opacity: k, transform: `translate(${(1 - k) * dx}px, ${(1 - k) * dy}px) scale(${0.94 + 0.06 * k})` };
  };
  const scoreK = p(t, T.scoreIn, 1.0, EASE_EXPO);
  return (
    <AbsoluteFill style={{ opacity: st.opacity }}>
      <Backdrop hue="rgba(245,181,68,0.05)" />
      <div style={{ position: 'absolute', left: 960, top: 500, transform: `translate(-50%, -50%) scale(${S.sheet * st.scale})` }}>
        <div style={{ position: 'relative', width: 400, height: 520 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, ...piece(T.sheetIn, 0, -40) }}><CallerHead /></div>
          <div style={{ position: 'absolute', left: 0, top: 72, ...piece(T.stats[0], -60, 0) }}><StatBox label="Durée">52s</StatBox></div>
          <div style={{ position: 'absolute', left: 206, top: 72, ...piece(T.stats[1], 60, 0) }}><StatBox label="Date">03/11/2026 19:42</StatBox></div>
          <div style={{ position: 'absolute', left: 0, top: 148, ...piece(T.stats[2], -60, 0) }}><StatBox label="Résultat">Rendez-vous pris</StatBox></div>
          <div style={{ position: 'absolute', left: 206, top: 148, ...piece(T.stats[3], 60, 0) }}><StatBox label="Sentiment"><Positive /></StatBox></div>
          <div style={{ position: 'absolute', left: 0, top: 232, display: 'flex', gap: 10, ...piece(T.chipsIn, 0, 30) }}>
            <LeadChip />
            {t >= T.bookingChip && <span style={{ opacity: p(t, T.bookingChip, 0.3), transform: `scale(${0.9 + 0.1 * p(t, T.bookingChip, 0.4, EASE_EXPO)})`, display: 'inline-block' }}><BookedChip /></span>}
          </div>
          <div style={{ position: 'absolute', left: 0, top: 280, ...piece(T.scoreIn, 0, 30) }}><ScoreBar k={scoreK} /></div>
          <div style={{ position: 'absolute', left: 0, top: 350, ...piece(T.summaryStart - 0.4, 0, 40) }}><SummaryBox t={t} /></div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function MonthScene({ t }: { t: number }) {
  const st = stage(t, T.monthIn, T.monthOut);
  const draw = p(t, T.monthIn + 0.4, 1.9, EASE_EXPO);
  const count = Math.round(129 * p(t, T.monthIn + 0.3, 1.7, EASE_EXPO));
  return (
    <AbsoluteFill style={{ opacity: st.opacity }}>
      <Backdrop hue="rgba(255,255,255,0.04)" />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${st.scale})`, transformOrigin: '50% 45%' }}>
        {[['Taux de conversion', '18%'], ['Appels traités', String(count)], ['Score sentiment', '71%']].map(([l, v], i) => (
          <div key={l} style={{ position: 'absolute', left: 170 + i * 420, top: 130, ...rise(t, T.monthIn + 0.1 + i * 0.08, 0.6, 14) }}><div style={{ transform: 'scale(1.4)', transformOrigin: '0 0' }}><Kpi label={l} value={v} /></div></div>
        ))}
        <div style={{ position: 'absolute', left: 170, top: 370 }}><CallsChart k={draw} width={1080} height={320} /></div>
        <div style={{ position: 'absolute', left: 1400, top: 330, ...rise(t, T.monthIn + 0.3, 0.7, 20) }}><div style={{ transform: 'scale(1.25)', transformOrigin: '0 0' }}><Gauge k={draw} value={count} /></div></div>
      </div>
    </AbsoluteFill>
  );
}

/* ---------------------------------------------------------------- légendes */

const CAPTIONS: Array<[number, number, string]> = [
  [T.callAnswered + 0.6, T.callOut - 0.5, 'Un client appelle. Elle décroche.'],
  [T.badgeBump - 0.2, T.gridOut - 0.45, 'Le rendez-vous est déjà dans l’agenda.'],
  [T.summaryStart, T.sheetOut - 0.45, 'Le résumé vous attend.'],
  [T.monthIn + 0.5, T.monthOut - 0.45, 'Vous, vous travaillez.'],
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
  const splashOn = t >= T.splashStart - 0.1 && t < T.splashOut + 0.5;
  const splashFade = 1 - p(t, T.splashOut, 0.45);
  const endOn = t >= T.monthOut - 0.1;
  const jo = JOURNEYS.open, jc = JOURNEYS.close;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {t < T.openingEnd && <Opening t={t} />}
      {t >= T.callIn && t < T.callOut + 0.1 && <CallScene t={t} />}
      {t >= T.gridIn && t < T.gridOut + 0.1 && <GridScene t={t} />}
      {t >= T.sheetIn && t < T.sheetOut + 0.1 && <SheetScene t={t} />}
      {t >= T.monthIn && t < T.monthOut + 0.1 && <MonthScene t={t} />}
      {splashOn && (
        <AbsoluteFill style={{ background: '#000', opacity: splashFade }}>
          <Mark which="open" id="mo" k={(t - T.splashStart) / FORMED} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: (jo.y + jo.lobeR + 1080) / 2 - 40, textAlign: 'center', fontSize: 72, fontWeight: 600, letterSpacing: '-0.025em', color: '#FDFDFF', opacity: p(t, T.splashFormed, 0.5, (x) => x), ...ff }}>Qwillio</div>
        </AbsoluteFill>
      )}
      <Captions t={t} />
      {endOn && (
        <AbsoluteFill style={{ background: '#000', opacity: p(t, T.monthOut - 0.1, 0.4) }}>
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
