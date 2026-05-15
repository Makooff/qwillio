/**
 * Qwillio Admin — Dark Luxury AI Design System
 * Linear × Raycast × Vercel dark, purple-accent glassmorphism
 *
 * Usage: import { t } from '../styles/admin-theme';
 */

/* ── Base palette ── */
export const t = {
  // Backgrounds
  bg:         '#06060E',        // deep cool black
  panel:      'rgba(255,255,255,0.028)',  // glass panel fill
  panelSolid: '#0D0D18',        // fallback without blur
  panelHover: 'rgba(255,255,255,0.05)',
  elevated:   'rgba(255,255,255,0.045)',  // cards inside panels
  inset:      'rgba(0,0,0,0.30)',         // recessed inputs

  // Borders
  border:     'rgba(255,255,255,0.06)',
  borderHi:   'rgba(255,255,255,0.10)',
  borderFocus:'rgba(123,92,240,0.45)',

  // Text
  text:       '#F5F5F7',        // primary
  textSec:    '#86868B',        // secondary
  textTer:    '#6E6E73',        // tertiary
  textMuted:  '#48484A',        // very dim

  // Brand — accent purple
  brand:      '#7B5CF0',
  live:       '#22C55E',

  // Accent gradient + glow
  accentGrad: 'linear-gradient(135deg, #7B5CF0 0%, #9B7DF8 100%)',
  accentGlow: 'rgba(123,92,240,0.18)',
  accentMid:  'rgba(123,92,240,0.10)',
  okGlow:     'rgba(34,197,94,0.18)',

  // Mesh gradient for sidebar ambience
  mesh: 'radial-gradient(ellipse 220px 180px at 10% 0%, rgba(123,92,240,0.12) 0%, transparent 70%), radial-gradient(ellipse 160px 120px at 90% 100%, rgba(123,92,240,0.08) 0%, transparent 70%)',

  // Shadows
  shadow:      '0 1px 3px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
  shadowFloat: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
  shadowGlow:  '0 0 0 1px rgba(123,92,240,0.3), 0 4px 20px rgba(123,92,240,0.18)',

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
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: `1px solid ${t.border}`,
  borderRadius: t.r,
  boxShadow: t.shadow,
} as const;

/** Glass panel with higher prominence */
export const glassHi = {
  ...glass,
  background: t.elevated,
  border: `1px solid ${t.borderHi}`,
  boxShadow: t.shadowFloat,
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
  background: 'rgba(13,13,24,0.97)',
  backdropFilter: t.blurSm,
  border: `1px solid ${t.borderHi}`,
  borderRadius: 10,
  fontSize: 12,
  color: t.textSec,
  boxShadow: t.shadow,
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
  btnGhost: 'px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-all duration-150 hover:bg-white/[0.07]',
  btnIcon: 'p-2 rounded-[10px] transition-all duration-150 hover:bg-white/[0.06]',

  // Table
  th: 'px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider',
  td: 'px-4 py-3 text-[13px]',
  tr: 'border-b border-white/[0.04] hover:bg-white/[0.018] transition-colors pro-table-row',

  // Layout
  pageWrap: 'space-y-5 max-w-[1440px] admin-page',
  cardGrid: 'grid gap-3',
} as const;
