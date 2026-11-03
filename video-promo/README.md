# Film promotionnel Qwillio

42 secondes, 1920×1080, 60 images par seconde, rendu avec **Remotion**. Pas de musique : un son par événement.

## Ce que montre le film : le produit, pas le site

Le film se passe dans le **portail client** (`frontend/src/pages/client/*`). Un appel arrive en
direct sur la page Appels, le rendez-vous tombe dans l'agenda, la fiche d'appel s'ouvre avec
son résumé IA, puis la vue d'ensemble du mois. Un curseur fait les clics qu'un gérant ferait.

Ce qui vient du portail, et pas d'une imitation :

- **les valeurs** : fonds, bordures, rayons et tailles ont été relevés sur le portail lui-même
  (styles calculés de `ClientLayout`, `ClientBookings`, `ClientCalls`, `LiveCalls`) ;
- **les icônes** : la façade du portail, `frontend/src/components/icons.tsx`, importée telle
  quelle (`remotion.config.ts` lui donne le même React que le film) ;
- **la grille de l'agenda** : `monthGrid` de `frontend/src/utils/month-grid.ts` ;
- **le logo** : les trajectoires de l'animation d'ouverture de l'app, calculées par
  `liquidJourney` (`frontend/src/components/blobPath.ts`, le code de `SplashScreen.tsx`).

Aucun bouton du site (« L'entendre décrocher », « Essayer 7 jours ») n'y figure : ce sont des
appels à l'action d'une page web, pas des éléments du produit.

## Le son

`src/timeline.ts` est le seul endroit qui dit QUAND : les scènes le lisent, et
`scripts/sfx.mjs` en tire la liste des sons. 26 sons, dans 12 familles (sonnerie, notification
en verre, clic de souris, pastille qui rebondit, carte qui se pose, panneau qui glisse, logo…).
Chaque occurrence a sa graine, qui fait varier sa hauteur, sa durée et sa place en stéréo :
aucun son n'est rejoué à l'identique.

## Ce que le film affirme

Rien d'invérifiable (`DA/voix.md`). Les noms, numéros et rendez-vous sont fictifs et les
numéros de l'ouverture sont masqués. Ce qui est montré existe dans le portail : appel en
direct, agenda, fiche d'appel avec résumé IA et score de lead, vue d'ensemble.

## Régénérer

Prérequis : Node 22.6 ou plus, Python 3 avec numpy, un Chromium (variable `REMOTION_CHROME`
ou option `--browser-executable`).

```bash
npm install
npm run build
```

`npm run studio` ouvre Remotion Studio pour régler une scène image par image. La version
livrée est `frontend/public/qwillio-promo.mp4`, avec son affiche `qwillio-promo-poster.jpg`.
