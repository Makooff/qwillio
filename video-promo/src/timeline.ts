/**
 * Le seul endroit où le film dit QUAND.
 *
 * Les scènes lisent ces temps, et `scripts/sfx.mjs` lit `CUES` pour écrire la
 * liste des sons : déplacer un instant ici déplace l'image ET son bruit.
 * Tout est en secondes.
 */
export const FPS = 60;
export const DURATION = 42;

export const T = {
  // Ouverture : le téléphone sonne pendant que le gérant travaille.
  ring1: 0.5,
  ring2: 2.6,
  missed: [1.5, 2.9, 3.7, 4.4],
  openingEnd: 5.5,

  // L'animation d'ouverture de l'app.
  splashStart: 5.6,
  splashFormed: 8.1, // 2,5 s de trajet, comme SplashScreen.tsx
  splashOut: 8.9,

  // Scène 1 : la carte « En cours », seule à l'écran.
  callIn: 9.0,
  callAnswered: 9.6,
  lines: [
    { who: 'user', at: 10.2, end: 11.8, text: 'Bonjour, vous auriez une place samedi matin pour une coupe ?' },
    { who: 'ai', at: 12.2, end: 14.0, text: 'Samedi, j’ai 9 h 30 ou 11 h. Lequel vous arrange ?' },
    { who: 'user', at: 14.4, end: 15.0, text: '9 h 30, parfait.' },
    { who: 'ai', at: 15.4, end: 17.2, text: 'C’est noté pour samedi 9 h 30. Je vous envoie la confirmation par SMS.' },
  ],
  bookedChip: 17.5, // « Rendez-vous créé » sort de la carte
  callOut: 18.2,

  // Scène 2 : la grille de l'agenda, et la carte « À venir ».
  gridIn: 18.3,
  badgeBump: 19.6,
  upcomingIn: 20.3,
  gridOut: 24.0,

  // Scène 3 : la fiche d'appel, pièce par pièce.
  sheetIn: 24.1,
  stats: [24.5, 24.62, 24.74, 24.86],
  chipsIn: 25.4,
  scoreIn: 25.8,
  summaryStart: 26.4,
  summaryEnd: 28.6,
  bookingChip: 29.0,
  sheetOut: 30.6,

  // Scène 4 : le mois.
  monthIn: 30.7,
  monthOut: 36.3,

  // Fin.
  endSplashStart: 36.8,
  endSplashFormed: 39.3,
  endLine: 39.8,
  endSub: 40.3,
  fadeOut: 41.3,
} as const;

/**
 * Les sons. Un son marque un ÉVÉNEMENT, jamais chaque mot qui apparaît, et
 * chaque occurrence a sa graine (hauteur, durée, place en stéréo) : aucun son
 * n'est rejoué à l'identique.
 */
export type CueKind =
  | 'ring' // la sonnerie, deux fois seulement
  | 'notify' // un appel manqué : verre léger
  | 'swell' // les lobes se mettent en route
  | 'logo' // le logo se forme
  | 'air' // un élément entre en scène
  | 'answer' // l'appel est décroché
  | 'voice' // une réplique commence
  | 'bump' // une pastille ou une puce qui rebondit
  | 'land' // une carte se pose
  | 'confirm' // validation : deux notes
  | 'slide'; // une barre qui se remplit, un panneau qui glisse

export interface Cue { t: number; kind: CueKind; seed: number; gain?: number }

let s = 1;
const cue = (t: number, kind: CueKind, gain = 1): Cue => ({ t, kind, seed: s++, gain });

export const CUES: Cue[] = [
  cue(T.ring1, 'ring'),
  cue(T.ring2, 'ring', 0.8),
  ...T.missed.map((t, i) => cue(t, 'notify', 0.9 - i * 0.1)),
  cue(T.splashStart, 'swell', 0.7),
  cue(T.splashFormed - 0.05, 'logo'),
  cue(T.callIn, 'air', 0.6),
  cue(T.callAnswered, 'answer'),
  ...T.lines.map((l) => cue(l.at, 'voice', l.who === 'ai' ? 0.8 : 0.55)),
  cue(T.bookedChip, 'bump'),
  cue(T.gridIn, 'air', 0.55),
  cue(T.badgeBump, 'bump', 0.9),
  cue(T.upcomingIn + 0.35, 'land'),
  cue(T.sheetIn, 'land', 0.75),
  cue(T.stats[0], 'land', 0.45),
  cue(T.stats[2], 'land', 0.4),
  cue(T.scoreIn, 'slide', 0.6),
  cue(T.bookingChip, 'confirm'),
  cue(T.monthIn, 'air', 0.55),
  cue(T.monthIn + 0.4, 'slide', 0.5),
  cue(T.endSplashStart, 'swell', 0.6),
  cue(T.endSplashFormed - 0.05, 'logo'),
];
