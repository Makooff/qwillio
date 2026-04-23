/**
 * Shared Stripe / Vercel / Render dashboard tokens.
 *
 * Every dashboard page — admin and client — imports these so the design
 * stays consistent: one neutral surface, one accent colour, uppercase
 * section labels, tabular-nums, rounded-2xl cards.
 */

export const pro = {
  // Backgrounds
  bg:       '#0A0A0C',
  panel:    'rgba(255,255,255,0.03)',
  panelHi:  'rgba(255,255,255,0.05)',

  // Borders
  border:   'rgba(255,255,255,0.07)',
  borderHi: 'rgba(255,255,255,0.12)',

  // Text
  text:     '#F5F5F7',
  textSec:  '#A1A1A8',
  textTer:  '#6B6B75',

  // Accent — used sparingly
  accent:   '#7B5CF0',

  // Status
  ok:       '#22C55E',
  warn:     '#F59E0B',
  bad:      '#EF4444',
  info:     '#60A5FA',
} as const;

/** Card wrapper style (translucent surface, 1px border, rounded-2xl). */
export const proCard = {
  background:  pro.panel,
  border:      `1px solid ${pro.border}`,
  borderRadius: 16,
} as const;

/** Primary "save / confirm" button — white on dark, not brand purple. */
export const proPrimaryBtn = {
  background: pro.text,
  color:      '#0B0B0D',
} as const;

/** Outline / ghost button (white on panel). */
export const proGhostBtn = {
  background: pro.panel,
  color:      pro.text,
  border:     `1px solid ${pro.border}`,
} as const;
