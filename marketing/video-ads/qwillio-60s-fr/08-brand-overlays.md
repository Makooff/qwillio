# Brand overlays — specs visuelles

Tokens à respecter sur tous les éléments graphiques de la vidéo. Cohérence avec le site Qwillio.

## Couleurs (depuis frontend/src/styles/globals.css)

### Palette principale

| Token | OKLCH | Hex | Usage |
|---|---|---|---|
| `--q-accent` | `oklch(56% 0.22 264)` | `#6366f1` | Indigo primaire, boutons CTA, lower-thirds, big numbers |
| `--q-accent-hi` | `oklch(63% 0.21 264)` | `#7c7df3` | Hover/active state des CTA |
| `--q-violet` | `oklch(67% 0.26 299)` | `#a855f7` | Violet secondaire, accents, gradients |
| `--q-bg` | `oklch(8% 0.009 265)` | `#0a0a0f` | Background canvas dark |
| `--q-bg2` | `oklch(11% 0.013 265)` | `#13131f` | Backgrounds cards |
| `--q-text` | `oklch(95% 0.004 265)` | `#f4f4f8` | Texte principal sur dark |
| `--q-text-2` | `oklch(65% 0.007 265)` | `#a3a3ad` | Texte secondaire |
| `--q-ok` | `oklch(72% 0.18 145)` | `#34d399` | Succès, validation (rare dans la vidéo) |

### Gradient brand (sur logo, bouton CTA pulse, backgrounds)

```
linear-gradient(135deg, #6366f1 0%, #a855f7 100%)
```

Ou pour un effet plus subtil :
```
linear-gradient(135deg, #6366f1 0%, #7c3aed 50%, #a855f7 100%)
```

## Typography

**Font principale** : `Outfit` (Google Fonts, gratuite)
- Téléchargement : https://fonts.google.com/specimen/Outfit
- Poids à charger : `Regular 400`, `Medium 500`, `SemiBold 600`, `Bold 700`, `Black 900`

**Pas d'Inter** (banni par CLAUDE.md). Pas d'em-dash dans le texte écran (utiliser virgule, deux-points, parenthèses).

### Échelle typographique pour la vidéo

| Usage | Font | Size | Color |
|---|---|---|---|
| Hook ("Combien d'appels...") | Outfit Bold | 72 px | White |
| Big numbers ("35 %", "100") | Outfit Black | 180 px | Indigo `#6366f1` |
| Subtitles / captions | Outfit Medium | 48 px | White |
| Lower-third nom | Outfit Bold | 22 px | White |
| Lower-third titre | Outfit Regular | 16 px | White opacity 0.75 |
| Témoignage typewriter | Outfit Regular | 32 px | White |
| Card label ("appels décrochés") | Outfit Medium | 18 px | `#a3a3ad` |
| Card value ("98 %") | Outfit Black | 72 px | Indigo `#6366f1` |
| Bouton CTA | Outfit Bold | 32 px | White |
| Tagline finale | Outfit Medium | 36 px | White |
| URL end-card | Outfit Regular | 24 px | White opacity 0.7 |

## Lower-third template

Dimensions : `480 × 80 px`

Layout :
```
┌────────────────────────────────────────┐
│  [Texte ligne 1 - bold]                │ ← padding-top 14 px, padding-left 16 px
│  Texte ligne 2 - regular opacity 0.75  │ ← below, 4 px gap
└────────────────────────────────────────┘
```

Background fill : Indigo `#6366f1` opacity 0.92
Border : aucune
Corner radius : 8 px
Box shadow : `0 4px 24px rgba(99, 102, 241, 0.35)`

Animation IN : Slide-from-left 300ms `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo)
Animation OUT : Fade-out 200ms `cubic-bezier(0.23, 1, 0.32, 1)` (ease-out)

Position : bottom-left, 60 px margin from bottom, 60 px margin from left

## 3 cards metrics (scène 6)

Dimensions : `280 × 200 px` chacune

Layout :
```
┌──────────────────────┐
│                      │
│       98 %           │ ← big number Outfit Black 72px indigo
│                      │
│  appels décrochés    │ ← label Outfit Medium 18px gris
│                      │
└──────────────────────┘
```

Background : `#13131f` (q-bg2) avec subtle border `1px solid rgba(99, 102, 241, 0.25)`
Corner radius : 16 px
Box shadow : `0 8px 32px rgba(99, 102, 241, 0.20)`

Animation : Apparition staggered 200 ms entre chaque card. Scale 0.7 → 1.0 + fade-in, ease-out-expo 400 ms.

Positionnement : 3 cards alignées horizontalement, gap 32 px, centrées en bas de la scène 6.

## Bouton CTA pulse (scène 7)

Dimensions : `480 × 120 px`

Texte : "Créer mon compte → qwillio.com/register"
Font : Outfit Bold 32 px white

Background : Linear gradient indigo → indigo-hi
```
linear-gradient(135deg, #6366f1 0%, #7c7df3 100%)
```

Corner radius : 999 px (pill shape)
Box shadow : `0 8px 32px rgba(99, 102, 241, 0.50)`

Animation pulse : Scale 1.0 ↔ 1.05, cycle 1500 ms, easing `ease-in-out`. Loop infini pendant 8s.

Position : Bottom-center, 80 px margin from bottom.

## End-card final (scène 8)

Composition layered :

1. **Background** : Higgsfield render #6 (logo reveal 3D)
2. **Overlay tagline** : "Chaque appel répondu. Chaque lead capturé." (Outfit Medium 36 px white, centered)
   - Position : 60% from top, centered horizontally
   - Animation IN : Fade-in 400 ms à 00:59
3. **Overlay URL** : "qwillio.com/register" (Outfit Regular 24 px white opacity 0.7, centered)
   - Position : 70% from top, centered horizontally
   - Animation IN : Fade-in 400 ms à 00:59.5
4. **Overlay QR code** (optionnel) : 120×120 px, coin bas-droit, 40 px margin from edges
   - Lien : `https://qwillio.com/register?utm_source=cold_email&utm_campaign=video_v1`
   - Génération QR : https://www.qr-code-generator.com (gratuit, format PNG transparent)

## SVG logo Qwillio

Si tu n'as pas le SVG du logo sous la main, voici une version textuelle simple à utiliser pour le 3D Higgsfield ou pour overlay direct :

```svg
<svg width="240" height="60" viewBox="0 0 240 60" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
  </defs>
  <text x="0" y="42" font-family="Outfit" font-weight="700" font-size="36" fill="url(#g)">Qwillio</text>
</svg>
```

À utiliser comme placeholder. Si tu as la version officielle (logo avec mark), remplace ce SVG.

## Motion design — easings

Tous les easings à utiliser, depuis CLAUDE.md :

| Easing | Cubic-bezier | Usage |
|---|---|---|
| Standard ease-out | `cubic-bezier(0.23, 1, 0.32, 1)` | Fade out, exits |
| Ease-out-expo | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrées avec impact (cards, lower-thirds) |
| Ease-in-out | `cubic-bezier(0.77, 0, 0.175, 1)` | Pulse, loops |
| Ease-drawer | `cubic-bezier(0.32, 0.72, 0, 1)` | Slides longues (transitions scène) |

Press feedback : `scale(0.97)` sur :active state (utile si on génère une preview interactive sur le site).

Stagger entre éléments : `30-80 ms` typique. Pour les 3 cards de metrics : 200 ms (volontairement plus aéré).

## Bans à respecter (depuis CLAUDE.md)

- ❌ Pas de gradient text via `background-clip: text` sur les texts overlay (sauf le logo)
- ❌ Pas de borders side-stripe accents
- ❌ Pas de hero-metric template (big number + small label grid répétitive) — exception : les 3 cards de scène 6 sont OK car elles sont accent ponctuel, pas template système
- ❌ Pas de glassmorphism par défaut (sauf bulles RDV scène 5 ← OK, c'est ponctuel et "premium product shot")
- ❌ Pas de `transition-all` (toujours specific : transition-opacity, transition-transform)
- ❌ Pas d'em-dash dans le texte écran (utiliser virgule, deux-points, parenthèses)
- ❌ Pas d'Inter font (Outfit exclusivement)

## Checklist QA brand

Avant export final :

- [ ] Tous les indigos sont `#6366f1` (pas d'autre nuance accidentelle)
- [ ] Tous les violets sont `#a855f7`
- [ ] Tous les textes sont en Outfit (vérifier le rendering en fullscreen)
- [ ] Aucun em-dash (—) dans les texts overlay
- [ ] Lower-thirds bien positionnés, pas de overlap avec visage avatar
- [ ] Bouton CTA bien visible (contraste WCAG AA minimum sur le fond avatar)
- [ ] Logo Qwillio dans l'end-card est aligned center, pas blurry
- [ ] QR code (si présent) scannable au moins jusqu'à 80 cm de distance
