/**
 * « Le Comptoir, samedi 20 h » — la pub verticale, version mise en scène.
 *
 * Construite comme une pub d'opérateur : un hook qui intrigue, la situation
 * filmée (le coup de feu, la cliente qui attend puis raccroche), puis la même
 * soirée rejouée avec Qwillio, avec les vraies voix de l'appel.
 * Le seul endroit qui dit QUAND. Tout est en secondes.
 */
import call from '../pub/call.ts';

export const FPS = 60;

/** Un plan de texte : les mots sortent du flou l'un après l'autre. */
export interface Line { at: number; out: number; words: string[]; serif?: number[] }

/** Les répliques, posées bout à bout avec un souffle entre elles. */
const GAP = 0.3;
let cursor = 18.4;
export const CALL = call.map((l) => {
  const at = cursor;
  cursor = at + l.duration + GAP;
  return { ...l, at, end: at + l.duration };
});
const callEnd = CALL[CALL.length - 1].end + 0.35;

export const T = {
  hook: { at: 0, out: 2.6, video: 'grill', from: 2 },
  hookLine: { at: 0.45, out: 2.55, words: ['Ce', 'coup', 'de', 'fil', 'vaut', 'une', 'table', 'de', 'quatre.'], serif: [8] } as Line,
  incoming: { at: 0.25, out: 4.8 },

  serve: { at: 2.6, out: 4.8, video: 'serve', from: 3 },
  serveLine: { at: 2.7, out: 4.75, words: ['Mais', 'personne', 'ne', 'décroche.'], serif: [3] } as Line,

  julie: { at: 4.8, out: 7.6, video: 'julie', from: 0 },
  julieLine: { at: 4.9, out: 7.55, words: ['Julie', 'rappelle.'], serif: [1] } as Line,

  hangup: { at: 7.6, out: 9.6, video: 'hangup', from: 1.6 },
  hangupLine: { at: 7.7, out: 9.55, words: ['Puis', 'elle', 'raccroche.'], serif: [2] } as Line,

  missed: { at: 9.6, out: 11.8, cards: [9.9, 10.55] },

  away: { at: 11.8, out: 13.6 },
  awayLine: { at: 11.9, out: 13.55, words: ['…et', 'réserve', 'en', 'face.'], serif: [2, 3] } as Line,

  splash: { at: 13.6, formed: 16.1, out: 16.9 },

  again: { at: 16.9, out: 18.0 },
  againLine: { at: 16.95, out: 17.95, words: ['Cette', 'fois…'], serif: [1] } as Line,

  call: { at: 18.0, answered: 18.15, out: callEnd },

  sms: { at: callEnd, out: callEnd + 2.0 },
  owner: { at: callEnd + 2.0, out: callEnd + 3.8 },

  mac: { at: callEnd + 3.8, out: callEnd + 8.0, bump: callEnd + 5.0, upcoming: callEnd + 5.6 },
  macLine: { at: callEnd + 3.9, out: callEnd + 7.95, words: ['Déjà', 'dans', 'votre', 'agenda.'], serif: [3] } as Line,

  payoff: { at: callEnd + 8.0, out: callEnd + 10.4 },
  payoffLines: [
    { at: callEnd + 8.1, out: callEnd + 9.25, words: ['Julie', 'a', 'sa', 'table.'] },
    { at: callEnd + 9.25, out: callEnd + 10.35, words: ['Vous,', 'votre', 'service.'], serif: [2] },
  ] as Line[],

  end: { at: callEnd + 10.4, formed: callEnd + 12.6, line: callEnd + 12.5, sub: callEnd + 12.85 },
};

export const DURATION = T.end.at + 3.4;

/** Les sons de synthèse (scripts/sounds.py) ; les autres viennent de Mixkit. */
export type CueKind = 'swell' | 'logo' | 'hang';
export interface Cue { t: number; kind: CueKind; seed: number; gain?: number }
export const CUES: Cue[] = [
  { t: 9.05, kind: 'hang', seed: 201, gain: 0.7 },
  { t: T.splash.at + 0.05, kind: 'swell', seed: 202, gain: 0.7 },
  { t: T.splash.formed - 0.05, kind: 'logo', seed: 203 },
  { t: T.end.at + 0.05, kind: 'swell', seed: 204, gain: 0.6 },
  { t: T.end.formed - 0.05, kind: 'logo', seed: 205 },
];
