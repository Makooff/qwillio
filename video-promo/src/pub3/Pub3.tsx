/**
 * « Samedi, 20 h 12 » — pub verticale 9:16, v3.
 *
 * Le fond clair du site. Une seule cuisine, plan après plan, dans un cadre
 * arrondi comme les visuels du site ; le téléphone du kit iOS posé à cheval sur
 * son coin. Deux chapitres : sans Qwillio, puis la même soirée avec.
 * Le texte sort du flou, il ne bouge pas. Les objets entrent par le flou et une
 * mise à l'échelle très courte, jamais par une translation.
 */
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { EASE_EXPO, EASE_IN_OUT, EASE_OUT, mix, p, useOutfit } from '../lib';
import { J, Mark, Words, useFonts } from '../pub2/Pub2';
import { MacBookBookings } from '../pub2/mac';
import { Device, IncomingCall, LockScreen, Notification } from './ios';
import { CALL, DURATION, FPS, Shot, T } from './timeline';

const INK = '#1D1D1F';
const BODY = '#777169';
const PLATE = '#EBE8E4';
const INDIGO = '#7A5FFF';
const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };
const serif: React.CSSProperties = { fontFamily: 'QSerif, Georgia, serif', fontStyle: 'italic', fontWeight: 400 };
const at = (s: number) => Math.round(s * FPS);
const between = (t: number, a: number, b: number) => t >= a && t < b;

/* ------------------------------------------------------------------ le fond */

function Canvas({ t }: { t: number }) {
  const a = Math.sin(t * 0.3), b = Math.cos(t * 0.23);
  return (
    <AbsoluteFill style={{ background: '#FDFCFC' }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 38% at ${82 + a * 4}% ${70 + b * 3}%, rgba(205,107,251,0.16), transparent 72%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(55% 32% at ${12 - b * 4}% ${30 + a * 3}%, rgba(122,95,255,0.12), transparent 72%)` }} />
      {/* Une trame de points, comme les planches du site : présente, pas lue. */}
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(29,29,31,0.07) 1.2px, transparent 1.4px)', backgroundSize: '36px 36px', maskImage: 'linear-gradient(180deg, transparent 0%, #000 30%, #000 70%, transparent 100%)', WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 30%, #000 70%, transparent 100%)' }} />
    </AbsoluteFill>
  );
}

/** Le numéro de chapitre, en petites capitales, en haut de page. */
function Chapter({ t, from, to, n, label }: { t: number; from: number; to: number; n: string; label: string }) {
  if (!between(t, from - 0.1, to + 0.1)) return null;
  const k = p(t, from, 0.6, EASE_OUT) * (1 - p(t, to - 0.3, 0.3));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center', fontSize: 28, fontWeight: 500, letterSpacing: '0.2em', color: BODY, opacity: k, filter: `blur(${(1 - k) * 8}px)`, ...ff }}>
      <span style={{ color: INDIGO }}>{n}</span>&nbsp;&nbsp;·&nbsp;&nbsp;{label.toUpperCase()}
    </div>
  );
}

/* ------------------------------------------------------------------ le cadre vidéo */

type Rect = { x: number; y: number; w: number; h: number };
const STAGE: Rect = { x: 80, y: 500, w: 760, h: 1020 };
const WIDE: Rect = { x: 80, y: 240, w: 920, h: 560 };
const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({ x: mix(a.x, b.x, k), y: mix(a.y, b.y, k), w: mix(a.w, b.w, k), h: mix(a.h, b.h, k) });

/** Le plan en cours : un seul cadre, des coupes franches entre les plans du même tournage. */
function Frame({ t, rect, shot, alpha }: { t: number; rect: Rect; shot: Shot; alpha: number }) {
  const k = p(t, shot.at, shot.out - shot.at, (x) => x);
  return (
    <div style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: 48, overflow: 'hidden', opacity: alpha, background: '#EBE8E4', boxShadow: `0 0 0 1px ${PLATE}, 0 50px 90px -40px rgba(60,30,120,0.35), 0 20px 40px -24px rgba(0,0,0,0.25)` }}>
      <Sequence from={at(shot.at)} durationInFrames={Math.max(1, at(shot.out - shot.at))} layout="none">
        <OffthreadVideo src={staticFile(`media/${shot.name}.mp4`)} startFrom={at(shot.from)} muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.06 - 0.05 * k})` }} />
      </Sequence>
    </div>
  );
}

/* ------------------------------------------------------------------ le téléphone */

/** Les vibrations : une légère rotation, au rythme du moteur, pas un tremblement. */
function buzzAngle(t: number, ring: { at: number; out: number }) {
  if (!between(t, ring.at, ring.out)) return 0;
  const local = (t - ring.at) % 1.5;
  if (local > 0.6) return 0;
  return Math.sin(t * 90) * 0.9 * Math.sin((local / 0.6) * Math.PI);
}

function Phone({ t, inAt, outAt, children, angle = 0 }: { t: number; inAt: number; outAt: number; children: React.ReactNode; angle?: number }) {
  if (!between(t, inAt - 0.05, outAt + 0.05)) return null;
  const k = p(t, inAt, 0.8, EASE_EXPO) * (1 - p(t, outAt - 0.4, 0.4, EASE_OUT));
  return (
    <div style={{ position: 'absolute', left: 560, top: 800, opacity: Math.min(1, k * 1.4), filter: `blur(${(1 - k) * 16}px)`, transform: `scale(${0.94 + 0.06 * k}) rotate(${angle - 3}deg)`, transformOrigin: '50% 60%' }}>
      <Device scale={1.03}>{children}</Device>
    </div>
  );
}

/** Une notification ou une bannière qui arrive par le flou. */
const reveal = (t: number, from: number, dur = 0.5) => {
  const k = p(t, from, dur, EASE_EXPO);
  return { opacity: k, filter: `blur(${(1 - k) * 8}px)`, transform: `scale(${0.96 + 0.04 * k})` } as React.CSSProperties;
};

/* ------------------------------------------------------------------ l'appel, sur fond clair */

function useVoices() {
  return CALL.map((l) => useAudioData(staticFile(l.file)));
}

function CallPanel({ t }: { t: number }) {
  const voices = useVoices();
  const k = p(t, T.call.at + 0.35, 0.7, EASE_EXPO) * (1 - p(t, T.call.out - 0.5, 0.5));
  const speaking = CALL.find((l) => t >= l.at && t <= l.end + 0.05);
  const idx = speaking ? CALL.indexOf(speaking) : -1;
  let bars = new Array(44).fill(0.05);
  if (speaking && voices[idx]) {
    const v = visualizeAudio({ fps: FPS, frame: Math.round((t - speaking.at) * FPS), audioData: voices[idx]!, numberOfSamples: 64, smoothing: true });
    bars = bars.map((_, i) => Math.min(1, 0.07 + Math.sqrt(v[Math.floor(i * 0.7) + 2]) * 1.6));
  }
  const timer = Math.max(0, t - T.call.answered);
  const shown = CALL.filter((l) => t >= l.at - 0.05);
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, top: 860, opacity: k, filter: `blur(${(1 - k) * 14}px)`, ...ff }}>
      <div style={{ borderRadius: 44, background: '#FFFFFF', boxShadow: `0 0 0 1px ${PLATE}, 0 40px 80px -40px rgba(60,30,120,0.30)`, padding: '34px 40px 44px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ position: 'relative', width: 18, height: 18 }}>
            <span style={{ position: 'absolute', inset: -((t * 1.1) % 1) * 12, borderRadius: 9999, background: INDIGO, opacity: 0.35 * (1 - ((t * 1.1) % 1)) }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: 9999, background: INDIGO }} />
          </span>
          <span style={{ fontSize: 32, fontWeight: 600, color: INK }}>En cours</span>
          <span style={{ fontSize: 30, color: BODY, fontVariantNumeric: 'tabular-nums' }}>+32 471 52 18 90</span>
          <span style={{ marginLeft: 'auto', fontSize: 30, color: BODY, fontVariantNumeric: 'tabular-nums' }}>{`0:${String(Math.floor(timer)).padStart(2, '0')}`}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 96, margin: '30px 0 12px' }}>
          {bars.map((b, i) => <i key={i} style={{ flex: 1, height: `${b * 100}%`, borderRadius: 6, background: speaking?.who === 'caller' ? '#C9C3BB' : INDIGO }} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30, marginTop: 24, minHeight: 470, justifyContent: 'flex-end' }}>
          {shown.slice(-3).map((l) => {
            const old = l !== speaking && t > l.end + 0.2;
            return (
              <div key={l.id} style={{ opacity: old ? 0.4 : 1 }}>
                <div style={{ fontSize: 24, letterSpacing: '0.16em', fontWeight: 600, color: l.who === 'agent' ? INDIGO : BODY, marginBottom: 8 }}>{l.who === 'agent' ? 'MARIE · RÉCEPTIONNISTE IA' : 'JULIE'}</div>
                <div style={{ fontSize: 46, lineHeight: 1.24, fontWeight: 300, color: INK, letterSpacing: '-0.015em' }}>
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
    </div>
  );
}

/* ------------------------------------------------------------------ la pub */

export const Pub3: React.FC = () => {
  useOutfit();
  useFonts();
  const t = useCurrentFrame() / FPS;

  // Le cadre : en scène, puis élargi en haut pendant l'appel, puis de retour.
  const toWide = p(t, T.call.at, 0.9, EASE_IN_OUT);
  const back = p(t, T.call.out - 0.5, 0.9, EASE_IN_OUT);
  const rect = lerpRect(STAGE, WIDE, toWide * (1 - back));
  const callShot: Shot = { at: T.call.at, out: T.booked.at, ...T.callShot };
  const bookedShot: Shot = { at: T.booked.at, out: T.booked.out, ...T.booked.shot };
  const shots: Shot[] = [...T.shots1, ...T.shots2, callShot, bookedShot];
  const shot = shots.find((s) => between(t, s.at, s.out));
  const frameAlpha = between(t, 0, T.out1)
    ? p(t, T.frameIn, 0.7, EASE_OUT) * (1 - p(t, T.out1 - 0.35, 0.35))
    : p(t, T.shots2[0].at, 0.6, EASE_OUT) * (1 - p(t, T.booked.out - 0.35, 0.35));

  return (
    <AbsoluteFill>
      <Canvas t={t} />

      {/* ------------------------------ 01 · Sans Qwillio ------------------------------ */}
      <Chapter t={t} from={0.3} to={T.out1} n="01" label="Sans Qwillio" />
      <Chapter t={t} from={T.shots2[0].at + 0.1} to={T.call.at + 0.4} n="02" label="Avec Qwillio" />
      {shot && <Frame t={t} rect={rect} shot={shot} alpha={frameAlpha} />}

      <Phone t={t} inAt={T.phoneIn} outAt={T.out1} angle={buzzAngle(t, T.ring)}>
        <LockScreen time="20:12" date="samedi 7 novembre" wallpaper="media/wall.jpg"
          banner={between(t, T.ring.at + 0.1, T.missed) ? <div style={reveal(t, T.ring.at + 0.1)}><IncomingCall name="Julie Martin" initials="JM" /></div> : undefined}>
          {t >= T.missed && <div style={reveal(t, T.missed)}><Notification kind="phone" title="Appel manqué" desc="Julie Martin" time="maintenant" /></div>}
        </LockScreen>
      </Phone>

      {[T.l1, T.l2, T.l3, T.l4].map((l, i) => <Words key={i} line={l} t={t} size={92} y={330} />)}

      {/* ------------------------------ l'ouverture de l'app ------------------------------ */}
      {between(t, T.splash.at, T.splash.out) && (
        <AbsoluteFill style={{ opacity: 1 - p(t, T.splash.out - 0.35, 0.35) }}>
          <Mark which="open" id="o3" k={(t - T.splash.at) / (T.splash.formed - T.splash.at)} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.open.y + J.open.R + 90, textAlign: 'center', fontSize: 92, fontWeight: 600, letterSpacing: '-0.025em', color: INK, opacity: p(t, T.splash.formed, 0.5, (x) => x), ...ff }}>Qwillio</div>
        </AbsoluteFill>
      )}

      {/* ------------------------------ 02 · Avec Qwillio ------------------------------ */}
      <Phone t={t} inAt={T.shots2[0].at + 0.6} outAt={T.call.at + 0.5} angle={buzzAngle(t, T.ring2)}>
        <LockScreen time="20:12" date="samedi 7 novembre" wallpaper="media/wall.jpg"
          banner={t >= T.ring2.at ? <div style={reveal(t, T.ring2.at)}><IncomingCall name="Julie Martin" initials="JM" /></div> : undefined} />
      </Phone>
      {[T.l5, T.l6].map((l, i) => <Words key={i} line={l} t={t} size={92} y={330} />)}

      {between(t, T.call.at, T.call.out + 0.1) && <CallPanel t={t} />}

      {/* Après l'appel : la réservation arrive sur le téléphone, le four tourne toujours. */}
      <Phone t={t} inAt={T.booked.at + 0.1} outAt={T.booked.out}>
        <LockScreen time="20:13" date="samedi 7 novembre" wallpaper="media/wall.jpg">
          {t >= T.booked.at + 0.1 && <div style={reveal(t, T.booked.at + 0.1)}><Notification kind="qwillio" title="Nouvelle réservation" desc="Julie Martin · 4 personnes · ce soir 20:30" time="maintenant" /></div>}
        </LockScreen>
      </Phone>
      <Words line={T.l7} t={t} size={88} y={330} />

      {/* Déjà dans l'agenda : le portail, dans Safari, sur le MacBook du site */}
      {between(t, T.mac.at, T.mac.out) && (() => {
        const z = p(t, T.mac.at, T.mac.out - T.mac.at, EASE_IN_OUT);
        // Le Mac vit dans un cadre arrondi, comme les plans filmés : de l'ordinateur
        // entier à la journée de samedi et à la colonne « À venir ».
        const s = mix(0.4, 1.75, z), fx = mix(915, 1075, z), fy = mix(760, 540, z);
        const k = p(t, T.mac.at, 0.6, EASE_OUT) * (1 - p(t, T.mac.out - 0.35, 0.35));
        return (
          <div style={{ position: 'absolute', left: 80, top: 500, width: 920, height: 1180, borderRadius: 48, overflow: 'hidden', background: '#E7E7E7', opacity: k, filter: `blur(${(1 - Math.min(1, k * 1.5)) * 12}px)`, boxShadow: `0 0 0 1px ${PLATE}, 0 50px 90px -40px rgba(60,30,120,0.35)` }}>
            <div style={{ position: 'absolute', left: 460, top: 600, transformOrigin: '0 0', transform: `scale(${s}) translate(${-fx}px, ${-fy}px)` }}>
              <MacBookBookings t={t} bump={T.mac.bump} upcoming={T.mac.upcoming} />
            </div>
          </div>
        );
      })()}
      <Words line={T.l8} t={t} size={92} y={330} />

      {/* La chute : Julie et ses amis, à table */}
      {between(t, T.payoff.at, T.payoff.out) && (
        <Frame t={t} rect={STAGE} shot={{ at: T.payoff.at, out: T.payoff.out, ...T.payoff.shot }} alpha={p(t, T.payoff.at, 0.6, EASE_OUT) * (1 - p(t, T.payoff.out - 0.35, 0.35))} />
      )}
      {[T.l9, T.l10].map((l, i) => <Words key={i} line={l} t={t} size={96} y={330} />)}

      {/* Fin */}
      {t >= T.end.at && (
        <AbsoluteFill>
          <Mark which="close" id="c3" k={(t - T.end.at) / (T.end.formed - T.end.at)} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.close.y + J.close.R + 70, textAlign: 'center', fontSize: 84, fontWeight: 600, letterSpacing: '-0.025em', color: INK, opacity: p(t, T.end.formed - 0.1, 0.5, (x) => x), ...ff }}>Qwillio</div>
          <div style={{ position: 'absolute', left: 80, right: 80, top: J.close.y + J.close.R + 220, textAlign: 'center', fontSize: 52, fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1.2, color: '#44403B', opacity: p(t, T.end.line, 0.6), filter: `blur(${(1 - p(t, T.end.line, 0.6)) * 14}px)`, ...ff }}>
            Elle décroche quand vous <span style={serif}>ne pouvez pas.</span>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.close.y + J.close.R + 380, textAlign: 'center', fontSize: 34, color: BODY, opacity: p(t, T.end.sub, 0.6), filter: `blur(${(1 - p(t, T.end.sub, 0.6)) * 10}px)`, ...ff }}>qwillio.com</div>
        </AbsoluteFill>
      )}

      {/* ------------------------------ le son ------------------------------ */}
      <Sequence from={0} durationInFrames={at(T.out1)} layout="none"><Audio src={staticFile('media/ambience.mp3')} volume={(f) => 0.32 * Math.min(1, f / 30) * Math.min(1, (at(T.out1) - f) / 40)} /></Sequence>
      <Sequence from={at(T.shots2[0].at)} durationInFrames={at(T.booked.out - T.shots2[0].at)} layout="none"><Audio src={staticFile('media/ambience.mp3')} startFrom={at(4)} volume={(f) => (f < at(T.call.at - T.shots2[0].at) ? 0.26 : 0.07) * Math.min(1, f / 30)} /></Sequence>
      {CALL.map((l) => <Sequence key={l.id} from={at(l.at)} layout="none"><Audio src={staticFile(l.file)} /></Sequence>)}
      <Sequence from={at(T.payoff.at)} durationInFrames={at(T.payoff.out - T.payoff.at)} layout="none"><Audio src={staticFile('media/ambience.mp3')} startFrom={at(9)} volume={0.32} /></Sequence>
      <Sequence from={at(T.l10.at)} durationInFrames={at(1.5)} layout="none"><Audio src={staticFile('media/clink.mp3')} volume={0.5} /></Sequence>
      <Audio src={staticFile('sounds-pub3.wav')} />
    </AbsoluteFill>
  );
};

export { DURATION };
