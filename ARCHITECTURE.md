# ARCHITECTURE.md — État réel constaté (audit du 13/08/2026)

Ce document décrit **ce que le code fait aujourd'hui**, preuves à l'appui (`fichier:ligne`),
pas ce que la documentation promet. Il est le socle de `AUDIT.md` (gap analysis) et
`ROADMAP.md` (plan d'implémentation).

## 1. Vue d'ensemble

**Qwillio** est une plateforme B2B de réceptionniste vocal IA (PME FR/BE), avec deux
mondes qui cohabitent dans un seul backend :

| Monde | Rôle | Modèles Prisma | Webhook |
|---|---|---|---|
| **Outbound sales** | Qwillio se vend lui-même (cold-calling Ashley/Marie) | `Prospect`, `Call`, `Campaign`, `Quote` | `POST /api/webhooks/vapi` |
| **Produit (réceptionniste)** | L'agent inbound de chaque client | `Client`, `ClientCall`, `ClientBooking`, `Contact`, `Deal`, `CallerMemory`, `BusinessKnowledge` | `POST /api/webhooks/vapi/client/:clientId` |

`Call` et `ClientCall` sont **deux tables d'appels distinctes sans relation**.

**Stack** : Express + TypeScript (`backend/`), Prisma 6 / PostgreSQL Neon
(`backend/prisma/schema.prisma`, ~1980 lignes, ~75 modèles, zéro enum), React 19 + Vite
(`frontend/`), Vapi (voix), Twilio (SMS/WhatsApp, telco sous Vapi), Stripe (facturation),
Resend (email), node-cron (45 jobs). Déploiement : Vercel (front) + Render **Oregon**
(`backend/render.yaml:5,68`) + Neon. Pas de docker-compose ; le seul `Dockerfile`
(`backend/Dockerfile:16`) lance `prisma db push --accept-data-loss` (danger, voir audit).

**Point important** : il n'y a **ni n8n, ni Google Places côté produit, ni MCP, ni
pgvector** dans le code actuel (Google Places sert uniquement au scraping de prospects
outbound via Apify). Les fournisseurs IA sont appelés en `fetch` brut (pas de SDK
OpenAI/ElevenLabs/Deepgram ; seul `@anthropic-ai/sdk` est installé).

## 2. Pipeline vocal — architecture en cascade via Vapi

### 2.1 Deux modes d'exécution

Le mode est choisi par `useSpeechToSpeech` (`backend/src/services/voice/speech-plans.ts:195-206`) :

- **Speech-to-speech (défaut)** : `VOICE_SPEECH_TO_SPEECH` par défaut `'on'`
  (`backend/src/config/env.ts:96`) → OpenAI `gpt-realtime-2025-08-28` (`env.ts:97`),
  voix natives OpenAI (`marin`/`cedar`, `speech-plans.ts:184`). Pas de transcriber
  séparé (`speech-plans.ts:311`).
- **Cascade classique** : Deepgram `nova-3` (STT, `speech-plans.ts:37-47`) →
  `gpt-4o` ou custom-LLM (`speech-plans.ts:245-258`, endpoint OpenAI-compatible maison
  `/api/webhooks/vapi/llm/:clientId/chat/completions`) → ElevenLabs `eleven_flash_v2_5`
  (TTS, `speech-plans.ts:136-169`). Une voix clonée force ce mode.

### 2.2 Trois constructeurs d'assistant (dont un mort)

| Constructeur | Fichier | Statut |
|---|---|---|
| `buildAssistantForCall` | `backend/src/services/voice/realtime-orchestrator.service.ts:65-134` | **Le seul qui tourne** : renvoyé à chaque `assistant-request`, il écrase tout |
| `assistantData` (onboarding) | `backend/src/services/onboarding.service.ts:72-95` | Crée l'assistant persistant au signup ; **écrasé à chaque appel** par le précédent |
| `buildVapiAssistantConfig` | `backend/src/config/vapi-templates.ts:180` | Code mort (aucun appelant en prod) |

Conséquence critique : la notice d'enregistrement RGPD construite à l'onboarding
(`onboarding.service.ts:356-376`) **n'atteint jamais un appelant**, car le
`firstMessage` runtime vient de `firstMessageVariants`
(`backend/src/services/voice/system-prompt.ts:177-207`) qui ne la contient pas.

### 2.3 Turn-taking, barge-in, backchanneling

- **Endpointing** : `smartEndpointingEnabled: true` ; EN → LiveKit avec `waitFunction`
  sigmoïde, FR → provider `vapi` (`speech-plans.ts:61-86`). Deepgram endpointing
  `VOICE_ENDPOINTING_MS` en cascade.
- **Barge-in** : `stopSpeakingPlan` `numWords: 0`, `voiceSeconds: 0.2`,
  `backoffSeconds: 1.0` + phrases d'acquiescement/interruption bilingues
  (`speech-plans.ts:102-119`).
- **Backchanneling** : booléen activé (`speech-plans.ts:314`) ; le
  `buildBackchannelPlan` détaillé (`speech-plans.ts:284-298`) est construit mais
  **jamais attaché** (Vapi le rejette, documenté `speech-plans.ts:315-321`).
- Budget latence documenté : `speech-plans.ts:20-23` (~435 ms hors réseau).

### 2.4 Langues

`'fr' | 'en'` uniquement (`speech-plans.ts:25`,
`backend/src/services/voice/realtime-context.service.ts:61`). **La Belgique est forcée
en français** (`realtime-context.service.ts:233-234`) : un appelant néerlandophone
tombe sur un agent FR. Aucune détection de langue, aucun NL.

## 3. Flux d'un appel entrant (diagramme textuel)

```
Appelant PSTN
   │
   ▼
Twilio (numéro géré par Vapi — UN SEUL numéro partagé, env VAPI_PHONE_NUMBER)
   │
   ▼
Vapi ──── assistant-request ────► POST /api/webhooks/vapi[/client/:clientId]
   │                              webhooks.routes.ts:13,18 (secret x-vapi-secret,
   │                              timingSafeEqual ; fail-open hors production)
   │                              │
   │                              ▼
   │            inbound-routing.service.ts:38-124 (numéro composé → client)
   │                              │
   │                              ▼
   │            realtime-orchestrator.buildAssistantForCall (:65-134)
   │              ├─ realtime-context.service : profil client caché (Redis optionnel,
   │              │    sinon mémoire), CallerMemory (mémoire multi-appels par numéro)
   │              ├─ system-prompt.ts : identité + règles + faits business +
   │              │    instructions client (600 c. max) + bloc connaissance + histoire
   │              │    appelant + clause SÉCURITÉ (:157-161)
   │              ├─ firstMessage : variante aléatoire SANS notice ni divulgation IA
   │              ├─ recordingEnabled: true (:124)
   │              └─ tools (voice-tools.ts:137-307)
   │                              │
   ▼                              ▼
Conversation ◄──── assistant JSON renvoyé inline ────┘
   │
   ├─ transcript / speech-update → en mémoire + latency-tracker (marks STT/LLM/TTS)
   ├─ tool-calls → tool-runtime.service.ts (timeout 2,5 s, dégradation parlée)
   │     ├─ checkAvailability / bookAppointment / lookupBooking
   │     │    → Google Calendar freeBusy (google-calendar.service.ts:164)
   │     │    → ClientBooking écrit d'abord, sync calendrier non-await (:235-238)
   │     │    → holds de créneaux inter-appels EN MÉMOIRE (tool-runtime.service.ts:172)
   │     ├─ captureLead (async)
   │     ├─ lookupKnowledge → business-memory.service (recherche sémantique puis
   │     │    lexicale — MAIS aucune écriture de BusinessKnowledge n'existe : mort)
   │     └─ transferCall → warm-transfer.service (mode warm-transfer-say-summary)
   │
   ▼
end-of-call-report ──► voice-webhook.controller.finalize (:188-225)
   ├─ realtime-orchestrator.finalizeCall : transcript, durée, coût, latence par étape
   │    → ClientCall.metadata.realtime + .billing
   ├─ client-call.service : classification spam, puis extraction structurée GPT-4o
   │    (:295-319) → sentiment, outcome, isLead, leadScore 1-10, tags
   ├─ crm-dedup.createOrMerge → Contact (téléphone → email → nom flou)
   ├─ ClientBooking + SMS de confirmation (Twilio, numéro global unique)
   └─ caller-memory.remember : résumé roulant 400 c., préférences (max 6)
```

**Post-appel hebdo** : `receptionist-learning` + `call-intelligence` (cron `0 2 * * 0`,
`backend/src/jobs/bot-loop.ts:712,763`), digest client.

**Flux outbound** (moteur de prospection propre à Qwillio) :
`outbound-engine.service.ts` (cron `*/5 6-22 * * 1-5`, `bot-loop.ts:652`) → sélection
prospects scrapés Google Maps (Apify) → `vapi.service.ts:232-243` → appel avec AMD
voicemail → `end-of-call-report` → analyse GPT-4o (`vapi.service.ts:596-641`) →
séquences email/SMS/WhatsApp. **Aucun modèle de consentement/opt-in d'appel** (seuls
`emailUnsubscribed` et `smsOptedOut` existent, `schema.prisma:122-125`).

## 4. Données et multi-tenant

- **Tenant** = `Client` (`schema.prisma:253`), 1:1 avec `User`. ~30 modèles enfants en
  `clientId` + `onDelete: Cascade`.
- **Isolation applicative uniquement** : convention `where: { clientId }` posée par
  `requireClient` (`backend/src/middleware/auth.middleware.ts:174`). Pas de RLS, pas
  d'extension Prisma de garde.
- **Numéros** : pas de provisioning. `phone-allocation.service.ts:40-78` attribue LE
  numéro partagé au premier client actif ; le suivant n'a **pas de ligne entrante**
  (alerte Discord).
- **KB / RAG** : deux systèmes. (A) Prompt-stuffing live : FAQ/texte libre de
  `Client.vapiConfig` concaténés dans le system prompt (`onboarding.service.ts:388-450`,
  plafond 8000 c.). (B) `BusinessKnowledge` + embeddings `text-embedding-3-small` +
  recherche hybride sémantique/lexicale (`business-memory.service.ts:103-152`,
  `knowledge-embeddings.service.ts`) — **construit mais sans chemin d'écriture** :
  aucun contrôleur/route/UI ne crée de ligne, donc `hasKnowledgeBase` est toujours
  faux et l'outil `lookupKnowledge` jamais exposé. Embeddings en `Float[]` Postgres,
  cosinus en mémoire Node — **pas de pgvector**.
- **Mémoire multi-appels** : réelle et bien faite. `CallerMemory`
  (`schema.prisma:1893`) + `caller-memory.service.ts` (résumé roulant, jamais
  d'écrasement par null, blocage possible), injectée dans le prompt
  (`system-prompt.ts:129-151`).
- **Calendrier** : Google Calendar seul (REST brut, freeBusy). Pas de Cal.com/Outlook.
  Pas de contrainte anti-double-réservation en base (`ClientBooking`,
  `schema.prisma:609`) ; sync calendrier en échec jamais réconciliée.
- **CRM** : interne (`Contact`/`Deal`/`Activity`) alimenté par les appels
  (dédup tel → email → nom). Externe : HubSpot (upsert batch), webhook générique
  (zapier/make/n8n), Slack — **sortant uniquement**, pas d'Odoo, conflits (`SyncConflict`)
  écrits mais jamais résolus.
- **Multicanal** : non. Voix, email (module Gmail payant), WhatsApp (prospection
  sandbox) = trois cerveaux disjoints, aucun modèle `Conversation` partagé.

## 5. Facturation Stripe

Abonnement mensuel + minutes incluses, overage/minute
(`backend/src/config/plans.ts:41-88`). **Pas de Stripe Meters** : l'overage est calculé
en code et posé en `invoiceItems.create` par un cron mensuel
(`backend/src/services/stripe.service.ts:393-424`, `bot-loop.ts:872`) **sans clé
d'idempotence** (une relance double-facture ; un raté perd un mois). Webhooks corrects
(`invoice.paid` idempotent :245-249), portail client OK, commissions d'affiliation
gardées par unicité `stripeInvoiceId`.

## 6. Conformité — état brut

- **Divulgation IA : absente partout.** Inbound : l'agent se présente sous un prénom
  humain, la variété des greetings est même conçue pour ne pas être reconnu comme
  automate (`system-prompt.ts:166-173`). Outbound : les prompts scriptent le **déni**
  (`vapi.service.ts:871,944,980,1034,1107,1143` : « si j'étais une IA… non, je suis
  réelle »).
- **Enregistrement** : `recordingEnabled: true` inconditionnel
  (`realtime-orchestrator.service.ts:124`) ; la notice existe à l'onboarding mais est
  écrasée au runtime (§2.2) ; suppressible par le client (`disableRecordingNotice`,
  `onboarding.service.ts:359`) sans garde ni trace.
- **Rétention** : la politique publiée (90 jours, `frontend/src/pages/v2/legal/Privacy.tsx:288-306`)
  n'est **implémentée nulle part** : aucun job de purge sur transcripts, enregistrements,
  `CallerMemory`, `Contact`.
- **Hébergement** : Render + Neon en Oregon ; runbook de migration UE existant mais non
  exécuté (`docs/MIGRATION-UE-RUNBOOK.md`).
- **Droits RGPD** : suppression de compte (Stripe d'abord) et export Art. 20 pour le
  **client** ; rien pour l'**appelant** (le vrai sujet de données).
- **Outbound B2C** : aucun opt-in, aucun champ do-not-call, aucune consultation
  Bloctel/liste BE, alors que la privacy policy promet la conformité DNC (américaine).

## 7. Observabilité, tests, qualité

- **Logs** : winston JSON → console + ring buffer mémoire 500 entrées + transport
  Discord (dédup, circuit breaker). Persistance DB désactivée. Pas de request-id.
- **Sentry** des deux côtés (traces 20 % prod). **Pas d'OTel, pas de Langfuse, pas de
  métriques, pas de coût LLM par appel** (le breakdown coût couvre Vapi/Twilio/APIs).
- **Latence** : `latency-tracker.ts` par appel et par étage (STT/LLM/TTS/total,
  percentiles nearest-rank, croisement avec les métriques Vapi) — mais **aucune
  agrégation flotte**, et l'étage LLM est vide sur le chemin par défaut
  (`latency-tracker.ts:18-21`).
- **Tests** : 58 fichiers backend (~587 cas, tous unitaires purs, I/O mocké), 17
  fichiers front (~116 cas), 18 e2e Playwright pour ~90 routes. Pas de couverture
  mesurée, lint non bloquant en CI, `supertest` installé mais inutilisé.
- **Évals LLM : zéro.** Aucune simulation d'appel, aucun corpus de régression de
  prompts.
- **Jobs** : 45 crons in-process dans `bot-loop.ts` sur une seule instance worker
  (`render.yaml`), garde anti-chevauchement en mémoire — un scale à 2 instances
  double-exécute tout (y compris la facturation).

## 8. Sécurité — points saillants

- `ADMIN_SECRET` en header = bypass admin complet, statique, non journalisé
  (`auth.middleware.ts:12-17`).
- CORS : allowlist + **regex `*.vercel.app` avec credentials** (`server.ts:77`).
- Endpoint custom-LLM **non authentifié** (`webhooks.routes.ts:25`,
  `voice-llm.controller.ts`) : quiconque connaît un `clientId` peut le piloter.
- Twilio webhooks non vérifiés par défaut (`twilio.middleware.ts:16-19`).
- Clés API clients stockées en clair (`api-key.middleware.ts:20-22`).
- Aucun secret en dur détecté ; validation d'env au boot avec soupape
  `ALLOW_DEGRADED_BOOT=1` (`env-validation.ts`).

## 9. Ce qui est bon et à préserver

- Le turn-taking/barge-in est déjà finement réglé (plans start/stop, filler messages
  par outil, réparation conversationnelle).
- `CallerMemory` (mémoire multi-appels) est propre et testée.
- Dédup CRM téléphone → email → nom, scoping tenant respecté dans le code lu.
- Dégradation gracieuse systématique (calendrier indisponible → captureLead ; outil
  lent → excuse parlée ; webhook outil ne renvoie jamais 500).
- `latency-tracker` par appel, spéculation freeBusy, holds de créneaux inter-appels.
- Suppression de compte « Stripe d'abord », export de données, idempotence
  `invoice.paid`.
- 587 tests unitaires backend qui verrouillent la logique pure.
