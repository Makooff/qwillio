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

  // L'animation d'ouverture de l'app, puis le logo devient celui de la barre latérale.
  splashStart: 5.6,
  splashFormed: 8.1, // 2,5 s de trajet, comme SplashScreen.tsx
  shellIn: 9.0,

  // Page Appels : l'appel en direct.
  callAnswered: 10.2,
  lines: [
    { who: 'user', at: 10.8, end: 12.4, text: 'Bonjour, vous auriez une place samedi matin pour une coupe ?' },
    { who: 'ai', at: 12.9, end: 14.8, text: 'Samedi, j’ai 9 h 30 ou 11 h. Lequel vous arrange ?' },
    { who: 'user', at: 15.3, end: 15.9, text: '9 h 30, parfait.' },
    { who: 'ai', at: 16.3, end: 18.2, text: 'C’est noté pour samedi 9 h 30. Je vous envoie la confirmation par SMS.' },
  ],

  // Rendez-vous : le créneau tombe dans l'agenda.
  clickBookings: 19.4,
  bookingsIn: 19.6,
  badgeBump: 21.2,
  upcomingIn: 21.9,

  // Retour aux appels : la fiche et son résumé.
  clickCalls: 25.6,
  callsIn: 25.8,
  rowIn: 26.5,
  clickRow: 27.6,
  drawerIn: 27.8,
  summaryStart: 28.5,
  summaryEnd: 30.3,
  bookingChip: 30.6,

  // Vue d'ensemble : le mois.
  clickOverview: 32.6,
  overviewIn: 32.8,

  // Fin.
  outro: 36.6,
  endSplashStart: 37.0,
  endSplashFormed: 39.5,
  endLine: 40.0,
  endSub: 40.5,
  fadeOut: 41.3,
} as const;

/**
 * Les sons. Moins nombreux qu'avant, et jamais deux fois le même : chaque
 * famille a son timbre, et chaque occurrence sa graine, qui fait varier la
 * hauteur et l'attaque. Un son marque un ÉVÉNEMENT (un appel qui arrive, un
 * clic, un rendez-vous qui se pose), pas chaque mot qui apparaît.
 */
export type CueKind =
  | 'ring' // la sonnerie, deux fois seulement
  | 'notify' // un appel manqué : verre léger
  | 'swell' // les lobes se mettent en route
  | 'logo' // le logo se forme : pop rond et grave
  | 'air' // l'interface apparaît
  | 'answer' // l'appel est décroché
  | 'voice' // une réplique commence : petite note boisée
  | 'click' // clic de souris
  | 'bump' // la pastille passe de 1 à 2
  | 'land' // une carte se pose
  | 'confirm' // validation : deux notes
  | 'slide'; // un panneau glisse

export interface Cue { t: number; kind: CueKind; seed: number; gain?: number }

let s = 1;
const cue = (t: number, kind: CueKind, gain = 1): Cue => ({ t, kind, seed: s++, gain });

export const CUES: Cue[] = [
  cue(T.ring1, 'ring'),
  cue(T.ring2, 'ring', 0.8),
  ...T.missed.map((t, i) => cue(t, 'notify', 0.9 - i * 0.1)),
  cue(T.splashStart, 'swell', 0.7),
  cue(T.splashFormed - 0.05, 'logo'),
  cue(T.shellIn + 0.1, 'air', 0.6),
  cue(T.callAnswered, 'answer'),
  ...T.lines.map((l) => cue(l.at, 'voice', l.who === 'ai' ? 0.8 : 0.55)),
  cue(T.clickBookings, 'click'),
  cue(T.badgeBump, 'bump'),
  cue(T.upcomingIn, 'land'),
  cue(T.clickCalls, 'click', 0.9),
  cue(T.rowIn, 'land', 0.7),
  cue(T.clickRow, 'click', 0.85),
  cue(T.drawerIn, 'slide', 0.7),
  cue(T.bookingChip, 'confirm'),
  cue(T.clickOverview, 'click', 0.85),
  cue(T.outro, 'air', 0.5),
  cue(T.endSplashStart, 'swell', 0.6),
  cue(T.endSplashFormed - 0.05, 'logo'),
];
