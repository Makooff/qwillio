# ElevenLabs — Style Reference
> Warm cream editorial with whispered headlines. A Bauhaus studio notebook, eggshell paper, black ink, a single violet and orange spark for product moments.

**Theme:** light

ElevenLabs runs on a warm-white minimalism: an off-white eggshell canvas (#fdfcfc) holding black type and a single layer of warm taupe surfaces (#f5f3f1). The brand voice is quiet and confident, whisper-weight Waldenburg at 300 carves display headlines with extreme tightness (-0.02em), while Inter at 400/500 carries everything else with calm neutrality. Two accent sparks, vivid violet #0447ff and vivid orange #ff4704, only ignite inside product visuals (audio spheres, product icons), never as UI chrome. Components stay flat or barely elevated with hairline 1px borders, generous 20px radii on cards, and fully-pilled 9999px buttons. The system feels like a Bauhaus studio on cream paper: restrained, editorial, and technically precise.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Eggshell | `#fdfcfc` | `--color-eggshell` | Page canvas, button surfaces, card surfaces. Warm off-white rather than clinical white, avoids digital glare, paper-like calm |
| Warm Taupe | `#f5f3f1` | `--color-warm-taupe` | Section bands, feature cards, secondary surface level. One step deeper than eggshell, quiet separation without borders |
| Stone | `#ebe8e4` | `--color-stone` | Hairline borders, dividers, icon plate backgrounds. Warm gray between taupe and mid-gray without feeling cold |
| Ink | `#000000` | `--color-ink` | Primary text, filled buttons, nav, links. Pure black anchors the warm palette, the system's only hard contrast |
| Graphite | `#44403b` | `--color-graphite` | Strong secondary text, section labels |
| Smoke | `#777169` | `--color-smoke` | Body text, muted descriptions, caption labels. The dominant readable-but-quiet voice |
| Ash | `#a59f97` | `--color-ash` | Faintest helper text, tertiary descriptions, footnotes |
| Violet Spark | `#0447ff` | `--color-violet-spark` | Product visual accent only (audio spheres, product icons). Never UI chrome |
| Ember Orange | `#ff4704` | `--color-ember-orange` | Product visual accent, paired with Violet Spark inside artwork, never in buttons or links |

## Tokens — Typography

- **Waldenburg** (substitute: Inter 300 or Söhne Light): display and heading only. 32/36/48px, weight **300**, line-height 1.08-1.17, letter-spacing **-0.02em** (-0.96px at 48px, -0.72px at 36px, -0.64px at 32px). The ultra-light weight is anti-convention, authority through restraint.
- **Inter** (400, 500): everything outside display. 10-20px, line-height 1.47-1.6, slight **+0.01em** tracking at 14-16px. Weight 500 reserved for buttons and emphasized links.
- **Geist Mono** (400, 13px, lh 1.69): technical micro-copy only, used sparingly.

### Type Scale

| Role | Size | Line Height | Letter Spacing |
|------|------|-------------|----------------|
| caption | 10px | 1.6 | — |
| body-sm | 14px | 1.5 | 0.14px |
| body | 16px | 1.5 | 0.16px |
| subheading | 18px | 1.6 | — |
| body-lg | 20px | 1.35 | — |
| heading-sm | 32px | 1.13 | -0.64px |
| heading | 36px | 1.17 | -0.72px |
| display | 48px | 1.08 | -0.96px |

## Tokens — Spacing & Shapes

Base unit 4px, density comfortable. Spacing scale: 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96, 160.

Radius: tags/buttons **9999px**, cards **20px**, large cards **24px**, inputs 4px, small elements 4-10px.

Shadows (whisper only):
- `--shadow-subtle`: `rgba(0,0,0,0.4) 0 0 1px, rgba(0,0,0,0.04) 0 1px 1px, rgba(0,0,0,0.04) 0 2px 4px`
- inset borders/focus halos: `rgba(0,0,0,0.075) 0 0 0 0.5px inset`

Layout: page max-width **1280px**, section gap **96-125px**, card padding **32px**, element gap 8-16px.

## Components

- **Filled Pill Button** (primary): black fill, white text, 9999px radius, 16px horizontal padding, 14px/500, 1px solid #e5e5e5 border. The system's most recognizable component.
- **Outline Pill Button** (secondary): #fdfcfc fill, black text, 9999px radius, 14px padding, 1px #e5e5e5 border.
- **Ghost Link Button**: transparent, black text, pill, border on hover only.
- **Feature Card (Taupe)**: #f5f3f1 fill, 20px radius, 32px horizontal padding, **no shadow, no border**. The dominant card pattern. Flat, quiet.
- **White Card with Whisper Shadow**: #fdfcfc fill, 20px radius, three-layer whisper shadow. Used sparingly.
- **Large Feature Card**: #f5f3f1, 24px radius, generous padding.
- **Tab Pill**: white fill, pill, 1px border, active state marked by a small colored dot.
- **Hairline Divider**: 1px solid #ebe8e4. Preferred over whitespace when sections need explicit separation (54 uses per page).
- **Audio Sphere Visual**: ~200px circular radial gradient blending violet/orange/pink, soft edges. The signature visual.
- **Top Nav Bar**: transparent on canvas, 50px height, logo left, links center-left (14px), outline Log in + filled Sign up right. Invisible until scroll.
- **Trust Logo Grid**: grayscale low-contrast partner logos on bare canvas, not boxed.

## Do's and Don'ts

### Do
- Waldenburg weight 300 for all display 32px+, never bold it.
- All buttons/tags/tab pills at 9999px radius, non-negotiable.
- Black filled + eggshell outline as the only button hierarchy, no colored CTA fills.
- Reserve accents exclusively for product visuals.
- 1px #ebe8e4 hairlines for section separation, borders over drop shadows.
- -0.02em on display, +0.01em on 14-16px body (opposite tracking directions, deliberate contrast).
- Surfaces stack eggshell → taupe → stone, never pure white or pure gray.

### Don't
- No bold/semibold display. No accents on interactive UI. No heavy drop shadows. No new accent colors (97% achromatic palette). No sharp corners (<8px) on cards. No pure white #ffffff backgrounds. No display weights on body copy.

## Surfaces

| Level | Name | Value |
|-------|------|-------|
| 1 | Eggshell Canvas | `#fdfcfc` |
| 2 | Warm Taupe | `#f5f3f1` |
| 3 | Stone Plate | `#ebe8e4` |

## Layout

Full-width sections in a single max-width 1280px centered column, 64px outer gutters. Hero asymmetric: left-aligned 48px whisper headline, right-aligned body description, two pill buttons stacked below the headline. Sections alternate eggshell/taupe bands with 96-125px gaps. Editorial rhythm: generous whitespace, one major visual per section, no card grids below the trust section. Minimal top bar, no sticky, no mega-menu.

## Similar Brands
Linear, Vercel, Stripe, Notion, Framer.
