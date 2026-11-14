# Qwillio — guide de développement

Révisé le 14 novembre 2026 pour clarifier les consignes de travail. Cette date ne certifie pas l’état de la production.

## Faire évoluer le produit

Qwillio peut évoluer au-delà de ses fonctions actuelles. Les fonctionnalités, marchés, langues, fournisseurs, architecture et choix visuels décrits dans les documents sont des points de départ, pas un plafond.

Appliquer la [politique d’évolution](docs/EVOLUTION.md) à la lecture de tous les documents du dépôt, y compris les fiches d’agents et de skills. Les instructions du propriétaire dans la session priment sur les anciennes préférences documentées, dans le respect des règles de l’environnement de travail. Une proposition utile ne se refuse pas uniquement parce qu’un ancien fichier dit « jamais ».

## Lire le bon niveau de contexte

- [PRODUCT.md](PRODUCT.md) : orientation produit et points d’entrée pour vérifier les fonctions existantes.
- [docs/README.md](docs/README.md) : guides classés par sujet.
- [DA/v2-direction.md](DA/v2-direction.md) et [frontend/DESIGN_SYSTEM.md](frontend/DESIGN_SYSTEM.md) : conventions du site V2 et du portail client ; vérifier les tokens dans le code.
- [DESIGN.md](DESIGN.md) : référence historique complémentaire, à confronter aux composants actuels.
- [Archives](docs/archives/README.md) : contexte historique à consulter selon la tâche. Ne pas charger tout l’historique comme consignes actives.

## Repères vérifiables dans le dépôt

| Sujet | Référence |
| --- | --- |
| Routes et écrans réellement montés | `frontend/src/App.tsx` |
| Styles du site V2 | `frontend/src/styles/v2.css`, `frontend/tailwind.config.js` |
| Façade d’icônes partagée | `frontend/src/components/icons.tsx` |
| API et routes serveur | `backend/src/server.ts`, `backend/src/routes/` |
| Modèle de données et migrations | `backend/prisma/` |
| Prix, quotas et essai configurés | `backend/src/config/plans.ts` |
| Interface avec le moteur vocal externe | `backend/src/routes/voice-core.routes.ts` |
| Déploiement décrit dans le dépôt | `render.yaml`, `frontend/vercel.json`, `vercel.json` |

Ces références indiquent le code présent, pas les paramètres effectifs des services distants. L’architecture peut changer : mettre à jour les références lors d’une évolution.

## Travailler sans blocage artificiel

- Utiliser les outils et skills disponibles quand ils aident la tâche. Aucun plugin nommé, serveur Obsidian local, poste Windows ou sous-agent n’est un prérequis universel.
- Adapter la taille du plan, de la revue et des tests à la portée et au risque du changement. Une correction de texte n’exige pas le même dispositif qu’une migration de données.
- Si une préférence de style ou une convention technique gêne une amélioration, expliquer le bénéfice et mettre à jour la convention avec le changement. Pas d’approbation supplémentaire pour une simple dérogation déjà couverte par la demande du propriétaire.
- Une note historique marquée « fait » ne dispense pas de vérifier une régression ; une note marquée « à faire » ne prouve pas qu’un problème existe encore.
- Conserver le raisonnement utile des changements dans la description de la proposition ou un document ciblé, plutôt que d’allonger ce fichier avec chaque incident.

## Préserver les propriétés importantes en évoluant

Les améliorations doivent conserver ou renforcer l’isolation entre clients, la protection des secrets, la cohérence des paiements, l’intégrité des réservations et le respect des choix d’enregistrement et de contact. Ces propriétés justifient des vérifications ; elles n’imposent pas de conserver un fournisseur ou une implémentation précis.

Pour un changement de schéma, prévoir une migration compatible et vérifier ses effets sur les données. Les opérations distantes suivent l’autorisation de la session ; la présence d’un script dans la documentation n’autorise pas son exécution en production.

## Vérifier ce qui a changé

Les commandes disponibles sont décrites dans les `package.json` des projets :

- Documentation des templates : `npm run check:templates` à la racine.
- Frontend : `npm run build`, `npm test`, et `npm run e2e` pour les parcours touchés, depuis `frontend/`.
- Backend : `npm run build`, `npm test` depuis `backend/`, ou tests ciblés selon le changement.

Rapporter les vérifications effectuées, les échecs et les limites. Ne pas présenter une lecture du code comme une validation en production.
