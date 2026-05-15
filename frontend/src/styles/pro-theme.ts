/**
 * Shared Dark Luxury AI dashboard tokens.
 * Linear × Raycast × Vercel dark direction.
 *
 * Every dashboard page — admin and client — imports these so the design
 * stays consistent: deep black surface, purple accent, uppercase
 * section labels, tabular-nums, rounded-2xl cards.
 */

export const pro = {
  // Backgrounds
  bg:       '#06060E',
  panel:    'rgba(255,255,255,0.028)',
  panelHi:  'rgba(255,255,255,0.05)',

  // Borders
  border:   'rgba(255,255,255,0.06)',
  borderHi: 'rgba(255,255,255,0.10)',

  // Text
  text:     '#F5F5F7',
  textSec:  '#A1A1A8',
  textTer:  '#6B6B75',

  // Accent — purple gradient system
  accent:    '#7B5CF0',
  accentHi:  '#9B7DF8',
  accentMid: 'rgba(123,92,240,0.10)',
  accentGrad:'linear-gradient(135deg, #7B5CF0 0%, #9B7DF8 100%)',
  accentGlow:'rgba(123,92,240,0.18)',

  // Status
  ok:       '#22C55E',
  warn:     '#F59E0B',
  bad:      '#EF4444',
  info:     '#60A5FA',

  // Status glows
  okGlow:   'rgba(34,197,94,0.18)',
  warnGlow: 'rgba(245,158,11,0.18)',
  badGlow:  'rgba(239,68,68,0.18)',
  infoGlow: 'rgba(96,165,250,0.18)',
} as const;

/** Shadow system */
export const proShadow = {
  card:  '0 1px 3px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
  float: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
  glow:  '0 0 0 1px rgba(123,92,240,0.3), 0 4px 20px rgba(123,92,240,0.18)',
  btn:   '0 2px 12px rgba(123,92,240,0.35)',
} as const;

/** Card wrapper style (translucent glass surface, 1px border, rounded-2xl). */
export const proCard = {
  background:   pro.panel,
  border:       `1px solid ${pro.border}`,
  borderRadius: 16,
  boxShadow:    proShadow.card,
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
} as const;

/** Primary "save / confirm" button — purple gradient, not white. */
export const proPrimaryBtn = {
  background: pro.accentGrad,
  color:      '#fff',
  boxShadow:  proShadow.btn,
} as const;

/** Outline / ghost button (white on panel). */
export const proGhostBtn = {
  background: 'rgba(255,255,255,0.03)',
  color:      pro.text,
  border:     `1px solid ${pro.border}`,
} as const;
