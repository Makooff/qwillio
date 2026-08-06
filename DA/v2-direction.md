# Direction artistique V2 — « Papier & Signal »

Refonte marketing 2026. Fusion précise de deux références (`DA/references/elevenlabs.md` pour le registre clair, `DA/references/linear.md` pour les sections sombres, `DA/references/calendly.md` en appoint layout), sur l'identité mauve du logo (`DA/couleurs.md` fait autorité sur les 4 couleurs de marque). S'applique aux pages `frontend/src/pages/v2/` et composants `frontend/src/components/v2/`. Le registre Produit (dashboard) n'est pas concerné.

## Idée directrice

Papier chaud, signal froid. Le site est une feuille coquille d'œuf, calme et éditoriale (ElevenLabs), écrite avec la précision d'un instrument (Linear). Le mauve Qwillio n'est jamais du chrome UI sur fond clair : il vit dans les visuels produit (les deux cercles du logo), les eyebrows sémantiques et les sections sombres « drenched », où il devient l'unique élément chromatique. Indigo `#7A5FFF` = ce qui décroche (réceptionniste, inbound). Violet `#CD6BFB` = ce qui sort (agent, outbound).

## Tokens (classes Tailwind `q2-*` + variables `--q2-*` dans `styles/v2.css`)

### Registre clair (canvas par défaut)
| Usage | Valeur | Classe |
|---|---|---|
| Canvas page | `#FDFCFC` | `bg-q2-canvas` |
| Bande de section / feature card (plate, sans ombre ni bordure) | `#F5F3F1` | `bg-q2-band` |
| Plate d'icône, fond input, hairline | `#EBE8E4` | `bg-q2-plate` / `border-q2-plate` |
| Encre (titres, CTA rempli) — jamais #000 pur | `#1D1D1F` | `text-q2-ink` / `bg-q2-ink` |
| Secondaire fort, labels | `#44403B` | `text-q2-graphite` |
| Corps de texte | `#777169` | `text-q2-body` |
| Tertiaire, footnotes | `#A59F97` | `text-q2-faint` |
| Marque indigo (inbound) | `#7A5FFF` | `*-q2-indigo` |
| Marque violet (outbound) — PAS `#cd6afb` | `#CD6BFB` | `*-q2-violet` |
| Marque deep (pressed, lentille) | `#7349FE` | `*-q2-deep` |

Ombres : « whisper » `var(--q2-shadow-whisper)` (cards élevées rares), hover éditorial `var(--q2-shadow-hover)` = `0 30px 80px rgba(20,16,50,0.10)`. Jamais d'ombre noire neutre lourde.

### Registre drenched (sections sombres, max 2 par page)
| Usage | Valeur | Classe |
|---|---|---|
| Fond section | `#08090A` | `bg-q2-void` |
| Card | `#0F1011` | `bg-q2-carbon` |
| Surface élevée | `#161718` | `bg-q2-obsidian` |
| Bordures (l'élévation vient d'elles, zéro ombre) | `#23252A` / `#383B3F` | `border-q2-graphite-d` / `border-q2-smoke-d` |
| Titres | `#FFFFFF` ; corps `#D0D6E0` ; muted `#8A8F98` | `text-white` / `text-q2-mist` / `text-q2-fog` |
| Accent : UNE seule action chromatique par section | `#7A5FFF` (ou `#B9A8FF` si contraste insuffisant) | `bg-q2-indigo` |

Voile de marque optionnel sur le fond drenched : dégradé vers `oklch(10% 0.015 285)` (le noir Qwillio n'est jamais neutre). Cards drenched : radius 12px (Linear).

## Typographie (Outfit uniquement, 300-800 chargés)

| Rôle | Spec |
|---|---|
| Display H1 | `clamp(2.8rem, 6.5vw, 5.8rem)` / **300** / `-0.02em` / lh 1.08 — classe `.q2-display` |
| H2 | `clamp(2rem, 4.5vw, 3.4rem)` / 300 / `-0.02em` / 1.13 — `.q2-h2` |
| H3 | 24px / 400 / `-0.012em` / 1.33 |
| Lead | 20px / 400 / 1.35 |
| Corps | 16px / 400 / 1.5 / `+0.01em` |
| Petit corps | 14px / 400 / 1.5 / `+0.01em` |
| Bouton | 14px / 500 |
| Eyebrow | 11px / 600 / `0.18em` uppercase, indigo ou violet selon la sémantique |
| Prix | `clamp(2.2rem, 3.2vw, 3rem)` / 300 / `-0.04em` / `tabular-nums` |

Le whisper 300 est LA signature V2 : jamais de poids >500 en display (eyebrow 600 excepté). Un mot serif italic système max par titre (`.q2-serif-word`). Chiffres changeants toujours `tabular-nums`. Interdits : Inter, em dash, gradient text. Espaces insécables avant `:;?!` et entre nombre et unité (`99 €`, `250 min`).

## Formes

- Boutons, chips, tags : **pilule 9999px**, non négociable. Padding bouton 10px 16px.
- CTA primaire sur clair : pilule **encre pleine** (`bg-q2-ink text-white`), secondaire : pilule outline (`border-q2-plate`), jamais de CTA mauve sur canvas clair.
- Sur drenched : pilule blanche (nav) ou pilule indigo (l'action chromatique unique).
- Cards clair 20px, grandes 24-28px ; cards drenched 12px ; inputs 12px.
- Séparation : hairlines `1px #EBE8E4` + alternance canvas/bande, pas de boîtes ni d'ombres.

## Espacement & layout

Base 4px. Sections **96-128px** (`py-24` à `py-32`). Max-width **1200px** (`max-w-[1200px]`), gouttières 24px mobile / 40px desktop. Padding card 32px. Gaps éléments 8-16px.

Hero asymétrique : titre whisper à gauche, description/visuel à droite, pilules empilées sous le titre. Features en 2 colonnes alternées texte/visuel. Jamais de grille de cards identiques, jamais de hero centré + 3 tuiles métriques (bans DA). Rythme type : hero (canvas) → strip crédibilité → bande taupe → drenched indigo mi-page → canvas → drenched violet avant footer → footer crème.

## Motion (emil-design-eng)

- Entrées : opacity + translateY 16-24px, 400-550ms, `cubic-bezier(0.16, 1, 0.3, 1)`, `once`, stagger 40-70ms (`RevealV2`).
- Press `scale(0.97)` (global, déjà en place). Feedback boutons 100-160ms. Hover cards : `translateY(-2px)` + ombre hover, `transition-transform`/`transition-shadow` nommées.
- Transform/opacity uniquement. Jamais depuis `scale(0)` (min 0.94). Jamais `transition-all`. Popovers depuis l'origine du trigger. `prefers-reduced-motion` respecté (kill-switch global existant). Ce qui est fréquent (nav, toggle) ne s'anime pas.
- Un seul moment de bravoure par page (le hero).

## Bans absolus (hérités DA + références)

Gradient text ; side-stripe `border-left` accent ; hero-metric grid ; grilles de cards identiques ; glassmorphism par défaut ; modal comme première solution ; `transition-all` ; Inter ; emojis ; em dashes ; noir pur `#000` en texte ; blanc pur `#FFF` en fond de page ; ombres noires neutres ; accents mauves sur boutons/liens du canvas clair ; plus d'une action chromatique par section drenched ; poids display >500.

## Registre PRODUIT (dashboard client) — addendum phase 2

Design neuf « instrument » (Linear, DA/references/linear.md), PAS un reskin de ProBlocks. S'applique à `components/v2/app/` et `pages/v2/app/`.
- **Surfaces** : canvas `q2-void` #08090A plein cadre ; sidebar et cards `q2-carbon` #0F1011 ; élevé `q2-obsidian` #161718. Élévation par bordures `#23252A` (1px) uniquement, **zéro ombre**. Voile indigo optionnel en fond (`--q2-void-tint`).
- **Texte** : titres blancs, corps `q2-mist` #D0D6E0, muted `q2-fog` #8A8F98. Corps UI 13.5-14px, meta 11-12px, chiffres `tabular-nums`.
- **Titres de page** : rendus par `AppShell` (`.q2p-page-title`, 20px/400/-0.012em) — les pages ne redessinent JAMAIS leur h1 (répare le bug V1 du titre invisible).
- **Accent** : indigo `#7A5FFF` (`q2-lift` #B9A8FF pour les petits textes), UNE action primaire par vue. États `--q2p-ok/warn/bad/info` = signal seulement.
- **Formes** : cards 12px, inputs 12px, boutons pilule ; rangées de réglages 56px hairline ; densité compacte (base 4px, gaps 8-12px).
- **Motion** : entrée de page `.q2p-page` (180ms), press global, pas d'animation sur la nav ; graphes recharts sobres (1 série accent, grille hairline).
- **Kit unique** : `components/v2/app/Blocks.tsx` remplace ProBlocks/OverviewBlocks/primitives locales côté client. Interdits identiques au reste de la V2 (+ jamais de glass/blur décoratif).

## Voix (DA/voix.md, inchangée)

Ne rien écrire d'improuvable. Pas de métriques inventées, pas de témoignages fabriqués. Vocabulaire banni : révolutionnaire, game-changer, disruptif, etc. Français d'abord, anglais traduit. La strip crédibilité n'affiche que des propriétés vérifiables du produit (FR/EN, < 1 s, 24/7).

## Addendum phase 3 (2026-08-03)

- **Avatars de personnages** : `frontend/public/characters/{id}.webp` (10 visages, PR #79). Rendus en rond (48 px dashboard, 56-64 px galerie marketing). Repli sans image : pastille initiale (`ashley`, `ethan`) ; « Ma voix » : icône micro.
- **Hero marketing** : voile lilas `#f5f2fb → #fdfcfc` accordé au fond des avatars, halo radial indigo doux derrière l'illustration. `PhoneDashboard3D` : iPhone 17 Pro, écran = mini-dashboard du registre produit.
- **Exception glassmorphism documentée** : la barre d'onglets translucide (`backdrop-blur`) DANS l'écran de `PhoneDashboard3D` est une illustration d'iOS 26, pas du chrome UI du site. Le ban glassmorphism reste entier partout ailleurs.
- **Animation** : GSAP (tilt pointeur du téléphone, stagger galerie, parallaxe ScrollTrigger de ScreenParade) et Remotion Player (transcript vivant, chunk lazy). Toujours transform/opacity, `prefers-reduced-motion` = état final statique.
- **Clonage de voix (copy)** : conditions prouvées par le code uniquement : 20-90 s, consentement explicite revalidé serveur, remplaçable/supprimable, utilisable dans la foulée (Instant). Ne jamais promettre l'appel test avec la voix clonée.
