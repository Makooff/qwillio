# Edit timeline — Adobe Premiere Pro

Workflow optimisé Premiere Pro (CC 2024+). Si tu fais du compositing avancé (lower-thirds animées, effets), tu peux envoyer une portion de la timeline vers After Effects via **Dynamic Link** (clic droit → Replace With After Effects Composition) — utile pour les blocs 3-6.

## Setup projet

1. **File → New → Project** → Name : `Qwillio Ads 60s FR` → Location : dossier dédié contenant `assets/`
2. **File → New → Sequence** (Ctrl/Cmd+N) :
   - Available Presets → `Digital SLR > 1080p > DSLR 1080p30`
   - OU onglet Settings (custom) :
     - Editing Mode : `Custom`
     - Timebase : `30 fps`
     - Frame Size : `1920 horizontal × 1080 vertical`
     - Pixel Aspect Ratio : `Square Pixels (1.0)`
     - Audio Sample Rate : `48000 Hz`
   - Sequence Name : `Master 60s FR`

3. **Color management** (recommandé) :
   - File → Project Settings → General → Display Color Management → cocher
   - Working color space : Rec. 709
   - Garde les rendus Higgsfield/HeyGen interprétés en sRGB par défaut

4. **Import des assets** via Media Browser (Window → Media Browser) ou drag-and-drop dans le Project panel. Organise en bins (clic droit dans Project panel → New Bin) :
   - `01 — HeyGen` (4 MP4)
   - `02 — Higgsfield` (6 MP4)
   - `03 — Audio Music` (1 file)
   - `04 — Audio VO` (2 files)
   - `05 — Audio SFX` (6 files)
   - `06 — Images` (logo, photo Dr. Chen)
   - `07 — Graphics` (créer plus tard : lower-thirds .mogrt, end-card)

## Timeline frame-by-frame

Tracks utilisés (de bas en haut) :

- **V1** : B-roll (Higgsfield)
- **V2** : Avatar (HeyGen)
- **V3** : Graphics overlays (cards, lower-thirds, CTA button)
- **V4** : Text titles (hooks, captions)
- **A1** : Voix avatar
- **A2** : Voix off
- **A3** : Musique
- **A4** : SFX

### Bloc 1 : Hook [00:00 → 00:05]

| Track | Asset | In | Out | Note |
|---|---|---|---|---|
| V1 | `higgs-01-phone-ringing.mp4` | 00:00 | 00:05 | Push-in déjà dans le rendu |
| V4 | Texte "Combien d'appels avez-vous manqué cette semaine ?" | 00:01 | 00:04.5 | Outfit Bold 72px, slide-up from bottom, ease-out-expo |
| A4 | `sfx-phone-ringing.wav` | 00:00 | 00:05 | -10 dB |

### Bloc 2 : Problème [00:05 → 00:15]

| Track | Asset | In | Out | Note |
|---|---|---|---|---|
| V1 | `higgs-02-stats-35.mp4` | 00:05 | 00:15 | |
| V4 | Big number "35 %" animated count-up | 00:06 | 00:08 | Outfit Black 180px, indigo `#6366f1` |
| V4 | Texte "Vos concurrents répondent. Pas vous." | 00:12 | 00:15 | Outfit SemiBold 48px |
| A2 | `vo-segment1-probleme.mp3` | 00:06 | 00:14 | -6 dB |
| A3 | `music-bright-horizon.mp3` | 00:05 | 01:00 | Fade-in 00:05→00:07, -18 dB baseline |
| A4 | `sfx-ui-tick.wav` ×3 (sync incréments) | 00:06 → 00:08 | | -15 dB |

### Bloc 3 : Solution intro [00:15 → 00:23]

| Track | Asset | In | Out | Note |
|---|---|---|---|---|
| V2 | `heygen-take1-intro.mp4` | 00:15 | 00:23 | |
| V1 | `higgs-05-phone-floating.mp4` (B-roll insert) | 00:21 | 00:23 | Cut-away 2s, picture-in-picture top-right 35% size |
| V3 | Lower-third "Marie · Réceptionniste IA Qwillio" | 00:16 | 00:22 | Slide-in 300ms |
| A1 | Voix avatar Take 1 | 00:15 | 00:23 | -6 dB, side-chain duck musique |

### Bloc 4 : Solution features [00:23 → 00:31]

| Track | Asset | In | Out | Note |
|---|---|---|---|---|
| V2 | `heygen-take2-features.mp4` | 00:23 | 00:31 | Crop left 50%, masque |
| V3 | Icon 3D "calendrier" (PNG ou Lottie) | 00:25 | 00:27 | Pop-in scale 0.8→1.0 + fade |
| V3 | Icon 3D "checkmark lead" | 00:27 | 00:29 | Idem |
| V3 | Icon 3D "phone urgence" | 00:29 | 00:31 | Idem |
| A1 | Voix avatar Take 2 | 00:23 | 00:31 | -6 dB |
| A4 | `sfx-pop-ui.wav` ×3 | 00:25, 00:27, 00:29 | | -15 dB |

### Bloc 5 : Solution scale [00:31 → 00:40]

| Track | Asset | In | Out | Note |
|---|---|---|---|---|
| V2 | `heygen-take3-scale.mp4` | 00:31 | 00:35 | Plein écran |
| V1 | `higgs-04-dataflow.mp4` | 00:35 | 00:40 | Wipe transition entrée |
| V4 | Big number "100" pulse | 00:32 | 00:34 | Outfit Black 180px |
| V4 | Texte "Sans une seule erreur." | 00:37 | 00:40 | Outfit Bold 48px, indigo |
| A1 | Voix avatar Take 3 | 00:31 | 00:40 | -6 dB |
| A4 | `sfx-whoosh.wav` | 00:35 | 00:36 | -10 dB |

### Bloc 6 : Preuve [00:40 → 00:50]

| Track | Asset | In | Out | Note |
|---|---|---|---|---|
| V1 | Photo Dr. Sarah Chen | 00:40 | 00:50 | Left 40% screen, halo warm |
| V3 | Texte témoignage typewriter | 00:40 | 00:46 | 30ms/char, Outfit Regular 32px |
| V3 | Card "98 %" + label "appels décrochés" | 00:46 | 00:50 | Scale 0.7→1.0, ease-out-expo |
| V3 | Card "< 1 s" + label "temps de réponse" | 00:46.2 | 00:50 | Idem, +200ms stagger |
| V3 | Card "24 / 7" + label "toujours là" | 00:46.4 | 00:50 | Idem, +400ms stagger |
| A2 | `vo-segment2-preuve.mp3` | 00:42 | 00:48 | -6 dB |
| A3 | Musique build (-15 dB) | 00:46 | 00:50 | Volume automation |
| A4 | `sfx-card-slide.wav` ×3 | 00:46, 00:46.2, 00:46.4 | | -15 dB |

### Bloc 7 : CTA [00:50 → 00:58]

| Track | Asset | In | Out | Note |
|---|---|---|---|---|
| V2 | `heygen-take4-cta.mp4` | 00:50 | 00:58 | Plein écran |
| V3 | Bouton CTA "Créer mon compte → qwillio.com/register" | 00:54 | 00:58 | 480×120 px, indigo `#6366f1`, pulse scale 1.0↔1.05 toutes 1.5s |
| A1 | Voix avatar Take 4 | 00:50 | 00:58 | -5 dB (priorité) |
| A3 | Musique climax (-12 dB) | 00:50 | 00:58 | |

### Bloc 8 : End-card [00:58 → 01:00]

| Track | Asset | In | Out | Note |
|---|---|---|---|---|
| V1 | `higgs-06-logo-reveal.mp4` | 00:58 | 01:00 | |
| V4 | Tagline "Chaque appel répondu. Chaque lead capturé." | 00:59 | 01:00.5 | Fade-in, Outfit Medium 36px |
| V4 | URL "qwillio.com/register" | 00:59.5 | 01:00.5 | Outfit Regular 24px, opacity 0.7 |
| A3 | Musique fade-out -∞ dB | 00:58.5 | 01:00 | |
| A4 | `sfx-whoosh.wav` + `sfx-ding.wav` | 00:58 | 00:59 | -10 dB |

## Color grade — Preset Lumetri "Qwillio Indigo"

1. **Window → Lumetri Color** pour ouvrir le panel
2. Crée un **Adjustment Layer** (clic droit dans Project panel → New Item → Adjustment Layer), drag-and-drop sur V5 (au-dessus de tout), étire-le sur les 60 secondes
3. Sélectionne l'Adjustment Layer → applique les réglages Lumetri Color :

   **Basic Correction** :
   - Temperature : -8 (push légèrement vers le bleu)
   - Tint : +4 (touche magenta pour les violets)
   - Exposure : 0
   - Contrast : +12

   **Creative > Look** : laisser sur `None` (LUT custom inutile, on monte la couleur en numérique)

   **Curves > RGB Curves** :
   - Master : ancrage point à (0.04, 0.04) pour crush les noirs vers indigo
   - Blue channel : tirer le shadows vers le haut (+5 sur les bas)

   **Color Wheels & Match > Shadows** : push vers indigo `#1a1d4d`
   **Color Wheels & Match > Midtones** : neutre
   **Color Wheels & Match > Highlights** : très léger push violet

   **HSL Secondary** :
   - Range Red : Saturation -10
   - Range Blue : Saturation +15
   - Range Magenta : Saturation +12

4. **Sauvegarder le preset** : panel Lumetri Color → bouton menu burger (☰) en haut à droite → **Save Preset** → nom `Qwillio Indigo` → enregistre dans `Presets/Lumetri/`. Le fichier `.prfpset` est réutilisable sur les futures vidéos Qwillio. Drag-and-drop direct depuis le Effects panel → Lumetri Presets sur n'importe quel clip ou adjustment layer.

> Note : Premiere ne génère pas de `.cube` LUT nativement. Si tu veux exporter en LUT cross-tool (DaVinci, FCP, Resolve), passe par un Adjustment Layer + Export → "Export Color Look" en `.look` (Premiere format) ou utilise DaVinci une seule fois pour générer le `.cube` à partir d'une référence frame.

## Lower-thirds template (Essential Graphics + .mogrt)

Créer un **Motion Graphics Template** réutilisable :

1. **Window → Essential Graphics** pour ouvrir le panel
2. Nouvel élément graphique sur V3 : sélectionne l'outil **Type Tool** (T) dans Program Monitor, clique pour ajouter texte, puis utilise **Rectangle Tool** dans le panel Essential Graphics pour le fond
3. Compose :
   - **Background** : Rect 480×80 px, fill `#6366f1`, Corner Radius 8 px (Properties → Appearance), Opacity 92%
   - **Texte ligne 1** : Outfit Bold 22px white, padding-left 16 px
   - **Texte ligne 2** : Outfit Regular 16px white opacity 75%
4. **Animation IN** : avec le graphique sélectionné → Effect Controls panel → Position + Opacity → poser keyframes : slide depuis -480 horizontal → 0 sur 300 ms, courbe Bezier (Temporal Interpolation → Ease Out, puis tirer les handles vers l'horizontale pour mimer ease-out-expo)
5. **Animation OUT** : fade Opacity 100% → 0% sur 200 ms en fin de clip
6. **Promote en template** : Essential Graphics panel → onglet **Browse** → drag le graphique depuis la timeline vers le panel → nomme `Qwillio Lower-Third` → marque les paramètres éditables (texte ligne 1, texte ligne 2) en cochant la pastille à côté de chaque propriété
7. **Export .mogrt** : clic droit sur le template dans Essential Graphics → Export Motion Graphics Template → enregistre dans `assets/templates/qwillio-lower-third.mogrt`. Réutilisable sur tous les autres lower-thirds : drag-and-drop depuis le panel, édite juste les 2 lignes de texte.

## End-card template

- **Background** : Higgsfield render #6 (logo reveal)
- **Overlay 1** : Tagline "Chaque appel répondu. Chaque lead capturé." (Outfit Medium 36px, white)
- **Overlay 2** : URL `qwillio.com/register` (Outfit Regular 24px, opacity 0.7)
- **Overlay 3** (optionnel) : QR code 120×120 px coin bas-droit, lien vers `qwillio.com/register?utm_source=cold_email&utm_campaign=video_v1`

## Export final

1. **File → Export → Media** (Ctrl/Cmd+M) avec la séquence sélectionnée :
   - Format : `H.264`
   - Preset : commencer par `Match Source — High bitrate` puis override les champs ci-dessous
   - Output Name : `qwillio-60s-fr-v1.mp4`

2. Onglet **Video** :
   - Basic Video Settings → Width 1920, Height 1080, Frame Rate 30, Field Order Progressive
   - Bitrate Settings → Bitrate Encoding `VBR, 2 pass` (qualité optimale), Target Bitrate `12 Mbps`, Maximum Bitrate `14 Mbps`
   - Résultat ~90 MB pour 60s (master haute qualité pour YouTube/Loom)

3. Onglet **Audio** :
   - Audio Format : AAC
   - Bitrate : 192 kbps
   - Sample Rate : 48 kHz

4. Onglet **Multiplexer** : MP4 (Standard)

5. **Export** (rendu local, ~2-3 min) OU **Send to Media Encoder** (Ctrl/Cmd+Shift+M) pour rendre en background pendant que tu continues à éditer la variante verticale

6. **Variant email-friendly** (10-15 MB) : duplique le preset, change Target Bitrate à `1.5 Mbps` Max `2 Mbps`, Output Name `qwillio-60s-fr-v1-email.mp4`

7. **QA final** sur le master :
   - Lecture sur 3 devices (laptop, mobile, TV/écran externe)
   - Audio mix équilibré ? (cf. 05-audio-brief.md cible -14 LUFS)
   - Pas de jump cut visible aux transitions de scène ?
   - Bouton CTA bien lisible 480×120 px ?
   - End-card freeze sur le logo pour thumbnail YouTube ?

## Variant vertical 1080×1920 (LinkedIn/Insta/TikTok)

Deux approches selon la précision souhaitée :

**Approche A — Auto Reframe (rapide, recommandée)** :
1. Project panel → clic droit sur la sequence `Master 60s FR` → **Auto Reframe Sequence**
2. Aspect Ratio : `Vertical 9:16`, Motion Preset : `Default` (ou `Faster` pour plans rapides)
3. Premiere génère une nouvelle sequence `Master 60s FR - Vertical (Auto-Reframed)` qui recadre dynamiquement les sujets centrés (visages avatar, big numbers, cards)
4. Review chaque plan, corrige manuellement avec le **Motion → Position** des clips si Auto Reframe rate un sujet
5. Repositionne lower-thirds et textes pour le ratio vertical (souvent décalés vers le centre)

**Approche B — Sequence manuelle (contrôle total)** :
1. File → New → Sequence → 1080×1920 30fps → nom `Master 60s FR Vertical`
2. Drag la sequence master en **Nested Sequence** dans la nouvelle timeline
3. Sélectionne le nest → Effect Controls → Motion → Scale et Position pour recadrer
4. Repositionne manuellement tous les overlays via Essential Graphics (les .mogrt s'adaptent au ratio mais les textes doivent être centrés)

6. Export `qwillio-60s-fr-vertical.mp4` en H.264 1080×1920 12 Mbps (mêmes settings que le master horizontal)

## Thumbnail YouTube (pour cold email preview)

1. Pendant le rendu, faire un screenshot du frame à 00:54 (avatar + bouton CTA visible)
2. Ouvrir dans Photoshop / Figma / Photopea (gratuit)
3. Ajouter texte over : "Marie ne dort jamais." (Outfit Black 96px blanc)
4. Export en JPEG 1280×720, < 200 KB
5. Upload comme custom thumbnail YouTube
