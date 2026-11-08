/**
 * « Elle ne fait pas que décrocher » — la pub n° 2, verticale.
 *
 * Six fonctions réelles du produit, une scène chacune, sur le même langage
 * visuel que la pub n° 1 (fond clair, cadres arrondis, iPhone du kit, rond de
 * l'appel). Chaque phrase est lue par Sarah ; la frise se cale sur la durée de
 * sa lecture (scripts/cartesia-v4.mjs). Le seul endroit qui dit QUAND.
 *
 * Ce que chaque scène affirme, et où le code le fait :
 *  - reconnaît vos clients .......... caller-memory.service, call-brief
 *  - prend, déplace, annule ......... voice-tools (book / reschedule / cancel)
 *  - trois langues ................... system-prompt (fr / en / nl)
 *  - urgence transférée .............. voice-tools (transferCall)
 *  - note chaque message ............. captureLead, lead-alert.service
 *  - apprend ce qu'elle ignore ....... knowledge-gap.service
 */
import voices from './voices.ts';

export const FPS = 60;

export interface VLine { at: number; id: string; out: number }
const say = (at: number, id: string, hold = 0.3): VLine => ({ at, id, out: at + voices.lines[id].duration + hold });
export interface Clip { at: number; id: string; end: number }
const clip = (at: number, id: string): Clip => ({ at, id, end: at + voices.clips[id].duration });

export const T = {
  hook: { at: 0, out: 3.3 },
  v1: say(0.35, 'v1', 0.4),

  // 1. Elle reconnaît vos clients.
  known: { at: 3.3, out: 8.6, ring: { at: 3.6, out: 4.9 }, answer: 4.9 },
  v2: say(3.45, 'v2', 0.25),
  k1: clip(5.15, 'k1'),

  // 2. Elle prend, déplace et annule vos rendez-vous.
  agenda: { at: 8.6, out: 12.6, bump: 9.9, upcoming: 10.3 },
  v3: say(8.75, 'v3', 0.3),

  // 3. Trois langues.
  langs: { at: 12.6, out: 21.1 },
  v4: say(12.75, 'v4', 0.15),
  k3: clip(15.6, 'k3'),
  k4: clip(17.95, 'k4'),

  // 4. Une urgence ? Elle vous la passe.
  urgent: { at: 21.1, out: 24.8, ring: { at: 22.0, out: 24.6 } },
  v5: say(21.25, 'v5', 0.25),

  // 5. Elle note chaque message.
  message: { at: 24.8, out: 27.9, notif: 25.3 },
  v6: say(24.95, 'v6', 0.35),

  // 6. Ce qu'elle ne sait pas, elle l'apprend.
  learn: { at: 27.9, out: 32.4, typed: 29.4, learned: 31.0 },
  v7: say(28.05, 'v7', 0.25),

  end: { at: 32.4, formed: 34.2 },
  v8: say(34.0, 'v8', 1.6),
};

export const DURATION = T.v8.out + 0.8;
export const VLINES: VLine[] = [T.v1, T.v2, T.v3, T.v4, T.v5, T.v6, T.v7];
export const CLIPS: Clip[] = [T.k1, T.k3, T.k4];

/** Les scènes, dans l'ordre : chaque passage a son souffle. */
export const SCENES = [T.hook, T.known, T.agenda, T.langs, T.urgent, T.message, T.learn];

/* ------------------------------------------------------------------ le son */

export type CueKind = 'buzz' | 'swell' | 'logo' | 'confirm' | 'bump' | 'tap' | 'whoosh' | 'riser' | 'click' | 'sparkle';
export interface Cue { t: number; kind: CueKind; seed: number; gain?: number }
const buzzes = (r: { at: number; out: number }, seed: number) => {
  const out: Cue[] = [];
  for (let s = r.at, i = 0; s < r.out - 0.4; s += 1.4, i++) out.push({ t: s, kind: 'buzz', seed: seed + i, gain: 0.6 });
  return out;
};
export const CUES: Cue[] = [
  { t: 0.05, kind: 'swell', seed: 500, gain: 0.45 },
  ...SCENES.slice(1).map((s, i) => ({ t: s.at - 0.12, kind: 'whoosh' as const, seed: 510 + i, gain: 0.4 })),
  ...VLINES.map((l, i) => ({ t: l.at, kind: 'bump' as const, seed: 530 + i, gain: 0.26 })),
  ...buzzes(T.known.ring, 540),
  { t: T.known.answer, kind: 'click', seed: 550, gain: 0.7 },
  { t: T.agenda.bump, kind: 'bump', seed: 551, gain: 0.6 },
  { t: T.agenda.upcoming, kind: 'sparkle', seed: 552, gain: 0.45 },
  { t: T.k3.at - 0.1, kind: 'tap', seed: 553, gain: 0.35 },
  { t: T.k4.at - 0.1, kind: 'tap', seed: 554, gain: 0.35 },
  ...buzzes(T.urgent.ring, 560),
  { t: T.learn.learned, kind: 'confirm', seed: 570, gain: 0.7 },
  { t: T.end.at - 1.1, kind: 'riser', seed: 571, gain: 0.5 },
  { t: T.end.at + 0.02, kind: 'swell', seed: 572, gain: 0.5 },
  { t: T.end.formed - 0.05, kind: 'logo', seed: 573 },
];
