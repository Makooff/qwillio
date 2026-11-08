/**
 * Les animations de texte et leurs sons, calqués sur la vidéo de référence
 * fournie par le propriétaire (« Premium SFX, text animation sound effects »).
 * Chaque son vient de cette vidéo, découpé tel quel dans public/media/sfx/ :
 *
 *   type      un clic par mot qui apparaît (les lettres tapées de la référence)
 *   click     un clic sec : un élément qui se pose
 *   pop       un pop : une carte, une notification qui arrive en rebondissant
 *   glitch    0,6 s de grésillement : le texte se dédouble en rouge et cyan
 *   tracking  des clics graves : les lettres espacées qui se resserrent
 *   counter   le défilement d'un compteur
 *   thump     un impact sourd : un mot qui tombe
 *
 * Tout est piloté par le temps de la vidéo (pas d'animation CSS), donc chaque
 * image du rendu est reproductible.
 */
import React from 'react';
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import { EASE_OUT, p } from './lib';

export type SfxName = 'type' | 'click' | 'pop' | 'glitch' | 'tracking' | 'counter' | 'thump' | 'buzz';

/** Un son de la référence, posé à l'instant `at`. */
export function Sfx({ at, name, gain = 1 }: { at: number; name: SfxName; gain?: number }) {
  const { fps: FPS } = useVideoConfig();
  return (
    <Sequence from={Math.max(0, Math.round(at * FPS))} durationInFrames={Math.round(1.2 * FPS)} layout="none">
      <Audio src={staticFile(`media/sfx/${name}.wav`)} volume={gain} />
    </Sequence>
  );
}

/** Un ressort amorti : arrive, dépasse à peine, se pose. */
const spring = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(7 * x));

/** Un mot qui apparaît : il sort du flou, grossi, et se pose avec un rebond. */
export function wordIn(t: number, at: number): React.CSSProperties {
  const k = p(t, at, 0.32, EASE_OUT);
  const s = spring(p(t, at, 0.55, (x) => x));
  return { opacity: Math.min(1, k * 1.6), filter: `blur(${(1 - k) * 14}px)`, transform: `scale(${1.22 - 0.22 * s})` };
}

/** Le glitch : le texte se dédouble en rouge et cyan et tremble, puis se remet. */
export function glitch(t: number, from: number, dur = 0.55): React.CSSProperties {
  if (t < from || t > from + dur) return {};
  const f = Math.floor((t - from) * 30);
  const r = (n: number) => (Math.sin(f * 12.9898 + n * 78.233) * 43758.5453) % 1;
  const a = 1 - (t - from) / dur;
  const dx = r(1) * 14 * a, dy = r(2) * 4 * a;
  return {
    textShadow: `${dx}px 0 0 rgba(255,40,80,0.85), ${-dx}px ${dy}px 0 rgba(0,210,255,0.85)`,
    transform: `translateX(${r(3) * 8 * a}px) skewX(${r(4) * 8 * a}deg)`,
    clipPath: r(5) > 0.6 ? `inset(${Math.abs(r(6)) * 40}% 0 ${Math.abs(r(7)) * 30}% 0)` : undefined,
  };
}

/** Les lettres espacées qui se resserrent (le « V i d e o » de la référence). */
export function tracking(t: number, from: number, wide = 0.9, tight = 0.2): string {
  const k = p(t, from, 0.7, EASE_OUT);
  return `${wide + (tight - wide) * k}em`;
}
