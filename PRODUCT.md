# Qwillio — orientation produit

Révisé le 14 novembre 2026 à partir des points d’entrée du dépôt. Ce document donne une direction et des références vérifiables ; il ne certifie pas les services activés en production.

## Direction

Qwillio aide les professionnels à gérer leurs appels, les demandes de leurs clients et les suites de ces échanges. Le réceptionniste vocal, les rendez-vous et le suivi constituent un socle à approfondir.

Le périmètre peut s’élargir : fonctions plus avancées, nouveaux métiers, langues, automatisations, intégrations ou autres interfaces. Une ambition ne devient une fonction « livrée » qu’après implémentation et vérification du parcours correspondant. Voir la [politique d’évolution](docs/EVOLUTION.md).

## Ce que l’on peut vérifier dans le code

| Domaine | Point d’entrée |
| --- | --- |
| Pages publiques, authentification et espaces utilisateurs | `frontend/src/App.tsx` |
| Appels, réceptionniste et orchestration vocale | `backend/src/services/voice/`, `backend/src/routes/` |
| Interface avec voice-core | `backend/src/routes/voice-core.routes.ts` |
| Réservations, clients et données métier | `backend/prisma/`, `backend/src/services/` |
| Offre, minutes et période d’essai configurées | `backend/src/config/plans.ts` |
| Suivi des affiliations et commissions | `backend/src/services/affiliate.service.ts`, `backend/prisma/` |

Une route, une table ou un écran ne prouvent pas à eux seuls qu’un parcours est complet ou activé. Vérifier le comportement et les dépendances avant toute promesse commerciale.

## Présentation et langues

La communication vise notamment les professionnels francophones en Belgique et en France. Les contenus de publication sont classés en français, anglais et néerlandais ; un dossier de langue ne prouve pas qu’une traduction du produit est terminée.

La direction visuelle actuelle est décrite dans [DA/](DA/README.md), avec une référence propre au [portail client](frontend/DESIGN_SYSTEM.md). Elle peut évoluer avec les objectifs du produit. Les conventions visuelles ne limitent pas les nouvelles fonctionnalités.

## Offre et promesses

Lire les prix, quotas, remises et conditions d’essai dans le code et vérifier leur alignement avec le parcours de souscription. Les taux de commission dépendent de leur configuration ; ne pas recopier un ancien pourcentage comme règle générale.

Les délais de réponse, gains commerciaux, niveaux de service, capacités d’une intégration et lieux d’hébergement doivent être étayés avant publication. L’ancien document présentait notamment une suite de modules, une promesse de réponse en moins d’une seconde et des engagements commerciaux sans distinguer assez clairement ambition et validation.

[Ancien contexte produit, conservé comme historique](docs/archives/consignes-avant-2026-11-14/PRODUCT.md).
