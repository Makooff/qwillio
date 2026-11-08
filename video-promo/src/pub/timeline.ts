/**
 * « Le coup de feu » — la pub verticale, sur le principe d'une pub d'opérateur :
 * une situation, le problème, la même situation rejouée avec Qwillio.
 *
 * Le seul endroit qui dit QUAND : la pub lit ces temps, et
 * `scripts/sfx.mjs pub` en tire la liste des sons. Tout est en secondes.
 */
export const FPS = 60;
export const DURATION = 30;

/** Un plan de texte : les mots arrivent l'un après l'autre (référence TikTok). */
export interface Line { at: number; out: number; words: string[]; serif?: number[] }

export const T = {
  // 1. La situation
  rush: { at: 0, out: 2.2 },
  rushLines: [
    { at: 0.25, out: 1.1, words: ['Vendredi,', '20', 'h.'] },
    { at: 1.1, out: 2.15, words: ['Le', 'coup', 'de', 'feu.'], serif: [3] },
  ] as Line[],

  // 2. Le téléphone sonne dans le vide
  ring: { at: 2.2, out: 4.6 },
  buzz: [2.45, 3.25],
  ringLine: { at: 3.6, out: 4.55, words: ['Personne', 'ne', 'décroche.'] } as Line,

  // 3. Les appels manqués s'empilent
  missed: { at: 4.6, out: 6.6, cards: [4.7, 5.25, 5.75] },

  // 4. Le client part
  away: { at: 6.6, out: 9.0 },
  awayLines: [
    { at: 6.7, out: 7.7, words: ['Camille', 'raccroche…'] },
    { at: 7.7, out: 8.95, words: ['…et', 'réserve', 'en', 'face.'], serif: [2, 3] },
  ] as Line[],

  // 5. La phrase
  claim: { at: 9.0, out: 11.0, line: { at: 9.1, out: 10.95, words: ['Un', 'appel', 'manqué,', 'c’est', 'une', 'table', 'vide.'], serif: [6] } as Line },

  // 6. L'ouverture de l'app
  splash: { at: 11.0, formed: 13.5, out: 14.3 },

  // 7. La même soirée, rejouée
  again: { at: 14.3, out: 15.4, line: { at: 14.4, out: 15.35, words: ['Cette', 'fois…'], serif: [1] } as Line },
  scenes: [
    { kind: 'overview', at: 15.4, out: 17.7, words: ['Elle', 'décroche.'] },
    { kind: 'booking', at: 17.7, out: 20.2, words: ['Elle', 'réserve.'], tap: 18.9 },
    { kind: 'returning', at: 20.2, out: 22.5, words: ['Elle', 'reconnaît', 'Camille.'] },
    { kind: 'summary', at: 22.5, out: 24.8, words: ['Vous', 'lisez', 'la', 'note.'] },
  ] as Array<{ kind: 'overview' | 'booking' | 'returning' | 'summary'; at: number; out: number; words: string[]; tap?: number }>,

  // 8. La chute
  payoff: { at: 24.8, out: 26.8 },
  payoffLines: [
    { at: 24.9, out: 25.85, words: ['Camille', 'a', 'sa', 'table.'] },
    { at: 25.85, out: 26.75, words: ['Vous,', 'votre', 'service.'], serif: [2] },
  ] as Line[],

  // 9. Fin
  end: { at: 26.8, formed: 29.0, line: 28.9, sub: 29.25 },
};

/** Les sons : un par événement, jamais deux fois le même (graine par occurrence). */
export type CueKind = 'buzz' | 'notify' | 'swell' | 'logo' | 'air' | 'bump' | 'land' | 'confirm' | 'tap' | 'whisper';
export interface Cue { t: number; kind: CueKind; seed: number; gain?: number }

let s = 100;
const cue = (t: number, kind: CueKind, gain = 1): Cue => ({ t, kind, seed: s++, gain });

export const CUES: Cue[] = [
  cue(T.rushLines[1].at + 0.15, 'whisper', 0.5),
  ...T.buzz.map((t) => cue(t, 'buzz')),
  ...T.missed.cards.map((t, i) => cue(t, 'notify', 0.9 - i * 0.12)),
  cue(T.awayLines[1].at + 0.45, 'whisper', 0.45),
  cue(T.claim.line.at + 1.2, 'bump', 0.55),
  cue(T.splash.at + 0.05, 'swell', 0.7),
  cue(T.splash.formed - 0.05, 'logo'),
  cue(T.again.at, 'air', 0.5),
  ...T.scenes.map((sc, i) => cue(sc.at + 0.35, i % 2 ? 'land' : 'bump', 0.8)),
  cue(T.scenes[1].tap!, 'tap'),
  cue(T.scenes[1].tap! + 0.35, 'confirm', 0.85),
  cue(T.payoffLines[1].at, 'whisper', 0.4),
  cue(T.end.at + 0.05, 'swell', 0.6),
  cue(T.end.formed - 0.05, 'logo'),
];
