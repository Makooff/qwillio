# Logo

## La source

`frontend/public/qwillio-logo-512.svg` est **la seule définition du tracé**. Tout le reste en est dérivé, jamais redessiné.

Le composant React `frontend/src/components/QwillioLogo.tsx` reprend les mêmes chemins pour un usage en ligne. `frontend/scripts/generate-icons.mjs` régénère les PNG depuis le SVG. Si le logo change, il change à un seul endroit puis on relance :

```bash
cd frontend && npm run icons
```

## La marque

Deux cercles qui se recouvrent, portant les lettres Q et W :

- le cercle de gauche, **Q**, en mauve primaire `#7A5FFF`
- le cercle de droite, **W**, en mauve clair `#CD6BFB`
- leur **recouvrement** en mauve profond `#7349FE`, qui est la vraie lentille d'intersection des deux disques, pas un cercle posé au milieu
- le **lettrage** en blanc `#FDFDFF`, en réserve dans les lobes

Le lettrage est peint en dernier et remplit les découpes : c'est ce qui permet au logo de rester transparent et de fonctionner sur fond clair comme sur fond sombre.

## Fichiers

| Fichier | Usage |
|---|---|
| `qwillio-logo-512.svg` | Source, transparent |
| `app-icon.svg` | Icône applicative, plaque blanche + marque à 72 % |
| `icon-512.png`, `icon-192.png` | Manifest PWA |
| `apple-touch-icon.png` | Écran d'accueil iOS, 180 px |
| `favicon.svg`, `favicon-32.png` | Onglet navigateur |

## Icône applicative

La marque occupe **72 % du carré**, centrée, sur une plaque `#FDFDFF` explicite.

Deux raisons de ne pas descendre en dessous ni monter au-dessus : au-delà de 80 % la marque touche les bords et paraît à l'étroit à côté des autres icônes ; en dessous de 65 % elle devient timide et illisible en petit.

La plaque est **explicite et non transparente**. Une icône transparente est composée par le système d'exploitation sur un fond qu'on ne choisit pas, et le rendu change entre iOS, Android et le bureau.

## Zones de protection

Marge libre autour de la marque égale à **la moitié du rayon d'un lobe**. Rien ne rentre dedans : ni texte, ni bord, ni autre logo.

## Tailles minimales

- Écran : 24 px de côté. En dessous, le lettrage se ferme, utiliser un seul lobe.
- Impression : 10 mm.

## Interdits

- Recolorer hors des quatre couleurs
- Faire tourner, incliner, déformer, étirer
- Ajouter une ombre portée, un contour, un halo
- Poser la marque sur une photo chargée sans plaque de fond
- Séparer les deux lobes, sauf dans l'animation de lancement, où ils se rejoignent pour former le logo
- Reconstruire le tracé à la main plutôt que d'utiliser le SVG

## Animation de lancement

`frontend/src/components/SplashScreen.tsx`. Les deux lobes arrivent par les côtés, se rejoignent, et au moment du recouvrement laissent place au **vrai logo**. La dernière image est donc la marque exacte et non une approximation. Le recouvrement est la lentille calculée, pas un cercle.

Elle ne se joue que lorsque l'application est lancée depuis l'écran d'accueil, une fois par lancement, et respecte `prefers-reduced-motion`.
