/**
 * « Le Comptoir, samedi 20 h » — pub verticale 9:16, version mise en scène.
 *
 * Chaque scène a son propre support, pour que rien ne se répète : plans
 * filmés (Mixkit), écrans iOS 26, la carte « En cours » de Qwillio avec les
 * vraies voix de l'appel, le portail dans Safari sur le MacBook du site.
 * Le texte sort du flou, sans mouvement.
 */
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { continueRender, delayRender } from 'remotion';
import { loadFont } from '@remotion/fonts';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import frames from '../logo-frames.json';
import { EASE_EXPO, EASE_IN_OUT, EASE_OUT, mix, p, useOutfit } from '../lib';
import { IncomingCall, LockClock, Notification, sf } from './ios';
import { MacBookBookings } from './mac';
import { CALL, DURATION, FPS, Line, T } from './timeline';

const INK = '#1D1D1F';
const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };
const serif: React.CSSProperties = { fontFamily: 'QSerif, Georgia, serif', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.01em' };

let fontsLoaded = false;
export function useFonts() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  const h = delayRender('fonts pub2');
  Promise.all([
    loadFont({ family: 'QSerif', url: staticFile('fonts/gelasio-latin-400-italic.woff2'), style: 'italic', weight: '400' }),
    ...[400, 500, 600, 700].map((w) => loadFont({ family: 'Inter', url: staticFile(`fonts/inter-latin-${w}-normal.woff2`), weight: String(w) })),
  ]).then(() => continueRender(h));
}

/* ------------------------------------------------------------------ texte : il sort du flou, il ne bouge pas */

export function Words({ line, t, color = INK, size = 104, y = 960, shadow = false }: { line: Line; t: number; color?: string; size?: number; y?: number; shadow?: boolean }) {
  if (t < line.at - 0.05 || t > line.out + 0.05) return null;
  const outK = p(t, line.out - 0.25, 0.25);
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: y, transform: 'translateY(-50%)', textAlign: 'center', fontSize: size, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1.08, color, textShadow: shadow ? '0 2px 30px rgba(0,0,0,0.45)' : undefined, ...ff }}>
      {line.words.map((w, i) => {
        const k = p(t, line.at + i * 0.08, 0.55, EASE_OUT);
        return (
          <span key={i} style={{ display: 'inline-block', marginRight: '0.24em', opacity: Math.min(1, k * 1.6) * (1 - outK), filter: `blur(${(1 - k) * 18 + outK * 14}px)`, ...(line.serif?.includes(i) ? serif : {}) }}>{w}</span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ décors */

function Pastel({ t }: { t: number }) {
  const a = Math.sin(t * 0.35), b = Math.cos(t * 0.27);
  return (
    <AbsoluteFill style={{ background: '#FDFCFC' }}>
      <AbsoluteFill style={{ background: `radial-gradient(75% 45% at ${30 + a * 8}% ${22 + b * 5}%, rgba(205,107,251,0.20), transparent 75%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(80% 50% at ${72 - b * 8}% ${78 + a * 5}%, rgba(122,95,255,0.20), transparent 75%)` }} />
    </AbsoluteFill>
  );
}

/** Un plan filmé, recadré en vertical, avec une lente poussée de caméra. */
function Footage({ name, at, out, from, t, blur = 0, dim = 0.35, zoom = 1.12 }: { name: string; at: number; out: number; from: number; t: number; blur?: number; dim?: number; zoom?: number }) {
  const k = p(t, at, out - at, (x) => x);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Sequence from={Math.round(at * FPS)} layout="none">
        <OffthreadVideo src={staticFile(`media/${name}.mp4`)} startFrom={Math.round(from * FPS)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom - 0.06 * k})`, filter: blur ? `blur(${blur}px)` : undefined }} />
      </Sequence>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,${dim * 0.8}), rgba(0,0,0,${dim}))` }} />
    </AbsoluteFill>
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
export const J = {
  open: { l: compile(frames.vopen.left), r: compile(frames.vopen.right), R: frames.vopen.lobeR, y: frames.vopen.markY },
  close: { l: compile(frames.vclose.left), r: compile(frames.vclose.right), R: frames.vclose.lobeR, y: frames.vclose.markY },
};
export function Mark({ which, k, id }: { which: 'open' | 'close'; k: number; id: string }) {
  const j = J[which], L = pathAt(j.l, k), R = pathAt(j.r, k);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
      <defs><clipPath id={id}><path d={L} /></clipPath></defs>
      <path d={R} fill="#CD6BFB" /><path d={L} fill="#7A5FFF" />
      <g clipPath={`url(#${id})`}><path d={R} fill="#7349FE" /></g>
    </svg>
  );
}

/* ------------------------------------------------------------------ l'appel, en direct */

function useVoices() {
  // Une donnée audio par réplique : l'onde suit la vraie voix, pas une sinusoïde.
  return CALL.map((l) => useAudioData(staticFile(l.file)));
}

function CallScene({ t }: { t: number }) {
  const frame = useCurrentFrame();
  const voices = useVoices();
  const k = p(t, T.call.at, 0.7, EASE_EXPO);
  const outK = p(t, T.call.out - 0.3, 0.3);
  const speaking = CALL.find((l) => t >= l.at && t <= l.end + 0.05);
  const idx = speaking ? CALL.indexOf(speaking) : -1;
  // L'onde : 40 barres, lues sur le spectre de la réplique en cours.
  let bars = new Array(40).fill(0.04);
  if (speaking && voices[idx]) {
    const local = Math.round((t - speaking.at) * FPS);
    const v = visualizeAudio({ fps: FPS, frame: local, audioData: voices[idx]!, numberOfSamples: 64, smoothing: true });
    bars = bars.map((_, i) => Math.min(1, 0.06 + v[Math.floor(i * 0.8) + 2] * 7));
  }
  const shown = CALL.filter((l) => t >= l.at - 0.05);
  const timer = Math.max(0, t - T.call.answered);
  const agentColor = '#B9A8FF';
  return (
    <AbsoluteFill style={{ opacity: 1 - outK }}>
      <Footage name="julie" at={T.call.at} out={T.call.out} from={6.5} t={t} blur={10} dim={0.55} zoom={1.25} />
      <div style={{ position: 'absolute', left: 60, right: 60, top: 230, opacity: k, filter: `blur(${(1 - k) * 14}px)`, ...ff }}>
        {/* En-tête de la carte « En cours » du portail */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '30px 36px', borderRadius: 44, background: 'rgba(14,14,14,0.72)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(20px)' }}>
          <span style={{ position: 'relative', width: 20, height: 20 }}>
            <span style={{ position: 'absolute', inset: -((t * 1.2) % 1) * 14, borderRadius: 9999, background: '#fff', opacity: 0.4 * (1 - ((t * 1.2) % 1)) }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: 9999, background: '#fff' }} />
          </span>
          <span style={{ fontSize: 34, fontWeight: 600, color: '#F2F2F2' }}>En cours</span>
          <span style={{ fontSize: 32, color: '#C8C8D0', fontVariantNumeric: 'tabular-nums' }}>+32 471 52 18 90</span>
          <span style={{ marginLeft: 'auto', fontSize: 30, color: '#9A9AA5', fontVariantNumeric: 'tabular-nums' }}>{`0:${String(Math.floor(timer)).padStart(2, '0')}`}</span>
        </div>
        {/* L'onde de la voix en cours */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 120, margin: '34px 20px 10px' }}>
          {bars.map((b, i) => (
            <i key={i} style={{ flex: 1, height: `${b * 100}%`, borderRadius: 6, background: speaking?.who === 'caller' ? 'rgba(255,255,255,0.75)' : agentColor }} />
          ))}
        </div>
        {/* La transcription : chaque mot sort du flou au moment où il est dit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34, marginTop: 30 }}>
          {shown.slice(-3).map((l) => {
            const old = l !== speaking && t > l.end + 0.2;
            return (
              <div key={l.id} style={{ opacity: old ? 0.45 : 1 }}>
                <div style={{ fontSize: 26, letterSpacing: '0.14em', fontWeight: 600, color: l.who === 'agent' ? agentColor : 'rgba(255,255,255,0.6)', marginBottom: 10 }}>{l.who === 'agent' ? 'MARIE · RÉCEPTIONNISTE IA' : 'JULIE'}</div>
                <div style={{ fontSize: 52, lineHeight: 1.25, fontWeight: 300, color: '#fff', letterSpacing: '-0.015em' }}>
                  {l.words.map((w, i) => {
                    const wk = p(t, l.at + w.start - 0.04, 0.22, EASE_OUT);
                    return <span key={i} style={{ display: 'inline-block', marginRight: '0.26em', opacity: wk, filter: `blur(${(1 - wk) * 10}px)` }}>{w.w}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {CALL.map((l) => (
        <Sequence key={l.id} from={Math.round(l.at * FPS)} layout="none"><Audio src={staticFile(l.file)} volume={1} /></Sequence>
      ))}
      <span style={{ display: 'none' }}>{frame}</span>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ la pub */

const on = (t: number, s: { at: number; out: number }) => t >= s.at && t < s.out;
const at = (s: number) => Math.round(s * FPS);

export const Pub2: React.FC = () => {
  useOutfit();
  useFonts();
  const t = useCurrentFrame() / FPS;

  // Les sonneries : régulières pendant que personne ne décroche.
  const rings: number[] = [];
  for (let s = T.incoming.at; s < T.incoming.out - 0.6; s += 1.6) rings.push(s);
  const ringPulse = rings.some((r) => t >= r && t < r + 0.5);

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* 1-2. Le coup de feu, le téléphone sonne */}
      {on(t, T.hook) && <Footage name="grill" at={T.hook.at} out={T.hook.out} from={T.hook.from} t={t} dim={0.3} zoom={1.15} />}
      {on(t, T.serve) && <Footage name="serve" at={T.serve.at} out={T.serve.out} from={T.serve.from} t={t} dim={0.35} zoom={1.12} />}
      {on(t, T.incoming) && (() => {
        const k = p(t, T.incoming.at, 0.6, EASE_EXPO);
        const shake = ringPulse ? Math.sin(t * 80) * 6 : 0;
        return (
          <div style={{ position: 'absolute', left: 40, top: 110 + (1 - k) * -220, transform: `translateX(${shake}px)` }}>
            <IncomingCall name="Julie Martin" sub="mobile" initials="JM" />
          </div>
        );
      })()}
      <Words line={T.hookLine} t={t} color="#fff" size={108} y={1060} shadow />
      <Words line={T.serveLine} t={t} color="#fff" size={112} y={1060} shadow />

      {/* 3-4. Julie attend, puis raccroche */}
      {on(t, T.julie) && <Footage name="julie" at={T.julie.at} out={T.julie.out} from={T.julie.from} t={t} dim={0.3} zoom={1.2} />}
      <Words line={T.julieLine} t={t} color="#fff" size={120} y={1420} shadow />
      {on(t, T.hangup) && <Footage name="hangup" at={T.hangup.at} out={T.hangup.out} from={T.hangup.from} t={t} dim={0.25} zoom={1.05} />}
      <Words line={T.hangupLine} t={t} color="#fff" size={120} y={1420} shadow />

      {/* 5. Les appels manqués, sur l'écran verrouillé du restaurant */}
      {on(t, T.missed) && (
        <AbsoluteFill>
          <Footage name="grill" at={T.missed.at} out={T.missed.out} from={6} t={t} blur={22} dim={0.45} zoom={1.2} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 210, opacity: p(t, T.missed.at, 0.4), filter: `blur(${(1 - p(t, T.missed.at, 0.5)) * 12}px)` }}><LockClock time="20:04" date="samedi 7 novembre" /></div>
          {T.missed.cards.map((c, i) => {
            const k = p(t, c, 0.5, EASE_EXPO);
            const replaced = i === 0 && t >= T.missed.cards[1];
            if (k <= 0 || replaced) return null;
            return (
              <div key={c} style={{ position: 'absolute', left: 50, top: 860, opacity: k, filter: `blur(${(1 - k) * 10}px)`, transform: `scale(${0.96 + 0.04 * k})` }}>
                <Notification app="Téléphone" icon="phone" title={i === 0 ? 'Appel manqué' : '2 appels manqués'} body="Julie Martin" time={i === 0 ? '20:02' : '20:04'} />
              </div>
            );
          })}
        </AbsoluteFill>
      )}

      {/* 6. Elle réserve ailleurs */}
      {on(t, T.away) && <AbsoluteFill><Pastel t={t} /><Words line={T.awayLine} t={t} /></AbsoluteFill>}

      {/* 7. L'ouverture de l'app */}
      {on(t, T.splash) && (
        <AbsoluteFill style={{ background: '#000', opacity: 1 - p(t, T.splash.out - 0.3, 0.3) }}>
          <Mark which="open" id="o2" k={(t - T.splash.at) / (T.splash.formed - T.splash.at)} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.open.y + J.open.R + 90, textAlign: 'center', fontSize: 92, fontWeight: 600, letterSpacing: '-0.025em', color: '#FDFDFF', opacity: p(t, T.splash.formed, 0.5, (x) => x), ...ff }}>Qwillio</div>
        </AbsoluteFill>
      )}
      {on(t, T.again) && <AbsoluteFill><Pastel t={t} /><Words line={T.againLine} t={t} size={124} /></AbsoluteFill>}

      {/* 8. L'appel décroché, avec les voix */}
      {on(t, T.call) && <CallScene t={t} />}

      {/* 9. La confirmation, chez Julie */}
      {on(t, T.sms) && (
        <AbsoluteFill>
          <Footage name="julie" at={T.sms.at} out={T.sms.out} from={10} t={t} blur={26} dim={0.4} zoom={1.3} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 210 }}><LockClock time="20:05" date="samedi 7 novembre" /></div>
          {(() => {
            const k = p(t, T.sms.at + 0.25, 0.55, EASE_EXPO);
            return (
              <div style={{ position: 'absolute', left: 50, top: 860, opacity: k, filter: `blur(${(1 - k) * 12}px)`, transform: `scale(${0.95 + 0.05 * k})` }}>
                <Notification app="Messages" icon="messages" title="Le Comptoir" body="Votre table pour 4 ce soir à 20 h 30 est confirmée. À tout à l’heure !" />
              </div>
            );
          })()}
        </AbsoluteFill>
      )}

      {/* 10. Et chez le restaurant, en plein service */}
      {on(t, T.owner) && (
        <AbsoluteFill>
          <Footage name="serve" at={T.owner.at} out={T.owner.out} from={9} t={t} dim={0.3} zoom={1.15} />
          {(() => {
            const k = p(t, T.owner.at + 0.15, 0.55, EASE_EXPO);
            return (
              <div style={{ position: 'absolute', left: 50, top: 120 + (1 - k) * -200 }}>
                <Notification app="Qwillio" icon="qwillio" title="Nouvelle réservation" body="Julie Martin · 4 personnes · ce soir 20:30" />
              </div>
            );
          })()}
        </AbsoluteFill>
      )}

      {/* 11. Déjà dans l'agenda : le portail, dans Safari, sur le MacBook du site */}
      {on(t, T.mac) && (() => {
        const z = p(t, T.mac.at, T.mac.out - T.mac.at, EASE_IN_OUT);
        // De l'ordinateur entier à la journée de samedi et à la colonne « À venir ».
        const s = mix(0.86, 2.7, z), fx = mix(915, 1075, z), fy = mix(700, 520, z);
        return (
          <AbsoluteFill style={{ background: '#EDEBE8' }}>
            <div style={{ position: 'absolute', left: 540, top: 1080, transformOrigin: '0 0', transform: `scale(${s}) translate(${-fx}px, ${-fy}px)` }}>
              <MacBookBookings t={t} bump={T.mac.bump} upcoming={T.mac.upcoming} />
            </div>
            <Words line={T.macLine} t={t} y={300} size={100} />
          </AbsoluteFill>
        );
      })()}

      {/* 12. La chute */}
      {on(t, T.payoff) && (
        <AbsoluteFill>
          {t < T.payoffLines[1].at
            ? <Footage name="room" at={T.payoff.at} out={T.payoffLines[1].at} from={2} t={t} dim={0.35} zoom={1.2} />
            : <Footage name="friends" at={T.payoffLines[1].at} out={T.payoff.out} from={1} t={t} dim={0.35} zoom={1.15} />}
          {T.payoffLines.map((l, i) => <Words key={i} line={l} t={t} color="#fff" size={116} y={1400} shadow />)}
        </AbsoluteFill>
      )}

      {/* 13. Fin */}
      {t >= T.end.at && (
        <AbsoluteFill style={{ background: '#000' }}>
          <Mark which="close" id="c2" k={(t - T.end.at) / (T.end.formed - T.end.at)} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.close.y + J.close.R + 70, textAlign: 'center', fontSize: 84, fontWeight: 600, letterSpacing: '-0.025em', color: '#FDFDFF', opacity: p(t, T.end.formed - 0.1, 0.5, (x) => x), ...ff }}>Qwillio</div>
          <div style={{ position: 'absolute', left: 80, right: 80, top: J.close.y + J.close.R + 220, textAlign: 'center', fontSize: 52, fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1.2, color: '#C8C8D0', opacity: p(t, T.end.line, 0.6), filter: `blur(${(1 - p(t, T.end.line, 0.6)) * 14}px)`, ...ff }}>
            Elle décroche quand vous <span style={serif}>ne pouvez pas.</span>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.close.y + J.close.R + 380, textAlign: 'center', fontSize: 34, color: '#9A9AA5', opacity: p(t, T.end.sub, 0.6), filter: `blur(${(1 - p(t, T.end.sub, 0.6)) * 10}px)`, ...ff }}>Essai gratuit 7 jours · qwillio.com</div>
        </AbsoluteFill>
      )}

      {/* ------------------------------ le son ------------------------------ */}
      <Sequence from={0} durationInFrames={at(T.missed.out)} layout="none"><Audio src={staticFile('media/ambience.mp3')} volume={0.35} /></Sequence>
      <Sequence from={0} durationInFrames={at(T.serve.out)} layout="none"><Audio src={staticFile('media/sizzle.mp3')} volume={0.45} /></Sequence>
      {rings.map((r) => <Sequence key={r} from={at(r)} durationInFrames={at(1.2)} layout="none"><Audio src={staticFile('media/ringtone.mp3')} volume={0.8} /></Sequence>)}
      <Sequence from={at(T.julie.at)} durationInFrames={at(T.julie.out - T.julie.at)} layout="none"><Audio src={staticFile('media/ringback.mp3')} volume={0.55} /></Sequence>
      {T.missed.cards.map((c) => <Sequence key={c} from={at(c)} durationInFrames={at(0.8)} layout="none"><Audio src={staticFile('media/pop.mp3')} volume={0.6} /></Sequence>)}
      <Sequence from={at(T.call.at)} durationInFrames={at(T.call.out - T.call.at)} layout="none"><Audio src={staticFile('media/ambience.mp3')} volume={0.08} /></Sequence>
      <Sequence from={at(T.sms.at + 0.25)} durationInFrames={at(1)} layout="none"><Audio src={staticFile('media/pop.mp3')} volume={0.7} /></Sequence>
      <Sequence from={at(T.owner.at + 0.15)} durationInFrames={at(3)} layout="none"><Audio src={staticFile('media/confirm.mp3')} volume={0.5} /></Sequence>
      <Sequence from={at(T.owner.at)} durationInFrames={at(T.owner.out - T.owner.at)} layout="none"><Audio src={staticFile('media/sizzle.mp3')} volume={0.3} /></Sequence>
      <Sequence from={at(T.payoff.at)} durationInFrames={at(T.payoff.out - T.payoff.at)} layout="none"><Audio src={staticFile('media/ambience.mp3')} volume={0.4} /></Sequence>
      <Sequence from={at(T.payoffLines[1].at)} durationInFrames={at(1.5)} layout="none"><Audio src={staticFile('media/clink.mp3')} volume={0.6} /></Sequence>
      <Audio src={staticFile('sounds-pub2.wav')} />
    </AbsoluteFill>
  );
};

export { DURATION };
