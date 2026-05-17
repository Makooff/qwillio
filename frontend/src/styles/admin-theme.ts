/**
 * Qwillio Admin — Signal Dark Design System
 * OKLCH color system. Neutral dark base, emerald accent.
 * Out: AI Purple (#7B5CF0). In: Signal Emerald.
 *
 * Usage: import { t } from '../styles/admin-theme';
 */

/* ── Base palette ── */
export const t = {
  // Backgrounds — zinc-dark, zero purple tint
  bg:         'oklch(8% 0.004 160)',
  panel:      'oklch(11% 0.006 160)',
  panelSolid: 'oklch(10% 0.005 160)',
  panelHover: 'oklch(15% 0.008 160)',
  elevated:   'oklch(14% 0.007 160)',
  inset:      'oklch(6% 0.003 0)',

  // Borders
  border:      'oklch(22% 0.006 160 / 0.6)',
  borderHi:    'oklch(30% 0.008 160 / 0.7)',
  borderFocus: 'oklch(68% 0.22 160 / 0.45)',

  // Text
  text:     'oklch(94% 0.005 0)',
  textSec:  'oklch(65% 0.006 0)',
  textTer:  'oklch(45% 0.005 0)',
  textMuted:'oklch(30% 0.004 0)',

  // Brand — Signal Emerald (replaces Qwillio purple)
  brand: 'oklch(68% 0.22 160)',
  live:  'oklch(72% 0.18 145)',

  // Accent system
  accentGrad: 'linear-gradient(135deg, oklch(64% 0.23 160) 0%, oklch(72% 0.20 155) 100%)',
  accentGlow: 'oklch(68% 0.22 160 / 0.18)',
  accentMid:  'oklch(68% 0.22 160 / 0.10)',
  okGlow:     'oklch(72% 0.18 145 / 0.18)',

  // Mesh gradient — emerald ambience
  mesh: 'radial-gradient(ellipse 220px 180px at 10% 0%, oklch(68% 0.22 160 / 0.10) 0%, transparent 70%), radial-gradient(ellipse 160px 120px at 90% 100%, oklch(68% 0.22 160 / 0.07) 0%, transparent 70%)',

  // Shadows
  shadow:      '0 1px 3px oklch(0% 0 0 / 0.55), 0 0 0 1px oklch(100% 0 0 / 0.04)',
  shadowFloat: '0 8px 40px oklch(0% 0 0 / 0.70), 0 0 0 1px oklch(100% 0 0 / 0.06)',
  shadowGlow:  '0 0 0 1px oklch(68% 0.22 160 / 0.30), 0 4px 20px oklch(68% 0.22 160 / 0.18)',

  // Functional
  success: 'oklch(72% 0.18 145)',
  warning: 'oklch(78% 0.18 75)',
  danger:  'oklch(65% 0.22 25)',
  info:    'oklch(70% 0.18 240)',

  // Radius
  r:    '14px',
  rSm:  '10px',
  rFull:'9999px',

  // Blur
  blur:   'blur(40px)',
  blurSm: 'blur(20px)',
} as const;

/* ── Reusable CSS-in-JS objects ── */

export const glass = {
  background: t.panel,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: `1px solid ${t.border}`,
  borderRadius: t.r,
  boxShadow: t.shadow,
} as const;

export const glassHi = {
  ...glass,
  background: t.elevated,
  border: `1px solid ${t.borderHi}`,
  boxShadow: t.shadowFloat,
} as const;

export const inputStyle = {
  background: t.inset,
  border: `1px solid ${t.border}`,
  borderRadius: t.rSm,
  color: t.text,
  fontSize: 13,
} as const;

export const tooltipStyle = {
  background: 'oklch(10% 0.005 160 / 0.97)',
  backdropFilter: t.blurSm,
  border: `1px solid ${t.borderHi}`,
  borderRadius: 10,
  fontSize: 12,
  color: t.textSec,
  boxShadow: t.shadow,
} as const;

/* ── Tailwind class helpers ── */
export const cx = {
  h1: 'text-lg font-semibold tracking-tight',
  h2: 'text-[11px] font-semibold uppercase tracking-[0.08em]',
  h3: 'text-[10px] font-medium uppercase tracking-[0.1em]',
  body: 'text-[13px] leading-relaxed',
  caption: 'text-[11px]',
  mono: 'font-mono text-[11px] tabular-nums',

  btnPrimary: 'px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all duration-150',
  btnGhost: 'px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-all duration-150 hover:bg-white/[0.07]',
  btnIcon: 'p-2 rounded-[10px] transition-all duration-150 hover:bg-white/[0.06]',

  th: 'px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider',
  td: 'px-4 py-3 text-[13px]',
  tr: 'border-b border-white/[0.04] hover:bg-white/[0.018] transition-colors pro-table-row',

  pageWrap: 'space-y-5 max-w-[1440px] admin-page',
  cardGrid: 'grid gap-3',
} as const;
