/**
 * « Samedi, 20 h 12 » — la pub verticale v3.
 *
 * Une seule cuisine, filmée plan après plan (le même tournage Mixkit), posée
 * dans un cadre arrondi sur le fond clair du site. Le téléphone est celui du
 * kit iOS, le rond de l'appel celui du fichier Figma Make « Shader Reminder ».
 * Une voix narrative lit chaque phrase affichée (scripts/narration.mjs) : la
 * frise se cale sur sa durée réelle. L'appel vient de `src/pub/call.ts`, voix
 * de synthèse aujourd'hui, enregistrement réel demain (scripts/transcribe-call.mjs).
 * Tout se recale seul. Le seul endroit qui dit QUAND, en secondes.
 */
import call from '../pub/call.ts';
import narration from './narration.ts';

export const FPS = 60;

/** Une phrase lue : `n` est son index dans narration.ts. */
export interface NLine { at: number; n: number; out: number }
const say = (at: number, n: number, hold = 0.35): NLine => ({ at, n, out: at + narration[n].duration + hold });

/** Un plan filmé : quel fichier, à partir de quelle seconde du rush. */
export interface Shot { at: number; out: number; name: string; from: number }

/** Les répliques de l'appel. Un enregistrement réel porte ses propres temps
 * (`offset`) : on garde alors ses silences tels qu'ils ont été dits. */
const CALL_AT = 15.4;
type Raw = (typeof call)[number] & { offset?: number };
const raw = call as Raw[];
const base = raw[0].offset ?? 0;
let cursor = CALL_AT;
export const CALL = raw.map((l) => {
  const at = l.offset !== undefined ? CALL_AT + l.offset - base : cursor;
  cursor = at + l.duration + 0.18;
  return { ...l, at, end: at + l.duration };
});
const E = CALL[CALL.length - 1].end + 0.45; // la fin de l'appel

export const T = {
  // 01 · Sans Qwillio : le coup de feu, le téléphone, l'appel perdu.
  shots1: [
    { at: 0, out: 2.6, name: 'dough', from: 0.6 },
    { at: 2.6, out: 4.6, name: 'sauce', from: 0.5 },
    { at: 4.6, out: 7.3, name: 'oven', from: 1.6 },
    { at: 7.3, out: 9.6, name: 'ovenhot', from: 0.6 },
  ] as Shot[],
  frameIn: 0.0,
  n1: say(0.25, 0),
  phoneIn: 1.5,
  ring: { at: 2.0, out: 6.9 },
  n2: say(3.0, 1),
  n3: say(4.5, 2, 0.25),
  missed: 6.9,
  n4: say(7.5, 3, 0.3),
  out1: 9.6,

  // L'ouverture de l'app
  splash: { at: 9.6, formed: 11.25, out: 11.9 },

  // 02 · Avec Qwillio : la même soirée.
  shots2: [{ at: 11.9, out: 15.2, name: 'dough', from: 4.6 }] as Shot[],
  n5: say(12.1, 4, 0.1),
  phone2In: 12.2,
  ring2: { at: 12.8, out: 15.1 },
  n6: say(13.9, 5, 0.05),
  call: { at: 15.2, answered: CALL_AT, out: E },

  // Ce qui reste après l'appel.
  booked: { at: E, out: E + 3.55, shot: { name: 'knead', from: 2 } },
  n7: say(E + 0.2, 6, 0.2),
  mac: { at: E + 3.55, out: E + 6.6, bump: E + 4.5, upcoming: E + 4.9 },
  n8: say(E + 3.75, 7, 0.9),
  payoff: { at: E + 6.6, out: E + 9.75, shot: { name: 'table', from: 0.3 } },
  n9: say(E + 6.8, 8, 0.1),
  n10: say(E + 8.2, 9, 0.2),

  end: { at: E + 9.75, formed: E + 11.35, line: E + 11.0 },
  n11: say(E + 10.5, 10, 1.4),
};

export const DURATION = T.n11.out + 0.9;
export const NLINES: NLine[] = [T.n1, T.n2, T.n3, T.n4, T.n5, T.n6, T.n7, T.n8, T.n9, T.n10];

/** Pendant l'appel, la cuisine continue : des plans du même tournage, à la
 * suite, chacun plus court que son rush (sinon l'image fige). La liste tourne
 * aussi longtemps que dure l'appel. */
const CALL_POOL = [
  { name: 'pepperoni', from: 0.3, len: 6.4 },
  { name: 'ovenhot', from: 0.3, len: 6.4 },
  { name: 'cheese', from: 0.4, len: 7.6 },
  { name: 'knead', from: 0.5, len: 11 },
  { name: 'sauce', from: 0.3, len: 5.6 },
];
export const CALL_SHOTS: Shot[] = [];
for (let s = T.call.at, i = 0; s < T.call.out; i++) {
  const c = CALL_POOL[i % CALL_POOL.length];
  const len = Math.min(c.len - 0.3, 3.6);
  CALL_SHOTS.push({ at: s, out: Math.min(T.call.out, s + len), name: c.name, from: c.from });
  s += len;
}

/* ------------------------------------------------------------------ le son */

/** Les sons de synthèse (scripts/sounds.py). Aucune sonnerie Apple : le
 * téléphone vibre sur le plan de travail. Chaque coupe a son souffle, chaque
 * phrase son pop, chaque bascule sa montée et son impact. */
export type CueKind = 'buzz' | 'swell' | 'logo' | 'confirm' | 'bump' | 'tap' | 'whoosh' | 'riser' | 'click' | 'sparkle';
export interface Cue { t: number; kind: CueKind; seed: number; gain?: number }
const buzzes = (from: number, to: number, seed: number) => {
  const out: Cue[] = [];
  for (let s = from, i = 0; s < to - 0.4; s += 1.5, i++) out.push({ t: s, kind: 'buzz', seed: seed + i, gain: 0.6 });
  return out;
};
const cuts = [
  ...T.shots1.slice(1).map((s) => s.at),
  T.shots2[0].at,
  ...CALL_SHOTS.slice(1).map((s) => s.at),
  T.booked.at, T.mac.at, T.payoff.at,
];
export const CUES: Cue[] = [
  { t: T.ring.at, kind: 'tap', seed: 380, gain: 0.5 },
  ...buzzes(T.ring.at, T.ring.out, 300),
  { t: T.missed, kind: 'sparkle', seed: 381, gain: 0.35 },
  { t: T.out1 - 1.3, kind: 'riser', seed: 382, gain: 0.55 },
  { t: T.splash.at + 0.02, kind: 'swell', seed: 321, gain: 0.55 },
  { t: T.splash.formed - 0.05, kind: 'logo', seed: 322 },
  { t: T.ring2.at, kind: 'tap', seed: 383, gain: 0.5 },
  ...buzzes(T.ring2.at, T.ring2.out, 330),
  { t: T.call.at + 0.05, kind: 'click', seed: 384, gain: 0.7 },
  { t: T.booked.at + 0.15, kind: 'confirm', seed: 340, gain: 0.75 },
  { t: T.mac.bump, kind: 'bump', seed: 341, gain: 0.6 },
  { t: T.mac.upcoming, kind: 'sparkle', seed: 342, gain: 0.45 },
  { t: T.end.at - 1.1, kind: 'riser', seed: 343, gain: 0.5 },
  { t: T.end.at + 0.02, kind: 'swell', seed: 344, gain: 0.5 },
  { t: T.end.formed - 0.05, kind: 'logo', seed: 345 },
];
