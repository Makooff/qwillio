/**
 * Qwillio Admin — Signal Dark v3
 * OKLCH. Indigo-tinted dark base — logo Q-circle primary.
 * Primary: oklch(56% 0.22 264)  ≈ #6366F1 (logo indigo)
 * Violet:  oklch(67% 0.26 299)  ≈ #A855F7 (logo violet)
 *
 * Usage: import { t } from '../styles/admin-theme';
 */

export const t = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  bg:         'oklch(8% 0.009 265)',
  panel:      'oklch(11% 0.013 265)',
  panelSolid: 'oklch(10% 0.011 265)',
  panelHover: 'oklch(15% 0.017 265)',
  elevated:   'oklch(14% 0.015 265)',
  inset:      'oklch(6% 0.007 265)',

  // ── Borders ──────────────────────────────────────────────────────────────
  border:      'oklch(22% 0.012 265 / 0.55)',
  borderHi:    'oklch(30% 0.014 265 / 0.70)',
  borderFocus: 'oklch(56% 0.22 264 / 0.50)',

  // ── Text ─────────────────────────────────────────────────────────────────
  text:     'oklch(95% 0.004 265)',
  textSec:  'oklch(65% 0.007 265)',
  textTer:  'oklch(42% 0.006 265)',
  textMuted:'oklch(28% 0.005 265)',

  // ── Brand — Qwillio Indigo (logo Q circle) ────────────────────────────
  brand:  'oklch(56% 0.22 264)',
  brandHi:'oklch(63% 0.21 264)',
  violet: 'oklch(67% 0.26 299)',
  live:   'oklch(72% 0.18 145)',

  // ── Accent system ─────────────────────────────────────────────────────────
  accentGrad: 'linear-gradient(135deg, oklch(52% 0.24 264) 0%, oklch(63% 0.22 264) 100%)',
  accentGlow: 'oklch(56% 0.22 264 / 0.22)',
  accentMid:  'oklch(56% 0.22 264 / 0.10)',
  accentDim:  'oklch(56% 0.22 264 / 0.12)',
  accentBrd:  'oklch(56% 0.22 264 / 0.40)',
  violetGlow: 'oklch(67% 0.26 299 / 0.20)',
  okGlow:     'oklch(72% 0.18 145 / 0.18)',

  // ── Mesh gradient — indigo ambience ──────────────────────────────────────
  mesh: 'radial-gradient(ellipse 220px 180px at 10% 0%, oklch(56% 0.22 264 / 0.09) 0%, transparent 70%), radial-gradient(ellipse 160px 120px at 90% 100%, oklch(67% 0.26 299 / 0.06) 0%, transparent 70%)',

  // ── Shadows ──────────────────────────────────────────────────────────────
  shadow:      '0 1px 3px oklch(0% 0 0 / 0.55), 0 0 0 1px oklch(100% 0 0 / 0.04)',
  shadowFloat: '0 8px 40px oklch(0% 0 0 / 0.70), 0 0 0 1px oklch(100% 0 0 / 0.06)',
  shadowGlow:  '0 0 0 1px oklch(56% 0.22 264 / 0.30), 0 4px 20px oklch(56% 0.22 264 / 0.18)',

  // ── Status ───────────────────────────────────────────────────────────────
  success: 'oklch(72% 0.18 145)',
  warning: 'oklch(78% 0.18 75)',
  danger:  'oklch(65% 0.22 25)',
  info:    'oklch(70% 0.18 240)',

  // ── Radius ───────────────────────────────────────────────────────────────
  r:    '14px',
  rSm:  '10px',
  rFull:'9999px',

  // ── Blur ─────────────────────────────────────────────────────────────────
  blur:   'blur(40px)',
  blurSm: 'blur(20px)',
} as const;

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
  fontFamily: `'Outfit', system-ui, sans-serif`,
} as const;

export const tooltipStyle = {
  background: 'oklch(10% 0.011 265 / 0.97)',
  backdropFilter: t.blurSm,
  border: `1px solid ${t.borderHi}`,
  borderRadius: 10,
  fontSize: 12,
  color: t.textSec,
  boxShadow: t.shadow,
} as const;

export const cx = {
  h1: 'text-lg font-semibold tracking-tight',
  h2: 'text-[11px] font-semibold uppercase tracking-[0.08em]',
  h3: 'text-[10px] font-medium uppercase tracking-[0.1em]',
  body: 'text-[13px] leading-relaxed',
  caption: 'text-[11px]',
  mono: 'font-mono text-[11px] tabular-nums',

  btnPrimary: 'px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all duration-150',
  btnGhost: 'px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-all duration-150 hover:bg-white/[0.06]',
  btnIcon: 'p-2 rounded-[10px] transition-all duration-150 hover:bg-white/[0.05]',

  th: 'px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider',
  td: 'px-4 py-3 text-[13px]',
  tr: 'border-b border-white/[0.04] hover:bg-white/[0.016] transition-colors pro-table-row',

  pageWrap: 'space-y-5 max-w-[1440px] admin-page',
  cardGrid: 'grid gap-3',
} as const;
