# Qwillio 60s FR, projet Remotion

Montage video programmatique (React -> mp4) avec la DA Qwillio. Genere le master 1080p; les variantes email/vertical sont produites en ffmpeg (voir `../renders`).

## Stack
- Remotion 4 (rendu React -> video, springs pour le feel Apple/Stripe)
- Police Outfit self-hosted (`public/fonts/Outfit.ttf`), chargee via `<FontLoader/>`
- Tokens DA dans `src/theme.ts` (indigo #6366f1, violet #a855f7, eases CLAUDE.md)

## Structure
- `src/Root.tsx` : composition `Qwillio60`, 1910 frames @ 30fps, 1920x1080
- `src/Main.tsx` : sequencage des 8 blocs + audio (voix avatar, 2 VO, musique)
- `src/components.tsx` : primitives animees (RevealText, CountUp, LowerThird, StatCard, CTAButton, FeatureChip, FontLoader, Grade, Grain)
- `src/theme.ts`, `src/fonts.ts`

## Pre-requis (assets non commites, voir .gitignore)
Le dossier `public/assets/` (clips + audio) n'est pas versionne. Pour re-rendre, le repeupler:
1. Telecharger les 10 clips depuis `../assets-manifest.json` (champs `url`) vers `public/assets/heygen` et `public/assets/higgsfield`.
2. Voix off + musique: regenerer (HeyGen TTS + ffmpeg) ou recopier depuis `../assets/audio`.

## Commandes
```bash
npm install
npm run studio    # preview interactif
npm run render    # rendu master -> out/qwillio-60s-fr-1080p.mp4
```
Rendu utilise: `npx remotion render Qwillio60 out/qwillio-60s-fr-1080p.mp4 --concurrency=2 --crf=18 --timeout=120000`

## Variantes (ffmpeg, depuis le master)
```bash
# Email 720p
ffmpeg -i master.mp4 -vf scale=1280:720 -c:v libx264 -crf 30 -preset veryfast -c:a aac -b:a 128k email.mp4
# Vertical 9:16 (fond floute)
ffmpeg -i master.mp4 -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:4[bg];[0:v]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2" -c:v libx264 -crf 20 -c:a aac -b:a 192k vertical.mp4
```
