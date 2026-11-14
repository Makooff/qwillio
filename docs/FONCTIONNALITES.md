# Qwillio — état fonctionnel du dépôt

Relevé du 14 novembre 2026, vérifié dans les routes et points d’entrée du checkout. Il distingue **accès dans l’interface**, **code serveur présent** et **validation en production**. Aucun test d’appel réel, achat, envoi de message ou changement de configuration distante n’est impliqué par ce relevé.

[Produit](../PRODUCT.md) · [Charte](../DESIGN.md) · [Inventaire généré](REFERENCE-GENEREE.md)

## Parcours et surfaces

| Domaine | État observé | Preuves / point d’entrée | Limites de la conclusion |
| --- | --- | --- | --- |
| Site public | Accueil, réceptionniste, tarifs, blog, comparatifs, affiliation, FAQ, pages métier et légales déclarés | `frontend/src/App.tsx`, `frontend/src/pages/v2/` | Une page marketing ne prouve pas une capacité active |
| Authentification | Connexion, inscription, confirmation email et réinitialisation déclarées | `frontend/src/App.tsx`, `backend/src/routes/auth.routes.ts` | Vérifier les flux et fournisseurs effectifs avant modification |
| Inscription libre-service | Parcours `/verify-email` → `/subscribe` → `/onboard`, avec gardes dédiées | `frontend/src/App.tsx` | Carte et facturation dépendent du parcours Stripe et de sa configuration |
| Portail client | `/dashboard` protégé, layout client ; aperçu, appels, leads, rendez-vous, réceptionniste, analytique, facturation, compte, support, intégrations et configuration déclarés | `frontend/src/App.tsx`, `backend/src/routes/my-dashboard.routes.ts` | L’état de chaque écran dépend du compte, des données et droits |
| Contacts / CRM | Leads unifiés, affaires, activités et fiche contact accessibles ; ancien `/dashboard/crm` redirigé vers leads | `frontend/src/App.tsx`, `backend/src/routes/crm.routes.ts` | Ne pas recréer un second répertoire à partir d’un ancien écran |
| Agent CRM client | `/dashboard/agent/crm` monté | `frontend/src/App.tsx`, `backend/src/routes/agent.routes.ts` | Ne prouve pas que tous les modules Agent sont ouverts |
| Autres modules Agent côté client | Catch-all `agent/*` renvoie au dashboard ; écrans historiques et endpoints peuvent exister | `frontend/src/App.tsx`, `backend/src/routes/agent.routes.ts` | Email, comptabilité, inventaire, paiements et autres modules ne sont pas tous achetables/accessibles côté client sur cette seule base |
| Page Agent publique | `/agent` redirige vers l’accueil | `frontend/src/App.tsx` | Ne pas annoncer une suite publiquement ouverte parce qu’un fichier Agent existe |
| Administration | Clients, paramètres, appels, leads, facturation, agents, modules administratifs, lab vocal, lignes et agence déclarés | `frontend/src/App.tsx`, `backend/src/routes/admin.routes.ts`, `backend/src/routes/admin-agents.routes.ts` | Les modules administratifs ne sont pas automatiquement des fonctions clients commercialisées |
| Closer | Espace protégé avec prospects, relances et compte | `frontend/src/App.tsx`, `backend/src/routes/closer.routes.ts` | Ne pas le confondre avec le dashboard client |
| Portail à jeton | `/portal` et `/onboarding` déclarés séparément | `frontend/src/App.tsx`, `backend/src/routes/client-portal.routes.ts`, `backend/src/routes/onboarding.routes.ts` | Surfaces historiques avec contrats différents du portail JWT |
| Prototype produit V2 | `pages/v2/app/` présent mais non monté par App.tsx | `frontend/src/App.tsx`, `frontend/src/pages/v2/app/` | Ne constitue ni le portail actif ni une migration achevée |

## Voix, données et intégrations

| Domaine | Preuves dans le dépôt | Ce qui reste à vérifier pour une affirmation de disponibilité |
| --- | --- | --- |
| Réceptionniste et outils vocaux | `backend/src/services/voice/`, routes webhooks et dashboard | Moteur choisi par compte/ligne, configuration distante, qualité d’un appel réel |
| Pont vers voice-core | `backend/src/routes/voice-core.routes.ts` monté sous `/api/voice-core` | Dépôt externe `qwillio-voice-core`, clés, worker et routage de chaque ligne ; ce checkout ne les valide pas |
| Rendez-vous et données clients | `backend/prisma/`, services et routes CRM/dashboard | Migrations effectives, droits, fournisseurs d’agenda et gestion des conflits |
| Google Calendar et Outlook | Routes de connexion/statut/test/déconnexion dans `my-dashboard.routes.ts`, services associés | Autorisations OAuth, compte connecté et opérations réellement supportées par le moteur concerné |
| Email et SMS | Services backend, `emails/`, `sms/`, miroirs synchronisés | Clés prestataires, domaine d’envoi, déclenchement et consentements selon le parcours |
| Paiements et abonnements | `backend/src/config/plans.ts`, routes webhooks Stripe et services | Produits/prix Stripe, environnement et état réel des abonnements |
| Affiliations et agences | Routes `/api/affiliate`, `/api/agency`, services et schéma | Droits, conditions et taux configurés ; ne pas généraliser un ancien pourcentage |
| API publique | `backend/src/routes/public-api.routes.ts` monté sous `/api/v1` | Authentification, contrat de chaque endpoint et limites |
| Bot Discord | Projet `discord-bot/` distinct | Déploiement et variables du bot ; ne pas supposer qu’il tourne parce que son code est versionné |

## Langues et thème

- L’i18n frontend déclare actuellement `fr` et `en` dans `frontend/src/i18n.ts`. La présence de contenus de publication néerlandais prévus ne prouve pas une interface néerlandaise complète.
- Le support vocal d’une langue se vérifie sur le moteur et le profil concernés. Ne pas le déduire de la langue de l’interface ou de l’indicatif d’un téléphone.
- Le site propose clair/sombre/système via `themeStore.ts` et `v2.css`. Le portail actuel reste sombre.

## Offre et évolution

Les valeurs configurées des quatre forfaits sont générées depuis `plans.ts` dans [REFERENCE-GENEREE.md](REFERENCE-GENEREE.md). Une copie de grille dans un document ne garantit pas l’alignement Stripe.

Cet état est un point de départ, pas une limite aux fonctions futures. Une nouvelle capacité devient « accessible » lorsqu’un parcours réel, les droits et les dépendances nécessaires existent et sont vérifiés. Lors d’une modification, actualiser la ligne concernée et la référence générée dans la même proposition.
