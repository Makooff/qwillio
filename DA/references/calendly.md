# Calendly — Style Reference
> Navy ink on cool marble.

**Theme:** light

Calendly reads as a quiet, confident scheduling workspace: a near-white canvas with generous breathing room, crisp white product cards floating on cool stone-gray, and all typography rendered in deep navy ink rather than pure black. The defining move is the navy (#0b3558) used everywhere text appears: headings, buttons, icons, links. A single vivid blue (#006bff) carries every primary action, while decorative pink and cyan blobs bleed from behind product mockups to add warmth without clutter. Components stay restrained: thin 1px hairline borders, subtle blue-tinted shadows, generous 24px card radii, 8px button corners.

## Tokens — Colors

| Name | Value | Role |
|------|-------|------|
| Ink Navy | `#0b3558` | Primary text, headings, icons, dark CTA backgrounds, nav links |
| Signal Blue | `#006bff` | Primary CTA fill, active nav, link accents, selected states |
| Slate Gray | `#476788` | Secondary body copy, helper text |
| Mist Gray | `#a6bbd1` | Disabled text, inactive labels, light icon strokes |
| Cloud | `#f8f9fb` | Page canvas, footer background |
| Paper | `#ffffff` | Card surfaces, elevated panels |
| Pebble | `#f0f3f8` | Badge backgrounds, input fills, hover washes |
| Hairline | `#d4e0ed` | Card and input borders, dividers |
| Coral Magenta | `#e55cff` | Decorative blob behind product cards, atmosphere only |
| Sky Cyan | `#0099ff` | Decorative blob, pairs with magenta |
| Deep Cobalt | `#004eba` | Badge text on Pebble fills, info labels |

## Tokens — Typography

**Gilroy** (substitute Manrope or Inter), weights 400/500/600/700. Editorial heading sizes: display 80px, heading-lg 68px, heading 50px, heading-sm 38px (all weight 700, lh 1.2). Button 18px/600, body 16px/400, body-sm 14px/500 (the workhorse for card titles), caption 12px.

## Tokens — Spacing & Shapes

Base 8px, comfortable. Scale: 8, 16, 24, 32, 40, 48, 56, 64, 72, 96.
Radius: feature cards **24px**, product cards **16px**, buttons/inputs **8px** (sharp-but-soft sweet spot), badges 9999px.
Shadows: three-layer **blue-tinted** stacks, e.g. `rgba(71,103,136,0.04) 0 4px 5px, rgba(71,103,136,0.03) 0 8px 15px, rgba(71,103,136,0.08) 0 30px 50px`. Never neutral black shadows.
Layout: max-width 1200px, section gap 48-64px, card padding 24px.

## Components

- **Primary CTA**: #006bff fill, white text, 18px/600, 8px radius.
- **Dark CTA**: #0b3558 fill, white text, pairs with primary.
- **Elevated Product Card**: white, 16px radius, three-layer blue shadow, often in front of a magenta/cyan decorative blob offset 20-40px.
- **Feature Accordion Item**: active heading #0b3558 18-20px/600 with #006bff icon; inactive #a6bbd1 16px/400; 1px hairline divider.
- **Pill Badge**: #e6f0ff bg, #004eba text, 12px/500, 50px radius.
- **Trust Logo Strip**: monochrome logos in #a6bbd1, evenly spaced, no cards.
- **Section Header Block**: centered H2 50-68px/700, subtext 16px #476788 max-width ~640px.

## Do's and Don'ts

- Never pure #000000 text, always Ink Navy or Slate Gray.
- All elevation blue-tinted, never neutral black.
- Editorial heading sizes 50-80px/700, undersized headings lose confidence.
- Buttons 8px radius, not 4px, not pill.
- Decorative blobs are atmosphere only, never functional UI color.
- No background gradients, flat surfaces with shadow-based elevation.
- H2 minimum 38px, H3 minimum 24px.

## Layout

Max-width 1200px centered. Hero two-column: left 80px headline + copy + stacked buttons, right product widget card backed by decorative blobs. Trust logo strip full-width below. Sections alternate centered header blocks and two-column feature blocks (text/product alternating sides). Card grids rare, side-by-side paired sections preferred. Nav 64px sticky, logo left, centered menu, CTA cluster right.

## Similar Brands
Linear, Notion, Loom, Webflow.
