# Séquence LinkedIn (5 messages)

Cible : gérants PME BE / FR, 30 à 55 ans, secteurs service (plomberie, dentaire, avocat, garage, notaire, coiffure, kiné).

## Prérequis

- Compte LinkedIn Sales Navigator (essai gratuit 30 jours, ensuite 99 EUR / mois).
- Une photo de profil pro, un headline clair ("Fondateur Qwillio, réceptionniste IA bilingue pour PME"), un post épinglé qui montre le produit.

## Volume et cadence

- 50 demandes de connexion par jour, envoyées manuellement (pas d'automatisation : LinkedIn shadow-ban).
- Taux d'acceptation attendu : 20 à 25 %.
- Chaque acceptation entre dans une séquence de 4 messages sur 4 semaines.
- 5 à 8 % des personnes acceptées finiront en call de démo. Sur 50 par jour × 22 jours = 1 100 demandes / mois → 220 acceptations → 11 à 18 démos.

## Message 1 — Demande de connexion (jour 0)

Objectif : faire accepter la connexion. Pas de pitch.

```
Bonjour {{firstName}},

J'aide les {{secteur, par exemple "plombiers"}} belges et français à ne plus manquer un seul appel. Curieux de connecter,

{{ton_prénom}}
```

## Message 2 — Post-acceptation (jour +2 après acceptation)

Objectif : ouvrir un vrai dialogue.

```
Merci pour la connexion {{firstName}} !

Question rapide : vous perdez combien d'appels par semaine en moyenne dans votre {{type de business}} ?

C'est mon focus chez Qwillio. On a un cas récent : {{entreprise X}} a récupéré +23 % de conversion en 60 jours. Prêt à partager le playbook si ça vous intéresse.

{{ton_prénom}}
```

## Message 3 — Cas client (jour +7)

Objectif : donner un chiffre concret pour déclencher.

```
{{firstName}}, un cas concret qui pourrait vous intéresser :

Cabinet dentaire à Anvers (2 fauteuils, 3 collaboratrices) : avant, ils rataient 32 % des appels sur l'heure de midi. Après Qwillio : 4 % de manqués, +11 000 EUR de chiffre en 90 jours.

Coût : 149 EUR / mois, 15 min de setup, 1er mois offert sans carte.

Dispo pour un call 15 minutes cette semaine ?
```

## Message 4 — Valeur pure (jour +14)

Objectif : rester dans la boucle sans harceler.

```
{{firstName}}, je ne vais pas insister.

Juste au cas où, voici mon guide gratuit : "Combien coûte réellement une secrétaire en Belgique en 2026" (chiffres CP200, charges patronales, turnover, tous les vrais coûts que les patrons ne calculent pas).

Lien : qwillio.com/blog/cout-secretaire-belgique-2026

Ça vous sera utile même si Qwillio n'est pas pour vous.

Bien à vous,
{{ton_prénom}}
```

## Message 5 — Dernier (jour +28)

Objectif : porte fermée proprement.

```
{{firstName}},

Dernier message. Si vous voulez tester Qwillio 30 jours gratuits (sans carte), voici le lien direct : qwillio.com/register

Sinon, bonne suite dans vos projets. Restons connectés.

{{ton_prénom}}
```

## Règles

- Ne pas envoyer plus de 50 demandes par jour, LinkedIn plafonne à 100 par semaine sur les nouveaux comptes.
- Personnaliser au moins le secteur (`{{secteur}}`). Le reste peut être copie exacte.
- Si un prospect répond entre les messages, sortir immédiatement de la séquence et gérer manuellement.
- Ne pas parler du prix dans les 3 premiers messages. Le prix ferme la porte trop tôt.

## Tracking

Instantly propose un connecteur LinkedIn payant. Ne l'utilise pas au démarrage : tu risques la suspension du compte LinkedIn. À la place :

- Duplique `prospects-pme.csv` en `prospects-linkedin.csv` (ou ajoute une colonne `canal`).
- Marque manuellement chaque état dans la colonne `statut` : `sent-1`, `accepted`, `sent-2`, `replied`, `demo-booked`, `closed-won`, `closed-lost`.
- Passe 5 minutes chaque matin à mettre à jour.
