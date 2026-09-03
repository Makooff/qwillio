# Decks commerciaux

Un PDF de vente par métier, plus une proposition de groupe pour un
propriétaire qui possède plusieurs de ces commerces. Le tout dans le registre
« Papier & Signal » de la V2, et dans deux formats.

| Format | Fichier | Pour quoi |
|---|---|---|
| 16:9 | `pdf/qwillio-<métier>.pdf` | À projeter, à dérouler à l'écran, à envoyer en pièce jointe |
| A4 portrait | `pdf/qwillio-<métier>-a4.pdf` | À imprimer, à laisser sur un bureau, à joindre à un devis |

```bash
npm run decks                          # les dix PDF, dans presentations/pdf/
node presentations/build.mjs bar       # un seul document, les deux formats
node presentations/build.mjs groupe    # la proposition de groupe
node presentations/build.mjs --a4      # un seul format
node presentations/build.mjs --png     # en plus, une image par planche, pour relire
```

Les PDF produits sont dans `pdf/`. Le dossier `build/` est jetable (il est
ignoré par git) : il ne contient que le HTML intermédiaire et les images de
relecture.

## La proposition de groupe

`groupe` est un document à part, pas la concaténation des quatre. Quatorze
planches pour un propriétaire qui possède plusieurs commerces, et il vend **une
réceptionniste par maison**, pas un abonnement groupé. L'argument tient en une
phrase, posée sous la frise des heures : *aucune de ses affaires ne justifie une
réceptionniste à plein temps, et chacune en mérite une quand même.*

Trois planches lui sont propres. La frise des heures où chacun de ses quatre
téléphones sonne, qui montre que les coups de feu ne tombent pas ensemble. Les
quatre réceptionnistes, avec leur visage, leur nom, leur voix et leur phrase
d'accueil. Et l'addition des quatre fuites en un tableau, calculée depuis les
mêmes hypothèses que les decks métier (le total sort du code, il n'est pas
écrit à la main).

Les visages et les noms ne sont pas décoratifs : ce sont les personnages réels
du catalogue de voix (`backend/src/config/voice-characters.ts` et
`frontend/public/characters`), avec leur `taglineFr`. Le client verra les mêmes
en choisissant.

Ce qui y est affirmé sur le produit est vérifié dans le schéma :
`ClientPhoneNumber` porte bien un nom d'agent, une phrase d'accueil, une voix,
des consignes et un numéro de transfert **par ligne**, en surcharge de la
configuration du client. C'est ce qui rend « une réceptionniste par maison »
vrai plutôt que commercial. Ce qui n'existe pas encore, la comparaison chiffrée
entre établissements dans le portail, est écrit dans la planche « Sans détour »
plutôt que passé sous silence.

## Ce qu'il y a dans un deck métier

Douze planches, toujours dans le même ordre : couverture, le problème du
métier, le calcul du manque à gagner, ce qu'est Qwillio, un appel joué de bout
en bout, ce qu'elle fait pendant l'appel, ce qui la rend naturelle, ce qui
reste après l'appel, la mise en route, ce que ça change pour ce métier, ce que
nous ne promettons pas, la prochaine étape.

Trois planches sur douze portent un contenu commun (le produit), les neuf
autres sont écrites métier par métier. C'est là que se joue la différence entre
une plaquette et une proposition : le scénario d'appel, les chiffres et les
gains sont ceux du concessionnaire, du pâtissier, du bar ou de la parfumerie.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `content.mjs` | Tout le texte des decks métier. Un métier, un objet. C'est le seul fichier à ouvrir pour changer un argument. |
| `group.mjs` | Le contenu ET les planches de la proposition de groupe. Elle réutilise l'ossature de `render.mjs` et les arguments produit de `content.mjs`. |
| `render.mjs` | Le gabarit. Une fonction par type de planche, plus les espaces insécables du français. |
| `assets/deck.css` | La charte et la mise en page 16:9, recopiées depuis `DA/` et `frontend/src/styles/v2.css`. |
| `assets/deck-a4.css` | La variante portrait. Importe `deck.css` et ne redéfinit que ce que la page A4 change. |
| `assets/fonts.css` | Outfit en base64, régénéré par `fetch-fonts.mjs`. |
| `build.mjs` | Écrit le HTML, appelle Chromium en mode impression. |

## Un contenu, deux mises en page

Le même HTML sert aux deux formats : seule la feuille de style change. Ce n'est
pas une mise à l'échelle, c'est une autre composition. En 16:9 la ressource
abondante est la largeur, donc les blocs se rangent en colonnes et les listes
se centrent dans une hauteur courte. En A4 c'est l'inverse : la largeur tombe
de 1 104 à 666 px, donc chaque paire de colonnes devient une pile, l'escalier
de la mise en route se décale au lieu de descendre, la colonne d'annotations de
la conversation passe sous chaque réplique, et le corps de texte remonte d'un
cran parce qu'une page A4 se lit de près.

La couverture, elle, change d'ancrage : centrée en 16:9, calée en bas en A4,
comme une couverture de document.

## Trois décisions qui expliquent le reste

**Les jetons de la charte sont recopiés, pas importés.** La feuille du site est
écrite pour Tailwind (canaux RVB, modificateurs d'opacité) et pour un thème
basculable ; un PDF n'a qu'un registre et doit se rendre sans build. Si une
couleur bouge dans la V2, elle bouge aussi dans `deck.css`, et nulle part
ailleurs.

**La police est embarquée dans le CSS.** Un `@import` vers Google Fonts
marcherait le jour du build et laisserait un fichier qui dépend du réseau.
Outfit est en base64, donc le rendu est le même hors ligne, et Chromium
l'embarque dans le PDF : le fichier s'ouvre à l'identique chez le client.

**Le mot en serif italique dépend de la machine qui compile.** La charte
demande « le serif italique du système » (`DA/typographie.md`). Sur ce conteneur
c'est Liberation Serif Italic qui gagne, et c'est cette fonte qui part dans le
PDF. Un autre poste donnerait un autre italique. Pour figer la chose, il suffit
d'ajouter une fonte serif à `fetch-fonts.mjs` et de la nommer en tête de la
pile `.serif` dans `deck.css`.

## Ce que les decks ne disent pas

**Aucun prix.** C'est un choix commercial : le PDF vend la valeur, le tarif se
discute en rendez-vous. Les grilles sont dans `frontend/src/pages/v2/pricing-plans.ts`
le jour où on veut les ajouter.

**Aucune promesse d'hébergement européen.** Render est en Oregon. La planche
« Ce que nous ne promettons pas » le dit noir sur blanc, comme le site. Si la
région bascule un jour, c'est cette planche qu'il faut corriger en premier.

**Aucune statistique de marché.** Le calcul du manque à gagner est présenté
comme une illustration à remplir avec les chiffres du client, jamais comme une
étude. Une source inventée se retourne contre vous au premier rendez-vous.

## Nommer le client

Les documents sont écrits au générique (« la concession », « la pâtisserie »).
Pour une proposition nominative, les libellés vivent dans `CREW`, `CURVES` et
`CATCHES` de `group.mjs`, et dans `label` de chaque secteur de `content.mjs`.

## Ajouter un métier

Ajoutez un objet à `SECTORS` dans `content.mjs` en copiant celui du bar, qui est
le plus court. Les champs obligatoires sont `slug`, `label`, `cover`, `pain`,
`cost`, `call`, `during`, `record`, `gains` et `closeLine`. `<i>` autour d'un
mot du titre le passe en serif italique de marque, un seul par phrase.
