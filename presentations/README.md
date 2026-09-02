# Decks commerciaux

Un PDF de vente par métier, au format 16:9, dans le registre « Papier & Signal »
de la V2. Ils servent en pièce jointe d'un e-mail de prospection ou en support
d'un rendez-vous.

```bash
npm run decks                       # les quatre PDF, dans presentations/pdf/
node presentations/build.mjs bar    # un seul métier
node presentations/build.mjs --png  # en plus, une image par planche, pour relire
```

Les PDF produits sont dans `pdf/`. Le dossier `build/` est jetable (il est
ignoré par git) : il ne contient que le HTML intermédiaire et les images de
relecture.

## Ce qu'il y a dans un deck

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
| `content.mjs` | Tout le texte. Un métier, un objet. C'est le seul fichier à ouvrir pour changer un argument. |
| `render.mjs` | Le gabarit. Une fonction par type de planche, plus les espaces insécables du français. |
| `assets/deck.css` | La charte, recopiée depuis `DA/` et `frontend/src/styles/v2.css`. |
| `assets/fonts.css` | Outfit en base64, régénéré par `fetch-fonts.mjs`. |
| `build.mjs` | Écrit le HTML, appelle Chromium en mode impression. |

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

## Ajouter un métier

Ajoutez un objet à `SECTORS` dans `content.mjs` en copiant celui du bar, qui est
le plus court. Les champs obligatoires sont `slug`, `label`, `cover`, `pain`,
`cost`, `call`, `during`, `record`, `gains` et `closeLine`. `<i>` autour d'un
mot du titre le passe en serif italique de marque, un seul par phrase.
