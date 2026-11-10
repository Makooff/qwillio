/**
 * La série de vidéos courtes (Instagram Reels, TikTok, LinkedIn), 9:16, 30 i/s.
 *
 * Une vidéo = une idée, posée en scènes à la suite : la narration de Sarah en
 * haut, ce qui se passe au milieu (téléphone qui sonne, rond de l'appel, fiche
 * du produit), la réplique en cours sous le rond. Le texte vient de
 * scripts/cartesia-shorts.mjs (src/shorts/data.ts), la frise se calcule ici sur
 * les durées réelles des voix : une scène ne peut pas déborder sur la suivante.
 *
 * Mêmes briques que les deux pubs (fond, iPhone du kit, rond « Shader Reminder »
 * en gris et noir, sons de la vidéo de référence) ; pas de glitch, pas de swipe.
 */
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { EASE_IN_OUT, EASE_OUT, mix, p, useOutfit } from '../lib';
import { J, Mark, useFonts } from '../pub2/Pub2';
import { MacBookBookings } from '../pub2/mac';
import { Canvas, Phone, buzzAngle, reveal, spring } from '../pub3/Pub3';
import { Device, IncomingCall, LockScreen, Notification } from '../pub3/ios';
import { ShaderOrb } from '../pub3/ShaderOrb';
import { Sfx, phraseChunks, titleTimes, wordIn } from '../fx';
import { SiteFrame } from '../pub4/illustrations';
import { Check, MessageSquare, Send } from '../../../frontend/src/components/icons';
import data from './data';
import { CameraRig, CineBackdrop, CineCtx, CineFinish, CineTitle, OrbStage, Phone3D, useCine } from './cine';
import type { Lang, Line, Narr, SceneData } from './types';

export const SHORT_FPS = 30;

/* ------------------------------------------------------------------ langues et formats */

/** Ce que l'image écrit elle-même, dans la langue de la vidéo. */
const STR: Record<Lang, { agent: string; caller: string; now: string; date: string; missed: string; mobile: string; unanswered: string; learned: string; cta: string; note: { chip: string; title: string; rows: [string, string][]; sent: string } }> = {
  fr: { agent: 'RÉCEPTIONNISTE IA', caller: 'APPELANT', now: 'maintenant', date: 'mardi 10 novembre', missed: 'Appel manqué', mobile: 'mobile', unanswered: 'QUESTION SANS RÉPONSE · APPEL DE 12:42', learned: 'Elle le saura au prochain appel.', cta: 'Essayez-la sur qwillio.com',
    note: { chip: 'Nouveau message', title: 'Julie Martin a appelé', rows: [['Pour', 'Marc'], ['Rappeler', 'après 17 h'], ['Numéro', '+32 471 52 18 90'], ['Motif', 'Une table pour huit, vendredi']], sent: 'Envoyé à Marc par SMS' } },
  en: { agent: 'AI RECEPTIONIST', caller: 'CALLER', now: 'now', date: 'Tuesday 10 November', missed: 'Missed call', mobile: 'mobile', unanswered: 'UNANSWERED QUESTION · CALL AT 12:42', learned: 'She’ll know on the next call.', cta: 'Try her at qwillio.com',
    note: { chip: 'New message', title: 'Julie Martin called', rows: [['For', 'Marc'], ['Call back', 'after 5 pm'], ['Number', '+32 471 52 18 90'], ['Reason', 'A table for eight, Friday']], sent: 'Sent to Marc by text' } },
  nl: { agent: 'AI-RECEPTIONIST', caller: 'BELLER', now: 'nu', date: 'dinsdag 10 november', missed: 'Gemiste oproep', mobile: 'mobiel', unanswered: 'ONBEANTWOORDE VRAAG · OPROEP VAN 12:42', learned: 'Bij de volgende oproep weet ze het.', cta: 'Probeer haar op qwillio.com',
    note: { chip: 'Nieuw bericht', title: 'Julie Martin belde', rows: [['Voor', 'Marc'], ['Terugbellen', 'na 17 u'], ['Nummer', '+32 471 52 18 90'], ['Reden', 'Een tafel voor acht, vrijdag']], sent: 'Per sms naar Marc gestuurd' } },
};

/**
 * Deux formats. 9:16 pour TikTok, Reels (Instagram, Facebook) et Shorts ; 4:5
 * pour les fils Instagram, Facebook et LinkedIn, où une vidéo verticale est
 * recadrée. En 4:5, le milieu (téléphone, rond, fiches) est le même dessin,
 * réduit à 68 % ; les textes, eux, sont reposés à leur taille pour rester
 * lisibles dans un fil.
 */
export type Format = '9x16' | '4x5';
export const FORMATS: Record<Format, { w: number; h: number; sayY: number; saySize: number; typeY: number; typeSize: number; tagY: number; spokenY: number; langsSpokenY: number; spokenSize: number; brandY: number; body: { k: number; dy: number }; end: { k: number; dy: number } }> = {
  '9x16': { w: 1080, h: 1920, sayY: 300, saySize: 80, typeY: 900, typeSize: 108, tagY: 690, spokenY: 1240, langsSpokenY: 1280, spokenSize: 48, brandY: 120, body: { k: 1, dy: 0 }, end: { k: 1, dy: 0 } },
  '4x5': { w: 1080, h: 1350, sayY: 220, saySize: 66, typeY: 700, typeSize: 92, tagY: 470, spokenY: 960, langsSpokenY: 985, spokenSize: 42, brandY: 64, body: { k: 0.68, dy: -190 }, end: { k: 0.75, dy: -300 } },
};
const INK = '#1D1D1F';
const BODY = '#777169';
const PLATE = '#EBE8E4';
const INDIGO = '#7A5FFF';
const WALL = 'ios/wallpaper-iphone14-midnight.png';
const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };
const serif: React.CSSProperties = { fontFamily: 'QSerif, Georgia, serif', fontStyle: 'italic', fontWeight: 400 };
const between = (t: number, a: number, b: number) => t >= a && t < b;

/* ------------------------------------------------------------------ la frise */

type TNarr = Narr & { at: number; out: number };
type TLine = Line & { at: number; end: number; until: number };
type TScene = SceneData & { at: number; out: number; tsay?: TNarr; tlines: TLine[]; ring?: { at: number; out: number }; card: number; missed?: number; typed?: number; learned?: number };

const MIN: Record<string, number> = { ring: 2.6, notif: 2.8, mac: 3.8, learn: 4.4, message: 3.6, langs: 0, orb: 0, type: 0 };

export function buildTimeline(id: string) {
  const sh = data.shorts[id];
  let cursor = 0;
  const scenes: TScene[] = sh.scenes.map((sc, i) => {
    const at = cursor;
    let t = at + (i === 0 ? 0.05 : 0.2);
    let tsay: TNarr | undefined;
    if (sc.say) { tsay = { ...sc.say, at: t, out: t + sc.say.duration + 0.25 }; t = t + sc.say.duration + 0.2; }
    const tlines: TLine[] = (sc.lines ?? []).map((l) => {
      const la = t + 0.1;
      t = la + l.duration + 0.3;
      return { ...l, at: la, end: la + l.duration, until: 0 };
    });
    tlines.forEach((l, j) => { l.until = j < tlines.length - 1 ? tlines[j + 1].at - 0.05 : Infinity; });
    const v = sc.visual;
    const min = MIN[v.kind] + (v.kind === 'ring' && v.missed ? 0.8 : 0);
    const out = Math.max(t + (v.kind === 'type' ? 0.25 : 0.45), at + min);
    tlines.forEach((l) => { if (l.until === Infinity) l.until = out; });
    const s: TScene = { ...sc, at, out, tsay, tlines, card: at + 0.35 };
    if (v.kind === 'ring') s.ring = { at: at + 0.3, out: v.missed ? out - 1.0 : out - 0.1 };
    if (v.kind === 'ring' && v.missed) s.missed = out - 0.95;
    if (v.kind === 'learn') { s.typed = at + 1.3; s.learned = s.typed + v.answer.length / 26 + 0.35; s.out = Math.max(s.out, s.learned + 1.2); }
    cursor = s.out;
    return s;
  });
  const endAt = cursor;
  const fin = data.end[sh.lang];
  // La signature sonore (public/jingle.mp3) : sa dernière note, à 1,0 s, tombe
  // sur le logo formé ; le slogan parlé vient après, pour ne pas la couvrir.
  const formed = endAt + 1.4;
  const end = { at: endAt, formed, jingle: formed - 1.0, say: { ...fin, at: formed + 0.3, out: formed + 0.3 + fin.duration + 0.5 } };
  return { id, lang: sh.lang, music: sh.music, scenes, end, duration: end.say.out + 1.0 };
}
export type Timeline = ReturnType<typeof buildTimeline>;

export const SHORT_IDS = Object.keys(data.shorts);
export const shortName = (id: string, f: Format) => `Short-${id}-${data.shorts[id].slug}-${f}`;

/* ------------------------------------------------------------------ le texte */

function Said({ line, t, size = 80, y = 300 }: { line: TNarr; t: number; size?: number; y?: number }) {
  const cine = useCine();
  if (!between(t, line.at - 0.05, line.out + 0.05)) return null;
  if (cine) {
    const words = line.title ? titleTimes(line.title, line.words, line.duration) : line.words;
    return <CineTitle words={words} serifIdx={line.title ? line.titleSerif ?? [] : line.serif} at={line.at} out={line.out} t={t} size={Math.round(size * 1.22)} y={y} />;
  }
  if (line.title) return <Title line={line} t={t} size={size} y={y} />;
  // Le morceau de phrase en cours : il reste jusqu'au début du suivant.
  const groups = phraseChunks(line.words);
  const startOf = (g: number[]) => line.at + line.words[g[0]].start - 0.06;
  let gi = 0;
  for (let k = 0; k < groups.length; k++) if (t >= startOf(groups[k])) gi = k;
  const g = groups[gi];
  const end = gi < groups.length - 1 ? startOf(groups[gi + 1]) : line.out;
  const outK = p(t, end - 0.2, 0.2, EASE_OUT);
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: y, transform: 'translateY(-50%)', textAlign: 'center', fontSize: size, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1.08, color: INK, ...ff }}>
      {g.map((i) => {
        const w = line.words[i];
        const inS = wordIn(t, line.at + w.start - 0.04);
        return <span key={i} style={{ display: 'inline-block', marginRight: '0.24em', ...inS, opacity: Number(inS.opacity) * (1 - outK), filter: `blur(${(1 - Math.min(1, Number(inS.opacity))) * 14 + outK * 12}px)`, ...(line.serif.includes(i) ? serif : {}) }}>{w.w}</span>;
      })}
    </div>
  );
}

function Title({ line, t, size, y }: { line: TNarr; t: number; size: number; y: number }) {
  const ws = titleTimes(line.title!, line.words, line.duration);
  const outK = p(t, line.out - 0.25, 0.25, EASE_OUT);
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: y, transform: 'translateY(-50%)', textAlign: 'center', fontSize: size, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1.08, color: INK, ...ff }}>
      {ws.map((w, i) => {
        const inS = wordIn(t, line.at + w.start - 0.04);
        return <span key={i} style={{ display: 'inline-block', marginRight: '0.24em', ...inS, opacity: Number(inS.opacity) * (1 - outK), filter: `blur(${(1 - Math.min(1, Number(inS.opacity))) * 14 + outK * 12}px)`, ...((line.titleSerif ?? []).includes(i) ? serif : {}) }}>{w.w}</span>;
      })}
    </div>
  );
}

/** La réplique en cours, mot à mot : qui parle au-dessus, ce qui est dit dessous. */
function Spoken({ t, l, y, size, lang }: { t: number; l: TLine; y: number; size: number; lang: Lang }) {
  if (!between(t, l.at - 0.1, l.until)) return null;
  const outK = p(t, l.until - 0.25, 0.25);
  const agent = l.who === 'agent';
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, top: y, textAlign: 'center', opacity: 1 - outK, ...ff }}>
      <div style={{ fontSize: 24, letterSpacing: '0.16em', fontWeight: 600, color: agent ? INDIGO : BODY, marginBottom: 12 }}>
        {l.tag ? <span style={{ padding: '4px 12px', borderRadius: 999, border: `1px solid ${INDIGO}55`, marginRight: 12 }}>{l.tag}</span> : null}
        {agent ? STR[lang].agent : STR[lang].caller}
      </div>
      <div style={{ fontSize: size, lineHeight: 1.22, fontWeight: agent ? 300 : 400, color: agent ? INK : '#44403B', letterSpacing: '-0.015em', ...(agent ? {} : { fontStyle: 'normal' }) }}>
        {l.words.map((w, i) => {
          const k = p(t, l.at + w.start - 0.04, 0.2, EASE_OUT);
          return <span key={i} style={{ display: 'inline-block', marginRight: '0.26em', opacity: k, filter: `blur(${(1 - k) * 10}px)` }}>{w.w}</span>;
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ la voix de Sarah, pour le rond */

function useVoiceLevels(T: Timeline, fps: number) {
  const sources = React.useMemo(() => [
    ...T.scenes.flatMap((s) => [
      ...(s.tsay ? [{ at: s.tsay.at, file: s.tsay.file, duration: s.tsay.duration }] : []),
      ...s.tlines.filter((l) => l.who === 'agent').map((l) => ({ at: l.at, file: l.file, duration: l.duration })),
    ]),
    { at: T.end.say.at, file: T.end.say.file, duration: T.end.say.duration },
  ], [T]);
  const audio = sources.map((s) => useAudioData(staticFile(s.file)));
  return React.useMemo(() => {
    if (audio.some((d) => !d)) return null;
    const n = Math.ceil(T.duration * fps) + 1;
    const lv = new Float32Array(n), phase = new Float32Array(n);
    for (let f = 0; f < n; f++) {
      const t = f / fps;
      const i = sources.findIndex((s) => t >= s.at && t <= s.at + s.duration);
      if (i >= 0) {
        const v = visualizeAudio({ fps, frame: Math.round((t - sources[i].at) * fps), audioData: audio[i]!, numberOfSamples: 32, smoothing: true });
        lv[f] = Math.min(1, Math.sqrt(v.slice(1, 8).reduce((a, b) => a + b, 0)) * 1.4);
      }
      if (f > 0) lv[f] = lv[f - 1] + (lv[f] - lv[f - 1]) * 0.4;
      phase[f] = (f > 0 ? phase[f - 1] : 0) + (0.8 + 2.6 * lv[f]) / fps;
    }
    return { lv, phase };
  }, [audio, sources, T, fps]);
}
type Levels = ReturnType<typeof useVoiceLevels>;

function Orb({ t, size, y, levels, fps, timer = '' }: { t: number; size: number; y: number; levels: Levels; fps: number; timer?: string }) {
  const f = Math.min(Math.round(t * fps), (levels?.lv.length ?? 1) - 1);
  if (useCine()) {
    return (
      <OrbStage t={t} x={(1080 - size) / 2} y={y} size={size} level={levels ? levels.lv[f] : 0}>
        <ShaderOrb size={size} time={levels ? levels.phase[f] : t * 0.8} active={1} level={levels ? levels.lv[f] : 0} timer={timer} />
      </OrbStage>
    );
  }
  return (
    <div style={{ position: 'absolute', left: (1080 - size) / 2, top: y }}>
      <ShaderOrb size={size} time={levels ? levels.phase[f] : t * 0.8} active={1} level={levels ? levels.lv[f] : 0} timer={timer} />
    </div>
  );
}

/* ------------------------------------------------------------------ les briques */

/** Un plan filmé dans un cadre arrondi (le cadre des pubs, au rythme de cette vidéo). */
function Footage({ t, name, from, at, out }: { t: number; name: string; from: number; at: number; out: number }) {
  const { fps } = useVideoConfig();
  const k = p(t, at, out - at, (x) => x);
  const cine = useCine();
  return (
    <div style={{ position: 'absolute', left: 80, top: 500, width: 760, height: 1020, borderRadius: 48, overflow: 'hidden', background: '#1a1714', boxShadow: `0 0 0 1px ${PLATE}, 0 50px 90px -40px rgba(60,30,120,0.35)`, ...(cine ? { transform: 'translateZ(-260px) rotateY(8deg)', boxShadow: '0 80px 120px -50px rgba(40,20,80,0.45)' } : {}) }}>
      <Sequence from={Math.round(at * fps)} durationInFrames={Math.max(1, Math.round((out - at) * fps))} layout="none">
        <OffthreadVideo src={staticFile(`media/${name}.mp4`)} startFrom={Math.round(from * fps)} muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.12 - 0.07 * k})` }} />
      </Sequence>
    </div>
  );
}

function ClientChip({ t, from, chip }: { t: number; from: number; chip: { name: string; initials: string; sub: string; badge: string } }) {
  return (
    <div style={{ position: 'absolute', left: 130, right: 130, top: 470, display: 'flex', alignItems: 'center', gap: 18, padding: '18px 26px', borderRadius: 28, background: '#fff', boxShadow: `0 0 0 1px ${PLATE}, 0 30px 60px -30px rgba(60,30,120,0.3)`, ...ff, ...reveal(t, from, 0.5) }}>
      <div style={{ width: 60, height: 60, borderRadius: 999, background: '#F5F3F1', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 600, color: INK }}>{chip.initials}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 30, fontWeight: 600, color: INK }}>{chip.name}</div>
        <div style={{ fontSize: 24, color: BODY }}>{chip.sub}</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: INDIGO, padding: '6px 14px', borderRadius: 999, background: 'rgba(122,95,255,0.1)' }}>{chip.badge}</div>
    </div>
  );
}

function LangPills({ t, s }: { t: number; s: TScene }) {
  const cur = s.tlines.findIndex((l) => t >= l.at - 0.1 && t < l.until);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 520, display: 'flex', justifyContent: 'center', gap: 18, ...ff, ...reveal(t, s.at + 0.1, 0.5) }}>
      {['Français', 'English', 'Nederlands'].map((l, i) => {
        const lit = s.tlines.length ? i === cur : true;
        return <span key={l} style={{ padding: '12px 26px', borderRadius: 999, fontSize: 30, fontWeight: 500, color: lit ? '#fff' : INK, background: lit ? INK : '#fff', boxShadow: `0 0 0 1px ${PLATE}` }}>{l}</span>;
      })}
    </div>
  );
}

function LearnCard({ t, s, question, answer, lang }: { t: number; s: TScene; question: string; answer: string; lang: Lang }) {
  const typed = Math.max(0, Math.min(answer.length, Math.floor((t - s.typed!) * 26)));
  const done = p(t, s.learned!, 0.45, EASE_OUT);
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, top: 560, borderRadius: 44, background: '#fff', padding: '40px 44px', boxShadow: `0 0 0 1px ${PLATE}, 0 50px 90px -40px rgba(60,30,120,0.35)`, ...ff, ...reveal(t, s.card, 0.6) }}>
      <div style={{ fontSize: 24, letterSpacing: '0.16em', fontWeight: 600, color: BODY }}>{STR[lang].unanswered}</div>
      <div style={{ fontSize: 50, fontWeight: 300, color: INK, marginTop: 18, letterSpacing: '-0.02em' }}>« {question} »</div>
      <div style={{ marginTop: 36, padding: '26px 30px', borderRadius: 26, background: '#F5F3F1', fontSize: 38, color: INK, minHeight: 60 }}>
        {answer.slice(0, typed)}
        {t >= s.typed! && t < s.learned! && <span style={{ opacity: Math.floor(t * 3) % 2 ? 0 : 1 }}>|</span>}
      </div>
      <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 16, opacity: done, filter: `blur(${(1 - done) * 8}px)` }}>
        <span style={{ width: 44, height: 44, borderRadius: 999, background: INK, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 26, transform: `scale(${0.6 + 0.4 * spring(p(t, s.learned!, 0.8, (x) => x))})` }}>✓</span>
        <span style={{ fontSize: 32, color: INK }}>{STR[lang].learned}</span>
      </div>
    </div>
  );
}

/** Le portail sur le MacBook : le Mac entier, puis la caméra s'approche de la réservation. */
function MacCard({ t, s }: { t: number; s: TScene }) {
  const z = p(t, s.at + 0.7, s.out - s.at - 0.9, EASE_IN_OUT);
  const sc = mix(0.78, 2.6, z), fx = mix(975, 1075, z), fy = mix(800, 540, z);
  return (
    <div style={{ position: 'absolute', left: 80, top: 500, width: 920, height: 1180, borderRadius: 48, overflow: 'hidden', background: '#E7E7E7', boxShadow: `0 0 0 1px ${PLATE}, 0 50px 90px -40px rgba(60,30,120,0.35)` }}>
      <div style={{ position: 'absolute', left: 460, top: 600, transformOrigin: '0 0', transform: `scale(${sc}) translate(${-fx}px, ${-fy}px)` }}>
        <MacBookBookings t={t} bump={s.at + 1.3} upcoming={s.at + 1.7} />
      </div>
    </div>
  );
}

/** « Elle note chaque message » : la fiche que le gérant reçoit, dans la langue de la vidéo. */
function MessageNote({ t, from, lang }: { t: number; from: number; lang: Lang }) {
  const n = STR[lang].note;
  const ap = (f: number) => {
    const k = p(t, f, 0.45, EASE_OUT);
    return { opacity: k, filter: `blur(${(1 - k) * 6}px)`, transform: `translateY(${(1 - k) * 10}px)` } as React.CSSProperties;
  };
  return (
    <SiteFrame kind="summary">
      <span className="pi__card" style={{ gap: 12 }}>
        <span className="pi__chip" style={ap(from)}><MessageSquare />{n.chip}</span>
        <span className="pi__title" style={ap(from + 0.15)}>{n.title}</span>
        <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {n.rows.map(([label, value], i) => (
            <span key={label} style={{ ...ap(from + 0.4 + i * 0.22), gridColumn: i === 3 ? '1 / -1' : undefined }}>
              <span className="pi__field-label" style={{ display: 'block' }}>{label}</span>
              <span className={i === 0 ? 'pi__field pi__field--active' : 'pi__field'}>{value}</span>
            </span>
          ))}
        </span>
        <span className="pi__chip" style={ap(from + 1.5)}><Send />{n.sent}<Check /></span>
      </span>
    </SiteFrame>
  );
}

/* ------------------------------------------------------------------ une scène */

type Fmt = (typeof FORMATS)[Format];

function AnyPhone(props: { t: number; inAt: number; outAt: number; children: React.ReactNode; angle?: number; x?: number; y?: number }) {
  if (!useCine()) return <Phone {...props} />;
  return (
    <Phone3D t={props.t} inAt={props.inAt} outAt={props.outAt} x={props.x ?? 560} y={props.y ?? 800} angle={props.angle} w={432} h={904}>
      <Device scale={1.03}>{props.children}</Device>
    </Phone3D>
  );
}

function Scene({ t, s, prev, levels, fps, lang, F, index = 0 }: { t: number; s: TScene; prev?: TScene; levels: Levels; fps: number; lang: Lang; F: Fmt; index?: number }) {
  const cine = useCine();
  const v = s.visual;
  const L = STR[lang];
  const k = p(t, s.at, 0.35, EASE_OUT) * (1 - p(t, s.out - 0.3, 0.3));
  const pop = 0.95 + 0.05 * spring(p(t, s.at, 0.9, (x) => x));
  let body: React.ReactNode = null;
  let over: React.ReactNode = null; // les textes posés hors réduction (4:5)
  if (v.kind === 'ring') {
    const banner = t >= s.ring!.at && t < s.ring!.out ? <div style={reveal(t, s.ring!.at)}><IncomingCall name={v.name} initials={v.initials} sub={v.sub ?? L.mobile} /></div> : undefined;
    const missed = s.missed !== undefined && t >= s.missed ? <div style={reveal(t, s.missed)}><Notification kind="phone" title={L.missed} desc={v.name} time={L.now} /></div> : undefined;
    body = (
      <>
        {v.footage && <Footage t={t} name={v.footage} from={0.6} at={s.at} out={s.out} />}
        <AnyPhone t={t} inAt={s.at + 0.05} outAt={s.out + 0.3} angle={buzzAngle(t, s.ring!)} x={v.footage ? 560 : 324} y={v.footage ? 800 : 560}>
          <LockScreen time={v.time} date={L.date} wallpaper={WALL} banner={banner}>{missed}</LockScreen>
        </AnyPhone>
      </>
    );
  } else if (v.kind === 'notif') {
    body = (
      <AnyPhone t={t} inAt={s.at + 0.05} outAt={s.out + 0.3} x={324} y={560}>
        <LockScreen time="20:14" date={L.date} wallpaper={WALL}>
          {t >= s.card && <div style={reveal(t, s.card)}><Notification kind="qwillio" title={v.title} desc={v.desc} time={L.now} /></div>}
        </LockScreen>
      </AnyPhone>
    );
    if (cine && t >= s.card + 0.25) {
      const k2 = 1 - Math.pow(2, -10 * Math.min(1, (t - s.card - 0.25) / 0.9));
      body = (
        <>
          {body}
          <div style={{ position: 'absolute', left: 540 - 186, top: 1000, width: 373, transformOrigin: '50% 50%', opacity: Math.min(1, k2 * 1.5), transform: `translateZ(${60 + 220 * k2}px) translateY(${(1 - k2) * 80}px) rotateX(${(1 - k2) * 25}deg) scale(${1.4 + 0.5 * k2})`, borderRadius: 23, background: 'rgba(250,250,252,0.97)', boxShadow: '0 30px 60px -20px rgba(40,20,80,0.35), 0 0 0 1px rgba(0,0,0,0.04)' }}>
            <Notification kind="qwillio" title={v.title} desc={v.desc} time={L.now} />
          </div>
        </>
      );
    }
  } else if (v.kind === 'orb') {
    const answered = prev?.visual.kind === 'ring' ? s.at : undefined;
    const sec = Math.max(0, Math.floor(t - s.at));
    body = (
      <>
        {v.chip && <ClientChip t={t} from={s.at + 0.2} chip={v.chip} />}
        <Orb t={t} size={500} y={640} levels={levels} fps={fps} timer={answered !== undefined || s.tlines.length ? `0:${String(sec).padStart(2, '0')}` : ''} />
      </>
    );
    over = s.tlines.map((l, i) => <Spoken key={i} t={t} l={l} y={F.spokenY} size={F.spokenSize} lang={lang} />);
  } else if (v.kind === 'langs') {
    body = (
      <>
        <LangPills t={t} s={s} />
        <Orb t={t} size={500} y={680} levels={levels} fps={fps} />
      </>
    );
    over = s.tlines.map((l, i) => <Spoken key={i} t={t} l={l} y={F.langsSpokenY} size={F.spokenSize} lang={lang} />);
  } else if (v.kind === 'learn') body = <LearnCard t={t} s={s} question={v.question} answer={v.answer} lang={lang} />;
  else if (v.kind === 'message') body = <MessageNote t={t} from={s.card} lang={lang} />;
  else if (v.kind === 'mac') body = <MacCard t={t} s={s} />;
  else if (v.kind === 'type' && v.tag) {
    const tk = reveal(t, s.at + 0.05, 0.5);
    const dark = ['APRÈS', 'AFTER', 'NA'].includes(v.tag);
    over = <div style={{ position: 'absolute', left: 0, right: 0, top: F.tagY, textAlign: 'center', ...ff }}><span style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 999, fontSize: 30, fontWeight: 600, letterSpacing: '0.18em', color: dark ? '#fff' : INK, background: dark ? INK : '#fff', boxShadow: `0 0 0 1px ${PLATE}`, ...tk }}>{v.tag}</span></div>;
  }
  if (cine) {
    // la scène est un plan : la caméra tourne autour, les titres restent à l'écran
    return (
      <AbsoluteFill>
        <CameraRig t={t} at={s.at} out={s.out} index={index}>
          <AbsoluteFill style={{ transformStyle: 'preserve-3d', transformOrigin: '540px 1000px', transform: `translateY(${F.body.dy}px) scale(${F.body.k})` }}>{body}</AbsoluteFill>
        </CameraRig>
        {over}
        {s.tsay && <Said line={s.tsay} t={t} size={v.kind === 'type' ? F.typeSize : F.saySize} y={v.kind === 'type' ? F.typeY : F.sayY} />}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ opacity: k, transform: `scale(${pop})` }}>
      <AbsoluteFill style={{ transformOrigin: '540px 1000px', transform: `translateY(${F.body.dy}px) scale(${F.body.k})` }}>{body}</AbsoluteFill>
      {over}
      {s.tsay && <Said line={s.tsay} t={t} size={v.kind === 'type' ? F.typeSize : F.saySize} y={v.kind === 'type' ? F.typeY : F.sayY} />}
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ la vidéo */

export const Short: React.FC<{ id: string; format: Format; cine?: boolean }> = ({ id, format, cine = false }) => {
  useOutfit();
  useFonts();
  const { fps } = useVideoConfig();
  const F = FORMATS[format];
  const T = React.useMemo(() => buildTimeline(id), [id]);
  const L = STR[T.lang];
  const t = useCurrentFrame() / fps;
  const levels = useVoiceLevels(T, fps);
  const at = (s: number) => Math.round(s * fps);

  const narr = [...T.scenes.flatMap((s) => (s.tsay ? [s.tsay] : [])), T.end.say];
  const lines = T.scenes.flatMap((s) => s.tlines);
  const talking = (x: number) => Math.max(0, ...narr.map((l) => p(x, l.at - 0.15, 0.2) * (1 - p(x, l.out - 0.3, 0.4))), ...lines.map((l) => p(x, l.at - 0.2, 0.2) * (1 - p(x, l.end, 0.4))));
  // La musique minimale (scripts/music-minimal.py) : plus présente entre les
  // phrases, presque effacée sous les voix.
  const music = (x: number) => 0.6 * p(x, 0, 0.6, (y) => y) * (1 - p(x, T.end.at - 0.3, 0.8)) * (1 - 0.72 * talking(x));

  return (
    <CineCtx.Provider value={cine}>
    <AbsoluteFill>
      {cine ? <CineBackdrop t={t} h={F.h} /> : <Canvas t={t} />}
      {t < T.end.at && !cine && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: F.brandY, textAlign: 'center', fontSize: 30, fontWeight: 600, letterSpacing: '-0.01em', color: INK, opacity: 0.55 * (1 - p(t, T.end.at - 0.4, 0.4)), ...ff }}>Qwillio</div>
      )}
      {T.scenes.map((s, i) => between(t, s.at, s.out + 0.05) && <Scene key={i} t={t} s={s} prev={T.scenes[i - 1]} levels={levels} fps={fps} lang={T.lang} F={F} index={i} />)}

      {t >= T.end.at && (
        <AbsoluteFill style={{ transformOrigin: '540px 960px', transform: `translateY(${F.end.dy}px) scale(${F.end.k})` }}>
          {cine ? (
            <AbsoluteFill style={{ perspective: 1400 }}>
              <AbsoluteFill style={{ transform: `rotateY(${(1 - Math.min(1, (t - T.end.at) / 1.6)) ** 3 * 50}deg) translateZ(${(1 - Math.min(1, (t - T.end.at) / 1.6)) ** 3 * -300}px)`, WebkitBoxReflect: 'below -560px linear-gradient(transparent 82%, rgba(255,255,255,0.18))' } as React.CSSProperties}>
                <Mark which="close" id={`c-${id}`} k={(t - T.end.at) / (T.end.formed - T.end.at)} />
              </AbsoluteFill>
            </AbsoluteFill>
          ) : <Mark which="close" id={`c-${id}`} k={(t - T.end.at) / (T.end.formed - T.end.at)} />}
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.close.y + J.close.R + 70, textAlign: 'center', fontSize: 84, fontWeight: 600, letterSpacing: '-0.025em', color: INK, opacity: p(t, T.end.formed - 0.3, 0.4, (x) => x), filter: `blur(${(1 - p(t, T.end.formed - 0.3, 0.4)) * 10}px)`, ...ff }}>Qwillio</div>
          <Said line={T.end.say} t={t} size={52} y={J.close.y + J.close.R + 250} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: J.close.y + J.close.R + 380, textAlign: 'center', fontSize: 34, color: BODY, opacity: p(t, T.end.say.at + 1.4, 0.5), filter: `blur(${(1 - p(t, T.end.say.at + 1.4, 0.5)) * 10}px)`, ...ff }}>{L.cta}</div>
        </AbsoluteFill>
      )}

      {/* ------------------------------ le son ------------------------------ */}
      <Audio src={staticFile('music-minimal.mp3')} startFrom={at(T.music)} volume={(f) => music(f / fps)} />
      <Sequence from={at(T.end.jingle)} layout="none"><Audio src={staticFile('jingle.mp3')} volume={0.9} /></Sequence>
      {narr.map((l) => <Sequence key={`n${l.file}`} from={at(l.at)} layout="none"><Audio src={staticFile(l.file)} /></Sequence>)}
      {lines.map((l) => <Sequence key={`l${l.file}`} from={at(l.at)} layout="none"><Audio src={staticFile(l.file)} /></Sequence>)}
      {/* une bulle douce quand un titre apparaît, pas un clic par mot */}
      {narr.map((l) => <Sfx key={`w${l.file}`} at={l.at + (l.words[0]?.start ?? 0) - 0.04} name="softpop" gain={0.45} />)}
      {T.scenes.flatMap((s, i) => {
        const v = s.visual;
        const out: React.ReactNode[] = [];
        if (s.ring) {
          out.push(<Sfx key={`rp${i}`} at={s.ring.at} name="pop" gain={0.5} />);
          for (let b = s.ring.at, j = 0; b < s.ring.out - 0.4; b += 1.4, j++) out.push(<Sfx key={`b${i}-${j}`} at={b} name="buzz" gain={0.55} />);
        }
        if (s.missed !== undefined) out.push(<Sfx key={`m${i}`} at={s.missed} name="pop" gain={0.55} />);
        if (v.kind === 'notif' || v.kind === 'learn' || v.kind === 'message' || v.kind === 'mac') out.push(<Sfx key={`c${i}`} at={s.card} name="pop" gain={0.55} />);
        if (v.kind === 'learn') out.push(<Sfx key={`ok${i}`} at={s.learned!} name="click" gain={0.6} />);
        if (v.kind === 'orb' && T.scenes[i - 1]?.visual.kind === 'ring') out.push(<Sfx key={`a${i}`} at={s.at} name="click" gain={0.6} />);
        if (v.kind === 'langs') s.tlines.forEach((l, j) => out.push(<Sfx key={`lg${i}-${j}`} at={l.at - 0.1} name="click" gain={0.45} />));
        if (v.kind === 'type' && v.tag) out.push(<Sfx key={`tg${i}`} at={s.at + 0.05} name="thump" gain={0.45} />);
        return out;
      })}
      {cine && <CineFinish w={F.w} h={F.h} />}
    </AbsoluteFill>
    </CineCtx.Provider>
  );
};
