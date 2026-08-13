# AUDIT.md — Gap analysis « état de l'art 2026 » (13/08/2026)

Référence : checklist fournie (stack vocale, fonctionnalités réceptionniste, qualité/
production, conformité UE). État réel documenté dans `ARCHITECTURE.md` ; plan d'action
dans `ROADMAP.md`. Efforts : **S** < 2 j, **M** 2-7 j, **L** > 1 sem.

Légende : ✅ PRÉSENT · 🟡 PARTIEL · ❌ ABSENT

## A. Stack vocale

| Item | Statut | Preuve | Risque si non traité | Effort |
|---|---|---|---|---|
| Pipeline en cascade avec transcripts auditables et fallback par composant | 🟡 | Cascade Deepgram→GPT-4o→ElevenLabs existe (`speech-plans.ts:37-47,136-169,245-258`) mais le **défaut est speech-to-speech** OpenAI Realtime (`env.ts:96-97`) sans transcriber ; fallback TTS same-provider seulement (`speech-plans.ts:163-169`), **aucun** fallback STT/LLM | Technique : panne Deepgram/OpenAI/ElevenLabs = panne totale. Business : SLA intenable | M |
| Endpointing sémantique / turn detection | 🟡 | `smartEndpointingEnabled: true` ; EN → LiveKit + waitFunction sigmoïde, **FR → provider `vapi` générique** (`speech-plans.ts:61-86`) | FR = marché principal ; coupures de parole = perception « robot » | S |
| Barge-in + annulation d'écho + backchanneling | 🟡 | Barge-in fin (`speech-plans.ts:102-119`), denoising activé ; backchannel réduit à un booléen, le plan détaillé est mort (`speech-plans.ts:284-298,315-321`) | Faible : l'essentiel est là | S |
| Latence voix-à-voix < 1,1 s instrumentée | 🟡 | `latency-tracker.ts` par appel (percentiles, croisement Vapi) mais **aucune agrégation flotte P50/P95/P99**, étage LLM vide sur le chemin par défaut (`latency-tracker.ts:18-21`) ; aucun objectif vérifié | On ne sait pas si l'objectif est tenu ; régressions invisibles | S |
| Multilinguisme FR/NL/EN + détection de langue + code-switching | ❌ | Types `'fr'\|'en'` (`speech-plans.ts:25`) ; **BE forcée en français** (`realtime-context.service.ts:233-234`) ; zéro NL dans le code | **Bloquant marché belge** : un appelant flamand tombe sur un agent FR. Perte de ~60 % du marché BE | L |

## B. Fonctionnalités réceptionniste

| Item | Statut | Preuve | Risque | Effort |
|---|---|---|---|---|
| Function calling / tools via MCP | 🟡 | 6 tools Vapi bien faits (`voice-tools.ts:137-307`, runtime timeout 2,5 s + dégradation parlée) ; **MCP : zéro hit repo-wide** | Faible court terme ; MCP = extensibilité future (HubSpot MCP, etc.) | M |
| RAG sur KB client (pgvector + hybride) + procédure de mise à jour | 🟡 | Retrieval hybride sémantique/lexical construit (`business-memory.service.ts:103-152`) mais **aucun chemin d'écriture** de `BusinessKnowledge` → mort ; le live est du prompt-stuffing 8000 c. (`onboarding.service.ts:438`) ; pas de pgvector (`Float[]`, cosinus en mémoire — assumé, `knowledge-embeddings.service.ts:20-22`) | Hallucinations sur les questions métier ; plafond de connaissance à 8000 c. ; travail client pénible (chantier n°4 du CLAUDE.md) | M |
| Mémoire persistante multi-appels (écritures async) | ✅ | `CallerMemory` + `caller-memory.service.ts` (résumé roulant, merge sans écrasement, blocage), injectée au prompt (`system-prompt.ts:129-151`), écrite en post-appel async | — | — |
| Prise de RDV réelle + gestion de conflits | 🟡 | Google Calendar freeBusy + booking réel + holds inter-appels + spéculation (`tool-runtime.service.ts`, `availability-speculator.ts`) ; **mais** holds en mémoire process, pas de contrainte DB anti-double-booking (`schema.prisma:609`), sync calendrier en échec jamais réconciliée (`tool-runtime.service.ts:255-257`), pas de Cal.com | Double réservation possible ; RDV fantômes (en base mais pas au calendrier) | S-M |
| Rappels SMS/WhatsApp | 🟡 | Rappels email+SMS J-1 + relance no-show (`booking-reminder.service.ts`) ; **pas de WhatsApp client** (WhatsApp = prospection sandbox uniquement, `whatsapp.service.ts:39,106`) ; numéro d'envoi global unique | WhatsApp attendu en BE ; SMS depuis un numéro tiers = confiance moindre | M |
| Intégration CRM (HubSpot MCP / Odoo) | 🟡 | CRM interne alimenté par appels + dédup (`crm-dedup.service.ts`) ; HubSpot sortant réel (`crm-sync.service.ts:157-182`) + webhook générique/Slack ; **pas d'Odoo, pas d'entrant, conflits jamais résolus, pas de tickets** | Sync unidirectionnelle = divergence silencieuse ; Odoo très demandé en BE | M-L |
| Warm transfer + escalade + « l'agent n'est pas l'autorité » | 🟡 | `transferCall` warm avec résumé dynamique (`voice-tools.ts:285-303`, `warm-transfer.service.ts:137-155`) ; mais aucune règle explicite d'autorité (l'agent peut booker/annoncer sans limite de montant/engagement) | Engagements pris par l'IA au nom du client | S |
| Multicanal sur un seul cerveau | ❌ | Voix, email (module Gmail séparé), WhatsApp (prospection) = 3 cerveaux, 3 contextes ; aucun modèle `Conversation` | Vision produit ; différenciateur clé 2026 | L |
| Résumés, extraction structurée, scoring, analytique post-appel | ✅ | Extraction GPT-4o structurée (sentiment, outcome, leadScore, tags — `client-call.service.ts:295-319`), analytics quotidiennes, digest hebdo | (Coût doublé vs `analysisPlan` Vapi — optimisation possible) | — |

## D. Qualité / production

| Item | Statut | Preuve | Risque | Effort |
|---|---|---|---|---|
| Évals + simulation d'appels + régression prompts | ❌ | Zéro harness d'éval, zéro corpus, zéro simulation (recherche exhaustive) ; seuls des tests unitaires de *construction* de prompt (`system-prompt.test.ts:33`) | Chaque modif de prompt part en prod à l'aveugle — le plus gros risque qualité du produit | M |
| Observabilité/tracing (coût/appel, P50/P95/P99) | 🟡 | Sentry (traces 20 %) + winston (ring buffer mémoire, persistance DB désactivée) ; latence par appel non agrégée ; **coût LLM absent du breakdown** (`admin-analytics.service.ts:16-60`) ; pas d'OTel/Langfuse | Débogage prod difficile ; marge par client inconnue | S (agrégation) / M (tracing complet) |
| Guardrails : isolation prompt, anti-hallucination, anti-injection | 🟡 | Une clause SÉCURITÉ (`system-prompt.ts:157-161`) mais : instructions client injectées **prioritaires** (`system-prompt.ts:76-81`), résumé du dernier appel = canal d'injection inter-appelants (`system-prompt.ts:141`), prompts outbound sans aucune garde, **endpoint custom-LLM non authentifié** (`webhooks.routes.ts:25`) | Détournement de l'agent par un appelant ou un client ; usurpation du LLM | S |
| Fallbacks multi-fournisseurs STT/LLM/TTS | ❌ | Voir A.1 — TTS fallback intra-ElevenLabs seulement | SPOF sur 3 fournisseurs | M |
| Multi-tenant : isolation stricte, provisioning numéros, Stripe Meters, white-label | 🟡 | Isolation par convention applicative seulement (`auth.middleware.ts:174`) ; **1 numéro partagé, client #2 sans ligne** (`phone-allocation.service.ts:40-78`) ; overage par cron mensuel **sans idempotence** au lieu de Meters (`stripe.service.ts:393-424`) ; white-label : champs stockés, jamais consommés (`agency.service.ts`) | Provisioning = bloquant vente n°1 ; double-facturation possible ; fuite inter-tenant à un `where` oublié | M (numéros) / S (idempotence) / M (Meters) |

## E. Conformité UE (BLOQUANT — AI Act art. 50 applicable depuis le 02/08/2026)

| Item | Statut | Preuve | Risque | Effort |
|---|---|---|---|---|
| Divulgation « vous parlez à une IA » au décroché | ❌ | Aucun firstMessage ne la contient (`system-prompt.ts:177-207`) ; greetings conçus pour ne pas être reconnu comme automate (`system-prompt.ts:166-173`) ; outbound scripte le **déni** (« non, je suis réelle » — `vapi.service.ts:871,944,980,1034,1107,1143` ; `niche-scripts.ts:177`) | **Légal majeur** : violation frontale AI Act art. 50(1), en vigueur. Amendes + résiliation clients. Le déni actif est indéfendable | **S — quick win 1** |
| Message d'information + consentement d'enregistrement (314bis BE / CNIL) | 🟡 | Notice écrite à l'onboarding (`onboarding.service.ts:356-376`) mais **jamais prononcée** (écrasée par le runtime, §2.2 ARCHITECTURE) ; `recordingEnabled: true` inconditionnel (`realtime-orchestrator.service.ts:124`) ; suppressible par le client sans garde (`onboarding.service.ts:359`) ; FR/EN seulement | **Légal majeur** : enregistrement systématique sans information = 314bis/RGPD. Chaque appel accroît l'exposition | **S — quick win 1** |
| Durées de conservation configurables + purge auto | ❌ | Politique publiée 90 j (`Privacy.tsx:288-306`) **non implémentée** : aucun job de purge (audit exhaustif des `deleteMany`) ; transcripts/enregistrements/CallerMemory éternels | Légal (promesse publique non tenue = déloyauté) + liabilité croissante | M |
| Voix biométrique : consentement + DPIA + effacement | 🟡 | Le clonage de voix exige le consentement (`voice-clone.service.ts:54-58`, UI + test) ; **pas de DPIA, pas d'effacement d'empreintes, la voix des appelants est enregistrée sans base** | DPIA obligatoire pour traitement de voix à grande échelle | M (process + doc) |
| Hébergement UE + DPA sous-traitants US | ❌ | Render + Neon **Oregon** (`render.yaml:5,68`) ; runbook UE écrit mais non exécuté (`docs/MIGRATION-UE-RUNBOOK.md`) ; privacy policy incomplète : 8+ sous-traitants non listés, pas d'adresse UE ni représentant art. 27 (`Privacy.tsx:66-71,150`) | Transferts hors UE sans encadrement réel ; argument commercial inverse (concurrents UE) | L (migration) / S (DPA+policy) |
| Appels sortants B2C : opt-in strict traçable ≥ 3 ans | ❌ | Moteur outbound actif vers FR/BE (`outbound-engine.service.ts:256-275`) ; **aucun champ consentement/do-not-call** (`schema.prisma:122-127`), pas de Bloctel/liste BE, privacy policy promet une conformité DNC américaine (`Privacy.tsx:~447`) ; prospects scrapés Google Maps | **Légal majeur** pour l'outbound. NB : cibles = entreprises (B2B), ce qui atténue vs B2C, mais loi FR du 11/08/2026 + ePrivacy exigent un cadre. À défaut : geler l'outbound FR/BE | M |

## Hors checklist — trouvailles bloquantes à traiter

| Trouvaille | Preuve | Gravité |
|---|---|---|
| `Dockerfile` lance `prisma db push --accept-data-loss` | `backend/Dockerfile:16` | Perte de données si l'image tourne contre la prod |
| `ADMIN_SECRET` header = bypass admin total non journalisé | `auth.middleware.ts:12-17` | Sécurité critique |
| CORS `*.vercel.app` avec credentials | `server.ts:77` | N'importe quel site Vercel peut appeler l'API authentifiée |
| Endpoint custom-LLM non authentifié | `webhooks.routes.ts:25` | Usurpation du cerveau de l'agent (quick win 4) |
| Twilio webhooks non vérifiés par défaut | `twilio.middleware.ts:16-19` | Forgeage de SMS entrants/STOP |
| Clés API clients en clair en base | `api-key.middleware.ts:20-22` | Fuite DB = fuite credentials |
| Overage sans clé d'idempotence | `stripe.service.ts:422-424` | Double facturation |
| 45 crons in-process, 1 instance, verrou mémoire | `bot-loop.ts`, `render.yaml:11` | Scale = double exécution (dont facturation) |

## Synthèse

- **Le socle vocal est bon** (turn-taking, barge-in, mémoire, tools, latence par appel,
  dégradation gracieuse) : le travail « état de l'art » est un travail de **complétion**
  (NL, fallbacks, agrégation, évals), pas de refonte.
- **La conformité est le trou béant** : divulgation IA absente (et niée en outbound),
  notice d'enregistrement court-circuitée, rétention promise non implémentée,
  hébergement US. Les deux premiers se corrigent en jours : c'est le lot 1.
- **Les bloquants business** ne sont pas dans la checklist : provisioning de numéros
  (1 client max), KB sans écriture, pas de NL.
