import { Easing } from 'remotion';
import { FONT_FAMILY } from './fonts';

// Qwillio brand tokens (hex equivalents of the oklch tokens in globals.css).
export const COLORS = {
  bg: '#0a0a0f',
  bg2: '#12131f',
  bg3: '#1a1b2e',
  indigo: '#6366f1',
  indigoHi: '#818cf8',
  violet: '#a855f7',
  text: '#f4f5fa',
  text2: '#a7a9bd',
  text3: '#6a6c82',
  ok: '#34d399',
  bad: '#fb7185',
};

export const FONT = FONT_FAMILY;

// Eases mirrored from CLAUDE.md motion tokens.
export const EASE = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
};

// Spring presets: "soft" is overdamped (no overshoot, Stripe-like calm),
// "pop" has a touch of overshoot for Apple-style entrances.
export const SPRING_SOFT = { damping: 200, mass: 0.8 } as const;
export const SPRING_POP = { damping: 14, mass: 0.7, stiffness: 120 } as const;
