# Qwillio 60s FR, rendus finaux (v2)

Montage motion-design programmatique (Remotion + ffmpeg), DA Qwillio (Outfit, indigo/violet), style Apple/Stripe. **Produit-driven** (UI Qwillio recreee animee) + typographie cinetique. Pas d'avatar IA en heros (insert court uniquement), pas de b-roll IA hallucine.

| Fichier | Format | Usage |
|---|---|---|
| `qwillio-60s-fr-1080p.mp4` | 1920x1080, H.264, ~52s | Master YouTube / Loom / site |
| `qwillio-60s-fr-email.mp4` | 1280x720 | Cold email (leger) |
| `qwillio-60s-fr-vertical-9x16.mp4` | 1080x1920 | LinkedIn / Insta / TikTok |

## Structure (10 scenes)
Hero (typo) -> Probleme (1 appel sur 3) -> Appel en direct (produit: waveform, transcript, RDV confirme) -> Agenda qui se remplit (produit) -> Leads/CRM (produit) -> Dispo 24/7 -> Insert avatar court -> Benefices -> CTA -> End-card.

## Voix off (a fournir)
La piece est calee pour tenir sans voix (typo + musique). Pour ajouter ta voix:
1. Depose ton fichier en `remotion/public/assets/audio/voiceover.wav` (ou .mp3).
2. Decommente le bloc `<Audio src=.../voiceover.wav />` dans `remotion/src/MainV2.tsx`.
3. Relance `npx remotion render QwillioV2 ...` (voir `../remotion/README.md`).
Ideal: enregistrer "to picture" (caler la voix sur l'image), ou je reajuste le timing des scenes a ta VO.

## Limites connues (a finir si besoin)
- Musique: lit ambient genere (ffmpeg), royalty-free par construction. Remplacable: depose un fichier WAV en `../remotion/public/assets/audio/music-bed.wav` et relance le rendu (`npm run render` depuis `../remotion/`) pour utiliser ta nouvelle piste.
- Pas de photo de temoignage (bloc preuve typographique + benefices, aucun faux portrait IA genere).
- Liens mp4 HeyGen sources expirent (~12 juin); le montage final est autonome (clips embarques dans le rendu).

## Re-render
Voir `../remotion/README.md` (composition `QwillioV2`).
