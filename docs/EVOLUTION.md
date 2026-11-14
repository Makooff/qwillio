# Une documentation qui accompagne l’évolution

Politique révisée le 14 novembre 2026.

## Les documents ne fixent pas un plafond au produit

Une fonctionnalité absente des spécifications peut être développée. Un fournisseur, une architecture, une cible commerciale ou un style visuel peut être remplacé si cela sert l’objectif du propriétaire. Les anciennes listes de fonctions et les interdictions esthétiques ne constituent pas des limites définitives.

Les instructions actuelles du propriétaire priment sur les préférences et procédures historiques, dans le respect des règles de l’environnement de travail. Quand une évolution est autorisée, mettre à jour les conventions concernées avec le changement ; ne pas ajouter une demande d’approbation simplement parce qu’une convention change.

## Distinguer quatre types d’information

| Type | Comment le traiter |
| --- | --- |
| État observé | Le vérifier dans le code, les tests ou le service concerné ; indiquer la date et les limites de la vérification |
| Convention actuelle | Un choix par défaut révisable, avec sa raison et son périmètre |
| Proposition | Une piste à explorer ; ni une fonctionnalité livrée, ni une obligation |
| Archive | Une explication d’un état passé ; ne pas exécuter ses procédures comme des consignes actuelles |

## Les protections portent sur le résultat

L’isolation des clients, la confidentialité, la cohérence des paiements, l’intégrité des réservations et le respect des consentements restent à préserver. Une autre conception peut assurer ces propriétés : les tests et la migration doivent le démontrer. Le nom d’une bibliothèque ou d’un prestataire n’est pas une propriété à protéger en soi.

## Éviter les freins inutiles

- Choisir les outils et skills disponibles selon la tâche. L’absence d’un plugin ou d’Obsidian ne bloque pas le développement.
- Adapter les revues et vérifications au changement ; éviter les rituels identiques pour toutes les tâches.
- Revoir une ancienne interdiction de design quand elle nuit à l’usage ou à l’ambition actuelle, en gardant cohérence et accessibilité.
- Ne pas traiter les anciens incidents comme la preuve d’un défaut actuel, ni une ancienne correction comme la preuve qu’un défaut ne peut plus revenir.
- Actualiser les documents qui décrivent le comportement modifié dans la même proposition.

## État de la documentation après cette révision

Les consignes centrales de développement et le contexte produit ont été revus. Les références de design et les fiches des agents de revue/architecture indiquent leur portée révisable. L’ancien guide accumulant les incidents est conservé en archive, sans être injecté comme instruction permanente.

**Tous les fichiers Markdown ne sont pas certifiés à jour.** Les runbooks, plans, scripts de vente et notes techniques gardent leur contexte daté. Leur validité doit être contrôlée lors d’une tâche qui les utilise. Cette révision ne valide ni les réglages distants ni les promesses commerciales en production.

[Retour aux guides](README.md)
