/**
 * « Samedi, 20 h 12 » — pub verticale 9:16, v3.
 *
 * Le fond clair du site. Une seule cuisine, plan après plan, dans un cadre
 * arrondi comme les visuels du site ; le téléphone du kit iOS posé à cheval sur
 * son coin. Deux chapitres : sans Qwillio, puis la même soirée avec.
 * Une voix narrative lit chaque phrase ; chaque mot sort du flou quand il est dit.
 * Pendant l'appel, le rond du fichier Figma Make « Shader Reminder ».
 */
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { EASE_EXPO, EASE_IN_OUT, EASE_OUT, mix, p, useOutfit } from '../lib';
import { J, Mark, useFonts } from '../pub2/Pub2';
import { MacBookBookings } from '../pub2/mac';
import { Device, IncomingCall, LockScreen, Notification } from './ios';
import narration from './narration';
import { ShaderOrb } from './ShaderOrb';
import { Sfx, tracking, wordIn } from '../fx';
import { CALL, CALL_SHOTS, DURATION, FPS, NLine, NLINES, Shot, T } from './timeline';

const INK = '#1D1D1F';
const BODY = '#777169';
const PLATE = '#EBE8E4';
const INDIGO = '#7A5FFF';
const WALL = 'ios/wallpaper-iphone14-midnight.png';
const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };
const serif: React.CSSProperties = { fontFamily: 'QSerif, Georgia, serif', fontStyle: 'italic', fontWeight: 400 };
const at = (s: number) => Math.round(s * FPS);
const between = (t: number, a: number, b: number) => t >= a && t < b;

/* ------------------------------------------------------------------ le texte : lu, puis il sort du flou mot à mot */

function Said({ line, t, size = 92, y = 330 }: { line: NLine; t: number; size?: number; y?: number }) {
  if (!between(t, line.at - 0.05, line.out + 0.05)) return null;
  const n = narration[line.n];
  const outK = p(t, line.out - 0.28, 0.28, EASE_OUT);
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: y, transform: 'translateY(-50%)', textAlign: 'center', fontSize: size, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1.08, color: INK, ...ff }}>
      {n.words.map((w, i) => {
        const at = line.at + w.start - 0.04;
        const inS = wordIn(t, at);
        const g: React.CSSProperties = {};
        return (
          <span key={i} style={{ display: 'inline-block', marginRight: '0.24em', ...inS, opacity: Number(inS.opacity) * (1 - outK), filter: `blur(${(1 - Math.min(1, Number(inS.opacity))) * 14 + outK * 12}px)`, ...(n.serif.includes(i) ? serif : {}), ...g, transform: `${inS.transform} ${g.transform ?? ''}` }}>{w.w}</span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ le fond */

export function Canvas({ t }: { t: number }) {
  const a = Math.sin(t * 0.3), b = Math.cos(t * 0.23);
  return (
    <AbsoluteFill style={{ background: '#FDFCFC' }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 38% at ${82 + a * 4}% ${70 + b * 3}%, rgba(205,107,251,0.16), transparent 72%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(55% 32% at ${12 - b * 4}% ${30 + a * 3}%, rgba(122,95,255,0.12), transparent 72%)` }} />
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(29,29,31,0.07) 1.2px, transparent 1.4px)', backgroundSize: '36px 36px', maskImage: 'linear-gradient(180deg, transparent 0%, #000 30%, #000 70%, transparent 100%)', WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 30%, #000 70%, transparent 100%)' }} />
    </AbsoluteFill>
  );
}

function Chapter({ t, from, to, n, label }: { t: number; from: number; to: number; n: string; label: string }) {
  if (!between(t, from - 0.1, to + 0.1)) return null;
  const k = p(t, from, 0.5, EASE_OUT) * (1 - p(t, to - 0.3, 0.3));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center', fontSize: 28, fontWeight: 500, letterSpacing: tracking(t, from), color: BODY, opacity: k, filter: `blur(${(1 - k) * 8}px)`, ...ff }}>
      <span style={{ color: INDIGO }}>{n}</span>&nbsp;&nbsp;·&nbsp;&nbsp;{label.toUpperCase()}
    </div>
  );
}

/* ------------------------------------------------------------------ le cadre vidéo */

export type Rect = { x: number; y: number; w: number; h: number };
export const STAGE: Rect = { x: 80, y: 500, w: 760, h: 1020 };
const CALLR: Rect = { x: 80, y: 230, w: 920, h: 470 };
const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({ x: mix(a.x, b.x, k), y: mix(a.y, b.y, k), w: mix(a.w, b.w, k), h: mix(a.h, b.h, k) });

/** Le cadre : les plans s'y fondent l'un dans l'autre en 0,3 s (flou, léger
 * zoom), au lieu d'une coupe sèche. */
export function Frame({ t, rect, shots, alpha }: { t: number; rect: Rect; shots: Shot[]; alpha: number }) {
  if (alpha <= 0) return null;
  const XF = 0.3;
  const live = shots.filter((s) => t >= s.at - 0.02 && t < s.out + XF);
  return (
    <div style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: 48, overflow: 'hidden', opacity: alpha, transform: `scale(${0.96 + 0.04 * alpha})`, background: '#1a1714', boxShadow: `0 0 0 1px ${PLATE}, 0 50px 90px -40px rgba(60,30,120,0.35), 0 20px 40px -24px rgba(0,0,0,0.25)` }}>
      {live.map((s) => {
        const k = p(t, s.at, s.out - s.at, (x) => x);
        const inK = p(t, s.at, XF, EASE_OUT);
        return (
          <Sequence key={s.at} from={at(s.at)} durationInFrames={Math.max(1, at(s.out - s.at + XF))} layout="none">
            <OffthreadVideo src={staticFile(`media/${s.name}.mp4`)} startFrom={at(s.from)} muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: inK, filter: inK < 1 ? `blur(${(1 - inK) * 14}px)` : undefined, transform: `scale(${1.12 - 0.07 * k - 0.04 * inK})` }} />
          </Sequence>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ le téléphone */

export function buzzAngle(t: number, ring: { at: number; out: number }) {
  if (!between(t, ring.at, ring.out)) return 0;
  const local = (t - ring.at) % 1.5;
  if (local > 0.6) return 0;
  return Math.sin(t * 90) * 0.9 * Math.sin((local / 0.6) * Math.PI);
}

/** Un ressort amorti : arrive, dépasse à peine, se pose. */
export const spring = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(7 * x));

export function Phone({ t, inAt, outAt, children, angle = 0, x = 560, y = 800, scale = 1.03 }: { t: number; inAt: number; outAt: number; children: React.ReactNode; angle?: number; x?: number; y?: number; scale?: number }) {
  if (!between(t, inAt - 0.05, outAt + 0.05)) return null;
  const s = spring(p(t, inAt, 0.9, (v) => v));
  const fade = p(t, inAt, 0.35, EASE_OUT) * (1 - p(t, outAt - 0.35, 0.35, EASE_OUT));
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: fade, filter: `blur(${(1 - fade) * 16}px)`, transform: `scale(${0.9 + 0.1 * s}) rotate(${angle - 3 + (1 - s) * 4}deg)`, transformOrigin: '50% 60%' }}>
      <Device scale={scale}>{children}</Device>
    </div>
  );
}

export const reveal = (t: number, from: number, dur = 0.5) => {
  const k = spring(p(t, from, dur * 1.6, (v) => v));
  const o = p(t, from, dur * 0.6, EASE_OUT);
  return { opacity: o, filter: `blur(${(1 - o) * 8}px)`, transform: `scale(${0.9 + 0.1 * k})` } as React.CSSProperties;
};

/* ------------------------------------------------------------------ l'appel : le rond du fichier Figma, et la transcription */

function useVoices() {
  return CALL.map((l) => useAudioData(staticFile(l.file)));
}

/** Le niveau de la voix, image par image, sur toute la durée de l'appel. Le
 * rond en a besoin cumulé : sa vitesse suit la voix, donc sa phase est la
 * somme des niveaux passés. Calculé une fois, puis lu. */
function useCallLevels(voices: ReturnType<typeof useVoices>) {
  return React.useMemo(() => {
    if (voices.some((v) => !v)) return null;
    const n = Math.ceil((T.call.out - T.call.at) * FPS) + 1;
    const lv = new Float32Array(n), phase = new Float32Array(n);
    for (let f = 0; f < n; f++) {
      const t = T.call.at + f / FPS;
      const sp = CALL.find((l) => t >= l.at && t <= l.end + 0.05);
      if (sp) {
        const s = visualizeAudio({ fps: FPS, frame: Math.round((t - sp.at) * FPS), audioData: voices[CALL.indexOf(sp)]!, numberOfSamples: 32, smoothing: true });
        lv[f] = Math.min(1, Math.sqrt(s.slice(1, 8).reduce((a, b) => a + b, 0)) * 1.4);
      }
      // Lissé sur ~80 ms, pour que le rond respire au lieu de trembler.
      if (f > 0) lv[f] = lv[f - 1] + (lv[f] - lv[f - 1]) * 0.25;
      phase[f] = (f > 0 ? phase[f - 1] : 0) + (0.8 + 2.6 * lv[f]) / FPS;
    }
    return { lv, phase };
  }, [voices]);
}

function CallScene({ t }: { t: number }) {
  const voices = useVoices();
  const levels = useCallLevels(voices);
  const k = p(t, T.call.at + 0.2, 0.7, EASE_EXPO) * (1 - p(t, T.call.out - 0.45, 0.45));
  const speaking = CALL.find((l) => t >= l.at && t <= l.end + 0.05);
  const fi = Math.max(0, Math.min(Math.round((t - T.call.at) * FPS), (levels?.lv.length ?? 1) - 1));
  const level = levels ? levels.lv[fi] : 0;
  const phase = T.call.at * 0.8 + (levels ? levels.phase[fi] : (t - T.call.at) * 0.8);
  const active = p(t, T.call.answered, 0.6, EASE_OUT);
  const timer = `0:${String(Math.floor(Math.max(0, t - T.call.answered))).padStart(2, '0')}`;
  const shown = CALL.filter((l) => t >= l.at - 0.05);
  const SIZE = 560;
  return (
    <AbsoluteFill style={{ opacity: k }}>
      <div style={{ position: 'absolute', left: (1080 - SIZE) / 2, top: 760, filter: `blur(${(1 - k) * 16}px)`, transform: `scale(${0.92 + 0.08 * spring(p(t, T.call.at + 0.2, 1, (v) => v))})` }}>
        <ShaderOrb size={SIZE} time={phase} active={active} timer={timer} level={level} />
      </div>
      <div style={{ position: 'absolute', left: 80, right: 80, top: 1370, height: 420, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 22, ...ff }}>
        {shown.slice(-2).map((l) => {
          const old = l !== speaking && t > l.end + 0.2;
          return (
            <div key={l.id} style={{ opacity: old ? 0.38 : 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24, letterSpacing: '0.16em', fontWeight: 600, color: l.who === 'agent' ? INDIGO : BODY, marginBottom: 6 }}>{l.who === 'agent' ? 'MARIE · RÉCEPTIONNISTE IA' : 'JULIE'}</div>
              <div style={{ fontSize: 44, lineHeight: 1.24, fontWeight: 300, color: INK, letterSpacing: '-0.015em' }}>
                {l.words.map((w, i) => {
                  const wk = p(t, l.at + w.start - 0.04, 0.22, EASE_OUT);
                  return <span key={i} style={{ display: 'inline-block', marginRight: '0.26em', opacity: wk, filter: `blur(${(1 - wk) * 10}px)` }}>{w.w}</span>;
                })}
              </div>
            </div>
          );
        })}
      </div>
      {CALL.map((l) => <Sequence key={l.id} from={at(l.at)} layout="none"><Audio src={staticFile(l.file)} /></Sequence>)}
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ le mixage */

/** La musique respire autour de la voix : -8 dB sous la narration, -16 dB sous l'appel. */
function musicVolume(t: number) {
  const fadeIn = p(t, 0, 0.6, (x) => x);
  const fadeOut = 1 - p(t, DURATION - 1.6, 1.6);
  const underCall = p(t, T.call.at - 0.3, 0.5) * (1 - p(t, T.call.out - 0.3, 0.7));
  const underVoice = Math.max(...NLINES.map((l) => p(t, l.at - 0.15, 0.2) * (1 - p(t, l.out - 0.3, 0.4))), p(t, T.n11.at - 0.15, 0.2));
  const duck = 1 - 0.84 * underCall - 0.6 * underVoice * (1 - underCall);
  const logoLift = 1 + 0.35 * (p(t, T.splash.at, 0.3) * (1 - p(t, T.splash.out - 0.2, 0.4)));
  return 0.5 * fadeIn * fadeOut * Math.max(0.12, duck) * logoLift;
}

/* ------------------------------------------------------------------ la pub */

export const Pub3: React.FC = () => {
  useOutfit();
  useFonts();
  const t = useCurrentFrame() / FPS;

  // Le cadre : en scène, puis remonté en bandeau pendant l'appel, puis de retour.
  const toCall = p(t, T.call.at, 0.8, EASE_IN_OUT);
  const back = p(t, T.call.out - 0.4, 0.8, EASE_IN_OUT);
  const rect = lerpRect(STAGE, CALLR, toCall * (1 - back));
  const bookedShot: Shot = { at: T.booked.at, out: T.booked.out, ...T.booked.shot };
  const shots: Shot[] = [...T.shots1, ...T.shots2, ...CALL_SHOTS, bookedShot];
  const frameAlpha = between(t, 0, T.out1 + 0.1)
    ? p(t, T.frameIn, 0.5, EASE_OUT) * (1 - p(t, T.out1 - 0.3, 0.3))
    : p(t, T.shots2[0].at, 0.5, EASE_OUT) * (1 - p(t, T.booked.out - 0.3, 0.3));

  return (
    <AbsoluteFill>
      <Canvas t={t} />

      <Chapter t={t} from={0.1} to={T.out1} n="01" label="Sans Qwillio" />
      <Chapter t={t} from={T.shots2[0].at + 0.05} to={T.call.at + 0.3} n="02" label="Avec Qwillio" />
      <Frame t={t} rect={rect} shots={shots} alpha={frameAlpha} />

      {/* 01 · le téléphone vibre, personne ne décroche */}
      <Phone t={t} inAt={T.phoneIn} outAt={T.out1} angle={buzzAngle(t, T.ring)}>
        <LockScreen time="20:12" date="samedi 7 novembre" wallpaper={WALL}
          banner={between(t, T.ring.at, T.missed) ? <div style={reveal(t, T.ring.at)}><IncomingCall name="Julie Martin" initials="JM" /></div> : undefined}>
          {t >= T.missed && <div style={reveal(t, T.missed)}><Notification kind="phone" title="Appel manqué" desc="Julie Martin" time="maintenant" /></div>}
        </LockScreen>
      </Phone>

      {/* L'ouverture de l'app */}
      {between(t, T.splash.at, T.splash.out) && (
        <AbsoluteFill style={{ opacity: 1 - p(t, T.splash.out - 0.3, 0.3) }}>
          <Mark which="open" id="o3" k={(t - T.splash.at) / (T.splash.formed - T.splash.at)} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.open.y + J.open.R + 90, textAlign: 'center', fontSize: 92, fontWeight: 600, letterSpacing: '-0.025em', color: INK, opacity: p(t, T.splash.formed - 0.25, 0.4, (x) => x), filter: `blur(${(1 - p(t, T.splash.formed - 0.25, 0.4)) * 10}px)`, ...ff }}>Qwillio</div>
        </AbsoluteFill>
      )}

      {/* 02 · le même appel, cette fois pris */}
      <Phone t={t} inAt={T.phone2In} outAt={T.call.at + 0.35} angle={buzzAngle(t, T.ring2)}>
        <LockScreen time="20:12" date="samedi 7 novembre" wallpaper={WALL}
          banner={t >= T.ring2.at ? <div style={reveal(t, T.ring2.at)}><IncomingCall name="Julie Martin" initials="JM" /></div> : undefined} />
      </Phone>

      {between(t, T.call.at, T.call.out + 0.1) && <CallScene t={t} />}

      <Phone t={t} inAt={T.booked.at + 0.05} outAt={T.booked.out}>
        <LockScreen time="20:13" date="samedi 7 novembre" wallpaper={WALL}>
          {t >= T.booked.at + 0.15 && <div style={reveal(t, T.booked.at + 0.15)}><Notification kind="qwillio" title="Nouvelle réservation" desc="Julie Martin · 4 personnes · ce soir 20:30" time="maintenant" /></div>}
        </LockScreen>
      </Phone>

      {/* Déjà dans l'agenda */}
      {between(t, T.mac.at, T.mac.out) && (() => {
        // Le Mac entier d'abord : à 0,78, le fond gris de la photo couvre déjà
        // toute la carte (1 600 × 0,78 dépasse ses 1 180 px de haut), donc aucune
        // bande d'une autre couleur. Il reste entier un instant, puis la caméra
        // s'approche de la réservation de Julie.
        const z = p(t, T.mac.at + 0.7, T.mac.out - T.mac.at - 0.9, EASE_IN_OUT);
        const s = mix(0.78, 3.0, z), fx = mix(975, 1080, z), fy = mix(800, 525, z);
        const k = p(t, T.mac.at, 0.45, EASE_OUT) * (1 - p(t, T.mac.out - 0.3, 0.3));
        return (
          <div style={{ position: 'absolute', left: 80, top: 500, width: 920, height: 1180, borderRadius: 48, overflow: 'hidden', background: '#E7E7E7', opacity: k, transform: `scale(${0.96 + 0.04 * k})`, filter: `blur(${(1 - k) * 12}px)`, boxShadow: `0 0 0 1px ${PLATE}, 0 50px 90px -40px rgba(60,30,120,0.35)` }}>
            <div style={{ position: 'absolute', left: 460, top: 600, transformOrigin: '0 0', transform: `scale(${s}) translate(${-fx}px, ${-fy}px)` }}>
              <MacBookBookings t={t} bump={T.mac.bump} upcoming={T.mac.upcoming} />
            </div>
          </div>
        );
      })()}

      {/* Julie à table */}
      {between(t, T.payoff.at, T.payoff.out + 0.05) && (
        <Frame t={t} rect={STAGE} shots={[{ at: T.payoff.at, out: T.payoff.out, ...T.payoff.shot }]} alpha={p(t, T.payoff.at, 0.45, EASE_OUT) * (1 - p(t, T.payoff.out - 0.3, 0.3))} />
      )}

      {NLINES.map((l) => <Said key={l.n} line={l} t={t} />)}

      {/* Fin */}
      {t >= T.end.at && (
        <AbsoluteFill>
          <Mark which="close" id="c3" k={(t - T.end.at) / (T.end.formed - T.end.at)} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.close.y + J.close.R + 70, textAlign: 'center', fontSize: 84, fontWeight: 600, letterSpacing: '-0.025em', color: INK, opacity: p(t, T.end.formed - 0.3, 0.4, (x) => x), filter: `blur(${(1 - p(t, T.end.formed - 0.3, 0.4)) * 10}px)`, ...ff }}>Qwillio</div>
          <Said line={T.n11} t={t} size={52} y={J.close.y + J.close.R + 250} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.close.y + J.close.R + 380, textAlign: 'center', fontSize: 34, color: BODY, opacity: p(t, T.n11.at + 1.6, 0.5), filter: `blur(${(1 - p(t, T.n11.at + 1.6, 0.5)) * 10}px)`, ...ff }}>qwillio.com</div>
        </AbsoluteFill>
      )}

      {/* ------------------------------ le son ------------------------------ */}
      <Audio src={staticFile('media/music.mp3')} volume={(f) => musicVolume(f / FPS)} />
      {[...NLINES, T.n11].map((l) => <Sequence key={`n${l.n}`} from={at(l.at)} layout="none"><Audio src={staticFile(narration[l.n].file)} volume={1.05} /></Sequence>)}
      {/* La cuisine, à peine : la plaque, pas la salle. */}
      <Sequence from={0} durationInFrames={at(T.out1)} layout="none"><Audio src={staticFile('media/sizzle.mp3')} volume={(f) => 0.14 * Math.min(1, f / 20) * Math.min(1, (at(T.out1) - f) / 30)} /></Sequence>
      {/* Les sons de la référence, chacun sur son animation. */}
      {[...NLINES, T.n11].flatMap((l) => narration[l.n].words.map((w, i) => <Sfx key={`w${l.n}-${i}`} at={l.at + w.start - 0.04} name="type" gain={0.32} />))}
      <Sfx at={T.n6.at + narration[5].words[narration[5].words.length - 1].start} name="thump" gain={0.7} />
      {[0.1, T.shots2[0].at + 0.05].map((s) => <Sfx key={`c${s}`} at={s} name="tracking" gain={0.4} />)}
      {[T.ring.at, T.missed, T.ring2.at, T.booked.at + 0.15].map((s) => <Sfx key={`p${s}`} at={s} name="pop" gain={0.6} />)}
      <Sfx at={T.call.at + 0.2} name="click" gain={0.6} />
      <Audio src={staticFile('sounds-pub3.wav')} />
    </AbsoluteFill>
  );
};

export { DURATION };
