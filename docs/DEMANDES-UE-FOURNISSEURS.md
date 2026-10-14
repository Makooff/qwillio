# Demandes UE aux sous-traitants — courriers prêts à envoyer (13/08/2026)

## Pourquoi ceci passe avant la migration Render/Neon

Déplacer Render et Neon met **nos** données en Europe. Ça ne suffit pas à
écrire « Hébergement UE » sur le site, parce que le produit est une chaîne
vocale : chaque appel envoie de l'audio et sa transcription à cinq tiers. Tant
qu'un seul maillon traite hors UE, la formule honnête reste « conforme au
RGPD, transferts encadrés par des clauses contractuelles types ».

Ces demandes sont donc le **délai long** du chantier, et elles sont gratuites.
Elles s'envoient avant, pas après.

**À faire soi-même** : ces courriers sont des brouillons, à relire et à
envoyer depuis ta propre adresse. Remplace `[…]` avant l'envoi.

---

## 1. Vapi — orchestration de l'appel

**À** : support@vapi.ai (ou le contact de ton plan)
**Objet** : Data residency EU and DPA — account [ton identifiant de compte]

> Hello,
>
> We operate an AI receptionist for small businesses in France and Belgium,
> built on Vapi. All our end users are located in the EU, and calls carry
> personal data (voice, transcripts, contact details).
>
> Could you confirm:
>
> 1. whether EU data residency is available for call processing and storage,
>    and on which plan;
> 2. whether you can provide a signed Data Processing Agreement including the
>    EU Standard Contractual Clauses;
> 3. your current list of sub-processors and their processing locations;
> 4. the retention period for recordings and transcripts on your side, and
>    whether it is configurable.
>
> We already delete recordings through your API as part of our own retention
> policy, and we would like to document the full chain accurately.
>
> Thank you,
> [Nom] — Qwillio

---

## 2. OpenAI — modèle

**À** : via le tableau de bord (Settings → Data controls), ou l'équipe commerciale
**Objet** : EU data residency and DPA — organisation [org-…]

> Hello,
>
> We run a voice assistant for EU-based businesses using the Realtime API and
> GPT-4o. All end users are in the EU.
>
> Could you confirm:
>
> 1. how to enable EU data residency for our organisation, and whether it
>    covers the Realtime API as well as chat completions;
> 2. how to obtain a countersigned DPA with SCCs;
> 3. confirmation that our API data is excluded from model training.
>
> Thank you,
> [Nom] — Qwillio

**Note** : la résidence UE d'OpenAI est proposée sur les offres entreprise.
Demande explicitement si la **Realtime API** est couverte : c'est notre chemin
par défaut, et la couverture n'est pas toujours identique à celle du texte.

---

## 3. ElevenLabs — synthèse vocale

**À** : support@elevenlabs.io
**Objet** : EU endpoint and DPA — account [identifiant]

> Hello,
>
> We use ElevenLabs for text-to-speech in a live phone assistant serving
> businesses in France and Belgium.
>
> Could you confirm:
>
> 1. whether an EU processing endpoint or EU data residency option exists,
>    and on which plan;
> 2. how to obtain a signed DPA with SCCs;
> 3. whether audio sent for synthesis is retained, and for how long.
>
> We also clone voices with documented consent, so we would like to confirm
> how voice fingerprints are stored and how they can be deleted on request.
>
> Thank you,
> [Nom] — Qwillio

**Note** : la question de l'effacement des empreintes vocales est aussi un
point ouvert de notre audit (DPIA voix). La réponse sert deux fois.

---

## 4. Deepgram — transcription

**À** : support@deepgram.com
**Objet** : EU endpoint and DPA — account [identifiant]

> Hello,
>
> We stream live phone audio to Deepgram (nova-3 and nova-2) for a voice
> assistant used by businesses in France and Belgium.
>
> Could you confirm:
>
> 1. whether an EU processing region or endpoint is available, and on which
>    plan;
> 2. how to obtain a signed DPA with SCCs;
> 3. whether streamed audio or transcripts are retained on your side, and
>    whether retention can be disabled.
>
> Thank you,
> [Nom] — Qwillio

---

## 5. Twilio — téléphonie

**À** : via la console Twilio (Support → nouveau ticket)
**Objet** : EU region for voice and messaging — account [AC…]

> Hello,
>
> Our customers are located in France and Belgium. We would like all voice and
> messaging traffic processed in the EU.
>
> Could you confirm:
>
> 1. how to move our account or project to the Ireland (EU) region, and what
>    changes on our side (endpoints, existing numbers, webhooks);
> 2. whether our existing numbers can be migrated or must be repurchased;
> 3. confirmation of the DPA and SCCs already in force on our account.
>
> Thank you,
> [Nom] — Qwillio

**Note importante** : la région Twilio se choisit à la création du projet.
Si un basculement impose de racheter les numéros, **fais-le avant** d'acheter
le numéro belge, sinon tu le paieras deux fois. C'est la seule dépendance
d'ordre entre les deux chantiers.

---

## Stripe et Resend

Rien à demander : ce sont des sous-traitants déjà encadrés, leurs DPA sont
publics et signables en ligne. À archiver simplement, pour le registre.

---

## Suivi

| Fournisseur | Envoyé le | Réponse | Résidence UE ? | DPA signé ? |
|---|---|---|---|---|
| Vapi | | | | |
| OpenAI | | | | |
| ElevenLabs | | | | |
| Deepgram | | | | |
| Twilio | | | | |

**Le site ne pourra réannoncer « Hébergement UE » que lorsque cette table est
complète ET la migration Render/Neon faite.** Pas avant. C'est ce que le
runbook de migration appelle son étape 4, et c'est le point qu'il est le plus
facile d'oublier.
