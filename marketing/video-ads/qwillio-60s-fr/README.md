# Qwillio — Vidéo ads explicative 60s FR

Pack créatif complet pour produire **1 vidéo explicative de 60 secondes** en français, à attacher en cold email aux prospects TPE/PME.

## Concept en une phrase

Marie, votre réceptionniste IA, décroche avant la deuxième sonnerie, prend les rendez-vous, qualifie les leads, ne dort jamais. Premier mois offert.

## Cible

Décideurs TPE/PME francophones perdant ~35% de leurs appels entrants. Niches prioritaires : dentaire, juridique, immobilier, services à domicile, restauration, automobile.

## Format de sortie

- **Principal** : 1920×1080, H.264, 30fps, 10-15 MB, ~60s
- **Vertical** : 1080×1920 re-cadré pour LinkedIn/Insta
- **Hébergement** : YouTube unlisted (lien dans email) + Loom backup

## Coût estimé

| Poste | Coût |
|---|---|
| HeyGen (1 min avatar) | $0 plan Free / $30 plan Creator |
| Higgsfield (30s motion) | ~$10 plan Pro |
| Musique Epidemic Sound | $15/mois personal |
| Édition Premiere Pro | inclus dans abonnement Creative Cloud |
| **Total première vidéo** | **~$25** |

## Temps estimé

| Étape | Durée |
|---|---|
| Lecture brief + génération HeyGen | 30 min |
| Higgsfield (6 prompts × ~3 min) | 1h |
| Téléchargements + organisation | 15 min |
| Édition Premiere | 2-3h |
| Test mail + upload YouTube | 30 min |
| **Total** | **4-5 heures** |

## Ordre d'exécution

1. **Lire** `01-script.md` en entier pour valider le ton
2. **HeyGen** : suivre `03-heygen-brief.md` → générer 4 takes (take1-intro, take2-features, take3-scale, take4-cta) → télécharger les 4 MP4 dans `assets/heygen/`
3. **Higgsfield** : suivre `04-higgsfield-prompts.md` → générer 6 scènes → télécharger 6 MP4 dans `assets/higgsfield/`
4. **Audio** : suivre `05-audio-brief.md` → télécharger track Epidemic + SFX dans `assets/audio/`
5. **Édition** : suivre `06-edit-timeline.md` dans Adobe Premiere Pro (CC 2024+), exporter final
6. **Upload** YouTube unlisted + Loom
7. **Email** : copier le corps de `07-email-outreach.md`, envoyer en cold via Lemlist/Smartlead

## Fichiers du pack

| Fichier | Contenu |
|---|---|
| `01-script.md` | Script verbatim 60s avec timestamps + phonétique des mots durs |
| `02-storyboard.md` | 8 scènes : visuel, durée, caméra, texte écran, audio |
| `03-heygen-brief.md` | Avatar, voix, paramètres, 4 takes verbatim |
| `04-higgsfield-prompts.md` | 6 prompts verbatim + camera + lighting + seed |
| `05-audio-brief.md` | 3 tracks suggérés + 6 SFX + niveaux de mix |
| `06-edit-timeline.md` | Timeline frame-by-frame Premiere Pro + Lumetri preset + .mogrt lower-thirds |
| `07-email-outreach.md` | 2 subjects A/B, 3 body variants, UTMs, preview text |
| `08-brand-overlays.md` | Specs lower-third + end-card + tokens couleur |
| `mcp-setup.md` | Comment activer HeyGen MCP plus tard si tu veux automatiser |

## Note sur les MCPs

HeyGen MCP et Higgsfield MCP ne sont pas configurés dans cette session Claude Code (vérifié, aucun outil exposé). Le pack est conçu pour exécution **manuelle via les UI web** de HeyGen et Higgsfield. Si tu veux automatiser plus tard, voir `mcp-setup.md` pour la config `.mcp.json` à ajouter avec tes clés API.

## KPIs à mesurer (semaine 1)

- Open rate email : viser ≥ 35%
- Click-through vidéo YouTube : viser ≥ 8%
- Inscriptions `/register` avec UTM `cold_email_video_v1` : viser ≥ 1%

Si CTR vidéo < 5% → A/B test sur le subject line. Si CTR OK mais conversion = 0 → revoir CTA / landing register.
