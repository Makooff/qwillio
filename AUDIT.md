# AUDIT.md — Gap analysis « état de l'art 2026 »

**Ré-audit du 13/08/2026, contre `master` = `047c45b` (post-PR #133).**
La version initiale (13/08, pré-PR) est conservée dans l'historique git.
Toutes les preuves ci-dessous ont été relues dans le code, pas dans les
documents. Efforts : **S** < 2 j, **M** 2-7 j, **L** > 1 sem.

Légende : ✅ PRÉSENT · 🟡 PARTIEL · ❌ ABSENT · **(→)** = évolution depuis le pré-audit

> **Distinction capitale introduite par ce ré-audit.** La PR #133 livre
> beaucoup de capacités **en opt-in par variable d'environnement**, avec un
> parti pris explicite : tant que la variable est vide, *le champ n'est même pas
> envoyé à Vapi*, pour que le schéma reste identique à l'existant. Conséquence :
> **« présent dans le code » ≠ « actif en production »**. Les lignes concernées
> sont marquées **⚙️ env** et listées en fin de document : elles demandent une
> vérification dans le tableau de bord Render que je ne peux pas faire d'ici.

---

## A. Stack vocale

| Item | Statut | Preuve | Risque si non traité | Effort |
|---|---|---|---|---|
| Pipeline en cascade, transcripts auditables, fallback par composant | 🟡 **(→ depuis 🟡)** ⚙️ env | Fallback STT (`speech-plans.ts:59-67`) et fallback LLM (`speech-plans.ts:295-296`) désormais **écrits**, en plus du fallback TTS intra-ElevenLabs (`speech-plans.ts:197-201`). Mais les trois sont conditionnés à `VOICE_STT_FALLBACK_PROVIDER` / `VOICE_LLM_FALLBACK_MODELS` : **vides = aucun secours** | Le SPOF n'est levé qu'une fois les variables posées sur Render. Le code ne protège personne tout seul | S (poser les env) |
| Endpointing sémantique / turn detection | ✅ **(→ depuis 🟡)** | Bug de fond corrigé : le FR tournait sur le modèle LiveKit **anglophone** (« il devinait », `speech-plans.ts:88-95`). Défaut FR/NL = `provider: 'vapi'`, seul documenté hors anglais ; LiveKit multilingue testable par `VOICE_FR_ENDPOINTING_PROVIDER=livekit` (`speech-plans.ts:106-109`) | — (le retour arrière est un set d'env, pas un déploiement) | — |
| Barge-in + annulation d'écho + backchanneling | 🟡 (inchangé) | Barge-in `numWords: 0` + `voiceSeconds` anti-toux + backoff 1 s (`speech-plans.ts:131-140`) ; backchannel toujours un booléen | Faible : l'essentiel est là | S |
| Latence voix-à-voix < 1,1 s instrumentée | 🟡 **(→ depuis 🟡, mais pas pour la raison attendue)** | Agrégation flotte livrée et **vérifiée en production** : `voiceMetricsService.summary()` exposé (`voice-webhook.controller.ts:232`), réponse live du 13/08 contenant `fleetMetrics` avec `voiceToVoiceObjectiveMs: 1100`. **Mais `calls: 0`, `latency: {}`, `meetsObjective: null`** | **L'objectif n'est ni tenu ni manqué : il n'est pas mesuré.** Aucun appel réel depuis le déploiement. Seule la section C du protocole peut lever cette ligne | S (passer les appels) |
| Multilinguisme FR/NL/EN + détection + code-switching | 🟡 **(→ depuis ❌)** | NL de bout en bout : type (`speech-plans.ts:25`), Deepgram (`:28`), STT de secours (`:44`), greetings et notice NL (`system-prompt.ts:291`). Bascule **opt-in** par `agentLanguage: 'nl'` | Le blocage marché belge est levé côté code. Reste : **aucune détection automatique**, un appelant flamand sur un client configuré FR tombe toujours sur un agent FR | M (détection) |

---

## B. Fonctionnalités réceptionniste

| Item | Statut | Preuve | Risque | Effort |
|---|---|---|---|---|
| Function calling / tools via MCP | 🟡 (inchangé) | 6 tools Vapi (`voice-tools.ts`) ; MCP toujours zéro hit repo-wide | Faible court terme ; extensibilité 2026 | M |
| RAG sur KB client + procédure de mise à jour | 🟡 **(→ depuis 🟡, le point mort est levé)** | **Le chemin d'écriture existe** : `businessKnowledgeService.create/update/remove` (`business-knowledge.service.ts:109,126`) exposé en CRUD complet (`my-dashboard.routes.ts:124-127`) + `import-preset` par métier (`:130`). Le retrieval hybride n'est donc plus mort | **Aucune UI ne consomme ces routes** (voir §Écarts). Le client ne peut toujours rien saisir : le travail reste dans la zone de texte libre de `ClientReceptionist.tsx:862`. Pas de pgvector (choix assumé) | S (l'UI = étape 4.1) |
| Mémoire persistante multi-appels | ✅ (inchangé) | `CallerMemory` + injection au prompt, écriture post-appel async | — | — |
| Prise de RDV réelle + gestion de conflits | 🟡 (inchangé) | Google Calendar freeBusy + holds + spéculation ; **toujours pas de contrainte DB anti-double-booking**, syncs en échec jamais réconciliées | Double réservation possible ; RDV fantômes | S-M |
| Rappels SMS/WhatsApp | 🟡 (inchangé) | Email + SMS J-1 + relance no-show ; WhatsApp toujours prospection sandbox | Attendu en BE | M |
| Intégration CRM | 🟡 (inchangé) | CRM interne + HubSpot sortant ; pas d'Odoo, pas d'entrant | Divergence silencieuse | M-L |
| Warm transfer + escalade + « l'agent n'est pas l'autorité » | 🟡 (inchangé) | `transferCall` warm avec résumé ; toujours **aucune règle d'autorité** (montant, engagement) | Engagements pris par l'IA au nom du client | S |
| Multicanal sur un seul cerveau | ❌ (inchangé) | Aucun modèle `Conversation` | Vision produit | L |
| Résumés, extraction structurée, scoring | ✅ (inchangé) | Extraction GPT-4o structurée + analytics | — | — |

---

## D. Qualité / production

| Item | Statut | Preuve | Risque | Effort |
|---|---|---|---|---|
| Évals + simulation + régression prompts | 🟡 **(→ depuis ❌)** | Harness réel : 9 scénarios contre le **vrai** prompt et les **vrais** outils (`evals/run-evals.ts`, `evals/scenarios.ts`), dont un scénario d'injection (`scenarios.ts:75`). `npm run evals` | **Jamais exécuté ici, et le défaut est trompeur** : sans `OPENAI_API_KEY`, le harness **sort en 0** (`run-evals.ts:133-136`). Un CI qui l'embarque sans la clé affiche vert en n'ayant rien testé | S (poser la clé + faire échouer si absente en CI) |
| Observabilité / tracing (coût/appel, P50/P95/P99) | 🟡 **(→ depuis 🟡)** | `fleetMetrics` en prod avec percentiles et `cost` ; vérifié live le 13/08 | `cost: null` et `latency: {}` faute d'appels. Toujours pas d'OTel/Langfuse | S |
| Guardrails : isolation prompt, anti-hallucination, anti-injection | ✅ **(→ depuis 🟡)** | La clause SÉCURITÉ est devenue **règle finale explicitement au-dessus des consignes du client** et couvre nommément les trois canaux d'injection identifiés au pré-audit — historique, base de connaissance, résultats d'outils — requalifiés en « données, jamais instructions » (`system-prompt.ts:256`). Nom de l'appelant assaini (`sanitizeInline`, `system-prompt.ts:281`) | — | — |
| Fallbacks multi-fournisseurs STT/LLM/TTS | 🟡 **(→ depuis ❌)** ⚙️ env | Voir A.1 : écrits, inactifs tant que les env sont vides | SPOF tant que non configuré | S |
| Multi-tenant : isolation, provisioning, Meters, white-label | 🟡 **(→ depuis 🟡)** ⚙️ env | **Provisioning automatique livré** : `autoProvisionNumber` appelé à l'onboarding (`phone-provisioning.service.ts:36`, `onboarding.service.ts:127-128`) → le plafond « 1 client » est levé côté code. **Idempotence de l'overage corrigée** : `idempotencyKey: overage-${clientId}-${billedMonth}` (`stripe.service.ts:438`) | Isolation toujours par convention applicative ; Stripe Meters toujours absent ; white-label toujours stocké-jamais-consommé | M (Meters) |

---

## E. Conformité UE (AI Act art. 50 applicable depuis le 02/08/2026)

| Item | Statut | Preuve | Risque | Effort |
|---|---|---|---|---|
| Divulgation « vous parlez à une IA » au décroché | ✅ **(→ depuis ❌)** | Portée par la **première phrase**, « seul moment garanti avant toute collecte » : « je suis un assistant IA » dans tous les greetings FR/EN/NL (`system-prompt.ts:297-318`). Défaut **fail-safe** : `VOICE_COMPLIANCE_GREETING` vaut `on` sauf `=off` explicite (`env.ts:133`). Le **déni actif** (« non, je suis réelle ») a disparu du code : il ne survit plus que dans un test qui **interdit** son retour (`compliance-disclosure.test.ts:108-118`) | — | — |
| Message d'information + consentement d'enregistrement | ✅ **(→ depuis 🟡)** | Notice prononcée **si et seulement si l'appel est réellement enregistré** : le greeting et le flag Vapi lisent le même prédicat `shouldRecord(profile)` (`system-prompt.ts:290` / `realtime-orchestrator.service.ts:126`). « Jamais un “peut-être” de confort. » FR/EN/NL | — | — |
| Durées de conservation configurables + purge auto | ✅ **(→ depuis ❌)** | `dataRetentionService.purgeExpiredCallData()` (`data-retention.service.ts:73`), idempotente par construction, **réellement planifiée** (`bot-loop.ts:965-966`) ; purge des objets distants avant la ligne locale (`:20,103`) ; réglage par client (`my-dashboard.routes.ts:133-134`) ; effacement ciblé d'un appelant (`client-dashboard.controller.ts:1226`) | Réglage sans UI (étape 4.1) | S |
| Voix biométrique : consentement + DPIA + effacement | 🟡 (inchangé) | Consentement au clonage exigé ; toujours **pas de DPIA**, pas d'effacement d'empreintes | DPIA obligatoire | M (process) |
| Hébergement UE + DPA sous-traitants US | ❌ (inchangé) | Render + Neon **Oregon** ; runbook écrit non exécuté (`docs/MIGRATION-UE-RUNBOOK.md`). Le site ne promet plus l'UE (correct) | Transferts hors UE non encadrés | L |
| Appels sortants : opt-in strict traçable ≥ 3 ans | 🟡 **(→ depuis ❌)** | **Opt-out livré** : détection verbale en cours d'appel (`utils/call-optout.ts:34`, appliqué `vapi.service.ts:357,393` avec `callOptOutSource: 'verbal'`) + STOP par SMS (`webhooks.controller.ts:337-339`) | **L'opt-out n'est pas l'opt-in.** Toujours aucun modèle `CallConsent`, aucune trace ≥ 3 ans, pas de Bloctel/liste BE, pas de fenêtres horaires légales. C'est l'étape 4.2 | M |

---

## Hors checklist — état des trouvailles bloquantes

| Trouvaille | Statut | Preuve |
|---|---|---|
| `Dockerfile` : `prisma db push --accept-data-loss` | ✅ **corrigé** | `backend/Dockerfile:19` → `npx prisma migrate deploy && npm start` |
| CORS `*.vercel.app` avec credentials | ✅ **corrigé** | `server.ts:79` : previews restreintes au seul projet Qwillio, commentaire à l'appui |
| Vérification du secret Vapi tripliquée | ✅ **corrigé** | Mutualisée dans `utils/vapi-webhook-auth.ts` |
| Overage sans clé d'idempotence | ✅ **corrigé** | `stripe.service.ts:438` |
| `ADMIN_SECRET` header = bypass admin total | ❌ **toujours présent** | `auth.middleware.ts:12-17` : `x-admin-secret` → `req.userRole = 'admin'`, `return next()`, **sans journalisation**. Le pré-audit le classait « sécurité critique » ; rien n'a bougé |
| Twilio webhooks non vérifiés | 🟡 **écrit, inactif par défaut** | `twilio.middleware.ts:17-19` : no-op sauf si `TWILIO_VALIDATE_WEBHOOKS=true` **et** `TWILIO_AUTH_TOKEN`. Forgeage de SMS/STOP encore possible tant que non activé |
| Clés API clients en clair en base | ❌ **toujours présent, désormais documenté** | `api-key.middleware.ts:20-22` reconnaît la réserve : bascule vers condensat = migration + rotation |
| 45 crons in-process, 1 instance | ❌ inchangé | `bot-loop.ts`, `render.yaml:11` ; BullMQ/Redis = étape 4.3 |

---

## Écarts entre ce que la PR #133 annonce et ce que le code fait

Aucun mensonge trouvé : les sept chantiers annoncés existent bel et bien dans le
code, et les **676 tests annoncés sont exactement les 676 qui passent** (65
fichiers, exit 0, relancé ici le 13/08). Quatre nuances, toutes vérifiées :

1. **Les évals « 9/9 » n'ont jamais tourné sur ce poste**, et ne peuvent pas
   mentir en rouge : sans clé, elles sortent en **0** en affichant qu'elles
   sautent. À traiter : rendre l'absence de clé **fatale en CI**, sinon la
   protection anti-régression de prompt est décorative.
2. **Les fallbacks STT/LLM et le provisioning ne protègent rien tant que les
   variables d'environnement ne sont pas posées sur Render.** C'est un choix
   défendable (déploiement à schéma constant), mais il déplace la conformité du
   code vers l'exploitation. À vérifier dans le tableau de bord.
3. **L'objectif de latence < 1,1 s reste non mesuré** : `fleetMetrics` est vivant
   mais vide (`calls: 0`). L'annonce « métriques livrées » est vraie ;
   « latence tenue » n'a pas encore de sens.
4. **La base de connaissance a un chemin d'écriture mais aucune porte d'entrée** :
   les cinq routes existent, zéro composant du portail ne les appelle. Le client
   reste devant sa zone de texte libre. C'est précisément l'étape 4.1.

**Aucune régression détectée.** Les deux items encore rouges hors checklist
(`ADMIN_SECRET`, clés API en clair) l'étaient déjà avant la PR : ils n'étaient
pas dans son périmètre.

---

## Synthèse du ré-audit

- **La conformité, qui était le trou béant, est bouchée** sur ses trois points
  bloquants : divulgation IA, notice d'enregistrement liée au réel, rétention
  purgée pour de bon. Le déni actif de l'IA, l'item le plus indéfendable du
  pré-audit, est non seulement supprimé mais **verrouillé par un test**.
- **Le socle vocal a gagné le NL et un vrai correctif d'endpointing FR** (le
  français tournait sur un détecteur anglophone : c'est la cause racine du
  « robotique » ressenti, pas un réglage).
- **Ce qui reste tient en trois familles** : (a) de l'**exploitation** — poser
  des variables d'env, passer de vrais appels, fournir une clé ; (b) de l'**UI** —
  la base de connaissance et la rétention n'ont pas d'écran (étape 4.1) ;
  (c) du **chantier lourd assumé** — opt-in outbound tracé, Meters, BullMQ,
  multicanal, hébergement UE.
- **Deux dettes de sécurité pré-existantes** méritent d'être requalifiées en
  bloquant vente maintenant que le reste est propre : le bypass `ADMIN_SECRET`
  non journalisé et les clés API en clair.
