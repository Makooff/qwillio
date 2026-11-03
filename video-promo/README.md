# Film promotionnel Qwillio

47 secondes, 1920×1080, 60 images par seconde, son stéréo à -14 LUFS (la norme des réseaux).

## Le découpage

| Temps | Plan | Ce qu'il dit |
|---|---|---|
| 0 à 5,8 s | Nuit, le téléphone sonne, les appels manqués s'empilent | Le problème, ressenti avant d'être dit |
| 5,8 s | Coupe au noir, silence total | La rupture |
| 6 à 10 s | Boulangerie, barbier | « Vous avez les mains prises. Le téléphone, lui, sonne encore. » |
| 10 à 13 s | Phrase-choc sur fond papier | « Un appel manqué, c'est un client qui appelle le suivant. » |
| 13 à 16,5 s | Les deux lobes du logo se rejoignent, impact | « Qwillio décroche. » |
| 16,5 à 29 s | L'appel en direct : forme d'onde, transcription, outils | Elle décroche, comprend, réserve |
| 29 à 33 s | Le rendez-vous tombe dans l'agenda, le SMS part | Directement dans votre agenda |
| 33 à 39,5 s | Quatre capacités, une par plan | 24 h/24, transfert d'urgence, FR/EN/NL, résumé d'appel |
| 39,5 à 47 s | Carton final | « Qwillio décroche. Vous, vous travaillez. » Essai 7 jours, dès 99 € par mois |

Chaque coupe tombe sur un temps de la musique (120 BPM, grille de 0,5 s). Les temps de
`index.html` et de `music.py` sont les mêmes nombres : en déplacer un, c'est déplacer l'autre.

## Ce que le film affirme, et pourquoi c'est tenable

La règle de `DA/voix.md` vaut ici : rien qu'on ne puisse prouver. Pas de client cité, pas de
chiffre de résultat. Ce qui est montré existe dans le produit : agenda Google, SMS de
confirmation avec lien agenda, transfert vers le portable, trois langues, résumé d'appel,
grille tarifaire de `backend/src/config/plans.ts`. L'appel est une mise en scène, et le
numéro est masqué. Les deux plans filmés sont des images Mixkit sous licence libre
commerciale (`frontend/public/marketing/SECTOR-VIDEO-SOURCES.md`), sans lien avec un client.

Si un prix change dans `plans.ts`, il change aussi dans le carton final (`#cta`).

## Régénérer

Prérequis : Node 20+, ffmpeg, Python 3 avec numpy, Chromium pour Playwright.

```bash
npm install
npm run build
```

`build` enchaîne quatre étapes, utilisables seules :

- `prepare-assets` : logo lu depuis `frontend/public/qwillio-logo-512.svg` (jamais redessiné), plans filmés extraits et étalonnés ;
- `music` : la bande-son, composée par le code (aucun échantillon externe) ;
- `video` : Chromium avance la timeline GSAP image par image et envoie chaque image à ffmpeg (environ 10 minutes) ;
- `mux` : assemblage et normalisation du son.

La version livrée est `frontend/public/qwillio-promo.mp4` (CRF 22, 13 Mo, pour le web) avec son affiche `qwillio-promo-poster.jpg`. Le `build` produit un master plus lourd (CRF 14, environ 75 Mo) à garder hors du dépôt.

`npm run stills` produit quelques images fixes dans `stills/` pour relire une modification sans tout rendre.

## Ce qui manque, volontairement

Aucune voix. Les seules voix françaises installables hors ligne ne prononcent pas les nasales,
et une voix robotique dans le film d'un produit qui vend une voix naturelle ferait l'effet
inverse. La meilleure voix possible est celle de la réceptionniste elle-même : un vrai appel
enregistré, posé sur la scène de 16,5 à 29 s, remplacerait la transcription muette.
