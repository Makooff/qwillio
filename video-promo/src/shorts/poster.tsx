/**
 * Le style « affiche » des vidéos et des visuels fixes, d'après la référence
 * donnée par le propriétaire (une campagne ElevenLabs) : une page blanche, un
 * grand panneau clair, une sphère dégradée et granuleuse qui monte du bas du
 * panneau, un chiffre au centre, puis sous le panneau un titre sur deux lignes
 * (noire, puis grise), une ligne d'appoint, le logo en bas à gauche et un bouton
 * noir en bas à droite. Calme, net, beaucoup d'air.
 *
 * Aux couleurs de Qwillio : la sphère mêle l'indigo et le violet de la marque
 * avec une touche chaude ; le chiffre est en indigo plein (pas de texte en
 * dégradé, interdit par la charte). Outfit partout.
 *
 * La sphère est le rond de l'appel : elle respire avec la voix de la
 * réceptionniste et vibre quand le téléphone sonne. Elle reste à l'écran d'une
 * scène à l'autre ; seuls le chiffre, le titre et la ligne d'appoint changent.
 */
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { EASE_OUT, p, useOutfit } from '../lib';
import { useFonts } from '../pub2/Pub2';
import type { Lang } from './types';
import { STR, type Fmt, type TLine, type TNarr, type TScene, type Timeline } from './Short';
import { titleTimes } from '../fx';

export const INK = '#111113';
export const GRAY = '#8C8C8F';
export const PANEL = '#F3F1EF';
export const INDIGO = '#6A4DF5';
const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };
const expo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

const CTA: Record<Lang, string> = { fr: 'Essayer gratuitement', en: 'Try for free', nl: 'Gratis proberen' };
const LABEL: Record<Lang, [string, string]> = { fr: ['Réceptionniste', 'IA'], en: ['AI', 'Receptionist'], nl: ['AI', 'Receptioniste'] };
const LIVE: Record<Lang, string> = { fr: 'En ligne avec la réceptionniste', en: 'On the line with the receptionist', nl: 'In gesprek met de receptioniste' };
const INCOMING: Record<Lang, string> = { fr: 'Appel entrant', en: 'Incoming call', nl: 'Inkomende oproep' };

/* ------------------------------------------------------------------ les pièces */

/** La sphère : un dégradé qui tourne lentement, du grain, coupée par le bas du panneau. */
export function Sphere({ t, size, cx, top, level = 0, buzz = 0, seed = 0 }: { t: number; size: number; cx: number; top: number; level?: number; buzz?: number; seed?: number }) {
  const ph = t * 0.35 + level * 0.8;
  const pos = (a: number, r: number, o: number) => `${50 + Math.cos(ph + a) * r + o}% ${45 + Math.sin(ph * 1.3 + a) * r}%`;
  const s = 1 + 0.025 * level + 0.012 * Math.sin(buzz * 60);
  return (
    <div style={{ position: 'absolute', left: cx - size / 2, top, width: size, height: size, borderRadius: '50%', overflow: 'hidden', transform: `scale(${s})`, transformOrigin: '50% 100%' }}>
      <div style={{ position: 'absolute', inset: -40, filter: 'blur(28px)', background: [
        `radial-gradient(38% 38% at ${pos(0, 14, 0)}, #FF8FB8 0%, rgba(255,143,184,0) 70%)`,
        `radial-gradient(42% 42% at ${pos(2.1, 18, -6)}, #CD6BFB 0%, rgba(205,107,251,0) 72%)`,
        `radial-gradient(46% 46% at ${pos(4.2, 16, 6)}, #6A4DF5 0%, rgba(106,77,245,0) 74%)`,
        `radial-gradient(30% 30% at ${pos(1.2, 22, 10)}, #FFC2A3 0%, rgba(255,194,163,0) 70%)`,
        'linear-gradient(180deg, #B9A6FF 0%, #8F6BFF 55%, #7A5FFF 100%)',
      ].join(', ') }} />
      {/* le grain, comme une impression */}
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.55 }}>
        <filter id={`sg-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#sg-${seed})`} />
      </svg>
      {/* le haut, un peu plus pâle : la lumière vient d'en haut */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,0.35), rgba(255,255,255,0) 70%)' }} />
    </div>
  );
}

/** Le logo de Qwillio, en bas à gauche. */
export function Logo({ x, y, h = 56 }: { x: number; y: number; h?: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'center', gap: h * 0.25, ...ff }}>
      <Img src={staticFile('qwillio-logo-512.svg')} style={{ height: h, width: h }} />
      <span style={{ fontSize: h * 0.82, fontWeight: 600, letterSpacing: '-0.035em', color: INK }}>Qwillio</span>
    </div>
  );
}

/** Le bouton noir, en bas à droite. */
export function Cta({ right, y, label, k = 1, size = 34 }: { right: number; y: number; label: string; k?: number; size?: number }) {
  return (
    <div style={{ position: 'absolute', right, top: y, padding: `${size * 0.6}px ${size * 1.05}px`, borderRadius: 999, background: INK, color: '#fff', fontSize: size, fontWeight: 500, letterSpacing: '-0.01em', transform: `scale(${k})`, transformOrigin: '100% 50%', ...ff }}>{label}</div>
  );
}

/** L'étiquette en haut du panneau : « Réceptionniste (IA) », le badge cerclé comme sur la référence. */
export function TopLabel({ lang, y, size = 46 }: { lang: Lang; y: number; size?: number }) {
  const [a, b] = LABEL[lang];
  const badgeFirst = lang !== 'fr';
  const badge = <span style={{ display: 'inline-block', padding: `0 ${size * 0.32}px`, border: `${Math.max(2, size * 0.06)}px solid ${INK}`, borderRadius: 999, fontSize: size * 0.62, fontWeight: 600, lineHeight: `${size * 0.95}px`, margin: `0 ${size * 0.22}px`, verticalAlign: 'middle' }}>{badgeFirst ? a : b}</span>;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', fontSize: size, fontWeight: 400, letterSpacing: '-0.02em', color: INK, ...ff }}>
      Qwillio {badgeFirst ? <>{badge} {b}</> : <>{a} {badge}</>}
    </div>
  );
}

/** Le titre en deux lignes : la première noire, la seconde grise (coupée à la première ponctuation). */
export function splitTitle(title: string): [string, string] {
  const m = title.match(/^(.+?[,.?!:])\s+(.+)$/);
  return m ? [m[1], m[2]] : [title, ''];
}

function Headline({ title, at, out, t, y, size, words, dur = 3 }: { title: string; at: number; out: number; t: number; y: number; size: number; words?: { start: number }[]; dur?: number }) {
  if (t < at - 0.05 || t > out + 0.05) return null;
  const [a, b] = splitTitle(title);
  const ws = words ? titleTimes(title, words as { start: number }[], dur) : title.split(' ').map((w, i) => ({ w, start: i * 0.06 }));
  const nA = a.split(' ').length;
  const outK = p(t, out - 0.3, 0.3, EASE_OUT);
  const word = (w: { w: string; start: number }, i: number) => {
    const k = expo(p(t, at + w.start - 0.05, 0.6, (x) => x));
    return <span key={i} style={{ display: 'inline-block', marginRight: '0.24em', opacity: k, transform: `translateY(${(1 - k) * 0.35}em)`, filter: `blur(${(1 - k) * 8}px)` }}>{w.w}</span>;
  };
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: y, fontSize: size, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1.06, opacity: 1 - outK, transform: `translateY(${-outK * 20}px)`, ...ff }}>
      <div style={{ color: INK }}>{ws.slice(0, nA).map(word)}</div>
      {b && <div style={{ color: GRAY }}>{ws.slice(nA).map((w, i) => word(w, i + nA))}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ la vidéo */

function sceneStat(s: TScene, t: number, lang: Lang): { big: string; small: string } {
  const v = s.visual;
  const L = STR[lang];
  if (v.kind === 'ring') return { big: v.time, small: s.missed !== undefined && t >= s.missed ? `${L.missed} · ${v.name}` : `${INCOMING[lang]} · ${v.name}` };
  if (v.kind === 'orb') return { big: `0:${String(Math.max(0, Math.floor(t - s.at))).padStart(2, '0')}`, small: LIVE[lang] };
  if (v.kind === 'notif') {
    const m = v.desc.match(/\d{1,2}:\d{2}/);
    return { big: m ? m[0] : '✓', small: `${v.title} · ${v.desc.split(' · ')[0]}` };
  }
  if (v.kind === 'langs') return { big: 'FR · NL · EN', small: '' };
  if (v.kind === 'learn') return { big: s.learned !== undefined && t >= s.learned ? '✓' : '?', small: v.question };
  if (v.kind === 'message') return { big: L.note.rows[0][1], small: `${L.note.chip} · ${L.note.rows[1][0]} ${L.note.rows[1][1]}` };
  if (v.kind === 'mac') return { big: '✓', small: '' };
  return { big: '', small: '' };
}

/**
 * La vidéo en style affiche : même frise, mêmes voix que les autres versions
 * (src/shorts/Short.tsx), seul le dessin change.
 */
export function Poster({ T, t, levels, fps, F }: { T: Timeline; t: number; levels: { lv: Float32Array } | null; fps: number; F: Fmt }) {
  const frame = useCurrentFrame();
  const lang = T.lang;
  const W = F.w, H = F.h;
  const tall = H > 1500;
  const panel = { x: 70, y: tall ? 140 : 90, w: W - 140, h: tall ? 1130 : 760 };
  const f = Math.min(Math.round(t * fps), (levels?.lv.length ?? 1) - 1);
  const level = levels ? levels.lv[f] : 0;
  const cur = T.scenes.find((s) => t >= s.at && t < s.out) ?? T.scenes[T.scenes.length - 1];
  const ringing = cur.ring && t >= cur.ring.at && t < cur.ring.out ? (t - cur.ring.at) % 1.4 < 0.6 ? t : 0 : 0;
  const end = t >= T.end.at;
  // la sphère monte au début, et grandit à la fin
  const rise = expo(p(t, 0, 1.6, (x) => x));
  const grow = expo(p(t, T.end.at, 1.4, (x) => x));
  const size = panel.w * ((tall ? 0.98 : 0.8) + 0.25 * grow);
  const sphereTop = panel.y + panel.h - size * (0.4 + 0.05 * grow) * rise - 10 + (1 - rise) * 200;
  // le chiffre de la scène, qui se change en fondu
  const stat = end ? { big: 'Qwillio', small: '' } : sceneStat(cur, t, lang);
  const statK = end ? expo(p(t, T.end.at + 0.3, 0.8, (x) => x)) : expo(p(t, cur.at + 0.1, 0.7, (x) => x)) * (1 - p(t, cur.out - 0.25, 0.25));
  // le titre : la dernière narration commencée
  const narr = [...T.scenes.flatMap((s) => (s.tsay ? [s.tsay] : [])), T.end.say] as TNarr[];
  const head = [...narr].reverse().find((l) => t >= l.at - 0.05);
  const headOut = head ? (narr[narr.indexOf(head) + 1]?.at ?? T.end.say.out + 5) - 0.1 : 0;
  // la ligne d'appoint : la réplique en cours de l'appel
  const line = T.scenes.flatMap((s) => s.tlines).find((l: TLine) => t >= l.at - 0.1 && t < l.until) as TLine | undefined;
  const L = STR[lang];
  const ctaK = end ? 1 + 0.04 * Math.sin(p(t, T.end.say.at, 1.2, (x) => x) * Math.PI) : 1;
  const hSize = tall ? 92 : 74;
  const headY = panel.y + panel.h + (tall ? 70 : 50);

  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      {/* le panneau et sa sphère */}
      <div style={{ position: 'absolute', left: panel.x, top: panel.y, width: panel.w, height: panel.h, background: PANEL, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: -panel.x, top: -panel.y, width: W, height: H }}>
          <Sphere t={t} size={size} cx={W / 2} top={sphereTop} level={level} buzz={ringing} seed={frame % 5} />
        </div>
      </div>
      <TopLabel lang={lang} y={panel.y + (tall ? 105 : 70)} size={tall ? 46 : 40} />
      {/* le chiffre */}
      {stat.big && (
        <div style={{ position: 'absolute', left: panel.x, width: panel.w, top: panel.y + (tall ? 380 : 230), textAlign: 'center', opacity: statK, transform: `translateY(${(1 - statK) * 24}px)`, filter: `blur(${(1 - statK) * 8}px)`, ...ff }}>
          <div style={{ fontSize: stat.big.length > 6 ? (tall ? 150 : 120) : (tall ? 190 : 150), fontWeight: 500, letterSpacing: '-0.05em', lineHeight: 1, color: INDIGO }}>{stat.big}</div>
          {stat.small && <div style={{ marginTop: 18, fontSize: tall ? 34 : 28, color: INDIGO, opacity: 0.85, letterSpacing: '-0.01em' }}>{stat.small}</div>}
        </div>
      )}
      {/* le titre */}
      {head && <Headline key={head.file} title={head.title ?? head.words.map((w) => w.w).join(' ')} at={head.at} out={headOut} t={t} y={headY} size={hSize} words={head.words} dur={head.duration} />}
      {/* la ligne d'appoint : ce qui se dit au téléphone */}
      {line && !end && (
        <div style={{ position: 'absolute', left: 70, right: 70, top: headY + hSize * 3.35, fontSize: tall ? 36 : 30, lineHeight: 1.3, color: GRAY, opacity: expo(p(t, line.at - 0.1, 0.4, (x) => x)) * (1 - p(t, line.until - 0.2, 0.2)), ...ff }}>
          <span style={{ color: INK, fontWeight: 500 }}>{line.who === 'agent' ? L.agent.charAt(0) + L.agent.slice(1).toLowerCase() : L.caller.charAt(0) + L.caller.slice(1).toLowerCase()} · </span>
          {line.words.map((w) => w.w).join(' ')}
        </div>
      )}
      <Logo x={70} y={H - (tall ? 150 : 110)} h={tall ? 56 : 46} />
      <Cta right={70} y={H - (tall ? 162 : 120)} label={CTA[lang]} k={ctaK} size={tall ? 34 : 28} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ les posts fixes */

/**
 * Les visuels fixes pour Instagram et LinkedIn (4:5, 1080 × 1350, le format
 * qui passe dans les deux fils), même grammaire que les vidéos : un chiffre,
 * un titre noir puis gris, une ligne d'appoint, le logo, le bouton.
 * Chaque affirmation décrit ce que le produit fait vraiment (voir CLAUDE.md).
 */
export type PostData = { stat: string; small: string; l1: string; l2: string; sub: string; t: number };
export const POSTS: Record<Lang, PostData[]> = {
  fr: [
    { stat: '24 h/24', small: 'Même à 3 h du matin', l1: 'Chaque appel décroché.', l2: 'Même quand vous êtes occupé.', sub: 'La réceptionniste IA des commerces et des cabinets.', t: 1 },
    { stat: 'FR · NL · EN', small: 'Une voix native par langue', l1: 'Trois langues.', l2: 'Avec le bon accent.', sub: 'Pensée pour Bruxelles et toute la Belgique.', t: 4 },
    { stat: '20:30', small: 'Nouvelle réservation · Julie Martin', l1: 'La réservation arrive.', l2: 'Pendant que vous travaillez.', sub: 'Elle prend, déplace et annule vos rendez-vous.', t: 7 },
    { stat: '?', small: 'Question sans réponse', l1: 'Elle n’invente rien.', l2: 'Elle vous demande, puis retient.', sub: 'Votre réponse sert à tous les appels suivants.', t: 10 },
    { stat: 'Pour Marc', small: 'Nouveau message · rappeler après 17 h', l1: 'Chaque message noté.', l2: 'Pour qui, et quand rappeler.', sub: 'Envoyé par SMS à la bonne personne.', t: 13 },
    { stat: 'Urgent', small: 'Appel transféré tout de suite', l1: 'Les urgences vous arrivent.', l2: 'Le reste, elle le gère.', sub: 'Elle trie les appels comme une vraie réceptionniste.', t: 16 },
  ],
  en: [],
  nl: [],
};

export const Post: React.FC<{ lang: Lang; index: number }> = ({ lang, index }) => {
  useOutfit();
  useFonts();
  const d = POSTS[lang][index];
  const W = 1080, H = 1350;
  const panel = { x: 70, y: 90, w: W - 140, h: 780 };
  const size = panel.w * 0.86;
  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      <div style={{ position: 'absolute', left: panel.x, top: panel.y, width: panel.w, height: panel.h, background: PANEL, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: -panel.x, top: -panel.y, width: W, height: H }}>
          <Sphere t={d.t} size={size} cx={W / 2} top={panel.y + panel.h - size * 0.42} seed={index} />
        </div>
      </div>
      <TopLabel lang={lang} y={panel.y + 70} size={40} />
      <div style={{ position: 'absolute', left: panel.x, width: panel.w, top: panel.y + 210, textAlign: 'center', ...ff }}>
        <div style={{ fontSize: d.stat.length > 6 ? 128 : 160, fontWeight: 500, letterSpacing: '-0.05em', lineHeight: 1, color: INDIGO }}>{d.stat}</div>
        <div style={{ marginTop: 16, fontSize: 28, color: INDIGO, opacity: 0.85 }}>{d.small}</div>
      </div>
      <div style={{ position: 'absolute', left: 70, right: 70, top: panel.y + panel.h + 50, fontSize: 70, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1.06, ...ff }}>
        <div style={{ color: INK }}>{d.l1}</div>
        <div style={{ color: GRAY }}>{d.l2}</div>
      </div>
      <div style={{ position: 'absolute', left: 70, right: 70, top: panel.y + panel.h + 230, fontSize: 28, color: GRAY, ...ff }}>{d.sub}</div>
      <Logo x={70} y={H - 110} h={46} />
      <Cta right={70} y={H - 120} label={CTA[lang]} size={28} />
    </AbsoluteFill>
  );
};
