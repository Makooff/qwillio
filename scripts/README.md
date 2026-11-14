# Outils techniques

| Outil | Rôle |
| --- | --- |
| [sync-reference.mjs](sync-reference.mjs) | Génère et vérifie l’inventaire des routes, tokens et forfaits |
| [build-design-catalog.mjs](build-design-catalog.mjs) | Génère et vérifie le catalogue visuel depuis les fondations et le template |
| [sync-templates.mjs](sync-templates.mjs) | Régénère ou vérifie les copies lisibles des emails et SMS automatiques |
| [hermes-call-fixer.mjs](hermes-call-fixer.mjs) | Outil technique de diagnostic et correction des appels ; lire ses options avant utilisation |
| [windows/](windows/) | Outils PowerShell locaux de gestion de la clé partagée voice-core |

Le script ponctuel `brancher.ps1` a été supprimé : il exigeait l’ancienne branche `voice-core-bridge` et créait une PR spécifique au branchement initial. Les routes correspondantes existent déjà dans le dépôt.

[Retour à l’accueil](../README.md)
