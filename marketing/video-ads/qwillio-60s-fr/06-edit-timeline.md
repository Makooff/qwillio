# Edit timeline — DaVinci Resolve 19 (gratuit)

Si tu n'as pas DaVinci Resolve : https://www.blackmagicdesign.com/products/davinciresolve (cross-platform Win/Mac/Linux, version gratuite suffit largement). Alternative simple : CapCut Desktop (gratuit, plus limité mais OK).

## Setup projet

1. New Project → "Qwillio Ads 60s FR"
2. Project Settings :
   - Timeline resolution : `1920 × 1080 HD`
   - Frame rate : `30 fps`
   - Color science : `DaVinci YRGB Color Managed`
   - Output : H.264, 12 Mbps, AAC 192 kbps

3. Import tous les assets de `assets/` dans un Bin organisé :
   - `01 — HeyGen` (4 MP4)
   - `02 — Higgsfield` (6 MP4)
   - `03 — Audio Music` (1 file)
   - `04 — Audio VO` (2 files)
   - `05 — Audio SFX` (6 files)
   - `06 — Images` (logo, photo Dr. Chen)
   - `07 — Graphics` (créer plus tard : lower-thirds, end-card)

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

## Color grade — LUT "Qwillio Indigo"

Créer un node DaVinci Color :

1. **Primary correction** :
   - Lift : R 0.00 / G 0.00 / B 0.04 (push blacks vers indigo)
   - Gamma : neutre
   - Gain : R 0.98 / G 1.00 / B 1.05 (légère pousse vers le bleu)

2. **Saturation** : 1.10 sur les rouges -10 / bleus +15 / violets +12

3. **Curves** :
   - Y curve : crush noirs à 0.04 minimum
   - S-curve subtile sur midtones pour contraste

4. Sauvegarder en `.cube` LUT exportable, à appliquer sur l'output node final.

## Lower-thirds template

Créer un template DaVinci Fusion :

- **Background** : Rect 480×80 px, fill `#6366f1`, corner radius 8 px, opacity 0.92
- **Texte ligne 1** : Outfit Bold 22px white, padding-left 16 px
- **Texte ligne 2** : Outfit Regular 16px opacity 0.75
- **Animation IN** : slide-from-left 300ms ease-out-expo
- **Animation OUT** : fade-out 200ms ease-out

Sauvegarder le template → réutilisable sur tous les lower-thirds.

## End-card template

- **Background** : Higgsfield render #6 (logo reveal)
- **Overlay 1** : Tagline "Chaque appel répondu. Chaque lead capturé." (Outfit Medium 36px, white)
- **Overlay 2** : URL `qwillio.com/register` (Outfit Regular 24px, opacity 0.7)
- **Overlay 3** (optionnel) : QR code 120×120 px coin bas-droit, lien vers `qwillio.com/register?utm_source=cold_email&utm_campaign=video_v1`

## Export final

1. **Deliver** tab → Render Settings :
   - Format : MP4
   - Codec : H.264
   - Resolution : 1920 × 1080
   - Frame rate : 30 fps
   - Quality : Restrict to 12 Mbps (~90 MB pour 60s, master haute qualité pour YouTube/Loom). Pour attach email direct, ré-exporter en parallèle à 1.5-2 Mbps (~10-15 MB) — variant `qwillio-60s-fr-v1-email.mp4`
   - Audio codec : AAC 192 kbps stereo
   - Filename : `qwillio-60s-fr-v1.mp4`

2. Hit Render → attendre ~2-3 min export

3. QA final :
   - Lecture sur 3 devices (laptop, mobile, TV)
   - Audio mix équilibré ?
   - Pas de jump cut visible ?
   - Bouton CTA bien lisible ?
   - End-card freeze sur le logo pour thumbnail YouTube ?

## Variant vertical 1080×1920 (LinkedIn/Insta)

1. Duplicate timeline → renomme "Vertical"
2. Project Settings → Timeline resolution `1080 × 1920`
3. Pour chaque clip vidéo : ouvrir Inspector → Crop & Pan, recadrer manuellement pour garder le sujet centré
4. Texts et lower-thirds : ajuster taille et position pour ratio vertical
5. Export en `qwillio-60s-fr-vertical.mp4`

## Thumbnail YouTube (pour cold email preview)

1. Pendant le rendu, faire un screenshot du frame à 00:54 (avatar + bouton CTA visible)
2. Ouvrir dans Photoshop / Figma / Photopea (gratuit)
3. Ajouter texte over : "Marie ne dort jamais." (Outfit Black 96px blanc)
4. Export en JPEG 1280×720, < 200 KB
5. Upload comme custom thumbnail YouTube
