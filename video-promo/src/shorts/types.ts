export type Word = { w: string; start: number };
export type Narr = { file: string; duration: number; serif: number[]; words: Word[] };
export type Line = { who: 'agent' | 'caller'; tag?: string; file: string; duration: number; words: Word[] };
export type Visual =
  | { kind: 'type'; tag?: string }
  | { kind: 'ring'; name: string; initials: string; time: string; sub?: string; footage?: string; missed?: boolean }
  | { kind: 'orb'; chip?: { name: string; initials: string; sub: string; badge: string } }
  | { kind: 'notif'; title: string; desc: string }
  | { kind: 'langs' }
  | { kind: 'learn'; question: string; answer: string }
  | { kind: 'message' }
  | { kind: 'mac' };
export type SceneData = { visual: Visual; say?: Narr; lines?: Line[] };
export type Lang = 'fr' | 'en' | 'nl';
export type ShortData = { lang: Lang; slug: string; music: number; scenes: SceneData[] };
export type ShortsData = { end: Record<Lang, Narr>; shorts: Record<string, ShortData> };
