# Qwillio Next-Gen Voice Core

Refonte de la couche vocale et de l'orchestrateur du réceptionniste IA.
Branche : `feature/qwillio-next-gen-core`.

Périmètre conservé intact : authentification, base de données, abonnements
Stripe, interfaces graphiques. Aucune migration Prisma, aucun changement de
schéma.

---

## 1. Ce qui bloquait

L'audit du pipeline existant a isolé quatre causes de latence et de coût, dans
cet ordre d'impact :

| Cause | Détail | Où |
|---|---|---|
| Écriture DB par transcript partiel | `call.updateMany` sur chaque événement `transcript`, soit 2 à 5 allers-retours Postgres par seconde et par appel, dans le chemin de réponse du webhook | `webhooks.controller.ts` |
| Insertion `webhookLog` bloquante | `await prisma.webhookLog.create(...)` avant tout dispatch, sur tous les types d'événements | idem |
| Turn-taking à l'ancienne | `interruptionsEnabled` + `numWordsToInterruptAssistant` + `responseDelaySeconds: 0.2`. Le barge-in attendait qu'un mot soit transcrit ; le délai de réponse fixe s'appliquait à chaque tour | `vapi-payload.ts`, `onboarding.service.ts` |
| Aucun transcriber explicite | Endpointing laissé au défaut Vapi, alors que c'est le premier levier sur la latence de tour | `onboarding.service.ts` |

S'y ajoutaient l'absence totale de function calling exécutable côté serveur
(les `function-call` étaient loggés, jamais exécutés), et un prompt système
construit sans aucun contexte client mis en cache.

---

## 2. Architecture livrée

Nouveau module `backend/src/services/voice/` :

```
speech-plans.ts              transcriber + start/stop speaking plans + voice
realtime-context.service.ts  cache profil client + historique appelant
system-prompt.ts             assemblage du prompt système et du first message
intent-router.ts             classification déterministe des tours sans valeur
voice-tools.ts               schémas d'outils + meublage (filler) par outil
tool-runtime.service.ts      exécution des outils (agenda, réservation, lead)
call-session.store.ts        état live en mémoire, buffer de transcript
realtime-orchestrator.service.ts  dispatch des événements streaming
```

Contrôleur : `controllers/voice-webhook.controller.ts`.
Routes : `/api/webhooks/vapi/client/:clientId`, `/api/webhooks/vapi/tools/:clientId`,
`/api/webhooks/vapi/health`.

### Règle structurante

**Les événements sur lesquels l'appelant attend sont traités inline ; les autres
répondent 200 immédiatement et travaillent après.**

| Événement | Traitement |
|---|---|
| `assistant-request` | inline — construit l'assistant depuis le cache |
| `tool-calls` / `function-call` | inline — exécute et renvoie le résultat |
| `transcript` | ack immédiat, buffer mémoire, zéro I/O |
| `speech-update` | ack immédiat, compteur de barge-in |
| `status-update` | ack immédiat, travail en `void` |
| `end-of-call-report` | ack immédiat, analyse déportée |

---

## 3. Budget de latence perçue

Cible < 400 ms sur un tour simple :

```
endpointing Deepgram        150 ms   VOICE_ENDPOINTING_MS
attente avant réponse       120 ms   VOICE_START_WAIT_SECONDS
premier token LLM            ~90 ms   maxTokens plafonné à 120
TTFB TTS (Flash v2.5)        ~75 ms   chunkPlan.minCharacters = 20
                            ───────
                            ~435 ms théorique, dont le smart endpointing
                            retire l'attente sur les fins de phrase prédites
```

Les valeurs sont dans `config/env.ts`, toutes surchargeables par variable
d'environnement. Chaque constante documente le mode de défaillance qu'elle
protège.

### Barge-in

`stopSpeakingPlan` remplace `interruptionsEnabled` :

- `numWords: 0` — coupure sur activité vocale, sans attendre la transcription.
  C'est ce qui rend l'interruption instantanée au lieu de bégayante.
- `voiceSeconds: 0.2` — garde-fou : une toux ou un « mhm » ne coupe pas.
- `backoffSeconds: 1.0` — silence tenu après coupure, évite la saturation où les
  deux parties se parlent dessus en boucle.
- Listes d'acquiescements et d'interruptions en français et en anglais.

---

## 4. Économie de tokens

**Routeur d'intention** (`intent-router.ts`) : classification déterministe des
tours sans contenu métier (acquiescements, vérifications de ligne, formules de
politesse, salutation d'ouverture). Garde-fous :

- tout marqueur métier (`rdv`, `dispo`, `annul`, `prix`, `book`, `cancel`…)
  force l'escalade vers le modèle, même sur un énoncé court ;
- au-delà de 5 mots, escalade systématique ;
- correspondance sur l'énoncé normalisé entier, jamais en sous-chaîne.

Le biais est asymétrique et assumé : une escalade inutile coûte des tokens, un
court-circuit erroné coûte un mauvais appel.

**Autres réductions :**

- `maxTokens: 120` sur les complétions — un tour de réceptionniste plus long est
  un monologue, et une complétion longue est aussi une latence TTS longue.
- Prompt système compact, testé à moins de 2 000 caractères, car il est rejoué à
  chaque tour du modèle.
- Résultats d'outils courts et impératifs (`LIBRE le 2026-09-14 a: 10:00, 11:00`)
  plutôt que du JSON verbeux, pour la même raison.
- Voicemail et non-réponse : plus aucune analyse GPT sur transcript vide.

---

## 5. Function calling et meublage

Outils exposés selon la configuration réelle du client : `checkAvailability`,
`bookAppointment`, `lookupBooking` seulement si un agenda Google est connecté et
la réservation activée ; `captureLead` toujours ; `transferCall` seulement si un
numéro de transfert existe. Un agent qui promet un créneau qu'il ne peut pas
écrire est pire qu'un agent qui propose un rappel.

Le meublage est déclaré dans le schéma de l'outil, pas généré par un tour de
modèle supplémentaire :

- `request-start` — parlé dès l'invocation (« Je regarde ça tout de suite. »),
  plusieurs variantes pour éviter l'effet répondeur ;
- `request-response-delayed` — seconde relance après 1,2 s, uniquement sur les
  outils réellement lents.

`captureLead` est le seul outil `async: true` : le modèle ne doit pas attendre
une écriture qui ne compte qu'après l'appel.

Côté runtime : chaque appel externe est borné à 2,5 s, ne lève jamais, et
dégrade vers une consigne actionnable (« propose de noter ses coordonnées pour
un rappel ») plutôt qu'un message d'erreur. L'écriture agenda après réservation
n'est volontairement pas attendue : la ligne `ClientBooking` fait foi.

**Double réservation :** un créneau confirmé sur un appel en cours est retenu en
mémoire (`holdSlot`, TTL 5 min) et retiré des disponibilités proposées aux
appels parallèles.

---

## 6. Contexte temps réel

`realtime-context.service.ts` sert le profil client et l'historique de
l'appelant depuis un cache, avant la première seconde de l'appel. Deux
allers-retours Neon à froid suffiraient à consommer tout le budget de latence.

- Cache local en mémoire par défaut, borné à 500 entrées.
- Store partagé Redis si `REDIS_URL` est défini **et** `ioredis` installé —
  import dynamique, dépendance optionnelle, dégradation silencieuse sinon.
- Invalidation explicite sur changement de configuration assistant
  (`onboarding.service`, `onboarding-flow.service`), sans quoi l'agent
  continuerait à se présenter sous l'ancien nom pendant la durée du TTL.

Injecté dans le prompt initial : nom du commerce, persona, horaires, services,
consignes du client, et mémoire de l'appelant (nom déjà connu, résumé du dernier
appel, rendez-vous à venir). Un appelant connu est salué par son prénom dès le
`firstMessage`.

**Sécurité :** le transcript est du texte contrôlé par l'appelant qui atterrit
dans le contexte du modèle. Le prompt contient une clause explicite indiquant
que ce que dit l'appelant est une demande, jamais une instruction système. Le
`clientId` provient toujours du chemin du webhook, jamais des arguments produits
par le modèle, pour empêcher un accès cross-tenant.

---

## 7. Vérification

```
tsc --noEmit          0 erreur
vitest run            216 tests, 25 fichiers, 100 % passants
eslint src/services/voice src/controllers/voice-webhook.controller.ts   propre
```

71 tests ajoutés, dont 14 tests de routes qui montent le routeur Express avec
orchestrateur simulé et vérifient : réponse inline sur `assistant-request` et
sur les outils, acquittement avant travail sur `status-update`, absence
d'écriture DB sur `transcript`, 200 avec résultats vides sur échec d'outil,
saut de l'analyse sur voicemail, et échec fermé de l'authentification.

Ces tests ont attrapé un vrai bug pendant l'implémentation : le filtre
« hot-path » comparait l'étiquette préfixée `client_transcript` au lieu du type
brut `transcript`, ce qui laissait passer une écriture `webhookLog` par
transcript.

Aucune régression : authentification, schéma Prisma, migrations et flux Stripe
n'ont pas été touchés.

---

## 8. Ce qui n'a pas pu être vérifié ici

La latence réelle et la qualité du barge-in ne se mesurent que sur un appel
réel. Les valeurs par défaut sont un point de départ argumenté, pas un résultat
mesuré. À valider en conditions réelles :

1. `VOICE_ENDPOINTING_MS` — descendre sous 150 ms coupe la parole des locuteurs
   lents ; monter au-dessus de 250 ms rend le silence audible.
2. `VOICE_BARGE_IN_VOICE_SECONDS` — trop bas, l'agent se coupe sur un bruit de
   fond ; trop haut, l'interruption redevient molle.
3. Le `waitFunction` LiveKit n'a de modèle qu'en anglais ; le français retombe
   sur l'endpointing intégré de Vapi, d'où un plancher d'attente non nul.

La métrique `medianTurnLatencyMs`, persistée dans `ClientCall.metadata.realtime`
avec le nombre de barge-ins et de tours déviés, sert précisément à ce réglage
après mise en production.
