# HeyGen brief — avatar + voix + 4 takes

URL : https://app.heygen.com — plan **Creator** ($30/mois) ou Free trial (1 minute gratuite, suffit pour ce projet si tu génères tout d'un coup).

## Sélection avatar

**Avatar recommandé** : `Anthony` (Studio Avatar, FR-natif, business casual)

Alternative : `Edward (Suit)` si tu veux plus formel pour cible juridique/finance.

**Comment générer un avatar custom à partir de toi** (optionnel, 5 min de plus) :
1. Settings → Instant Avatar → Upload 1 selfie en HD bien éclairé fond neutre
2. Attendre 2 min de génération
3. Utiliser ton avatar custom dans le projet

## Sélection voix

**Voix recommandée** : `Edouard` (Premium FR-FR, masculine, ~30 ans, chaleureuse)

Paramètres :
- Stability : `0.60` (équilibre entre cohérence et naturel)
- Similarity : `0.75` (proche de la voix originale)
- Style exaggeration : `0.20` (subtil, pas robotique)
- Speaker boost : `On`

## Cadrage et fond

- **Cadrage** : Mid-shot (poitrine + tête), regard caméra direct
- **Fond** : Custom upload — gradient indigo → noir
  - À générer : `1920×1080` PNG, gradient radial centré
  - Top : `oklch(56% 0.22 264)` = `#6366f1` à 30% opacity
  - Bottom : `oklch(11% 0.013 265)` = `#1a1a2e` à 100%
  - Ou utiliser un fond HeyGen "Office Modern" et appliquer un filtre indigo en post-prod
- **Lower-third** : NE PAS ajouter dans HeyGen, on le fait au montage pour cohérence brand

## Les 4 takes verbatim

### TAKE 1 — Solution intro (8 secondes)
Direction : sourire doux, regard chaleureux, comme on présente une amie de confiance.

```
Je vous présente Marie. Votre nouvelle réceptionniste. Sauf qu'elle ne dort jamais, ne tombe jamais malade, et décroche en moins d'une seconde.
```

Notes prononciation :
- "Marie" : pause de 200ms juste après
- "Sauf" : légère emphase
- "moins d'une seconde" : ralentir légèrement les 3 derniers mots

### TAKE 2 — Features (8 secondes)
Direction : énumération posée, gestuelle naturelle qui ponctue chaque feature.

```
Marie répond en français, prend vos rendez-vous dans votre calendrier, qualifie vos prospects, et vous transfère uniquement les vraies urgences.
```

Notes prononciation :
- 4 features = 4 micro-pauses de 100ms entre chaque virgule
- "vraies urgences" : emphase, c'est le point différenciant

### TAKE 3 — Scale (9 secondes)
Direction : tone passe à plus assertif, fierté discrète.

```
Elle gère cent appels en même temps. Le jour, la nuit, le week-end. Sans une seule erreur. C'est mathématique.
```

Notes prononciation :
- "cent appels en même temps" : ralentir + emphase sur "cent"
- "Le jour, la nuit, le week-end" : 3 beats égaux, presque mécanique
- "C'est mathématique" : ton final, plus bas, conclusion

### TAKE 4 — CTA (8 secondes)
Direction : énergie remontée, conviction, regard direct caméra.

```
Testez Qwillio dès maintenant. Premier mois entièrement offert. Aucune carte demandée. Vous activez votre compte en deux minutes. Le prochain appel arrive dans une heure. Soyez prêt.
```

Notes prononciation :
- "Qwillio" : `KWI-li-o`, insister sur le `kw`. Si HeyGen TTS le lit `kwi-yo` ou `qui-yo`, utiliser la **prononciation phonétique** dans l'éditeur HeyGen : taper `Kouilio` ou utiliser balise `[Kwili-o]` SSML
- "Soyez prêt" : pause de 400ms avant, énergie qui retombe légèrement, conclusion brand

## Workflow HeyGen pas-à-pas

1. New project → Avatar Video
2. Sélection : `Anthony` + voix `Edouard` FR + fond custom uploadé
3. **Important** : créer **4 vidéos séparées**, pas une seule. Pourquoi ?
   - Permet de re-générer un take qui glitche sans tout refaire
   - Permet le freeze entre les takes au montage
   - Évite que HeyGen lisse les pauses entre les sections
4. Pour chaque take :
   - Coller le script du take exact
   - Aspect ratio : 16:9 (1920×1080)
   - Background : custom upload
   - Generate → attendre 1-2 min
   - Preview en lecture pour valider lip-sync
   - Si glitch (mauvais lip-sync sur un mot) → regénérer ce take uniquement
   - Download MP4 HD
5. Renommer les 4 fichiers :
   - `heygen-take1-intro.mp4`
   - `heygen-take2-features.mp4`
   - `heygen-take3-scale.mp4`
   - `heygen-take4-cta.mp4`
6. Déposer dans `marketing/video-ads/qwillio-60s-fr/assets/heygen/` (à créer)

## QA des takes

Avant de passer au montage, valider chaque take :

- [ ] Lip-sync : pas de désynchronisation > 1 frame sur mots-clés
- [ ] Prononciation "Qwillio" correcte (`kwi-li-o`)
- [ ] Regard centré, pas de fuite vers le côté
- [ ] Pas d'artefact facial (yeux qui tournent, sourire qui glitche)
- [ ] Durée audio = durée attendue ±0.5s

Si problème → regénérer avec un **seed différent** dans Settings avancés HeyGen.

## Si avatar HeyGen ne te plait pas

Plan B : utiliser ElevenLabs directement (sans avatar) — voice-only sur des plans Higgsfield + motion graphics plein écran. Économise ~$20 et garde l'aspect "haut de gamme" si bien monté. Demander si tu veux ce plan B.

## Si tu veux automatiser via HeyGen API plus tard

Voir `mcp-setup.md` à la racine du pack. La REST API HeyGen permet de générer un avatar via `POST /v2/video/generate` avec le script en payload + retour MP4 en async. Je peux scripter ça en Node ou Bash dès que tu fournis ta `HEYGEN_API_KEY`.
