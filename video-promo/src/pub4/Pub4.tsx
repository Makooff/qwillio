/**
 * « Elle ne fait pas que décrocher » — pub n° 2, verticale 9:16.
 *
 * Huit fonctions du produit, une scène chacune, dans le langage de la pub n° 1 :
 * fond clair, cadres arrondis, iPhone du kit iOS, rond de l'appel (fichier
 * Figma Make « Shader Reminder », gris et noir). Sarah lit chaque phrase et le
 * rond respire avec sa voix, narration comprise : c'est elle, la réceptionniste.
 */
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { EASE_IN_OUT, EASE_OUT, mix, p, useOutfit } from '../lib';
import { J, Mark, useFonts } from '../pub2/Pub2';
import { MacBookBookings } from '../pub2/mac';
import { Canvas, Frame, Phone, STAGE, buzzAngle, reveal, spring } from '../pub3/Pub3';
import { IncomingCall, LockScreen, Notification } from '../pub3/ios';
import { ShaderOrb } from '../pub3/ShaderOrb';
import { Sfx, phraseChunks, titleTimes, wordIn } from '../fx';
import { Engines, MessageNote, VoiceClone } from './illustrations';
import voices from './voices';
import { CLIPS, DURATION, FPS, T, VLine, VLINES } from './timeline';

const INK = '#1D1D1F';
const BODY = '#777169';
const PLATE = '#EBE8E4';
const INDIGO = '#7A5FFF';
const WALL = 'ios/wallpaper-iphone14-midnight.png';
const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };
const serif: React.CSSProperties = { fontFamily: 'QSerif, Georgia, serif', fontStyle: 'italic', fontWeight: 400 };
const at = (s: number) => Math.round(s * FPS);
const between = (t: number, a: number, b: number) => t >= a && t < b;
const sceneAlpha = (t: number, s: { at: number; out: number }) => p(t, s.at, 0.4, EASE_OUT) * (1 - p(t, s.out - 0.3, 0.3));

/* ------------------------------------------------------------------ le texte lu */

function Said({ line, t, size = 88, y = 300 }: { line: VLine; t: number; size?: number; y?: number }) {
  if (!between(t, line.at - 0.05, line.out + 0.05)) return null;
  const n = voices.lines[line.id];
  if (n.title) {
    // la voix dit la phrase, l'écran garde le titre court
    const ws = titleTimes(n.title, n.words, n.duration);
    const outT = p(t, line.out - 0.28, 0.28, EASE_OUT);
    return (
      <div style={{ position: 'absolute', left: 70, right: 70, top: y, transform: 'translateY(-50%)', textAlign: 'center', fontSize: size, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1.08, color: INK, ...ff }}>
        {ws.map((w, i) => {
          const inS = wordIn(t, line.at + w.start - 0.04);
          return <span key={i} style={{ display: 'inline-block', marginRight: '0.24em', ...inS, opacity: Number(inS.opacity) * (1 - outT), filter: `blur(${(1 - Math.min(1, Number(inS.opacity))) * 14 + outT * 12}px)`, ...((n.titleSerif ?? []).includes(i) ? serif : {}) }}>{w.w}</span>;
        })}
      </div>
    );
  }
  // La narration parle en vraies phrases : on affiche le morceau en cours.
  const groups = phraseChunks(n.words);
  const startOf = (g: number[]) => line.at + n.words[g[0]].start - 0.06;
  let gi = 0;
  for (let k = 0; k < groups.length; k++) if (t >= startOf(groups[k])) gi = k;
  const end = gi < groups.length - 1 ? startOf(groups[gi + 1]) : line.out;
  const outK = p(t, end - 0.2, 0.2, EASE_OUT);
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: y, transform: 'translateY(-50%)', textAlign: 'center', fontSize: size, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1.08, color: INK, ...ff }}>
      {groups[gi].map((i) => {
        const w = n.words[i];
        const inS = wordIn(t, line.at + w.start - 0.04);
        return <span key={i} style={{ display: 'inline-block', marginRight: '0.24em', ...inS, opacity: Number(inS.opacity) * (1 - outK), filter: `blur(${(1 - Math.min(1, Number(inS.opacity))) * 14 + outK * 12}px)`, ...(n.serif.includes(i) ? serif : {}) }}>{w.w}</span>;
      })}
    </div>
  );
}

/** Une réplique de la réceptionniste, mot à mot, sous le rond. */
/** `until` coupe la réplique avant la suivante : sans lui, « Goedenavond »
 * s'écrivait par-dessus « Hello ». */
function Spoken({ t, id, start, y = 1390, tag, until }: { t: number; id: string; start: number; y?: number; tag?: string; until?: number }) {
  const c = voices.clips[id];
  const end = until ?? start + c.duration + 1.2;
  if (!between(t, start - 0.1, end)) return null;
  const outK = p(t, end - 0.3, 0.3);
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, top: y, textAlign: 'center', opacity: 1 - outK, ...ff }}>
      <div style={{ fontSize: 24, letterSpacing: '0.16em', fontWeight: 600, color: INDIGO, marginBottom: 10 }}>
        {tag ? <span style={{ padding: '4px 12px', borderRadius: 999, border: `1px solid ${INDIGO}55`, marginRight: 12 }}>{tag}</span> : null}
        {tag ? 'RÉCEPTIONNISTE IA' : 'SARAH · RÉCEPTIONNISTE IA'}
      </div>
      <div style={{ fontSize: 46, lineHeight: 1.24, fontWeight: 300, color: INK, letterSpacing: '-0.015em' }}>
        {c.words.map((w, i) => {
          const k = p(t, start + w.start - 0.04, 0.22, EASE_OUT);
          return <span key={i} style={{ display: 'inline-block', marginRight: '0.26em', opacity: k, filter: `blur(${(1 - k) * 10}px)` }}>{w.w}</span>;
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ la voix de Sarah, image par image */

const SOURCES = [
  ...VLINES.map((l) => ({ at: l.at, file: voices.lines[l.id].file, duration: voices.lines[l.id].duration })),
  { at: T.v8.at, file: voices.lines.v8.file, duration: voices.lines.v8.duration },
  ...CLIPS.map((c) => ({ at: c.at, file: voices.clips[c.id].file, duration: voices.clips[c.id].duration })),
];

/** Le niveau de sa voix et la phase du rond, calculés une fois pour toute la
 * pub : la vitesse des vagues suit la voix, donc la phase est une somme. */
function useVoiceLevels() {
  const data = SOURCES.map((s) => useAudioData(staticFile(s.file)));
  return React.useMemo(() => {
    if (data.some((d) => !d)) return null;
    const n = Math.ceil(DURATION * FPS) + 1;
    const lv = new Float32Array(n), phase = new Float32Array(n);
    for (let f = 0; f < n; f++) {
      const t = f / FPS;
      const i = SOURCES.findIndex((s) => t >= s.at && t <= s.at + s.duration);
      if (i >= 0) {
        const v = visualizeAudio({ fps: FPS, frame: Math.round((t - SOURCES[i].at) * FPS), audioData: data[i]!, numberOfSamples: 32, smoothing: true });
        lv[f] = Math.min(1, Math.sqrt(v.slice(1, 8).reduce((a, b) => a + b, 0)) * 1.4);
      }
      if (f > 0) lv[f] = lv[f - 1] + (lv[f] - lv[f - 1]) * 0.25;
      phase[f] = (f > 0 ? phase[f - 1] : 0) + (0.8 + 2.6 * lv[f]) / FPS;
    }
    return { lv, phase };
  }, [data]);
}

function Orb({ t, size, y, levels, active = 1, timer = '' }: { t: number; size: number; y: number; levels: ReturnType<typeof useVoiceLevels>; active?: number; timer?: string }) {
  const f = Math.min(Math.round(t * FPS), (levels?.lv.length ?? 1) - 1);
  return (
    <div style={{ position: 'absolute', left: (1080 - size) / 2, top: y }}>
      <ShaderOrb size={size} time={levels ? levels.phase[f] : t * 0.8} active={active} level={levels ? levels.lv[f] : 0} timer={timer} />
    </div>
  );
}

/* ------------------------------------------------------------------ les cartes du produit */

/** Une petite fiche aux tokens q2 : ce que Qwillio sait de l'appelant. */
function ClientChip({ t, from }: { t: number; from: number }) {
  const r = reveal(t, from, 0.5);
  return (
    <div style={{ position: 'absolute', left: 150, right: 150, top: 640, display: 'flex', alignItems: 'center', gap: 18, padding: '18px 26px', borderRadius: 28, background: '#fff', boxShadow: `0 0 0 1px ${PLATE}, 0 30px 60px -30px rgba(60,30,120,0.3)`, ...ff, ...r }}>
      <div style={{ width: 60, height: 60, borderRadius: 999, background: '#F5F3F1', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 600, color: INK }}>TL</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 30, fontWeight: 600, color: INK }}>Thomas Leroy</div>
        <div style={{ fontSize: 24, color: BODY }}>Client connu · rendez-vous jeudi 10:00</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: INDIGO, padding: '6px 14px', borderRadius: 999, background: 'rgba(122,95,255,0.1)' }}>reconnu</div>
    </div>
  );
}

/** Les trois langues, qui s'allument tour à tour. */
function LangPills({ t }: { t: number }) {
  const lit = t < T.k3.at ? 0 : t < T.k4.at ? 1 : 2;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 640, display: 'flex', justifyContent: 'center', gap: 18, ...ff, ...reveal(t, T.v4.at + 0.4, 0.5) }}>
      {['Français', 'English', 'Nederlands'].map((l, i) => (
        <span key={l} style={{ padding: '12px 26px', borderRadius: 999, fontSize: 30, fontWeight: 500, color: i === lit ? '#fff' : INK, background: i === lit ? INK : '#fff', boxShadow: `0 0 0 1px ${PLATE}`, transition: 'none' }}>{l}</span>
      ))}
    </div>
  );
}

/** La carte « Question sans réponse » du portail : la réponse s'écrit, puis elle est apprise. */
function LearnCard({ t }: { t: number }) {
  const s = T.learn;
  const answer = 'Oui, gratuit après 19 h, juste en face.';
  const typed = Math.max(0, Math.min(answer.length, Math.floor((t - s.typed) * 26)));
  const done = p(t, s.learned, 0.45, EASE_OUT);
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, top: 560, borderRadius: 44, background: '#fff', padding: '40px 44px', boxShadow: `0 0 0 1px ${PLATE}, 0 50px 90px -40px rgba(60,30,120,0.35)`, ...ff, ...reveal(t, s.at + 0.2, 0.6) }}>
      <div style={{ fontSize: 24, letterSpacing: '0.16em', fontWeight: 600, color: BODY }}>QUESTION SANS RÉPONSE · APPEL DE 19:42</div>
      <div style={{ fontSize: 50, fontWeight: 300, color: INK, marginTop: 18, letterSpacing: '-0.02em' }}>« Vous avez un <span style={serif}>parking</span> ? »</div>
      <div style={{ marginTop: 36, padding: '26px 30px', borderRadius: 26, background: '#F5F3F1', fontSize: 38, color: INK, minHeight: 60 }}>
        {answer.slice(0, typed)}
        {t >= s.typed && t < s.learned && <span style={{ opacity: Math.floor(t * 3) % 2 ? 0 : 1 }}>|</span>}
      </div>
      <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 16, opacity: done, filter: `blur(${(1 - done) * 8}px)` }}>
        <span style={{ width: 44, height: 44, borderRadius: 999, background: INK, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 26, transform: `scale(${0.6 + 0.4 * spring(p(t, s.learned, 0.8, (x) => x))})` }}>✓</span>
        <span style={{ fontSize: 32, color: INK }}>Elle le saura au prochain appel.</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ le mixage */

function musicVolume(t: number) {
  const fadeIn = p(t, 0, 0.8, (x) => x);
  const fadeOut = 1 - p(t, T.end.at - 0.3, 0.8); // la musique s'efface, la signature prend le relais
  const talking = Math.max(
    ...VLINES.map((l) => p(t, l.at - 0.15, 0.2) * (1 - p(t, l.out - 0.3, 0.4))),
    ...CLIPS.map((c) => p(t, c.at - 0.2, 0.2) * (1 - p(t, c.end, 0.4))),
    p(t, T.v8.at - 0.15, 0.2),
  );
  return 0.5 * fadeIn * fadeOut * (1 - 0.65 * talking);
}

/* ------------------------------------------------------------------ la pub */

export const Pub4: React.FC = () => {
  useOutfit();
  useFonts();
  const t = useCurrentFrame() / FPS;
  const levels = useVoiceLevels();

  return (
    <AbsoluteFill>
      <Canvas t={t} />

      {/* Le titre : le rond, seul, qui respire avec la voix de Sarah. */}
      {between(t, T.hook.at, T.hook.out) && (
        <AbsoluteFill style={{ opacity: sceneAlpha(t, T.hook), transform: `scale(${0.94 + 0.06 * spring(p(t, 0, 1.2, (x) => x))})` }}>
          <Orb t={t} size={640} y={720} levels={levels} active={0.3} />
        </AbsoluteFill>
      )}

      {/* 1. Elle reconnaît vos clients. */}
      {between(t, T.known.at, T.known.out) && (() => {
        const k = sceneAlpha(t, T.known);
        const answered = p(t, T.known.answer, 0.5, EASE_OUT);
        return (
          <AbsoluteFill style={{ opacity: k }}>
            <Frame t={t} rect={STAGE} shots={[{ at: T.known.at, out: T.known.out, name: 'dough', from: 0.8 }]} alpha={1 - answered} />
            <Phone t={t} inAt={T.known.at + 0.1} outAt={T.known.answer + 0.4} angle={buzzAngle(t, T.known.ring)}>
              <LockScreen time="18:47" date="mardi 10 novembre" wallpaper={WALL}
                banner={t >= T.known.ring.at ? <div style={reveal(t, T.known.ring.at)}><IncomingCall name="Thomas Leroy" initials="TL" /></div> : undefined} />
            </Phone>
            {t >= T.known.answer && (
              <AbsoluteFill style={{ opacity: answered, filter: `blur(${(1 - answered) * 14}px)` }}>
                <ClientChip t={t} from={T.known.answer + 0.15} />
                <Orb t={t} size={520} y={820} levels={levels} timer={`0:0${Math.min(9, Math.floor(t - T.known.answer))}`} />
                <Spoken t={t} id="k1" start={T.k1.at} />
              </AbsoluteFill>
            )}
          </AbsoluteFill>
        );
      })()}

      {/* 2. L'agenda : le portail, dans Safari, sur le MacBook du site. */}
      {between(t, T.agenda.at, T.agenda.out) && (() => {
        // Le Mac entier d'abord : à 0,78, le fond gris de la photo couvre déjà
        // toute la carte (1 600 × 0,78 dépasse ses 1 180 px de haut), donc aucune
        // bande d'une autre couleur. Il reste entier un instant, puis la caméra
        // s'approche de la réservation de Julie.
        const z = p(t, T.agenda.at + 0.7, T.agenda.out - T.agenda.at - 0.9, EASE_IN_OUT);
        const s = mix(0.78, 2.6, z), fx = mix(975, 1075, z), fy = mix(800, 540, z);
        const k = sceneAlpha(t, T.agenda);
        return (
          <div style={{ position: 'absolute', left: 80, top: 500, width: 920, height: 1180, borderRadius: 48, overflow: 'hidden', background: '#E7E7E7', opacity: k, transform: `scale(${0.96 + 0.04 * k})`, boxShadow: `0 0 0 1px ${PLATE}, 0 50px 90px -40px rgba(60,30,120,0.35)` }}>
            <div style={{ position: 'absolute', left: 460, top: 600, transformOrigin: '0 0', transform: `scale(${s}) translate(${-fx}px, ${-fy}px)` }}>
              <MacBookBookings t={t} bump={T.agenda.bump} upcoming={T.agenda.upcoming} />
            </div>
          </div>
        );
      })()}

      {/* 3. Trois langues. */}
      {between(t, T.langs.at, T.langs.out) && (
        <AbsoluteFill style={{ opacity: sceneAlpha(t, T.langs) }}>
          <LangPills t={t} />
          <Orb t={t} size={520} y={800} levels={levels} />
          <Spoken t={t} id="k3" start={T.k3.at} tag="EN" until={T.k4.at - 0.05} />
          {t >= T.k4.at - 0.1 && <Spoken t={t} id="k4" start={T.k4.at} tag="NL" />}
        </AbsoluteFill>
      )}

      {/* 4. Une urgence : votre téléphone sonne, c'est elle qui vous la passe. */}
      {between(t, T.urgent.at, T.urgent.out) && (
        <AbsoluteFill style={{ opacity: sceneAlpha(t, T.urgent) }}>
          <Frame t={t} rect={STAGE} shots={[{ at: T.urgent.at, out: T.urgent.out, name: 'oven', from: 1.6 }]} alpha={1} />
          <Phone t={t} inAt={T.urgent.at + 0.2} outAt={T.urgent.out} angle={buzzAngle(t, T.urgent.ring)}>
            <LockScreen time="21:05" date="mardi 10 novembre" wallpaper={WALL}
              banner={t >= T.urgent.ring.at ? <div style={reveal(t, T.urgent.ring.at)}><IncomingCall name="Qwillio · urgence" initials="Q" sub="Mme Dubois · fuite d'eau" /></div> : undefined} />
          </Phone>
        </AbsoluteFill>
      )}

      {/* 5. Elle note chaque message : une fiche au dessin du site, pas un téléphone de plus. */}
      {between(t, T.message.at, T.message.out) && (
        <AbsoluteFill style={{ opacity: sceneAlpha(t, T.message), transform: `scale(${0.96 + 0.04 * spring(p(t, T.message.at, 1, (x) => x))})` }}>
          <MessageNote t={t} from={T.message.at + 0.4} />
        </AbsoluteFill>
      )}

      {/* 6. Elle apprend. */}
      {between(t, T.learn.at, T.learn.out) && <AbsoluteFill style={{ opacity: sceneAlpha(t, T.learn) }}><LearnCard t={t} /></AbsoluteFill>}

      {/* 7. Elle peut même parler avec votre voix. */}
      {between(t, T.clone.at, T.clone.out) && (
        <AbsoluteFill style={{ opacity: sceneAlpha(t, T.clone), transform: `scale(${0.96 + 0.04 * spring(p(t, T.clone.at, 1, (x) => x))})` }}>
          <VoiceClone t={t} from={T.clone.at + 0.35} ready={T.clone.ready} />
        </AbsoluteFill>
      )}

      {/* 8. Les meilleurs moteurs, en temps réel : le rond au-dessus de la fiche. */}
      {between(t, T.tech.at, T.tech.out) && (
        <AbsoluteFill style={{ opacity: sceneAlpha(t, T.tech) }}>
          <Orb t={t} size={300} y={520} levels={levels} />
          <div style={{ position: 'absolute', inset: 0, transform: 'translateY(260px)' }}><Engines t={t} from={T.tech.at + 0.5} /></div>
        </AbsoluteFill>
      )}

      {VLINES.map((l) => <Said key={l.id} line={l} t={t} />)}

      {/* Fin */}
      {t >= T.end.at && (
        <AbsoluteFill>
          <Mark which="close" id="c4" k={(t - T.end.at) / (T.end.formed - T.end.at)} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.close.y + J.close.R + 70, textAlign: 'center', fontSize: 84, fontWeight: 600, letterSpacing: '-0.025em', color: INK, opacity: p(t, T.end.formed - 0.3, 0.4, (x) => x), filter: `blur(${(1 - p(t, T.end.formed - 0.3, 0.4)) * 10}px)`, ...ff }}>Qwillio</div>
          <Said line={T.v8} t={t} size={52} y={J.close.y + J.close.R + 250} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.close.y + J.close.R + 380, textAlign: 'center', fontSize: 34, color: BODY, opacity: p(t, T.v8.at + 1.6, 0.5), filter: `blur(${(1 - p(t, T.v8.at + 1.6, 0.5)) * 10}px)`, ...ff }}>qwillio.com</div>
        </AbsoluteFill>
      )}

      {/* ------------------------------ le son ------------------------------ */}
      <Audio src={staticFile('music-minimal.mp3')} startFrom={at(60)} volume={(f) => musicVolume(f / FPS)} />
      {SOURCES.map((s) => <Sequence key={s.file} from={at(s.at)} layout="none"><Audio src={staticFile(s.file)} /></Sequence>)}
      {/* Les sons de la référence, chacun sur son animation. */}
      {[...VLINES, T.v8].flatMap((l) => { const n = voices.lines[l.id]; return (n.title ? titleTimes(n.title, n.words, n.duration) : n.words).map((w, i) => <Sfx key={`w${l.id}-${i}`} at={l.at + w.start - 0.04} name="type" gain={0.32} />); })}
      {[T.known.ring.at, T.urgent.ring.at, T.message.at + 0.4].map((s) => <Sfx key={`p${s}`} at={s} name="pop" gain={0.6} />)}
      <Sfx at={T.known.answer} name="click" gain={0.6} />
      {[T.k3.at - 0.1, T.k4.at - 0.1].map((s) => <Sfx key={`l${s}`} at={s} name="click" gain={0.5} />)}
      {[0, 1, 2, 3].map((i) => <Sfx key={`m${i}`} at={T.message.at + 0.8 + i * 0.22} name="click" gain={0.35} />)}
      {[0, 1, 2].map((i) => <Sfx key={`e${i}`} at={T.tech.at + 0.85 + i * 0.35} name="click" gain={0.4} />)}
      {[0, 0.9].map((d) => <Sfx key={`k${d}`} at={T.clone.at + 0.7 + d} name="counter" gain={0.4} />)}
      <Sfx at={T.learn.at + 0.2} name="pop" gain={0.5} />
      <Audio src={staticFile('sounds-pub4.wav')} />
      <Sequence from={at(T.end.jingle)} layout="none"><Audio src={staticFile('jingle.mp3')} volume={0.9} /></Sequence>
    </AbsoluteFill>
  );
};

export { DURATION };
