/**
 * « Elle ne fait pas que décrocher » — la pub n° 2, verticale.
 *
 * Huit fonctions du produit, une scène chacune, dans le langage de la pub n° 1
 * (fond clair, cadres arrondis, iPhone du kit, rond de l'appel). Chaque phrase
 * est lue par Sarah ; la frise est construite À LA SUITE, scène après scène, à
 * partir des durées réelles des voix (scripts/cartesia-v4.mjs) : une scène ne
 * peut pas déborder sur la suivante, c'est ce qui faisait passer « Goedenavond »
 * par-dessus « Hello ».
 *
 * Ce que chaque scène affirme, et où le code le fait :
 *  - reconnaît vos clients .......... caller-memory.service, call-brief
 *  - prend, déplace, annule ......... voice-tools (book / reschedule / cancel)
 *  - trois langues ................... system-prompt (fr / en / nl)
 *  - urgence transférée .............. voice-tools (transferCall)
 *  - note chaque message ............. captureLead, lead-alert.service
 *  - apprend ce qu'elle ignore ....... knowledge-gap.service
 *  - parle avec votre voix ........... voice-clone.service (clonage ElevenLabs)
 *  - les meilleurs moteurs ........... Deepgram Nova-3, modèles OpenAI, Cartesia Sonic
 */
import voices from './voices.ts';

export const FPS = 60;

export interface VLine { at: number; id: string; out: number }
const say = (at: number, id: string, hold = 0.3): VLine => ({ at, id, out: at + voices.lines[id].duration + hold });
export interface Clip { at: number; id: string; end: number }
const clip = (at: number, id: string): Clip => ({ at, id, end: at + voices.clips[id].duration });
const len = (id: string) => voices.lines[id].duration;

/* La frise, posée bout à bout. */
const hookOut = 0.35 + len('v1') + 0.5;
const kAt = hookOut + 0.15 + len('v2') + 1.4; // le téléphone sonne, elle décroche
const k1 = clip(kAt + 0.25, 'k1');
const knownOut = k1.end + 0.7;
const agendaOut = knownOut + Math.max(4, len('v3') + 1.3);
const k3 = clip(agendaOut + 0.15 + len('v4') + 0.35, 'k3');
const k4 = clip(k3.end + 0.55, 'k4');
const langsOut = k4.end + 0.6;
const urgentOut = langsOut + Math.max(3.6, len('v5') + 1.4);
const messageOut = urgentOut + Math.max(3.4, len('v6') + 2.0);
const learnOut = messageOut + Math.max(4.4, len('v7') + 2.5);
const cloneOut = learnOut + Math.max(3.6, len('v9') + 1.9);
const techOut = cloneOut + len('v10') + 1.1;

export const T = {
  hook: { at: 0, out: hookOut },
  v1: say(0.35, 'v1', 0.4),

  known: { at: hookOut, out: knownOut, ring: { at: hookOut + 0.3, out: kAt }, answer: kAt },
  v2: say(hookOut + 0.15, 'v2', 0.25),
  k1,

  agenda: { at: knownOut, out: agendaOut, bump: knownOut + 1.3, upcoming: knownOut + 1.7 },
  v3: say(knownOut + 0.15, 'v3', 0.3),

  langs: { at: agendaOut, out: langsOut },
  v4: say(agendaOut + 0.15, 'v4', 0.15),
  k3,
  k4,

  urgent: { at: langsOut, out: urgentOut, ring: { at: langsOut + 0.9, out: urgentOut - 0.2 } },
  v5: say(langsOut + 0.15, 'v5', 0.25),

  message: { at: urgentOut, out: messageOut },
  v6: say(urgentOut + 0.15, 'v6', 0.35),

  learn: { at: messageOut, out: learnOut, typed: messageOut + 1.5, learned: messageOut + 3.1 },
  v7: say(messageOut + 0.15, 'v7', 0.25),

  clone: { at: learnOut, out: cloneOut, ready: learnOut + 2.2 },
  v9: say(learnOut + 0.15, 'v9', 0.3),

  tech: { at: cloneOut, out: techOut },
  v10: say(cloneOut + 0.15, 'v10', 0.3),

  end: { at: techOut, formed: techOut + 1.8 },
  v8: say(techOut + 1.6, 'v8', 1.6),
};

export const DURATION = T.v8.out + 0.8;
export const VLINES: VLine[] = [T.v1, T.v2, T.v3, T.v4, T.v5, T.v6, T.v7, T.v9, T.v10];
export const CLIPS: Clip[] = [T.k1, T.k3, T.k4];

/** Les scènes, dans l'ordre : chaque passage a son souffle. */
export const SCENES = [T.hook, T.known, T.agenda, T.langs, T.urgent, T.message, T.learn, T.clone, T.tech];

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
  ...VLINES.map((l, i) => ({ t: l.at, kind: 'bump' as const, seed: 530 + i, gain: 0.26 })),
  ...buzzes(T.known.ring, 540),
  { t: T.known.answer, kind: 'click', seed: 550, gain: 0.7 },
  { t: T.agenda.bump, kind: 'bump', seed: 551, gain: 0.6 },
  { t: T.agenda.upcoming, kind: 'sparkle', seed: 552, gain: 0.45 },
  { t: T.k3.at - 0.1, kind: 'tap', seed: 553, gain: 0.35 },
  { t: T.k4.at - 0.1, kind: 'tap', seed: 554, gain: 0.35 },
  ...buzzes(T.urgent.ring, 560),
  { t: T.message.at + 0.9, kind: 'sparkle', seed: 565, gain: 0.35 },
  { t: T.learn.learned, kind: 'confirm', seed: 570, gain: 0.7 },
  { t: T.clone.ready, kind: 'confirm', seed: 575, gain: 0.6 },
  { t: T.end.at - 1.1, kind: 'riser', seed: 571, gain: 0.5 },
  { t: T.end.at + 0.02, kind: 'swell', seed: 572, gain: 0.5 },
  { t: T.end.formed - 0.05, kind: 'logo', seed: 573 },
];
