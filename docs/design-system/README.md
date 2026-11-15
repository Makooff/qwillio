# Qwillio Design System

**[Ouvrir le catalogue interactif](index.html)** : fondations, exemples contextualisés, thèmes, densité, formulaires, recherche, filtres et dialogues.

| Référence | Usage |
| --- | --- |
| [Charte Qwillio](../../DESIGN.md) | Marque, couleur, type, espacement, arrondis, interaction et règles d’évolution |
| [Composants et états](COMPOSANTS.md) | Bibliothèque existante, contrats et comportements attendus |
| [Adoption et écarts](MIGRATION.md) | Ce qui est partagé dans le code et ce qui reste à migrer |
| [Fonctions du produit](../FONCTIONNALITES.md) | Écrans montés, modules préparés et limites de vérification |
| [Valeurs et routes générées](../REFERENCE-GENEREE.md) | Inventaire synchronisé depuis les sources |

Le catalogue est un document HTML local, pas une nouvelle route publique du produit. Ouvrir `index.html` depuis le dépôt complet pour conserver les liens vers le logo et les polices. Les contacts, conversations et traitements montrés sont fictifs et locaux.

Pour modifier le catalogue, éditer `scripts/design-catalog.template.html`, puis lancer `npm run sync:design` à la racine. Les fondations injectées viennent de `frontend/src/design-system/tokens.json`.
