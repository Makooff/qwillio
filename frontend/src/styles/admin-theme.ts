/**
 * Qwillio Admin — Dark Glassmorphism Design System
 * Apple-inspired, monochrome grey, frosted glass panels
 *
 * Usage: import { t } from '../styles/admin-theme';
 */

/* ── Base palette ── */
export const t = {
  // Backgrounds
  bg:         '#09090B',        // page background (near-black)
  panel:      'rgba(255,255,255,0.025)',  // glass panel fill
  panelSolid: '#111113',        // fallback without blur
  panelHover: 'rgba(255,255,255,0.045)',
  elevated:   'rgba(255,255,255,0.04)',   // cards inside panels
  inset:      'rgba(0,0,0,0.25)',         // recessed inputs

  // Borders
  border:     'rgba(255,255,255,0.06)',
  borderHi:   'rgba(255,255,255,0.10)',
  borderFocus:'rgba(255,255,255,0.18)',

  // Text
  text:       '#F5F5F7',        // primary (Apple white)
  textSec:    '#86868B',        // secondary (Apple grey)
  textTer:    '#6E6E73',        // tertiary
  textMuted:  '#48484A',        // very dim

  // Brand — only for logo & live badge
  brand:      '#7B5CF0',
  live:       '#22C55E',

  // Functional (muted)
  success:    '#34D399',        // emerald-400
  warning:    '#FBBF24',        // amber-400
  danger:     '#F87171',        // red-400
  info:       '#60A5FA',        // blue-400

  // Radius
  r:          '14px',           // default card radius
  rSm:        '10px',           // smaller elements
  rFull:      '9999px',         // pills

  // Blur for glass
  blur:       'blur(40px)',
  blurSm:     'blur(20px)',
} as const;

/* ── Reusable CSS-in-JS objects ── */

/** Glass panel (card / section wrapper) */
export const glass = {
  background: t.panel,
  backdropFilter: t.blur,
  WebkitBackdropFilter: t.blur,
  border: `1px solid ${t.border}`,
  borderRadius: t.r,
} as const;

/** Glass panel with higher prominence */
export const glassHi = {
  ...glass,
  background: t.elevated,
  border: `1px solid ${t.borderHi}`,
} as const;

/** Input field base style */
export const inputStyle = {
  background: t.inset,
  border: `1px solid ${t.border}`,
  borderRadius: t.rSm,
  color: t.text,
  fontSize: 13,
} as const;

/** Tooltip style for Recharts */
export const tooltipStyle = {
  background: 'rgba(20,20,22,0.95)',
  backdropFilter: t.blurSm,
  border: `1px solid ${t.borderHi}`,
  borderRadius: 10,
  fontSize: 12,
  color: t.textSec,
} as const;

/* ── Tailwind class helpers ── */
export const cx = {
  // Text
  h1: 'text-lg font-semibold tracking-tight',
  h2: 'text-[11px] font-semibold uppercase tracking-[0.08em]',
  h3: 'text-[10px] font-medium uppercase tracking-[0.1em]',
  body: 'text-[13px] leading-relaxed',
  caption: 'text-[11px]',
  mono: 'font-mono text-[11px] tabular-nums',

  // Interactive
  btnPrimary: 'px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all duration-150',
  btnGhost: 'px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-all duration-150 hover:bg-white/[0.04]',
  btnIcon: 'p-2 rounded-[10px] transition-all duration-150 hover:bg-white/[0.06]',

  // Table
  th: 'px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider',
  td: 'px-4 py-3 text-[13px]',
  tr: 'border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors',

  // Layout
  pageWrap: 'space-y-5 max-w-[1440px]',
  cardGrid: 'grid gap-3',
} as const;
