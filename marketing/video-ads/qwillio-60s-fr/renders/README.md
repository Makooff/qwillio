# Qwillio 60s FR, rendus finaux

Montage motion-design programmatique (Remotion + ffmpeg), DA Qwillio (Outfit, indigo/violet), style Apple/Stripe.

| Fichier | Format | Usage |
|---|---|---|
| `qwillio-60s-fr-1080p.mp4` | 1920x1080, H.264, ~63.7s, 28 MB | Master YouTube / Loom / site |
| `qwillio-60s-fr-email.mp4` | 1280x720, ~2.2 MB | Cold email (leger) |
| `qwillio-60s-fr-vertical-9x16.mp4` | 1080x1920, ~12 MB | LinkedIn / Insta / TikTok |

## Composition
8 blocs: hook telephone, probleme (35%), intro avatar + lower-third Marie, features (3 chips), scale (100 appels), preuve (citation + stat-cards 98% / <1s / 24/7), CTA (bouton), end-card logo.

Sources: 6 clips Higgsfield (seedance_2_0) + 4 takes HeyGen (avatar Brandon, voix Etienne Moreau) + 2 voix off FR (HeyGen TTS, voix Harper). Voir `../assets-manifest.json`.

## Limites connues (a finir si besoin)
- Musique: lit ambient genere (ffmpeg), royalty-free par construction. Remplacable: depose un mp3 dans `assets/audio/music-bed.wav` et relance le rendu.
- Pas de photo de temoignage (le bloc preuve est typographique + stat-cards, aucun faux portrait IA genere).
- Liens mp4 HeyGen sources expirent (~12 juin); le montage final est autonome (clips embarques dans le rendu).

## Re-rendre
Voir `../remotion/README.md`.
