# Audio brief — musique + SFX + voix off

## Musique principale

**Style cible** : Modern corporate tech, BPM 100-110, build progressif, climax sur le CTA, fade-out sur l'end-card. Inspire confiance, énergie maîtrisée, pas euphorique.

**3 tracks recommandés sur Epidemic Sound** (filtre : "Inspiring" + "Modern" + "Mid-energy") :

1. **"Bright Horizon" — by Anders Bothén** — Idéal premier choix. Synth pad doux + pulse rythmique + build mélodique sur 60s
2. **"Rising Tide" — by Megan Wofford** — Backup si #1 utilisé ailleurs. Plus orchestral
3. **"Forward Motion" — by Stationary Sign** — Plus électronique, conviendra mieux si cible jeune (startup, e-commerce)

URL Epidemic : https://www.epidemicsound.com — abonnement Personal $15/mois suffit (licence YouTube + Email autorisée).

**Alternative gratuite** : YouTube Audio Library (chercher "Corporate Inspiring 110 BPM"). Qualité inférieure mais zéro coût.

**Alternative premium** : Artlist.io ($16/mois) — souvent meilleur catalogue corporate.

## SFX (6 effets nécessaires)

À sourcer sur Epidemic Sound section "Sound Effects" ou freesound.org :

| # | SFX | Quand ? | Volume |
|---|---|---|---|
| 1 | Phone ringing (vintage rotary) — 3 rings | 00:00 → 00:05 | -10 dB |
| 2 | UI tick / data beep — count up | 00:06 → 00:08 (sync avec incrément 35%) | -15 dB |
| 3 | Pop UI (icon appear) — 3 hits | 00:25, 00:27, 00:29 | -15 dB |
| 4 | Whoosh transition (smooth) — 2 hits | 00:35, 00:58 | -10 dB |
| 5 | Card slide-in (soft swish) — 3 hits | 00:46, 00:46.2, 00:46.4 | -15 dB |
| 6 | Validation ding (success bell) — 1 hit | 00:59 (end-card) | -10 dB |

Recherches Epidemic recommandées :
- "Phone ringing vintage"
- "UI count up tick"
- "Notification pop modern"
- "Cinematic whoosh"
- "Card slide swish"
- "Success ding bell"

## Voix off (2 segments)

**Voix recommandée** : féminine FR-FR, ~30-35 ans, douce mais énergique, légèrement urgente sur le segment problème.

**Option A — Générer via ElevenLabs** (https://elevenlabs.io, plan Starter $5/mois, illimité pour ce volume)
- Voix recommandée : `Domi` (FR multilingue, expressive) ou `Aurore` si dispo
- Settings : Stability 0.45, Similarity 0.75, Style 0.30
- Format download : MP3 192 kbps

**Option B — Enregistrer toi-même ou collègue** au micro USB. Acceptable si environnement insonorisé (placard avec linges autour suffit pour 16s d'audio).

### VO Segment 1 — Problème (00:06 → 00:14, 8s)
```
35 % des appels en TPE et PME restent sans réponse. Chaque appel manqué, c'est un client qui passe au concurrent.
```
Ton : factuel mais urgent, pose la statistique avec gravité, ralentir sur "client" et "concurrent".

### VO Segment 2 — Preuve (00:42 → 00:48, 6s)
```
Bright Dental. Cabinet Lambert. Garage Dupont. Tous ont arrêté de perdre des appels.
```
Ton : énumération rythmique, 3 beats égaux sur les noms, conclusion confiante.

## Niveaux de mix (master timeline)

| Track | Volume | Note |
|---|---|---|
| Voix avatar HeyGen | -6 dB | Master clarity |
| Voix off ElevenLabs | -6 dB | Idem |
| Musique baseline | -18 dB | Discrète sous voix |
| Musique climax (00:46-00:58) | -12 dB | Monte sur le CTA |
| Musique fade-out (00:58 → 01:00) | -∞ dB | Disparition complète |
| SFX standard | -15 dB | Subtils |
| SFX whoosh / ring | -10 dB | Plus saillants |
| SFX validation ding | -10 dB | Présent |

**Ducking** : Activer side-chain compressor sur la track musique, déclenchée par les pistes voix (avatar + VO). Threshold -20 dB, ratio 4:1, attack 5ms, release 200ms. Résultat : la musique baisse automatiquement quand quelqu'un parle.

## Loudness target

- **YouTube standard** : -14 LUFS integrated, -1 dBTP true peak
- **Cold email (Loom, attachement)** : -16 LUFS pour ne pas saturer petits speakers laptop

Dans DaVinci, utiliser le panel **Fairlight Loudness Meter** → cible "ITU-R BS.1770" → ajuster master gain en fin pour atteindre la cible.

## Organisation des assets

Créer la structure dans le dossier projet :
```
assets/
├── heygen/           4 fichiers MP4 takes avatar
├── higgsfield/       6 fichiers MP4 scènes 3D
├── audio/
│   ├── music/        1 fichier WAV/MP3 musique principale
│   ├── sfx/          6 fichiers WAV/MP3 effets
│   └── vo/           2 fichiers WAV/MP3 voix off
└── images/           Photo Dr. Sarah Chen + logo Qwillio PNG
```
