/**
 * Qwillio Design Tokens — Signal Dark v2
 * OKLCH. Emerald-drenched dark base (the brand color IS the darkness).
 * Skills: taste-skill, emil-design-eng, impeccable
 */

export const pro = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  bg:       'oklch(9% 0.014 160)',
  panel:    'oklch(13% 0.018 160)',
  panelHi:  'oklch(17% 0.022 160)',

  // ── Borders ──────────────────────────────────────────────────────────────
  border:   'oklch(26% 0.014 160 / 0.55)',
  borderHi: 'oklch(36% 0.016 160 / 0.70)',

  // ── Text ─────────────────────────────────────────────────────────────────
  text:    'oklch(95% 0.006 160)',
  textSec: 'oklch(62% 0.009 160)',
  textTer: 'oklch(40% 0.007 160)',

  // ── Accent — Signal Emerald ───────────────────────────────────────────────
  accent:     'oklch(68% 0.22 160)',
  accentHi:   'oklch(74% 0.20 160)',
  accentDim:  'oklch(68% 0.22 160 / 0.12)',
  accentGlow: 'oklch(68% 0.22 160 / 0.22)',
  accentGrad: 'linear-gradient(135deg, oklch(64% 0.23 160) 0%, oklch(72% 0.20 155) 100%)',
  accentMid:  'oklch(68% 0.22 160 / 0.10)',
  accentBrd:  'oklch(68% 0.22 160 / 0.35)',

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
  card:  '0 1px 3px oklch(0% 0 0 / 0.60), 0 0 0 1px oklch(100% 0 0 / 0.04)',
  float: '0 8px 40px oklch(0% 0 0 / 0.75), 0 0 0 1px oklch(100% 0 0 / 0.06)',
  glow:  '0 0 0 1px oklch(68% 0.22 160 / 0.35), 0 4px 24px oklch(68% 0.22 160 / 0.22)',
  btn:   '0 2px 16px oklch(68% 0.22 160 / 0.45)',
} as const;

export const proCard = {
  background:   pro.panel,
  border:       `1px solid ${pro.border}`,
  borderRadius: 16,
  boxShadow:    proShadow.card,
} as const;

export const proPrimaryBtn = {
  background: pro.accentGrad,
  color:      'oklch(9% 0.014 160)',
  boxShadow:  proShadow.btn,
} as const;

export const proGhostBtn = {
  background: 'oklch(100% 0 0 / 0.03)',
  color:      pro.text,
  border:     `1px solid ${pro.border}`,
} as const;
