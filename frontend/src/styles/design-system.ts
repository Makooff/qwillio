/**
 * Qwillio Design System — canonical semantic layer for the REAL routed portal
 * (client/* pages, DashboardShell, settings aesthetic).
 *
 * This is NOT a new theme. Every value derives from `t` (admin-theme,
 * "Signal Dark v3"), which remains the single source of color truth.
 * Use these helpers instead of hardcoding hex/oklch strings in components:
 *
 *   import { ds } from '../styles/design-system';
 *   <button style={ds.btnPrimary}>…</button>
 *   <div style={ds.surface}>…</div>
 *
 * Rules:
 *  - Flat, restrained. No gradients, no glow. Indigo (#7349fe) only on the
 *    primary action and the active nav item — never ambient decoration.
 *  - Depth comes from hairline borders + subtle shadows (t.shadow / t.shadowFloat).
 *  - Danger stays red (t.danger); never use brand indigo for destructive actions.
 */
import type { CSSProperties } from 'react';
import { t } from './admin-theme';

/* ── Surfaces ──────────────────────────────────────────────────────────── */

/** Default content card: flat panel, hairline border. */
export const surface = {
  background: t.panel,
  border: `1px solid ${t.border}`,
  borderRadius: t.r,
} as const;

/** Slightly raised surface (dropdowns, hover states, popovers). */
export const surfaceRaised = {
  background: t.elevated,
  border: `1px solid ${t.border}`,
  borderRadius: t.r,
  boxShadow: t.shadow,
} as const;

/** Inset well for inputs / nested content. */
export const surfaceInset = {
  background: t.inset,
  border: `1px solid ${t.border}`,
  borderRadius: t.rSm,
} as const;

/** Floating layer (dialogs, sheets, menus). */
export const surfaceFloat = {
  background: t.panelSolid,
  border: `1px solid ${t.borderHi}`,
  borderRadius: '16px',
  boxShadow: t.shadowFloat,
} as const;

/** Subtle hover wash used on rows / ghost buttons. */
export const hoverWash = 'rgba(255,255,255,0.06)' as const;

/* ── Buttons ───────────────────────────────────────────────────────────── */

const btnBase = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  /* Un libellé long (200 % de zoom, toolbar étroite) reflate au lieu de
     déborder: la gélule passe sur deux lignes, jamais hors de son parent. */
  flexWrap: 'wrap',
  maxWidth: '100%',
  /* Gélule partout sur les commandes (décision utilisateur, même référence
     que le bouton « Connexion » du site). */
  borderRadius: t.rFull,
  fontFamily: `'Outfit', system-ui, sans-serif`,
  fontSize: 13,
  fontWeight: 500,
  transition: 'background-color 150ms, opacity 150ms',
  cursor: 'pointer',
  border: 'none',
} as const;

/* L'action primaire ne se peint PLUS en mauve plein (demande utilisateur:
   « enlève les fonds de couleur mauves, juste contour en mauve »). Fond
   transparent, contour et texte mauves. Le texte utilise `t.brandHi`
   (#8a6fff) et non `t.brand` (#7349fe): mesuré à ~5,4:1 sur #0a0a0a, il
   passe WCAG AA pour du 13px, là où #7349fe tombe à ~3,9:1. */
export const btnPrimary = {
  ...btnBase,
  padding: '9px 16px',
  background: 'transparent',
  color: t.brandHi,
  border: `1px solid ${t.brandHi}`,
} as const;

/* Au survol: AUCUN remplissage mauve (demande utilisateur). Un léger lavage
   neutre + un contour/texte qui s'éclaircissent disent le survol. */
export const btnPrimaryHover = {
  background: hoverWash,
  color: t.brandHi,
  borderColor: t.brandHi,
} as const;

/** Destructive confirm — danger red, white text. */
export const btnDanger = {
  ...btnBase,
  padding: '9px 16px',
  background: t.danger,
  color: '#fff',
} as const;

/** Neutral secondary — ghost wash, secondary text. */
export const btnGhost = {
  ...btnBase,
  padding: '9px 16px',
  background: 'transparent',
  color: t.textSec,
} as const;
export const btnGhostHover = { background: hoverWash } as const;

/** Compact ghost for toolbars / icon-adjacent actions. */
export const btnSubtle = {
  ...btnBase,
  padding: '6px 12px',
  background: 'rgba(255,255,255,0.05)',
  color: t.textSec,
  fontSize: 12,
} as const;
export const btnSubtleHover = { background: 'rgba(255,255,255,0.08)' } as const;

export const btnDisabled = { opacity: 0.5, cursor: 'not-allowed' } as const;

/** Shared focus ring — use on every interactive element. */
export const focusRing = {
  outline: 'none',
  boxShadow: `0 0 0 2px ${t.borderFocus}`,
} as const;

/* ── Form controls ─────────────────────────────────────────────────────── */

/** Standard text/select input. Matches settings-page aesthetic.
 *  Le focus clavier ne se contente pas de changer la bordure: un anneau
 *  reprend la couleur de focus du système pour rester visible à 200 %. */
export const inputCls = [
  'w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors',
  'bg-white/[0.04] border border-white/[0.08]',
  'text-white/90 placeholder-white/25',
  'focus:border-[#7349fe]/50',
  'focus-visible:ring-2 focus-visible:ring-[rgba(115,73,254,0.5)]',
].join(' ');

export const selectCls = inputCls + ' appearance-none cursor-pointer';

export const labelCls = 'block text-xs font-medium text-white/50 mb-2';

/* ── Badges / status tones ─────────────────────────────────────────────── */

export type Tone = 'brand' | 'violet' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneColor: Record<Tone, string> = {
  brand:   t.brand,
  violet:  t.violet,
  success: t.success,
  warning: t.warning,
  danger:  t.danger,
  info:    t.info,
  neutral: t.textSec,
};

/** Solid-soft pill: tinted wash + matching text + tinted hairline border.
 *  color-mix keeps this working for both hex (`#7349fe`) and oklch tokens. */
export function badgeStyle(tone: Tone): CSSProperties {
  const c = toneColor[tone];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 500,
    lineHeight: '16px',
    background: `color-mix(in oklab, ${c} 12%, transparent)`,
    color: c,
    border: `1px solid color-mix(in oklab, ${c} 28%, transparent)`,
    whiteSpace: 'nowrap',
  };
}

/** Dot used inside live/pulsing indicators. */
export function dotStyle(tone: Tone): CSSProperties {
  return { width: 6, height: 6, borderRadius: 999, background: toneColor[tone] };
}

/* ── Dialog ────────────────────────────────────────────────────────────── */

/** Scrim behind dialogs/sheets. */
export const scrim = { background: 'rgba(0,0,0,0.55)' } as const;

export const dialogPanel = surfaceFloat;
export const dialogTitleCls = 'text-base font-semibold pr-6';
export const dialogMessageCls = 'text-sm leading-relaxed mt-2';

/* ── Aggregates ────────────────────────────────────────────────────────── */

export const ds = {
  surface,
  surfaceRaised,
  surfaceInset,
  surfaceFloat,
  hoverWash,
  btnPrimary,
  btnPrimaryHover,
  btnDanger,
  btnGhost,
  btnGhostHover,
  btnSubtle,
  btnSubtleHover,
  btnDisabled,
  focusRing,
  inputCls,
  selectCls,
  labelCls,
  badgeStyle,
  dotStyle,
  scrim,
  dialogPanel,
  dialogTitleCls,
  dialogMessageCls,
} as const;
