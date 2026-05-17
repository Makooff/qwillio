# Qwillio — Design System

## Visual Direction
Dark Authority. Linear × Raycast aesthetic. Not "AI purple gradient on white" SaaS.
Single committed color strategy: Qwillio purple carries 40-60% of every surface.

## Typography
- **Display**: Geist (Vercel), fallback Inter — weight 800, tracking -0.03em, size 5-8rem for hero
- **Body**: Geist or Inter — weight 400-500, line-height 1.65, max 68ch
- **Labels**: 10-11px, uppercase, tracking 0.08em, weight 600
- **NO**: gradient text. EVER. Single solid color for emphasis.
- Hierarchy: ≥1.25 ratio between steps minimum

## Colors (OKLCH)
```
--bg:         oklch(9% 0.018 275)   /* deep purple-black */
--bg-2:       oklch(12.5% 0.022 275)  /* card surface */
--bg-3:       oklch(16% 0.025 275)  /* elevated surface */
--border:     oklch(25% 0.025 275 / 0.5)  /* subtle borders */
--border-hi:  oklch(35% 0.030 275 / 0.6)  /* hover borders */
--accent:     oklch(66% 0.25 285)   /* Qwillio purple */
--accent-dim: oklch(66% 0.25 285 / 0.12)  /* accent backgrounds */
--accent-hi:  oklch(72% 0.22 285)   /* hover state */
--text:       oklch(95% 0.010 275)  /* primary text */
--text-2:     oklch(68% 0.012 275)  /* secondary text */
--text-3:     oklch(45% 0.010 275)  /* tertiary/disabled */
--ok:         oklch(72% 0.18 145)   /* green success */
--warn:       oklch(78% 0.18 75)    /* amber warning */
--bad:        oklch(65% 0.22 25)    /* red error */
```

## Spacing Rhythm
NOT uniform. Vary intentionally:
- Section gaps: 6rem / 9rem / 12rem (alternate)
- Card padding: 1.5rem inner, 2.5rem larger blocks
- Inline gaps: 0.5rem / 1rem / 1.5rem

## Layout
- NO centered everything. Left-anchored hero text.
- Break out of 1200px container when it adds energy
- Use negative space as a design element
- Cards only when genuinely the best affordance — not by default

## Component Patterns
- Borders: 1px solid oklch(25% 0.025 275 / 0.5) — never side-stripe accent
- Radius: 12px standard, 20px hero elements, 999px pills only
- Shadows: `0 1px 3px oklch(0% 0 0 / 0.5), 0 0 0 1px oklch(100% 0 0 / 0.04)`
- Focus: 2px outline oklch(66% 0.25 285 / 0.6), offset 2px

## Motion
- Ease: cubic-bezier(0.16, 1, 0.3, 1) — expo out only
- Duration: 150ms micro, 250ms standard, 400ms page
- Compositor only: transform, opacity
- NO: bouncy, elastic, looping decorative animations

## Banned
- gradient text (background-clip: text)
- side-stripe borders
- identical card grids (icon+heading+text ×3)
- hero-metric stats template (big number, small label)
- floating orbs as decoration
- glassmorphism by default
- Inter for display — use Geist or Satoshi
