# ROADMAP.md — Plan d'implémentation (issu de AUDIT.md, 13/08/2026)

Trois niveaux : **Quick wins** (< 1 sem), **Différenciation** (1-4 sem), **Avantage
durable** (1-3 mois). Chaque tâche : techno, impact, effort, dépendances, critère de
« done ». Les cases se cochent au fil des livraisons.

---

## Niveau 1 — Quick wins (< 1 semaine)

### 1.1 Divulgation IA + consentement d'enregistrement au décroché — CONFORMITÉ BLOQUANTE
- [x] **Fait le 13/08/2026** (voir note de livraison en bas de fichier)
- **Techno** : modification de `buildFirstMessage`/`firstMessageVariants`
  (`system-prompt.ts`) + `buildAssistantForCall` ; flags d'env.
- **Contenu** : le premier message annonce l'assistant comme IA ; si l'enregistrement
  est actif, la notice est prononcée dans le même souffle. `disableRecordingNotice`
  ne supprime plus la notice : il **désactive l'enregistrement** (le choix reste au
  client, la légalité n'est plus optionnelle). Suppression des scripts de déni d'IA
  outbound ; règle inverse ajoutée au prompt (« si on te demande, tu confirmes »).
- **Impact business** : condition de vente en UE ; AI Act art. 50 applicable depuis
  le 02/08/2026.
- **Effort** : S. **Dépendances** : aucune.
- **Done** : tout appel entrant commence par une divulgation IA ; aucun appel enregistré
  sans notice prononcée ; plus aucune chaîne « je suis réelle » dans le repo ; tests
  unitaires verts sur les deux invariants.

### 1.2 Endpointing sémantique FR (turn detection)
- [x] **Fait le 13/08/2026**
- **Techno** : `smartEndpointingPlan` LiveKit (Smart Turn) étendu au français dans
  `speech-plans.ts`, derrière flag `VOICE_SEMANTIC_ENDPOINTING_FR` (repli `vapi` en un
  set d'env).
- **Impact** : moins de coupures de parole sur le marché principal (FR).
- **Effort** : S. **Dépendances** : support LiveKit FR chez Vapi (validé en test réel).
- **Done** : plan livekit actif en FR par défaut + flag de repli + tests. Métrique :
  interruptions prématurées / appel en baisse sur 1 semaine (à lire dans les métriques
  agrégées de 1.3).

### 1.3 Observabilité : agrégation latence P50/P95/P99 + coût par appel
- [x] **Fait le 13/08/2026**
- **Techno** : agrégateur maison en process (`voice-metrics.service.ts`) alimenté par
  `latency-tracker` à chaque fin d'appel ; fenêtre glissante ; exposition sur le
  health endpoint voix + log récapitulatif horaire. Langfuse/OTel : différé au niveau 2
  (dépendance externe : compte + clé + DPA).
- **Impact** : l'objectif < 1,1 s voix-à-voix devient vérifiable ; régressions visibles.
- **Effort** : S. **Dépendances** : aucune.
- **Done** : P50/P95/P99 par étage (STT/LLM/TTS/total) et coût moyen/appel consultables
  sur un endpoint ; tests unitaires sur l'agrégateur.

### 1.4 Guardrail d'isolation du system prompt + auth du endpoint custom-LLM
- [x] **Fait le 13/08/2026**
- **Techno** : sanitisation des textes non fiables injectés au prompt (instructions
  client, résumé d'appel précédent, nom appelant) ; la clause SÉCURITÉ devient finale
  et explicitement supérieure aux instructions client ; secret Vapi exigé sur
  `/vapi/llm/:clientId/chat/completions`.
- **Impact** : ferme le canal d'injection inter-appelants et l'usurpation du LLM.
- **Effort** : S. **Dépendances** : header secret côté config Vapi (custom-llm).
- **Done** : endpoint LLM répond 401 sans secret ; textes non fiables délimités et
  neutralisés ; tests d'injection unitaires verts.

### 1.5 Correctifs de sécurité à coût nul (recommandé dans la foulée)
- [ ] Retirer `--accept-data-loss` du `Dockerfile` (→ `migrate deploy`).
- [ ] Clé d'idempotence sur l'overage Stripe (`stripe.service.ts:422`).
- [ ] Restreindre le CORS `*.vercel.app` aux previews du projet.
- **Effort** : S. **Done** : revue + tests existants verts.

---

## Niveau 2 — Différenciation (1-4 semaines)

### 2.1 Néerlandais + détection de langue (marché belge)
- **Techno** : étendre `VoiceLanguage` à `'nl'` ; Deepgram nova-3 `nl` ; voix
  ElevenLabs NL ; prompts NL ; détection : choix par numéro appelé (ligne NL dédiée)
  puis switch en cours d'appel (« Wilt u verder in het Nederlands? ») ; test
  code-switching FR/NL/EN scripté.
- **Impact** : ouvre la moitié flamande du marché BE — le plus gros levier commercial.
- **Effort** : L. **Dépendances** : voix NL validée, numéro BE (déjà au backlog).
- **Done** : appel de test NL complet (greeting → RDV → SMS) ; suite code-switching
  passée ; WER NL mesuré sur 20 transcripts < 12 %.

### 2.2 Rétention configurable + purge automatique
- **Techno** : champs `retentionDays` par client (défaut 90 j, bornes 6 mois qualité /
  5 ans preuve selon type) ; cron quotidien de purge transcripts/enregistrements
  (suppression Vapi incluse via API) + `CallerMemory` ; effacement appelant sur demande
  (droit du sujet de données).
- **Impact** : aligne la réalité sur la politique publiée ; argument de vente RGPD.
- **Effort** : M. **Dépendances** : API Vapi de suppression d'enregistrements.
- **Done** : aucune donnée d'appel plus vieille que la politique en base ni chez Vapi ;
  job idempotent testé ; page privacy mise à jour.

### 2.3 KB/RAG : ouvrir le chemin d'écriture + présets par niche
- **Techno** : CRUD `BusinessKnowledge` (routes + UI Paramètres) branché sur les
  présets métier backend existants (`knowledge-presets.ts`) ; cron `generateMissing()`
  pour les embeddings ; activation de `lookupKnowledge`.
- **Impact** : réduit les hallucinations, débloque le chantier n°4 du CLAUDE.md sans
  seconde liste de niches.
- **Effort** : M. **Dépendances** : aucune (tout le retrieval existe déjà).
- **Done** : un client crée 30 entrées, l'agent répond via `lookupKnowledge` (trace à
  l'appui) ; recall vérifié sur un jeu de 20 questions.

### 2.4 Provisioning automatique de numéros par client
- **Techno** : achat Twilio/Vapi à l'onboarding (`buyPhoneNumber` existe déjà,
  `config/vapi.ts:61-69`, sans appelant) ; `ClientPhoneNumber` comme source de vérité ;
  numéro BE.
- **Impact** : **débloque la vente au-delà d'un client** — bloquant n°1.
- **Effort** : M. **Dépendances** : compte Twilio provisionné, budget numéros,
  adresse/bundle réglementaire BE pour l'achat de numéros belges.
- **Done** : onboarding d'un 2e client de bout en bout avec sa propre ligne, sans
  action manuelle.

### 2.5 Évals : harness de simulation d'appels + régression de prompts
- **Techno** : harness maison (les évals hébergées type Coval/Cekura = compte externe,
  à décider) : corpus de scénarios FR/EN (puis NL) joués contre le custom-LLM en mode
  texte (le chemin existe : `llm-stream.service`), assertions sur outils appelés,
  divulgation prononcée, refus d'injection ; en CI sur chaque PR touchant `voice/`.
- **Impact** : les prompts cessent de partir en prod à l'aveugle.
- **Effort** : M. **Dépendances** : clé OpenAI de CI (coût ~centimes/run).
- **Done** : ≥ 15 scénarios (dont barge-in simulé, bruit, injection) verts en CI ;
  une régression de prompt casse la CI.

### 2.6 Tracing Langfuse (ou OTel) + coût LLM par appel
- **Techno** : Langfuse cloud UE ou self-host ; instrumentation du custom-LLM path et
  des analyses post-appel ; coût tokens ajouté au breakdown (`admin-analytics`).
- **Impact** : coût/appel complet, marge par client, débogage par trace.
- **Effort** : M. **Dépendances** : **compte Langfuse + clé + DPA** (externe).
- **Done** : 100 % des appels produisent une trace avec coût total (Vapi + LLM) ;
  dashboard P50/P95/P99 sur 7 jours.

### 2.7 Fallbacks multi-fournisseurs
- **Techno** : `fallbackPlan` Vapi : transcriber secondaire, `model.fallbackModels`
  (ex. gpt-4o → claude), voix de secours cross-provider (Azure/PlayHT).
- **Impact** : plus de SPOF fournisseur.
- **Effort** : M. **Dépendances** : clés fournisseurs secondaires.
- **Done** : test de chaos (clé primaire invalide) → l'appel aboutit quand même.

---

## Niveau 3 — Avantage durable (1-3 mois)

### 3.1 Migration hébergement UE + dossier sous-traitants
- **Techno** : exécuter `docs/MIGRATION-UE-RUNBOOK.md` (Render Frankfurt + Neon UE) ;
  DPA signés (Vapi, OpenAI, Twilio, ElevenLabs, Stripe, Resend, Sentry, Discord…) ;
  privacy policy complétée (sous-traitants, représentant art. 27, adresse) ; DPIA voix.
- **Impact** : « Hébergement UE » redevient un argument affichable ; prérequis grands
  comptes.
- **Effort** : L. **Dépendances** : fenêtre de maintenance, DPA (externes), juriste.
- **Done** : prod servie depuis l'UE ; registre des traitements + DPIA à jour ;
  mention UE réactivée sur le site.

### 3.2 Multicanal « un seul cerveau » (voix + WhatsApp + chat web + email)
- **Techno** : modèle `Conversation` partagé ; réutiliser system-prompt/tools/
  CallerMemory pour un canal texte ; WhatsApp Business (numéro dédié, hors sandbox) ;
  widget chat web.
- **Impact** : différenciateur produit majeur 2026 ; continuité appel → SMS → WhatsApp.
- **Effort** : L. **Dépendances** : compte WhatsApp Business vérifié.
- **Done** : un client final commence sur le chat web, l'agent retrouve le contexte
  quand il rappelle.
- **Étape intermédiaire livrable en 1 sem** : rappels de RDV WhatsApp (le service
  Twilio existe) — impact immédiat BE.

### 3.3 Outbound conforme (si l'outbound FR/BE doit vivre)
- **Techno** : modèle `CallConsent` (source, date, preuve, conservation ≥ 3 ans),
  champ `doNotCall`, consultation Bloctel/liste BE avant appel, divulgation IA
  d'ouverture, fenêtre horaire légale ; à défaut : geler l'outbound FR/BE.
- **Impact** : évite le risque légal le plus explosif du repo.
- **Effort** : M. **Dépendances** : abonnement Bloctel (externe), position juridique
  B2B vs B2C.
- **Done** : aucun appel sortant sans consentement tracé ou base légale documentée ;
  opt-out verbal persisté et respecté.

### 3.4 Industrialisation : queue + multi-instance + Stripe Meters + RLS
- **Techno** : BullMQ + Redis (remplace 45 crons in-process), verrous distribués,
  Stripe Meters pour l'overage, contrainte unique anti-double-booking, réconciliation
  calendrier, RLS Postgres ou extension Prisma de scoping tenant, chiffrement des
  clés API clients.
- **Impact** : scale > 1 instance sans double exécution ; facturation fiable.
- **Effort** : L. **Dépendances** : Redis managé (externe).
- **Done** : 2 instances worker sans double-run ; usage visible dans Stripe en continu ;
  test d'isolation tenant automatisé.

### 3.5 MCP + intégrations CRM bidirectionnelles (HubSpot MCP, Odoo XML-RPC)
- **Techno** : serveur MCP exposant les tools Qwillio ; connecteurs entrants ;
  résolution des `SyncConflict`.
- **Impact** : écosystème ouvert, agents d'entreprise « plus poussés » (objectif énoncé).
- **Effort** : L. **Dépendances** : comptes sandbox HubSpot/Odoo.
- **Done** : modification d'un contact côté HubSpot reflétée dans Qwillio et
  inversement ; démo Odoo.

---

## Note de livraison — lot Quick wins du 13/08/2026

Livré sur la branche `claude/qwillio-audit-gap-analysis-ppux3n` (une PR pour le lot ;
détail des métriques dans la description de PR) :

1. **1.1 Divulgation IA + consentement** : divulgation au décroché (FR/EN) dans tous
   les `firstMessageVariants` ; la notice d'enregistrement est prononcée quand
   l'enregistrement est actif ; `disableRecordingNotice` coupe désormais
   l'enregistrement au lieu de couper la notice ; scripts de déni d'IA supprimés des
   prompts outbound et remplacés par une confirmation honnête ; règle « ne jamais nier
   être une IA » ajoutée aux prompts.
2. **1.2 Endpointing sémantique FR** : plan LiveKit actif en FR (flag
   `VOICE_SEMANTIC_ENDPOINTING_FR`, défaut on, repli `vapi` en un set d'env).
3. **1.3 Observabilité** : agrégateur `voice-metrics.service.ts` — P50/P95/P99 par
   étage + coût/appel sur fenêtre glissante, exposé sur le health endpoint voix.
4. **1.4 Guardrails** : secret Vapi exigé sur le endpoint custom-LLM ; sanitisation
   des textes non fiables du prompt ; clause SÉCURITÉ finale et prioritaire.

Reste à valider par l'équipe avant le niveau 2 (voir la question en fin de PR).
