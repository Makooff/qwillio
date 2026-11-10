/**
 * Le rendu « cinéma » des vidéos courtes : de la profondeur, de la lumière, un
 * mouvement de caméra. Retour du propriétaire : « on dirait un simple
 * PowerPoint, je veux plus de 3D, impressionnant de qualité, style pub
 * ChatGPT, Apple ». Ce qui sépare un diaporama d'une pub de marque :
 *  - une CAMÉRA : chaque scène entre en pivotant dans l'espace et dérive
 *    lentement pendant qu'elle vit, au lieu d'apparaître à plat ;
 *  - des OBJETS en volume : le téléphone a une tranche, un reflet qui glisse,
 *    une ombre portée et un reflet au sol ; le rond flotte au-dessus d'un sol
 *    où des ondes s'élargissent quand la réceptionniste parle ;
 *  - une LUMIÈRE : un studio clair à fond infini, une grande lueur de marque
 *    derrière le sujet, une vignette et un grain de film ;
 *  - une TYPOGRAPHIE de campagne : grosse, serrée, chaque mot qui monte d'un
 *    masque, au lieu de mots qui sortent d'un flou.
 * Tout reste piloté par le temps de la vidéo (pas de CSS animé), donc chaque
 * image est reproductible. Le flou n'est jamais posé sur un élément en 3D
 * (un filtre aplatit la perspective) : seulement autour.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_OUT, p } from '../lib';

export const CineCtx = React.createContext(false);
export const useCine = () => React.useContext(CineCtx);

const INK = '#1D1D1F';
const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };
const serif: React.CSSProperties = { fontFamily: 'QSerif, Georgia, serif', fontStyle: 'italic', fontWeight: 400 };
const expo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const smooth = (x: number) => x * x * (3 - 2 * x);


/* ------------------------------------------------------------------ les variations */

/**
 * Chaque vidéo a son « look », pour que la série ne soit pas un copier-coller
 * (retour du propriétaire) : le ton du studio, le mouvement de caméra, la
 * peau des bulles de l'appel, l'alignement des titres et l'entrée du logo.
 * Le premier look est celui de la vidéo 1, validée telle quelle.
 */
export type Look = {
  tone: { wall: [string, string, string]; base: string; floor: string; light: string };
  move: 'orbit' | 'dolly' | 'crane' | 'slide' | 'roll';
  skin: 'brand' | 'ink' | 'soft' | 'outline';
  align: 'center' | 'left';
  logo: 1 | -1 | 0;
};
const TONES = {
  // blanc neutre, sans beige : « il y a un fond beige que j'aime pas »
  cream: { wall: ['#FFFFFF', '#F7F7F8', '#EBEBED'], base: '#F4F4F5', floor: '228,228,231|212,212,216|194,194,199', light: '50% 18%' },
  stone: { wall: ['#FFFFFF', '#F1F2F4', '#E0E2E6'], base: '#EEF0F2', floor: '224,226,230|208,211,217|190,194,201', light: '30% 14%' },
  sand: { wall: ['#FFFDF8', '#F6EFE4', '#E9DDCB'], base: '#F3ECE1', floor: '230,220,204|216,203,184|200,186,165', light: '70% 16%' },
  mist: { wall: ['#FCFDFE', '#EEF1F5', '#DEE3EA'], base: '#ECEFF3', floor: '226,230,236|210,216,224|192,199,209', light: '50% 8%' },
  linen: { wall: ['#FFFFFF', '#F4F2EF', '#E4E0DA'], base: '#EFECE8', floor: '222,218,212|206,200,193|186,180,172', light: '24% 22%' },
} as const;
const L = (tone: keyof typeof TONES, move: Look['move'], skin: Look['skin'], align: Look['align'], logo: Look['logo']): Look => ({ tone: TONES[tone] as unknown as Look['tone'], move, skin, align, logo });
export const LOOKS: Look[] = [
  // La DA reste celle de la vidéo 1 (studio clair, bulles blanc et indigo) :
  // « garde la DA qu'on a fait avant ». Ce qui varie, c'est la mise en scène.
  L('cream', 'orbit', 'brand', 'center', 1), // s01, validée
  L('cream', 'dolly', 'brand', 'left', -1),
  L('cream', 'crane', 'brand', 'center', 0),
  L('cream', 'slide', 'brand', 'left', 1),
  L('cream', 'roll', 'brand', 'center', -1),
  L('cream', 'dolly', 'brand', 'center', 1),
  L('cream', 'crane', 'brand', 'left', 0),
  L('cream', 'slide', 'brand', 'center', -1),
  L('cream', 'orbit', 'brand', 'left', 0),
  L('cream', 'crane', 'brand', 'center', 1),
  L('cream', 'roll', 'brand', 'left', -1),
];
export const lookFor = (id: string) => LOOKS[(Number((id.match(/s(\d+)/) ?? [])[1] ?? 1) - 1) % LOOKS.length];
export const LookCtx = React.createContext<Look>(LOOKS[0]);
export const useLook = () => React.useContext(LookCtx);

/* ------------------------------------------------------------------ le studio */

/** Un studio clair à fond infini : le mur, le sol, la ligne d'horizon fondue,
 * et une grande lueur de marque qui respire derrière le sujet. */
export function CineBackdrop({ t, h }: { t: number; h: number }) {
  const horizon = h * 0.64;
  const { tone } = useLook();
  const [f0, f1, f2] = tone.floor.split('|');
  return (
    <AbsoluteFill style={{ background: tone.base, overflow: 'hidden' }}>
      {/* le mur, plus clair là d'où vient la lumière (elle change d'une vidéo à l'autre) */}
      <AbsoluteFill style={{ background: `radial-gradient(120% 70% at ${tone.light}, ${tone.wall[0]} 0%, ${tone.wall[1]} 45%, ${tone.wall[2]} 100%)` }} />
      {/* le sol, qui s'assombrit doucement vers la caméra */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: horizon, bottom: 0, background: `linear-gradient(180deg, rgba(${f0},0) 0%, rgba(${f1},0.55) 55%, rgba(${f2},0.75) 100%)` }} />
      {/* un rai de lumière qui traverse lentement, très léger */}
      <div style={{ position: 'absolute', top: -200, bottom: -200, width: 520, left: `${-40 + ((t * 6) % 140)}%`, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.35), rgba(255,255,255,0))', transform: 'skewX(-18deg)', filter: 'blur(30px)' }} />
    </AbsoluteFill>
  );
}

/** La vignette et le grain de film : ce qui fait « tourné », pas « exporté ». */
export function CineFinish({ w, h }: { w: number; h: number }) {
  const frame = useCurrentFrame();
  const seed = frame % 6;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(120% 90% at 50% 45%, rgba(0,0,0,0) 55%, rgba(40,30,60,0.16) 100%)' }} />
      <svg width={w} height={h} style={{ position: 'absolute', inset: 0, opacity: 0.07, mixBlendMode: 'multiply' }}>
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ la caméra */

/**
 * La caméra d'une scène : elle arrive en pivotant depuis la profondeur, dérive
 * pendant que la scène vit, et repart de l'autre côté. Le sens alterne d'une
 * scène à l'autre, comme un plan qui tourne autour du sujet.
 */
export function CameraRig({ t, at, out, index, children, origin = '540px 1000px' }: { t: number; at: number; out: number; index: number; children: React.ReactNode; origin?: string }) {
  const dir = index % 2 ? -1 : 1;
  const { move } = useLook();
  const inK = expo(p(t, at, 1.1, (x) => x));
  const live = p(t, at, Math.max(0.1, out - at), (x) => x);
  const outK = smooth(p(t, out - 0.45, 0.45, (x) => x));
  let ry = 0, rx = 0, rz = 0, z = 0, tx = 0, ty = 0;
  if (move === 'orbit') { // pivote autour du sujet, le sens alterne
    ry = dir * (22 * (1 - inK) - 5 * live) - dir * 18 * outK;
    rx = 6 * (1 - inK) + 2 * Math.sin(live * Math.PI);
    z = -420 * (1 - inK) + 90 * live - 260 * outK;
  } else if (move === 'dolly') { // travelling avant, sans pivot, et on traverse la scène pour sortir
    rx = 3 * (1 - inK);
    z = -620 * (1 - inK) + 120 * live + 380 * outK;
  } else if (move === 'crane') { // la grue descend sur le sujet, remonte pour partir
    rx = -16 * (1 - inK) + 1.5 * Math.sin(live * Math.PI) + 10 * outK;
    ty = -220 * (1 - inK) - 180 * outK;
    z = -300 * (1 - inK) + 70 * live - 200 * outK;
  } else if (move === 'slide') { // travelling latéral, la scène suivante arrive du côté opposé
    tx = dir * 360 * (1 - inK) - dir * 40 * live - dir * 320 * outK;
    ry = -dir * 10 * (1 - inK) + dir * 3 * live + dir * 8 * outK;
    z = -200 * (1 - inK) + 60 * live - 120 * outK;
  } else { // roll : une légère bascule de l'horizon, comme une caméra à l'épaule posée
    rz = dir * 6 * (1 - inK) - dir * 1.2 * live - dir * 5 * outK;
    rx = 4 * (1 - inK);
    z = -360 * (1 - inK) + 80 * live - 220 * outK;
  }
  const blur = (1 - inK) * 12 + outK * 10;
  return (
    <AbsoluteFill style={{ opacity: Math.min(1, inK * 1.4) * (1 - outK), filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>
      <AbsoluteFill style={{ perspective: 1500, perspectiveOrigin: origin }}>
        <AbsoluteFill style={{ transformStyle: 'preserve-3d', transformOrigin: origin, transform: `translate3d(${tx}px, ${ty}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)` }}>
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ les objets */

/** L'ombre portée d'un objet posé au-dessus du sol : une ellipse floue. */
export function ContactShadow({ x, y, w, k = 1 }: { x: number; y: number; w: number; k?: number }) {
  return <div style={{ position: 'absolute', left: x - w / 2, top: y, width: w, height: w * 0.16, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(30,20,50,0.38), rgba(30,20,50,0))', filter: 'blur(14px)', opacity: k }} />;
}

/**
 * Le téléphone en volume : légèrement tourné vers la caméra, il flotte, a une
 * tranche de titane (des couches empilées en profondeur), un reflet qui glisse
 * sur l'écran quand il tourne, un reflet au sol et une ombre portée.
 */
export function Phone3D({ t, inAt, outAt, x, y, children, angle = 0, w = 446, h = 930 }: { t: number; inAt: number; outAt: number; x: number; y: number; children: React.ReactNode; angle?: number; w?: number; h?: number }) {
  if (t < inAt - 0.05 || t > outAt + 0.05) return null;
  const k = expo(p(t, inAt, 1.2, (v) => v));
  const fade = p(t, inAt, 0.35, EASE_OUT) * (1 - p(t, outAt - 0.35, 0.35, EASE_OUT));
  const bob = Math.sin((t - inAt) * 1.6) * 10;
  const ry = -24 + 10 * k + Math.sin((t - inAt) * 0.7) * 4;
  const rx = 10 - 4 * k;
  const rz = angle - 2;
  const glare = 50 + ry * 3; // le reflet suit la rotation
  return (
    <>
      <ContactShadow x={x + w / 2} y={y + h + 40} w={w * 1.05} k={fade * (0.7 + 0.3 * k)} />
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, opacity: fade, transformStyle: 'preserve-3d', transform: `translateY(${bob - (1 - k) * 160}px) translateZ(${(1 - k) * -300}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`, WebkitBoxReflect: 'below 30px linear-gradient(transparent 72%, rgba(255,255,255,0.22))' } as React.CSSProperties}>
        {/* la tranche : des couches de titane empilées vers l'arrière */}
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: 70, background: `linear-gradient(135deg, #9A9AA2, #3B3B40 40%, #6E6E76)`, transform: `translateZ(${-2 - i * 2}px)` }} />
        ))}
        <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
        {/* le reflet de la vitre */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 66, overflow: 'hidden', pointerEvents: 'none', transform: 'translateZ(1px)' }}>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(115deg, rgba(255,255,255,0) ${glare - 22}%, rgba(255,255,255,0.32) ${glare}%, rgba(255,255,255,0) ${glare + 18}%)`, mixBlendMode: 'screen' }} />
        </div>
      </div>
    </>
  );
}

/**
 * Le décor du rond de l'appel : il flotte et se reflète dans le sol. Les ondes
 * animées au sol ont été retirées (« ça fait trop cheap », le propriétaire).
 */
export function OrbStage({ t, x, y, size, level, children }: { t: number; x: number; y: number; size: number; level: number; children: React.ReactNode }) {
  const bob = Math.sin(t * 1.3) * 12;
  const floorY = y + size + 70;
  return (
    <>
      <ContactShadow x={x + size / 2} y={floorY - 26} w={size * 0.8} k={0.8} />
      <div style={{ position: 'absolute', left: x, top: y + bob, width: size, height: size, transform: 'translateZ(60px)', WebkitBoxReflect: 'below 50px linear-gradient(transparent 60%, rgba(255,255,255,0.28))' } as React.CSSProperties}>
        {children}
        {/* un éclat de lumière en haut à gauche : le rond devient une sphère */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(38% 30% at 32% 24%, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%), radial-gradient(70% 70% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.25) 100%)', pointerEvents: 'none' }} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ le texte */

/**
 * Un titre de campagne : gros, serré, chaque mot monte d'un masque en suivant
 * la voix, puis la ligne entière part vers le haut quand la phrase se termine.
 */
export function CineTitle({ words, serifIdx, at, out, t, size, y }: { words: { w: string; start: number }[]; serifIdx: number[]; at: number; out: number; t: number; size: number; y: number }) {
  const left = useLook().align === 'left';
  if (t < at - 0.05 || t > out + 0.05) return null;
  const outK = smooth(p(t, out - 0.35, 0.35, (x) => x));
  return (
    <div style={{ position: 'absolute', left: left ? 84 : 60, right: left ? 120 : 60, top: y, transform: `translateY(-50%) translateY(${-outK * 40}px)`, textAlign: left ? 'left' : 'center', fontSize: size, fontWeight: 600, letterSpacing: '-0.045em', lineHeight: 1.04, color: INK, opacity: 1 - outK, ...ff }}>
      {words.map((w, i) => {
        const k = expo(p(t, at + w.start - 0.06, 0.7, (x) => x));
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: '0.12em', marginBottom: '-0.12em', marginRight: '0.22em' }}>
            <span style={{ display: 'inline-block', transform: `translateY(${(1 - k) * 105}%) rotate(${(1 - k) * 4}deg)`, transformOrigin: '0 100%', ...(serifIdx.includes(i) ? { ...serif, fontWeight: 400 } : {}) }}>{w.w}</span>
          </span>
        );
      })}
    </div>
  );
}
