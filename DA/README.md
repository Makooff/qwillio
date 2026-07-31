# DA Qwillio, direction artistique

La marque tient dans quatre fichiers. Celui-ci donne la plateforme, les autres donnent les règles.

| Fichier | Contenu |
|---|---|
| `couleurs.md` | Les 4 couleurs du logo, leurs équivalents OKLCH, la répartition |
| `typographie.md` | Outfit, l'échelle, le tracking |
| `logo.md` | Versions, zones de protection, interdits |
| `ui.md` | Rayons, ombres, motion, les interdits absolus |
| `voix.md` | Ton de voix, vocabulaire autorisé et banni |

**Le logo est la source.** `frontend/public/qwillio-logo-512.svg` définit le tracé et les quatre couleurs. Tout le reste en découle. `frontend/scripts/generate-icons.mjs` régénère les icônes depuis ce fichier, il ne les redessine pas.

## Plateforme de marque

**Ce qu'on vend.** Une réceptionniste IA qui décroche à la place d'un patron de PME, prend le rendez-vous et qualifie l'appel. Marché : Belgique et France, en français, avec l'anglais sur le même appel.

**À qui.** Des patrons de 1 à 30 personnes qui ratent des appels tous les jours et n'ont personne à l'accueil. Ils ne sont pas techniques, ils sont occupés, et ils jugent en trente secondes.

**Ce qu'on n'est pas.** Une startup enthousiaste. Pas de « révolutionnaire », pas de « game-changer », pas d'emojis. Le ton est celui d'un outil fait par quelqu'un qui connaît le métier.

**La promesse.** L'appel qui n'est pas décroché part chez le concurrent. Qwillio décroche.

## Deux registres

| | Marque | Produit |
|---|---|---|
| Où | Home, Landing, Tarifs, Agent, À propos, Contact, Affiliation, Blog, Légal | Dashboard, admin, portail client, closer |
| Surface | Crème et blanc | Sombre teinté indigo |
| Couleur | Engagée : le mauve porte 30 à 60 % de la surface | Retenue : accent sur 10 % maximum |
| Densité | Éditoriale, aérée, asymétrique | Dense, rapide, alignée |

Ce qui **ne change pas** entre les deux : la typographie, l'échelle des rayons, les courbes de motion, la grammaire des composants, et les quatre couleurs. Passer du site au dashboard ne doit produire aucune rupture de sensation, seulement un changement de surface.

## Anti-références

Ce à quoi Qwillio ne doit jamais ressembler :

- Salesforce, HubSpot : lourdeur entreprise, blanc et turquoise, « saas-clean »
- Tailwind et shadcn sortis de la boîte, sans intention
- Le hero centré avec trois tuiles de métriques en dessous
- La grille de quatre cartes identiques, icône + titre + paragraphe
- Les titres en dégradé
- Les illustrations plates de robots, d'avatars ou de « cerveaux IA »

## Références

Linear, Vercel, Granola. Des outils faits par des gens qui soignent le détail. Typographie assumée, mise en page asymétrique, une seule couleur de marque qui porte la surface.
