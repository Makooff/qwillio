# Qwillio — bibliothèque de composants et patterns

[Catalogue visuel](index.html) · [Charte](../../DESIGN.md) · [Fondations](../../frontend/src/design-system/tokens.json)

## Contrats communs

Chaque composant définit : intention, variantes, tailles, contenu autorisé, comportement clavier/tactile, états, responsive et traduction. Réutiliser un composant existant avant d’en créer un second au même rôle. Une variante nouvelle est possible ; la documenter dans le composant et le catalogue.

| Famille | Référence existante | Variantes et états à conserver / préciser |
| --- | --- | --- |
| Bouton public | `frontend/src/components/v2/Button.tsx` | primary, outline, ghost, onDark, chromatic ; md/lg, min 44 px ; hover, focus, press, disabled ; chargement à définir selon le parcours, pas de prop loading supposée |
| Bouton produit | `frontend/src/components/ui/Button.tsx` | primary contour, ghost, danger, subtle ; sm/md ; loading, disabled, focus, nom et handlers préservés |
| Liens et navigation publique | `components/v2/NavV2.tsx`, `FooterV2.tsx`, `PillLink` | actif, hover, menu mobile, liens internes/externes, thème et clavier |
| Navigation produit | `components/layout/DashboardShell.tsx` | dépliée/repliée, mobile, active, sous-routes, déconnexion ; pas de sous-menu inaccessible au clavier |
| Champs et selects | `styles/design-system.ts`, `components/settings/SettingsUI.tsx` | label, aide, requis, erreur, disabled, lecture seule ; association aria ; select et champ texte gardent leur propre contrat |
| Cartes et surfaces | `components/v2/CardV2.tsx`, `ds.surface/Inset/Raised/Float` | éditorial clair/sombre ; large/mobile ; contenu produit ; interactif seulement quand l’action est claire |
| Statut et badge | `badgeStyle`, `components/client-dashboard/StatusBadge.tsx`, `SentimentBadge.tsx` | neutral, brand, violet, success, warning, danger, info ; libellé en plus de la couleur |
| Tableaux et listes | pages client/admin concernées, composants de pagination | chargement, vide, erreur, données, tri/filtre, sélection si utile ; lignes longues et scroll local |
| Pagination | `components/ui/Pagination.tsx`, `components/client-dashboard/Pagination.tsx` | bornes, page active, taille, résultats ; éviter deux comportements nouveaux pour la même famille |
| Dialogue de confirmation | `components/ui/ConfirmDialog.tsx`, `components/client-dashboard/ConfirmDialog.tsx` | confirmation neutre/danger, pending, erreur ; focus contenu et restitué, fermeture cohérente |
| Modale et panneau latéral | `components/ui/Modal.tsx`, `SlideSheet.tsx`, `components/client-dashboard/SlideOver.tsx` | ouvert/fermé, scroll, mobile, Escape, focus ; une modale n’est pas interdite si adaptée |
| Notification | `components/ui/Toast.tsx` | info/succès/erreur, action éventuelle, annonce non intrusive ; pas de succès fictif avant réponse |
| Chargement | `components/ui/Skeleton.tsx`, `LoadingDots.tsx` | forme proche du contenu ; aria-busy sur la région pertinente ; réduire la motion |
| État vide | `components/ui/EmptyState.tsx`, `components/client-dashboard/EmptyState.tsx` | première utilisation, aucun résultat de filtre, erreur distincte ; action utile, pas de faux chiffres |
| Recherche / commande | `components/ui/CommandPalette.tsx` | recherche, navigation clavier, aucun résultat, fermeture ; action et raccourci clairement nommés |
| Enregistrement et lecture audio | `components/client-dashboard/RecordingPlayer.tsx` | prêt, lecture, pause, indisponible, erreur ; contrôles nommés et source conforme aux droits |
| Indicateurs et graphiques | composants dashboard / pages utilisant Recharts | unités, période, légende et alternatives lisibles ; démo distincte des données réelles |

Les chemins abrégés du tableau sont relatifs à `frontend/src/`. La présence d’un composant n’atteste pas qu’il soit employé par toutes les routes ; consulter l’import réel avant migration.

## Matrice minimale des états

| État | Comportement attendu |
| --- | --- |
| Repos / hover / press | Une action identifiable ; retour discret ; pas de saut de layout |
| Focus clavier | Anneau visible sur le fond réel ; ordre et nom accessibles |
| Sélection / actif | Libellé, forme ou indicateur en plus de la couleur ; aria adapté |
| Chargement | Empêcher les doubles soumissions concernées ; annoncer le traitement ; garder le contexte |
| Désactivé | Motif compréhensible ; ne pas rendre une action importante simplement invisible |
| Vide | Expliquer ce qui manque et l’action suivante ; distinguer zéro résultat et absence de données |
| Erreur | Expliquer ce qui a échoué, garder les saisies, proposer reprise quand possible |
| Succès | Confirmer le résultat réel ; éviter de masquer l’état suivant |
| Permission manquante | Expliquer les droits nécessaires sans exposer des données d’un autre client |

## Ajouter un composant professionnel

1. Identifier l’usage et la surface, puis chercher le composant existant.
2. Réutiliser les tokens de rôle, y compris espaces et arrondis.
3. Décrire les variantes justifiées et leurs états ; éviter une multitude d’options sans usage.
4. Ajouter un exemple contextualisé, puis contrôler clavier, mobile, zoom, texte long et traduction.
5. Vérifier les parcours qui consomment le composant. Une nouvelle idée peut enrichir la bibliothèque ; elle ne requiert pas une refonte globale.
