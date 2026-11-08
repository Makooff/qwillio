/**
 * « Samedi, 20 h 12 » — la pub verticale v3.
 *
 * Une seule cuisine, filmée plan après plan (le même tournage Mixkit), posée
 * dans un cadre arrondi sur le fond clair du site. Le téléphone est celui du
 * kit iOS. L'appel est celui de `src/pub/call.ts` : aujourd'hui des voix de
 * synthèse, demain l'enregistrement réel transcrit par `scripts/transcribe-call.mjs`.
 * Tout se recale seul sur la durée de l'appel.
 * Le seul endroit qui dit QUAND. Tout est en secondes.
 */
import call from '../pub/call.ts';

export const FPS = 60;

export interface Line { at: number; out: number; words: string[]; serif?: number[] }

/** Un plan filmé : quel fichier, à partir de quelle seconde du rush. */
export interface Shot { at: number; out: number; name: string; from: number }

/** Les répliques. Un enregistrement réel porte ses propres temps (`offset`) :
 * on garde alors ses silences tels qu'ils ont été dits. */
const CALL_AT = 21.2;
type Raw = (typeof call)[number] & { offset?: number };
const raw = call as Raw[];
const base = raw[0].offset ?? 0;
let cursor = CALL_AT;
export const CALL = raw.map((l) => {
  const at = l.offset !== undefined ? CALL_AT + l.offset - base : cursor;
  cursor = at + l.duration + 0.3;
  return { ...l, at, end: at + l.duration };
});
const callEnd = CALL[CALL.length - 1].end + 0.6;

export const T = {
  // 1. Le coup de feu
  shots1: [
    { at: 0, out: 3.8, name: 'dough', from: 0.6 },
    { at: 3.8, out: 6.6, name: 'sauce', from: 0.4 },
    { at: 6.6, out: 10.6, name: 'oven', from: 1.2 },
    { at: 10.6, out: 13.4, name: 'ovenhot', from: 0.5 },
  ] as Shot[],
  frameIn: 0.15,
  l1: { at: 0.5, out: 3.6, words: ['Samedi,', '20 h 12.'], serif: [1] } as Line,
  phoneIn: 2.4,
  ring: { at: 3.1, out: 9.4 },
  l2: { at: 3.9, out: 6.4, words: ['Le', 'téléphone', 'vibre.'], serif: [2] } as Line,
  l3: { at: 6.7, out: 9.3, words: ['Les', 'mains', 'dans', 'la', 'pâte.'], serif: [4] } as Line,
  missed: 9.5,
  l4: { at: 9.6, out: 13.2, words: ['Julie', 'réserve', 'en', 'face.'], serif: [2, 3] } as Line,
  out1: 13.4,

  // 2. L'ouverture de l'app
  splash: { at: 13.4, formed: 15.9, out: 16.9 },

  // 3. Même soirée, avec Qwillio
  shots2: [
    { at: 16.9, out: 21.2, name: 'dough', from: 4.4 },
  ] as Shot[],
  l5: { at: 17.1, out: 19.6, words: ['Même', 'soirée.'], serif: [1] } as Line,
  ring2: { at: 18.2, out: 21.0 },
  l6: { at: 19.6, out: 21.1, words: ['Cette', 'fois…'], serif: [1] } as Line,
  call: { at: 21.0, answered: CALL_AT, out: callEnd },

  // 4. Ce qui reste après l'appel
  booked: { at: callEnd, out: callEnd + 3.2, shot: { name: 'knead', from: 2 } },
  l7: { at: callEnd + 0.15, out: callEnd + 3.0, words: ['Réservé.', 'Les', 'mains', 'toujours', 'dans', 'la', 'pâte.'], serif: [6] } as Line,
  mac: { at: callEnd + 3.2, out: callEnd + 7.6, bump: callEnd + 4.4, upcoming: callEnd + 5.0 },
  l8: { at: callEnd + 3.35, out: callEnd + 7.45, words: ['Déjà', 'dans', 'votre', 'agenda.'], serif: [3] } as Line,
  payoff: { at: callEnd + 7.6, out: callEnd + 10.6, shot: { name: 'table', from: 0.3 } },
  l9: { at: callEnd + 7.75, out: callEnd + 9.15, words: ['Julie', 'a', 'sa', 'table.'] } as Line,
  l10: { at: callEnd + 9.15, out: callEnd + 10.45, words: ['Vous,', 'vos', 'pizzas.'], serif: [2] } as Line,

  end: { at: callEnd + 10.6, formed: callEnd + 12.8, line: callEnd + 12.6, sub: callEnd + 13.0 },
};

export const DURATION = T.end.at + 3.6;

/** Pendant l'appel, la cuisine continue : des plans du même tournage, à la
 * suite, jamais plus longs que leur rush (sinon l'image fige). La liste tourne
 * aussi longtemps que dure l'appel, quelle que soit sa longueur. */
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
  const len = Math.min(c.len - 0.3, 4.6);
  CALL_SHOTS.push({ at: s, out: Math.min(T.call.out, s + len), name: c.name, from: c.from });
  s += len;
}

/** Les phrases à l'écran : un pop discret à chacune. */
const LINES: Line[] = [T.l1, T.l2, T.l3, T.l4, T.l5, T.l6, T.l7, T.l8, T.l9, T.l10];

/** Les sons de synthèse (scripts/sounds.py). Aucune sonnerie Apple : le
 * téléphone vibre sur le plan de travail, c'est tout. */
export type CueKind = 'buzz' | 'notify' | 'swell' | 'logo' | 'confirm' | 'bump' | 'tap';
export interface Cue { t: number; kind: CueKind; seed: number; gain?: number }
const buzzes = (from: number, to: number, seed: number) => {
  const out: Cue[] = [];
  for (let s = from, i = 0; s < to - 0.5; s += 1.5, i++) out.push({ t: s, kind: 'buzz', seed: seed + i, gain: 0.55 });
  return out;
};
export const CUES: Cue[] = [
  ...LINES.map((l, i) => ({ t: l.at, kind: 'bump' as const, seed: 360 + i, gain: 0.32 })),
  { t: T.ring.at + 0.1, kind: 'tap', seed: 380, gain: 0.5 },
  { t: T.ring2.at, kind: 'tap', seed: 381, gain: 0.5 },
  ...buzzes(T.ring.at, T.ring.out, 300),
  { t: T.splash.at + 0.05, kind: 'swell', seed: 321, gain: 0.6 },
  { t: T.splash.formed - 0.05, kind: 'logo', seed: 322 },
  ...buzzes(T.ring2.at, T.ring2.out, 330),
  { t: T.mac.bump, kind: 'bump', seed: 341, gain: 0.6 },
  { t: T.end.at + 0.05, kind: 'swell', seed: 342, gain: 0.5 },
  { t: T.end.formed - 0.05, kind: 'logo', seed: 343 },
];
