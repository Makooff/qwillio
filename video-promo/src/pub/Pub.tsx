/**
 * « Le coup de feu » — pub verticale 9:16.
 *
 * Le motion vient de la référence (fond clair qui respire, texte mot à mot qui
 * sort du flou, objets qui s'empilent), la DA de Qwillio (Outfit 300, mot en
 * italique serif, mauves du logo), et chaque illustration est CELLE DU SITE :
 * `ProductIllustration` est importée telle quelle depuis le frontend.
 */
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { continueRender, delayRender } from 'remotion';
import { loadFont } from '@remotion/fonts';
import '../../../frontend/src/styles/v2.css';
import ProductIllustration from '../../../frontend/src/components/v2/ProductIllustration';
import '../site-illustrations.css';
import { Phone } from '../../../frontend/src/components/icons';
import frames from '../logo-frames.json';
import { EASE_EXPO, EASE_OUT, p, useOutfit } from '../lib';
import { FPS, Line, T } from './timeline';

const INK = '#1D1D1F';
const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };
const serif: React.CSSProperties = { fontFamily: 'QSerif, Georgia, serif', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.01em' };

let serifLoaded = false;
function useSerif() {
  if (serifLoaded) return;
  serifLoaded = true;
  const h = delayRender('Gelasio');
  // .q2-serif-word du site est en Georgia ; Gelasio en reprend les métriques.
  loadFont({ family: 'QSerif', url: staticFile('fonts/gelasio-latin-400-italic.woff2'), style: 'italic', weight: '400' }).then(() => continueRender(h));
}

/* ------------------------------------------------------------------ fond clair qui respire */

function Pastel({ t }: { t: number }) {
  const a = Math.sin(t * 0.35), b = Math.cos(t * 0.27);
  return (
    <AbsoluteFill style={{ background: '#FDFCFC' }}>
      <AbsoluteFill style={{ background: `radial-gradient(75% 45% at ${30 + a * 8}% ${22 + b * 5}%, rgba(205,107,251,0.20), transparent 75%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(80% 50% at ${72 - b * 8}% ${78 + a * 5}%, rgba(122,95,255,0.20), transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(65% 40% at ${80 + a * 6}% ${30 - b * 4}%, rgba(185,168,255,0.16), transparent 70%)` }} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ texte mot à mot */

function Words({ line, t, color = INK, size = 104, y = 960 }: { line: Line; t: number; color?: string; size?: number; y?: number }) {
  if (t < line.at - 0.05 || t > line.out + 0.05) return null;
  const outK = p(t, line.out - 0.22, 0.22);
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: y, transform: 'translateY(-50%)', textAlign: 'center', fontSize: size, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1.08, color, ...ff }}>
      {line.words.map((w, i) => {
        const k = p(t, line.at + i * 0.09, 0.5, EASE_EXPO);
        return (
          <span key={i} style={{ display: 'inline-block', marginRight: '0.24em', opacity: k * (1 - outK), transform: `translateY(${(1 - k) * 34 - outK * 14}px)`, filter: `blur(${(1 - k) * 12 + outK * 8}px)`, ...(line.serif?.includes(i) ? serif : {}) }}>{w}</span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ notification de téléphone */

function Notif({ title, sub, time, missed }: { title: string; sub: string; time: string; missed?: boolean }) {
  return (
    <div style={{ width: 880, padding: '30px 34px', borderRadius: 38, background: 'rgba(255,255,255,0.82)', boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 30px 80px rgba(20,16,50,0.12)', display: 'flex', alignItems: 'center', gap: 26, ...ff }}>
      <div style={{ width: 84, height: 84, borderRadius: 22, background: missed ? '#FDECEC' : '#7A5FFF', display: 'grid', placeItems: 'center', flex: 'none' }}>
        <Phone size={42} color={missed ? '#D93F3F' : '#fff'} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 38, fontWeight: 600, color: INK }}>{title}</div>
        <div style={{ fontSize: 32, color: '#777169', marginTop: 4 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 28, color: '#A59F97', alignSelf: 'flex-start' }}>{time}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ l'ouverture de l'app */

type Compiled = { nums: number[][]; parts: string[] };
const compile = (fr: string[]): Compiled => ({ nums: fr.map((f) => (f.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)), parts: fr[0].split(/-?\d+(?:\.\d+)?/) });
const pathAt = (c: Compiled, k: number) => {
  const n = c.nums.length - 1, x = Math.max(0, Math.min(1, k)) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
  const a = c.nums[i], b = c.nums[i + 1];
  let s = c.parts[0];
  for (let j = 0; j < a.length; j++) s += (a[j] + (b[j] - a[j]) * f).toFixed(2) + c.parts[j + 1];
  return s;
};
const J = {
  open: { l: compile(frames.vopen.left), r: compile(frames.vopen.right), R: frames.vopen.lobeR, y: frames.vopen.markY },
  close: { l: compile(frames.vclose.left), r: compile(frames.vclose.right), R: frames.vclose.lobeR, y: frames.vclose.markY },
};
function Mark({ which, k, id }: { which: 'open' | 'close'; k: number; id: string }) {
  const j = J[which], L = pathAt(j.l, k), R = pathAt(j.r, k);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
      <defs><clipPath id={id}><path d={L} /></clipPath></defs>
      <path d={R} fill="#CD6BFB" /><path d={L} fill="#7A5FFF" />
      <g clipPath={`url(#${id})`}><path d={R} fill="#7349FE" /></g>
    </svg>
  );
}

/* ------------------------------------------------------------------ la pub */

const on = (t: number, s: { at: number; out: number }) => t >= s.at && t < s.out;

/** Les illustrations sont responsives : rendues à largeur mobile, elles s'empilent en hauteur, ce qui sert le 9:16. */
const ILLU_W = 440;
const ILLU_S = 880 / ILLU_W;

export const Pub: React.FC = () => {
  useOutfit();
  useSerif();
  const t = useCurrentFrame() / FPS;

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* 1. Le coup de feu */}
      {on(t, T.rush) && (
        <AbsoluteFill>
          <OffthreadVideo src={staticFile('service-cafe.mp4')} startFrom={60} muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.12 - 0.06 * p(t, 0, 2.2, (x) => x)})` }} />
          <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,10,10,0.35), rgba(10,10,10,0.55))' }} />
          {T.rushLines.map((l, i) => <Words key={i} line={l} t={t} color="#fff" size={120} />)}
        </AbsoluteFill>
      )}

      {/* 2. Le téléphone vibre */}
      {on(t, T.ring) && (
        <AbsoluteFill>
          <Pastel t={t} />
          {(() => {
            const k = p(t, T.ring.at + 0.05, 0.6, EASE_EXPO);
            const shaking = T.buzz.some((b) => t >= b && t < b + 0.55);
            const shake = shaking ? Math.sin(t * 90) * 7 : 0;
            const lift = p(t, T.ringLine.at - 0.2, 0.5, EASE_OUT);
            return (
              <div style={{ position: 'absolute', left: 100, top: 760 - lift * 190, opacity: k, transform: `translate(${shake}px, ${(1 - k) * -60}px) scale(${0.94 + 0.06 * k})` }}>
                <Notif title="Appel entrant" sub="Camille · mobile" time="20:02" />
              </div>
            );
          })()}
          <Words line={T.ringLine} t={t} y={1060} />
        </AbsoluteFill>
      )}

      {/* 3. Les appels manqués s'empilent */}
      {on(t, T.missed) && (
        <AbsoluteFill>
          <Pastel t={t} />
          {T.missed.cards.map((at, i) => {
            const k = p(t, at, 0.55, EASE_EXPO);
            if (k <= 0) return null;
            const above = T.missed.cards.filter((c) => t >= c && c > at).length;
            return (
              <div key={at} style={{ position: 'absolute', left: 100, top: 690 + above * 170, opacity: k * (1 - above * 0.2), transform: `translateY(${(1 - k) * -70}px) scale(${(0.94 + 0.06 * k) * (1 - above * 0.03)})`, zIndex: 10 - above }}>
                <Notif missed title={i === 0 ? 'Appel manqué' : `${i + 1} appels manqués`} sub="Camille · mobile" time={['20:02', '20:05', '20:09'][i]} />
              </div>
            );
          })}
        </AbsoluteFill>
      )}

      {/* 4. Camille part */}
      {on(t, T.away) && (
        <AbsoluteFill>
          <Pastel t={t} />
          {T.awayLines.map((l, i) => <Words key={i} line={l} t={t} />)}
        </AbsoluteFill>
      )}

      {/* 5. La phrase */}
      {on(t, T.claim) && (
        <AbsoluteFill>
          <Pastel t={t} />
          <Words line={T.claim.line} t={t} size={112} />
        </AbsoluteFill>
      )}

      {/* 6. L'ouverture de l'app */}
      {on(t, T.splash) && (
        <AbsoluteFill style={{ background: '#000', opacity: 1 - p(t, T.splash.out - 0.3, 0.3) }}>
          <Mark which="open" id="po" k={(t - T.splash.at) / (T.splash.formed - T.splash.at)} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.open.y + J.open.R + 90, textAlign: 'center', fontSize: 92, fontWeight: 600, letterSpacing: '-0.025em', color: '#FDFDFF', opacity: p(t, T.splash.formed, 0.5, (x) => x), ...ff }}>Qwillio</div>
        </AbsoluteFill>
      )}

      {/* 7. La même soirée, rejouée */}
      {on(t, T.again) && (
        <AbsoluteFill>
          <Pastel t={t} />
          <Words line={T.again.line} t={t} size={120} />
        </AbsoluteFill>
      )}
      {T.scenes.map((sc) => {
        if (!on(t, sc)) return null;
        const k = p(t, sc.at + 0.15, 0.75, EASE_EXPO);
        const outK = p(t, sc.out - 0.25, 0.25);
        const tapK = sc.tap ? p(t, sc.tap, 0.6, EASE_OUT) : 0;
        return (
          <AbsoluteFill key={sc.kind}>
            <Pastel t={t} />
            <Words line={{ at: sc.at, out: sc.out, words: sc.words, serif: [sc.words.length - 1] }} t={t} y={470} size={96} />
            <div style={{ position: 'absolute', left: 100, width: ILLU_W, top: 660, opacity: k * (1 - outK), transform: `translateY(${(1 - k) * 90}px) scale(${ILLU_S * (0.92 + 0.08 * k + 0.02 * p(t, sc.at, sc.out - sc.at, (x) => x))})`, filter: `blur(${(1 - k) * 10 + outK * 6}px)`, transformOrigin: '0 0', borderRadius: 24, boxShadow: '0 30px 60px rgba(20,16,50,0.12)', ...ff }}>
              <ProductIllustration kind={sc.kind} isFr />
              {sc.tap && t >= sc.tap && (
                <div style={{ position: 'absolute', left: 221, top: 145, width: 56, height: 56, marginLeft: -28, marginTop: -28, borderRadius: 9999, border: '3px solid #7A5FFF', opacity: 1 - tapK, transform: `scale(${0.6 + tapK * 1.6})` }} />
              )}
            </div>
          </AbsoluteFill>
        );
      })}

      {/* 8. La chute */}
      {on(t, T.payoff) && (
        <AbsoluteFill>
          <Pastel t={t} />
          {T.payoffLines.map((l, i) => <Words key={i} line={l} t={t} />)}
        </AbsoluteFill>
      )}

      {/* 9. Fin */}
      {t >= T.end.at && (
        <AbsoluteFill style={{ background: '#000' }}>
          <Mark which="close" id="pc" k={(t - T.end.at) / (T.end.formed - T.end.at)} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.close.y + J.close.R + 70, textAlign: 'center', fontSize: 84, fontWeight: 600, letterSpacing: '-0.025em', color: '#FDFDFF', opacity: p(t, T.end.formed - 0.1, 0.5, (x) => x), ...ff }}>Qwillio</div>
          <div style={{ position: 'absolute', left: 80, right: 80, top: J.close.y + J.close.R + 220, textAlign: 'center', fontSize: 52, fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1.2, color: '#C8C8D0', opacity: p(t, T.end.line, 0.5, EASE_EXPO), ...ff }}>
            Elle décroche quand vous <span style={serif}>ne pouvez pas.</span>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.close.y + J.close.R + 380, textAlign: 'center', fontSize: 34, color: '#9A9AA5', opacity: p(t, T.end.sub, 0.5, EASE_EXPO), ...ff }}>Essai gratuit 7 jours · qwillio.com</div>
        </AbsoluteFill>
      )}

      <Audio src={staticFile('sounds-pub.wav')} />
    </AbsoluteFill>
  );
};
