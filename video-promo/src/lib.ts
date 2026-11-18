import { Easing, interpolate } from 'remotion';
import { continueRender, delayRender, staticFile } from 'remotion';
import { loadFont } from '@remotion/fonts';

/** Les couleurs relevées sur le portail client (styles calculés, 03/11/2026). */
export const C = {
  sidebar: '#111111',
  panel: '#0A0A0A',
  panelBorder: 'rgba(255,255,255,0.08)',
  cell: 'rgba(255,255,255,0.04)',
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.10)',
  text: '#F2F2F2',
  text2: '#C8C8D0',
  text3: '#9A9AA5',
  text4: '#6B6B75',
  activeNav: 'rgba(255,255,255,0.05)',
  indigo: '#7A5FFF',
  deep: '#7349FE',
  violet: '#CD6BFB',
  amber: '#F5B544',
  green: '#34d399',
  red: '#f87171',
};

/** Courbes d'emil-design-eng, les mêmes que le site. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
export const EASE_DRAWER = Easing.bezier(0.32, 0.72, 0, 1);

/** 0 → 1 entre deux instants, avec une courbe. */
export const p = (t: number, a: number, dur: number, ease = EASE_OUT) =>
  interpolate(t, [a, a + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

export const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** Entrée standard du site : opacité + 20 px de montée. */
export const rise = (t: number, a: number, dur = 0.55, dy = 20) => {
  const k = p(t, a, dur, EASE_EXPO);
  return { opacity: k, transform: `translateY(${(1 - k) * dy}px)` };
};

let fontsLoaded = false;
export function useOutfit() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  const h = delayRender('Outfit');
  Promise.all(
    [300, 400, 500, 600, 700].map((w) =>
      loadFont({ family: 'Outfit', url: staticFile(`fonts/outfit-latin-${w}-normal.woff2`), weight: String(w) }),
    ),
  ).then(() => continueRender(h));
}
