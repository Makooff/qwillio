# Plan du jour — 4 heures de vente ciblées

Objectif : 20 cold-calls, 50 demandes LinkedIn, 1 séquence email lancée.

## Bloc 1 : Setup outils (60 min, une seule fois)

- [ ] Créer un compte Instantly (essai gratuit 14 jours).
- [ ] Créer un compte Sales Navigator (essai gratuit 30 jours).
- [ ] Ouvrir un compte Trustpilot Business (gratuit).
- [ ] Créer un Calendly personnel de 30 minutes, nom `demo-qwillio`.
- [ ] Ajouter les env vars Vercel : `VITE_SENTRY_DSN` + `VITE_APP_VERSION`.
- [ ] Vérifier que Sentry frontend capte une erreur test (console `throw new Error('test')` sur qwillio.com).

Ces items ne sont à faire qu'une fois. Ensuite tu passes direct au bloc 2 chaque jour.

## Bloc 2 : Sourcing (30 min)

- [ ] Remplir 40 lignes dans `prospects-fiduciaires.csv` :
  - Sources : Ordre IEC (ipcfbelgium.be), IPCF, Google Maps `fiduciaire [ville]`.
  - Colonnes obligatoires : `nom_cabinet`, `ville`, `telephone`, `email` (à trouver ou deviner sur le pattern habituel), `contact_nom`.
- [ ] Remplir 40 lignes dans `prospects-pme.csv` :
  - Secteurs à privilégier : plomberie, garage auto, dentaire, notaire, kinésithérapeute.
  - Cibler Bruxelles, Namur, Liège, Anvers, Lyon, Marseille (villes à densité PME).

## Bloc 3 : Cold-call PME (45 min)

- [ ] Ouvrir `01-cold-call-pme.md`.
- [ ] Ouvrir `prospects-pme.csv`.
- [ ] Appeler 20 prospects successifs. Ne pas se poser de questions entre deux appels.
- [ ] Après chaque appel, mettre le statut dans le CSV : `no-answer` / `refus` / `rdv-pris` / `rappel-demandé`.
- [ ] Si RDV pris ou intéressé : déplacer dans `pipeline.csv` avec la date et le canal.

## Bloc 4 : Séquence email Instantly (30 min, setup + lancement)

- [ ] Importer les 40 fiduciaires du CSV dans Instantly.
- [ ] Coller la séquence `03-cold-email-fiduciaire.md` (4 emails, jours 0, 3, 7, 14).
- [ ] Configurer un warm-up de 7 jours avant premier envoi (envoi progressif).
- [ ] Lancer.

## Bloc 5 : LinkedIn (45 min)

- [ ] Ouvrir Sales Navigator.
- [ ] Filtrer : gérants PME, 30 à 55 ans, Belgique + France, secteurs service.
- [ ] Envoyer 50 demandes de connexion avec la note du `04-linkedin-sequence.md` message 1.
- [ ] Sur les acceptations d'hier ou avant-hier, envoyer manuellement le message 2.
- [ ] Sur les prospects qui n'ont pas répondu depuis 7 jours, envoyer le message 3.

## Bloc 6 : Bilan (10 min)

- [ ] Compter : combien d'appels froids passés, combien de RDV posés, combien de connexions LinkedIn acceptées, combien de réponses email.
- [ ] Noter la chose la plus dure de la journée (à corriger demain).
- [ ] Fermer l'ordinateur.

## Métriques cibles semaine 1 à 4

| Semaine | Cold-calls | RDV posés | Clients payants | Partenaires signés |
|---|---:|---:|---:|---:|
| 1 | 60 | 2 | 0 | 0 |
| 2 | 80 | 4 | 0 | 0 |
| 3 | 80 | 6 | 1 | 0 |
| 4 | 80 | 6 | 2 à 3 | 1 |

Rien n'oblige à tout faire chaque jour : 4 h par jour × 4 jours = 16 h par semaine. Assez pour tenir les cibles ci-dessus.
