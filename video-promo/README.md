# Film promotionnel Qwillio

42 secondes, 1920×1080, 60 images par seconde, rendu avec **Remotion**. Pas de musique : un son par événement.

## Ce que montre le film : des éléments du produit, pas des captures

Pas d'enregistrement d'écran ni de page entière : le film sort chaque ÉLÉMENT du portail
client et le met en scène seul, en grand, sur fond sombre.

1. la carte « En cours » d'un appel (`LiveCalls`), où la conversation s'écrit en direct, puis
   la puce « Rendez-vous créé » qui en sort ;
2. la grille de l'agenda (`ClientBookings`) : la case du samedi passe de 1 à 2, et la carte du
   rendez-vous s'envole de la case jusqu'à la colonne « À venir » ;
3. la fiche d'appel, reconstruite pièce par pièce : appelant, durée, date, résultat, sentiment,
   puces, score de lead, puis le résumé IA qui s'écrit ;
4. le mois (`ClientOverview`) : indicateurs, courbe des appels, jauge.

Chaque élément est redessiné seul (`src/elements.tsx`), avec ce qui vient du portail :

- **les valeurs** : fonds, bordures, rayons et tailles, relevés sur le portail rendu avec des
  données de démonstration (styles calculés) ;
- **les icônes** : la façade du portail, `frontend/src/components/icons.tsx`, importée telle
  quelle (`remotion.config.ts` lui donne le même React que le film) ;
- **la grille de l'agenda** : `monthGrid` de `frontend/src/utils/month-grid.ts` ;
- **le logo** : les trajectoires de l'animation d'ouverture de l'app, calculées par
  `liquidJourney` (`frontend/src/components/blobPath.ts`, le code de `SplashScreen.tsx`).

Aucun bouton du site n'y figure.

## Le son

`src/timeline.ts` est le seul endroit qui dit QUAND : les scènes le lisent, et
`scripts/sfx.mjs` en tire la liste des sons. 27 sons, dans 11 familles (sonnerie, notification
en verre, pastille qui rebondit, carte qui se pose, barre qui se remplit, logo…).
Chaque occurrence a sa graine, qui fait varier sa hauteur, sa durée et sa place en stéréo :
aucun son n'est rejoué à l'identique.

## Ce que le film affirme

Rien d'invérifiable (`DA/voix.md`). Les noms, numéros et rendez-vous sont fictifs et les
numéros de l'ouverture sont masqués. Ce qui est montré existe dans le portail : appel en
direct, agenda, fiche d'appel avec résumé IA et score de lead, vue d'ensemble du mois.

## Régénérer

Prérequis : Node 22.6 ou plus, Python 3 avec numpy, un Chromium (variable `REMOTION_CHROME`
ou option `--browser-executable`).

```bash
npm install
npm run build
```

`npm run studio` ouvre Remotion Studio pour régler une scène image par image. La version
livrée est `frontend/public/qwillio-promo.mp4`, avec son affiche `qwillio-promo-poster.jpg`.
