# Linear — Style Reference
> Midnight precision instrument.

**Theme:** dark

Linear's design system is a midnight command center built on near-black surfaces (#08090a) with paper-white type and one electric acid-lime accent (#e4f222) that functions as a flashlight: small, high-contrast, used sparingly to signal action. Darkness is a substrate rather than a theme: crisp white text at tight tracking (-0.022em), weights in a low 400-510 band rather than bold, hairline-thin borders (0.5-1px) letting geometry do the work shadows usually would. Components feel precision-machined: 6px and 12px radii, compact 8-12px paddings, almost no decorative ornament. The product UI is the only visual texture in an otherwise quiet system.

## Tokens — Colors

| Name | Value | Role |
|------|-------|------|
| Void | `#08090a` | Page canvas, full-bleed backgrounds |
| Carbon | `#0f1011` | Card surfaces, nav bars, one step above canvas |
| Obsidian | `#161718` | Elevated surfaces, deeper panels |
| Graphite | `#23252a` | Subtle borders, dividers, ghost outlines |
| Smoke | `#383b3f` | Hairline borders at higher contrast, section separators |
| Ash | `#62666d` | Muted body text, inactive icons |
| Fog | `#8a8f98` | Tertiary text, placeholders, icon fills |
| Mist | `#d0d6e0` | Secondary headings, button text on dark |
| Bone | `#e5e5e6` | Near-white fills, high-contrast button text |
| Paper | `#ffffff` | Primary headings, hero type, max-contrast emphasis |
| Acid Lime | `#e4f222` | Primary action, active nav. The single electric accent breaking the monochrome |
| Pulse Green | `#27a644` | Supporting accent (tags, focused edges) |
| Coral Red | `#eb5757` | Supporting accent (soft emphasis washes) |
| Signal Teal | `#02b8cc` | Decorative, informational icons |
| Iris Violet | `#6366f1` | Tag/badge fills |
| Lavender | `#8b5cf6` | Secondary tag fills |

## Tokens — Typography

- **Inter Variable** (300, 400, 510, 590; features `"cv01" on, "ss03" on, "zero" on`): everything. Letter-spacing **-0.022em at 48-72px**, -0.012em at 20-32px, -0.011em at 15px, -0.010em at 13-16px.
- **Berkeley Mono** (400, 12/14px, ls -0.013em): issue IDs, keyboard shortcuts, technical metadata only. Never headings or marketing copy.

### Type Scale Detail

| Role | Size / Weight / LH / LS |
|------|------|
| Display | 72px / 510 / 1.0 / -0.022em |
| Hero | 64px / 510 / 1.0 / -0.022em |
| Section heading | 48px / 510 / 1.0 / -0.022em |
| Subheading | 32px / 400 / 1.13 / -0.022em |
| Heading | 24px / 400 / 1.33 / -0.012em |
| Body emphasis | 20px / 590 / 1.33 / -0.012em |
| Body large | 17px / 590 / 1.6 |
| Body | 16px / 400 / 1.5 |
| Body small | 15px / 400 / 1.6 / -0.011em |
| Caption | 13px / 400 / 1.2 |
| Label | 12px / 400 / 1.4 |
| Micro | 10px / 510 / 1.5 |

## Tokens — Spacing & Shapes

Base unit 4px, density compact. Scale: 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 80, 96, 128.

Radius vocabulary (three radii total): cards **12px**, buttons/inputs **6px**, pills **9999px**, badges 4px, small 2px.

Shadows: elevation comes from hairline borders and surface progression, not shadow stacks.
- sm: `rgba(0,0,0,0.4) 0 2px 4px`
- subtle (card edge): `rgb(35,37,42) 0 0 0 1px inset`
- xl: `rgba(8,9,10,0.6) 0 4px 32px`

Layout: max-width **1200px**, section gap **96px**, card padding 24px, element gap 8px.

## Components

- **Primary Action Button (Acid Lime)**: bg #e4f222, text #08090a, 6px radius, 10px 16px padding, 14px/510, ls -0.011em. The sole filled chromatic element, one per view.
- **Nav Text Button**: transparent, #d0d6e0, 13px/400. Pure typographic nav.
- **Pill Button**: `rgba(255,255,255,0.05)` fill, #d0d6e0, 9999px, 4px 12px.
- **Ghost/Outline Button**: transparent, 1px #23252a border, #d0d6e0, 6px radius.
- **Sign-up Button (white pill)**: #ffffff bg, #08090a text, 9999px, 8px 16px, 13px/510.
- **Card (Product Screenshot Frame)**: #0f1011, 12px radius, inset 1px #23252a via box-shadow, 24px padding. No outer shadow, no glow.
- **Card (Subtle)**: `rgba(255,255,255,0.02)`, 6px radius, barely separates from canvas.
- **Text Input**: `rgba(255,255,255,0.02)` bg, 1px `rgba(255,255,255,0.08)` border, 6px radius, focus brightens border to #d0d6e0.
- **Badge/Status Tag**: `rgba(255,255,255,0.05)`, #8a8f98, 4px radius, 12px/400.
- **Logo Bar**: neutral grey customer logos, evenly spaced 48-64px gaps, no card backgrounds.
- **Hero Gradient Floor**: subtle dark-to-light linear gradient grounding the floating product UI.

## Do's and Don'ts

### Do
- Inter with cv01/ss03/zero features on.
- #e4f222 exclusively for the single primary action per view.
- Body 16px/400/1.5. Letter-spacing -0.022em at 48px+.
- Card 12px, button 6px, pill 9999px. Three radii is the entire vocabulary.
- 0.5-1px hairline borders (#23252a / #383b3f) instead of shadows.
- Section gaps 96px, element gaps 8px.

### Don't
- No bold weights (700+), the scale caps at 590.
- No decorative gradients on buttons/cards/text (hero atmospheric floor only).
- No additional chromatic accents as actions.
- No radii 16px+ on cards.
- No shadows for card separation.
- No chromatic body text (grey scale only: #d0d6e0 / #8a8f98 / #62666d).
- No mono font for headings or marketing copy.

## Surfaces

| Level | Name | Value |
|-------|------|-------|
| 0 | Void | `#08090a` |
| 1 | Carbon | `#0f1011` |
| 2 | Obsidian | `#161718` |
| 3 | Slate | `#23252a` |

## Layout

Max-width ~1200px centered, full-bleed dark backgrounds to viewport edges. Hero: left-aligned oversized headline (64-72px) with right-aligned link CTA, followed by a large product screenshot bleeding slightly beyond max-width. Sections alternate text-left/image-right 2-column compositions and full-width showcase bands, 96px gaps. Never 3-column card grids or masonry, low information density, one focal point per screen. Fixed top bar, logo left, links right, no sidebar, no mega-menu.

## Similar Brands
Vercel, Cursor, Raycast, Framer.
