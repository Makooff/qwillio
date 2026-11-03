# Film promotionnel Qwillio

49,5 secondes, 1920×1080, 60 images par seconde. Aucune musique : chaque apparition à l'écran fait un pop.

## Le design est celui du site

Le film ne réinvente rien, il reprend le registre V2 « Papier & Signal » (`DA/v2-direction.md`) :

- titres en Outfit 300 avec un mot en italique serif (`.q2-serif-word`, en Georgia sur le site, en Gelasio ici, qui en reprend les métriques) ;
- eyebrows indigo en petites capitales, pilules pour tous les boutons, cartes blanches sur la bande taupe, sections sombres à bordures fines et sans ombre ;
- les textes du site, mot pour mot : le hero (« Elle ne prend pas de messages. Elle prend des *rendez-vous.* »), ses cartes « Appel entrant » et « Réservation proposée », la scène « Tout se passe *en ligne.* » et ses étapes, « La confirmation part toute seule », les boutons « Essayer 7 jours » et « L'entendre décrocher » ;
- Marie, l'un des personnages réceptionnistes du site, dans la carte d'appel.

## Le logo est l'animation d'ouverture de la webapp

Les deux lobes qui se déforment, traversent l'écran et se posent en logo sont calculés par
`liquidJourney` (`frontend/src/components/blobPath.ts`), le même code que `SplashScreen.tsx`,
avec ses constantes (graines 7 et 21, rayon de départ, 2,5 s de trajet, recouvrement en
`#7349FE` par découpe d'un lobe par l'autre). `logo-frames.mjs` l'exécute aux dimensions du
film : si l'animation change dans l'app, elle change dans le film au prochain `build`.

## Le découpage

| Temps | Plan |
|---|---|
| 0 à 5,8 s | Nuit, le téléphone sonne, les appels manqués s'empilent |
| 6 à 10 s | Boulangerie, barbier : « Vous avez les mains *prises.* » |
| 10 à 13 s | « Un appel manqué, c'est un client qui appelle *le suivant.* » |
| 13 à 16,5 s | Ouverture de l'app : les lobes se rejoignent, « Qwillio » |
| 16,5 à 21 s | Le hero du site, ses cartes, le créneau 19:30 qui s'allume |
| 21 à 31,5 s | « Tout se passe *en ligne.* » : l'appel de Marie, les trois étapes qui s'allument |
| 31,5 à 35,5 s | « La confirmation part *toute seule.* » : agenda et SMS |
| 35,5 à 42 s | 24 h/24, transfert d'urgence, français et anglais, résumé d'appel |
| 42 à 49,5 s | Ouverture de l'app une seconde fois, puis le hero en carton final et ses boutons |

## Le son : des pops, déclarés par l'image

Chaque animation qui mérite un son appelle `pop(t, type, hauteur)` dans `index.html`. La
page publie cette liste (`window.SFX`), `npm run sfx` l'écrit dans `sfx.json`, et `pops.py`
synthétise chaque pop à son instant. Déplacer une animation déplace donc son pop, sans rien
recaler à la main. Cinq sons, tous générés par le code : `pop` (bulle qui éclate),
`tiny` (un mot qui apparaît), `big` (le logo qui se forme), `double` (une validation),
`ring` (la sonnerie, en roulé de petites bulles). Les hauteurs suivent une gamme
pentatonique, pour que les cascades restent agréables.

## Ce que le film affirme

Rien d'invérifiable (`DA/voix.md`) : pas de client cité, pas de chiffre de résultat. Ce qui
est montré existe : agenda connecté, SMS de confirmation, transfert, français et anglais,
résumé d'appel, prix de `backend/src/config/plans.ts`. L'appel est une mise en scène. Les
plans filmés sont des images Mixkit sous licence commerciale libre
(`frontend/public/marketing/SECTOR-VIDEO-SOURCES.md` et `VIDEO-SOURCE.md`).

## Régénérer

Prérequis : Node 22.6 ou plus (pour lire `blobPath.ts` directement), ffmpeg, Python 3 avec numpy, Chromium pour Playwright.

```bash
npm install
npm run build
```

`npm run stills` produit quelques images fixes dans `stills/` pour relire une modification
sans tout rendre. La version livrée est `frontend/public/qwillio-promo.mp4`, avec son
affiche `qwillio-promo-poster.jpg`.
