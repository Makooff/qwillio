/**
 * Qwillio Design Tokens — Signal Dark v3
 * OKLCH. Indigo-tinted dark base — logo Q-circle primary.
 * Primary: oklch(56% 0.02 265)  ≈ #6366F1 (logo indigo)
 * Violet:  oklch(67% 0.03 265)  ≈ #A855F7 (logo violet)
 * Skills: taste-skill, emil-design-eng, impeccable
 */

export const pro = {
  // ── Backgrounds — near-black neutral (indigo lives in the accent, not the bg) ─
  bg:       'oklch(8% 0.003 265)',
  panel:    'oklch(11% 0.004 265)',
  panelHi:  'oklch(15% 0.006 265)',

  // ── Borders ──────────────────────────────────────────────────────────────
  border:   'oklch(22% 0.012 265 / 0.55)',
  borderHi: 'oklch(30% 0.014 265 / 0.70)',

  // ── Text ─────────────────────────────────────────────────────────────────
  text:    'oklch(95% 0.004 265)',
  textSec: 'oklch(65% 0.007 265)',
  textTer: 'oklch(42% 0.006 265)',

  // ── Accent — logo Q-circle indigo (PRIMARY) ───────────────────────────────
  accent:     'oklch(56% 0.02 265)',
  accentHi:   'oklch(63% 0.02 265)',
  accentDim:  'oklch(56% 0.02 265 / 0.12)',
  accentGlow: 'oklch(56% 0.02 265 / 0.12)',
  accentGrad: 'oklch(56% 0.02 265)',
  accentMid:  'oklch(56% 0.02 265 / 0.10)',
  accentBrd:  'oklch(56% 0.02 265 / 0.40)',

  // ── Violet — logo W-circle (secondary) ───────────────────────────────────
  violet:     'oklch(67% 0.03 265)',
  violetDim:  'oklch(67% 0.03 265 / 0.12)',
  violetGlow: 'oklch(67% 0.03 265 / 0.20)',

  // ── Status ───────────────────────────────────────────────────────────────
  ok:   'oklch(72% 0.18 145)',
  warn: 'oklch(78% 0.18 75)',
  bad:  'oklch(65% 0.22 25)',
  info: 'oklch(70% 0.18 240)',

  // ── Status glows ─────────────────────────────────────────────────────────
  okGlow:   'oklch(72% 0.18 145 / 0.22)',
  warnGlow: 'oklch(78% 0.18 75 / 0.22)',
  badGlow:  'oklch(65% 0.22 25 / 0.22)',
  infoGlow: 'oklch(70% 0.18 240 / 0.20)',
} as const;

export const proShadow = {
  card:  '0 1px 2px oklch(0% 0 0 / 0.40), 0 0 0 1px oklch(100% 0 0 / 0.03)',
  float: '0 12px 32px oklch(0% 0 0 / 0.55), 0 0 0 1px oklch(100% 0 0 / 0.05)',
  glow:  '0 0 0 1px oklch(56% 0.02 265 / 0.30)',
  btn:   'none',
} as const;

export const proCard = {
  background:   pro.panel,
  border:       `1px solid ${pro.border}`,
  borderRadius: 16,
  boxShadow:    proShadow.card,
} as const;

export const proPrimaryBtn = {
  background: pro.accentGrad,
  color:      'oklch(98% 0.004 265)',
  boxShadow:  proShadow.btn,
} as const;

export const proGhostBtn = {
  background: 'oklch(100% 0 0 / 0.03)',
  color:      pro.text,
  border:     `1px solid ${pro.border}`,
} as const;
