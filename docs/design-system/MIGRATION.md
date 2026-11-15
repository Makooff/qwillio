# Adoption et écarts connus

Révision du 14 novembre 2026. [Charte](../../DESIGN.md) · [Fonctions](../FONCTIONNALITES.md)

## Intégré dans cette proposition

- Fondations typées partagées : `frontend/src/design-system/tokens.json` et `tokens.ts`.
- Tailwind lit les couleurs de marque, fonds sombres, échelle d’espacement et rayons partagés.
- `admin-theme.ts` lit les fonds et rayons communs ; les surfaces et espacements de boutons dans `design-system.ts` les réutilisent. `ui/Button` utilise les hauteurs configurées.
- Les alias sombres Tailwind rejoignent les neutres déjà définis dans `v2.css` ; le violet primaire Tailwind et la variable globale sont alignés sur le logo.
- Charte complète, catalogue visuel, guide partagé `AGENTS.md` / `CLAUDE.md`, état fonctionnel et inventaire généré.

## Ce qui n’est pas une migration terminée

| Sujet | État / suite utile |
| --- | --- |
| Pages historiques | Des espacements, couleurs et rayons locaux existent encore ; les migrer écran par écran avec comparaison visuelle et tests, sans prétendre que tous ont été harmonisés |
| Familles Button | Public et produit gardent des contrats différents ; partager les fondations avant d’envisager une fusion |
| Formulaires | Des champs ont encore des styles locaux ; conserver labels, validation et focus lors de leur adoption du système |
| Couleurs de texte discrètes | La palette existante n’atteste pas un contraste AA sur chaque fond ; contrôler les paires utilisées, notamment les bandes claires |
| Cibles tactiles | Produit compact existant 30/36 px, public 44 px ; vérifier et adapter la zone interactive sur chaque écran mobile |
| Thème clair du portail | Pas implémenté par cette proposition ; thème public et thème produit restent distincts |
| Portail V2 alternatif | Prototype non routé ; ne pas le prendre pour le produit actif |
| Captures et données du catalogue | Démonstrations de composants ; pas des captures d’un parcours de production ni des preuves commerciales |
| Couverture du projet vocal | Worker externe et paramètres distants non audités par ce checkout |

## Continuer sans bloquer les idées

Une proposition peut introduire un composant, une visualisation plus riche ou une nouvelle mise en page. La décrire comme extension ou expérimentation, vérifier les propriétés utiles et actualiser la charte quand elle devient commune. Le catalogue n’est pas une liste fermée de composants autorisés.
