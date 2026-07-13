# Séquence email fiduciaire (Instantly, 4 messages)

Séquence à charger dans Instantly, ciblage : fiduciaires belges scrapées sur l'annuaire IEC / IPCF ou LinkedIn Sales Navigator. Volume cible : 200 fiduciaires en pipeline.

## Configuration Instantly

- Warm-up : 7 jours avant premier envoi. Volume progressif de 10 à 40 emails / jour par boîte.
- Domaine d'envoi : un sous-domaine dédié (par exemple `partenaires.qwillio.com`) pour ne pas polluer la réputation du domaine principal.
- Signature : ton nom, ton titre, qwillio.com, un numéro de téléphone.
- Unsubscribe : automatique par Instantly. Ne pas retirer.

## Email 1 — Jour 0

**Sujet** : Vos clients artisans ratent 25 % de leurs appels

```
Bonjour {{firstName}},

Je suis {{ton_prénom}}, fondateur de Qwillio (réceptionniste IA pour PME).

Question rapide : vous avez combien de clients dans votre portefeuille qui sont des artisans, PME service, ou professions libérales ?

La raison de mon message : la plupart d'entre eux ratent 20 à 35 % de leurs appels entrants. Chaque appel manqué est environ 140 EUR de chiffre perdu. Multiplié par 500 appels par an, cela fait facilement 15 000 EUR qui partent chez la concurrence.

On propose aux fiduciaires comme la vôtre 15 % de commission récurrente sur chaque client qui souscrit via votre recommandation.

Ça vous intéresse d'en discuter 15 minutes ?

{{ton_prénom}}
qwillio.com
```

## Email 2 — Jour 3

**Sujet** : Re: vos clients artisans

```
Bonjour {{firstName}},

Petit up rapide au cas où mon premier mail a atterri en spam.

Un cas concret : Menuiserie X à Namur a signé avec nous il y a 3 mois. Résultat : +23 % d'appels convertis en RDV, +4 200 EUR de chiffre supplémentaire au mois 2. Son fiduciaire a touché 75 EUR / mois de commission.

Dispo pour un call cette semaine ? Voici mon lien Calendly : {{lien_calendly}}

{{ton_prénom}}
```

## Email 3 — Jour 7

**Sujet** : Une brochure PDF (2 pages) pour vos clients

```
{{firstName}},

Je ne vais pas insister plus. Je vous laisse en pièce jointe :
- 1 fiche produit de 2 pages que vous pouvez partager à vos clients
- Le barème commission fiduciaire (15 % récurrent)

Si un client vous demande à qui vous confieriez sa téléphonie IA, Qwillio est la seule option 100 % bilingue FR+EN avec hébergement UE.

Bien à vous,
{{ton_prénom}}
```

Pièces jointes recommandées : voir dossier `assets/` à créer, contenant `qwillio-fiduciaire-2p.pdf` (à produire séparément) et `bareme-commission-fiduciaire.pdf`.

## Email 4 — Jour 14

**Sujet** : Dernier message

```
{{firstName}},

Dernier mail. Si vous voulez le pack partenaire fiduciaire (brochure + contrat commission), répondez juste "OK" et je vous envoie tout.

Sinon je vous laisse tranquille. Bon travail,
{{ton_prénom}}
```

## Ce que tu attends comme retour

Sur 200 fiduciaires en séquence :

- Taux d'ouverture email 1 : 45 à 60 %.
- Taux de réponse toutes séquences confondues : 4 à 8 %.
- Réponses positives (démo posée) : 8 à 16.
- Signatures partenariat (60 jours plus tard) : 2 à 4.

## Ce qu'il faut éviter

- Envoyer sans warm-up : les 4 premiers emails partiront en spam.
- Personnaliser à la main les 200 emails : perte de temps. Un placeholder `{{firstName}}` suffit.
- Suivre les prospects par email après le 4ᵉ message : c'est LinkedIn ou téléphone pour la suite.
- Envoyer un sujet en majuscules ou avec un emoji : baisse de deliverability.
