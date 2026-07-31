# Emails

Tout ce que Qwillio envoie par email, à un seul endroit, lisible sans ouvrir de TypeScript.

```
transactionnels/   ce que l'application envoie toute seule
vente/             ce que tu envoies à la main
partenaires/       approche et suivi des cabinets partenaires
```

## Source de vérité

C'est la règle qui empêche ce dossier de devenir un mensonge.

| Type | La vérité est dans | Ce dossier sert à |
|---|---|---|
| **Transactionnels** | le code : `backend/src/services/email-renderers.ts` | relire la copy sans lire du code |
| **Vente et partenaires** | **ce dossier**, il n'y a pas d'équivalent en code | copier-coller au moment d'envoyer |

Chaque fichier de `transactionnels/` porte en tête la fonction dont il est le miroir :

```
<!-- source: backend/src/services/email-renderers.ts · renderWelcomeTemplate -->
```

**Modifier un email transactionnel se fait dans le code, puis ici.** L'inverse ne prend pas effet et laisse une copie qui ment, ce qui est pire que pas de copie du tout.

Le script `scripts/check-templates-sync.ts` vérifie que chaque fichier de `transactionnels/` pointe vers une fonction qui existe encore. Il tourne au CI : supprimer ou renommer un template sans mettre le dossier à jour casse le build.

```bash
npm run check:templates
```

## Les onze emails transactionnels

| Fichier | Fonction | Déclenchement |
|---|---|---|
| `devis.md` | `renderQuoteTemplate` | Envoi d'un devis à un prospect |
| `relance.md` | `renderFollowUpTemplate` | Relance après un appel sans suite |
| `bienvenue.md` | `renderWelcomeTemplate` | Compte créé |
| `bienvenue-essai.md` | `renderTrialWelcomeTemplate` | Début des 7 jours d'essai |
| `essai-bientot-fini.md` | `renderTrialEndingTemplate` | Avant la fin de l'essai |
| `essai-expire.md` | `renderTrialExpiredTemplate` | Essai terminé sans conversion |
| `rappel-3-mois.md` | `renderCallback3MonthsTemplate` | Rappel d'un prospect tiède |
| `rappel-rdv.md` | `renderBookingReminderTemplate` | Avant un rendez-vous pris par l'IA |
| `reset-mot-de-passe.md` | `renderPasswordResetTemplate` | Demande de réinitialisation |
| `replanification.md` | `renderRescheduleTemplate` | Rendez-vous déplacé |
| `_gabarit.md` | `email-template.ts` | Enveloppe commune, en-tête et pied |

## Règles d'écriture

Elles valent pour les trois dossiers, et découlent de `DA/voix.md` :

- **Rien qu'on ne puisse prouver.** Pas de client cité qui n'existe pas, pas de pourcentage sans source.
- Objet court, sous 50 caractères, qui dit ce qu'il y a dedans.
- Une seule action par email. Deux boutons, c'est zéro clic.
- Les prix viennent de `backend/src/config/plans.ts`. Aucun montant écrit à la main.
- L'essai dure **7 jours** et **une carte est demandée à l'inscription**. Toute autre formulation contredit le produit et se découvre à l'inscription.
- Accents français partout, pas d'emojis, pas de tirets cadratins.
