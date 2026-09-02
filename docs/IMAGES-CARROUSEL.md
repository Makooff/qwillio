# Les quatre images du carrousel de l'accueil

Le carrousel du bas de `pages/v2/Home.tsx` cherche quatre fichiers. Tant qu'ils
n'existent pas, chaque panneau garde son dégradé et **rien ne casse**: le repli
est dans le composant (`components/ui/carousel-squeeze.tsx`, fonction `Picture`,
`onError`). Déposer un fichier suffit à le faire apparaître, il n'y a pas une
ligne de code à changer.

## Où, et à quelle taille

| Fichier | Panneau | Page visée |
|---|---|---|
| `frontend/public/carousel/a-propos.webp` | À propos | `/about` |
| `frontend/public/carousel/blog.webp` | Blog | `/blog` |
| `frontend/public/carousel/contact.webp` | Contact | `/contact` |
| `frontend/public/carousel/affiliation.webp` | Affiliation | `/affiliate` |

**1600 × 900** (16:9), exporté en **WebP qualité 80**, sous 150 ko.

Le 16:9 n'est pas décoratif: le composant dessine chaque image dans un bloc 16:9
fixe et centré, puis n'en montre qu'une part quand le panneau rétrécit. Un autre
rapport serait recadré, et le sujet doit donc vivre au **centre** de l'image, pas
sur un bord. Une latte de 8 px ne laisse voir qu'une bande verticale du milieu.

Conversion, une fois les PNG sortis du générateur:

```bash
cd frontend/public/carousel
for f in *.png; do cwebp -q 80 -resize 1600 900 "$f" -o "${f%.png}.webp"; done
```

## La règle avant les recettes

Ces quatre images vivent dans le **registre drenched** de la charte: fond très
sombre, lumière rasante, une seule source. Elles ne sont pas des photos de
banque d'images, et elles ne montrent **jamais** de visage reconnaissable, de
logo, ni de texte lisible: le panneau porte déjà son mot en surimpression, et
un texte dans l'image se retrouverait coupé en deux dès que la carte se replie.

Palette imposée, ce sont les couleurs de la marque:
indigo `#7A5FFF`, violet `#CD6BFB`, noirs `#0A0A0A` et `#161718`.

À bannir, parce que c'est ce que tous les générateurs sortent par défaut: le
casque de téléavertisseur, le globe en fil de fer, le cerveau lumineux, les
graphiques flottants, la poignée de main en costume, le sourire vers l'objectif.

## Les quatre recettes

Chacune est faite pour être collée telle quelle. Le suffixe technique commun
est rappelé une fois, à ajouter à la fin de chaque recette:

> **Suffixe commun** — cinematic still, 16:9, shot on 35mm, shallow depth of
> field, single raking light source, deep near-black background (#0A0A0A),
> subtle indigo (#7A5FFF) and violet (#CD6BFB) rim light, fine film grain,
> no text, no logo, no watermark, no recognizable faces, muted contrast,
> subject centred in frame.

### 1. À propos — `a-propos.webp`

> A small Brussels workspace at dusk, seen from across the room. Two silhouetted
> figures at a long wooden desk, turned away from camera, one standing. Tall
> nineteenth-century windows on the left, the last cold daylight coming through
> them; a single warm desk lamp on the right. Rain on the glass. Bare brick and
> a plant. Quiet, worked-in, not staged.

Ce qu'elle doit dire: **qui**, et **depuis où**. Bruxelles, une petite équipe,
le soir. De dos, parce que la page dit « jeune et construit ici », pas
« regardez-nous ».

### 2. Blog — `blog.webp`

> An open notebook on a dark worktop, filled with handwriting and a crossed-out
> diagram, a fountain pen laid across it. Beside it a cold cup of coffee and a
> stack of loose printed pages annotated in the margins. Overhead light falling
> at a low angle from the left, most of the frame in shadow. The handwriting is
> illegible, an impression of writing rather than words.

Ce qu'elle doit dire: on **apprend en faisant**, et on note. L'écriture
illisible est délibérée: un texte lisible serait tranché par le repli du
panneau, et daterait l'image.

### 3. Contact — `contact.webp`

> A vintage telephone handset lifted off its cradle, resting on a pale concrete
> desk, its coiled cord curling out of frame. Shot close, slightly from above.
> A single indigo light source behind it throws a long soft shadow toward the
> camera. Everything else falls into darkness.

Ce qu'elle doit dire: **on décroche**. C'est le produit tout entier en un objet,
et le seul des quatre panneaux qui a le droit d'être littéral.

### 4. Affiliation — `affiliation.webp`

> Two dark cords on a black surface, tied together in a single clean knot at the
> centre of the frame, each running out of opposite edges. One cord catches an
> indigo rim light, the other a violet one. Macro, shot from directly above,
> the knot sharp and the ends falling out of focus.

Ce qu'elle doit dire: une **recommandation**, et un lien qui **dure**. Le nœud
plutôt que la poignée de main: la commission est récurrente, elle ne se conclut
pas en une fois. Et les deux teintes de la marque rendent les deux parties
lisibles sans montrer personne.

## Après les avoir déposées

Relire le rendu, en clair ET en sombre: les fonds drenched ne basculent pas avec
le thème, donc une image trop claire s'imposerait dans une page blanche autant
que dans une page noire. Vérifier aussi la latte: elle ne montre qu'une bande
verticale de 8 px prise au milieu, et si le sujet n'y est pas, la latte est un
aplat gris.
