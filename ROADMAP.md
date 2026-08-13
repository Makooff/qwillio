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
- **Découverte d'audit** : le FR utilise déjà un endpointing sémantique (provider
  `vapi`), et c'est un correctif délibéré documenté dans `speech-plans.ts` — le
  modèle LiveKit historique était anglophone et dégradait le tour de parole FR.
  Rebasculer en LiveKit par défaut aurait réintroduit le bug diagnostiqué.
- **Techno livrée** : flag `VOICE_FR_ENDPOINTING_PROVIDER` (`vapi` par défaut,
  `livekit` en opt-in) pour valider le nouveau modèle de tour multilingue LiveKit
  sur de vrais appels, sans déploiement, avec retour arrière en un set d'env.
- **Impact** : A/B du turn detection FR possible en production.
- **Effort** : S. **Dépendances** : validation sur vrais appels FR avant tout
  passage du défaut à `livekit`.
- **Done** : flag + tests (défaut `vapi` verrouillé par test, opt-in testé).
  Métrique de décision : interruptions prématurées / appel, à lire dans les
  métriques agrégées de 1.3 sur une semaine de test.

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

### 1.4 Guardrail d'isolation du system prompt
- [x] **Fait le 13/08/2026**
- **Correction d'audit** : le endpoint custom-LLM était déjà authentifié (constat
  initial erroné) ; le vrai défaut était la vérification du secret Vapi copiée à
  l'identique dans trois contrôleurs — mutualisée dans `utils/vapi-webhook-auth.ts`.
- **Techno** : sanitisation des textes non fiables injectés au prompt (instructions
  client, bloc de connaissance, résumé d'appel précédent, nom appelant — y compris
  dans le premier message) ; la clause SÉCURITÉ devient finale et explicitement
  supérieure aux instructions client, dont le label dit désormais l'inverse de
  « prioritaires » sur la sécurité.
- **Impact** : ferme le canal d'injection inter-appelants (résumé du dernier appel)
  et le désarmement de la sécurité par les consignes client.
- **Effort** : S. **Dépendances** : aucune.
- **Done** : tests d'injection unitaires verts (caractères de contrôle, fences,
  fausses sections, nom forgé) ; clause SÉCURITÉ vérifiée en dernière position.

### 1.5 Correctifs de sécurité à coût nul
- [x] **Fait le 13/08/2026**
- [x] `Dockerfile` : `migrate deploy` remplace `db push --accept-data-loss`.
- [x] Overage Stripe : clé d'idempotence `overage-{client}-{mois}` **et correction
  de la fenêtre** — le cron du 1er facturait le mois en cours (6 h d'appels),
  donc ne facturait jamais rien ; il facture désormais le mois précédent entier.
- [x] CORS : `*.vercel.app` restreint aux previews du projet
  (`qwillio*-makooffs-projects.vercel.app`).

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
- [x] **Fait le 13/08/2026**
- **Livré** : `Client.retentionDays` (migration ; null = 90 j, bornes 30 j-5 ans) ;
  cron quotidien `data-retention` (04:15 UTC) qui purge le CONTENU personnel des
  appels (transcript, identité, URL) en gardant la ligne pour la facturation,
  supprime l'audio chez Vapi (`DELETE /call/{id}`, best-effort plafonné, la ligne
  n'est vidée que si la suppression distante a réussi), supprime `CallerMemory`
  expirée, et purge le monde outbound (Call, Prospect.callTranscript) ;
  API client : `GET/PUT /my-dashboard/retention` + `DELETE /my-dashboard/callers/:number`
  (effacement d'un appelant, droit du sujet de données).
- **Done** : job idempotent testé (8 tests) ; reste côté produit : exposer le réglage
  dans l'UI Paramètres et mettre à jour la page privacy si la durée devient
  configurable publiquement.

### 2.3 KB/RAG : ouvrir le chemin d'écriture + présets par niche
- [x] **Fait le 13/08/2026** (backend ; l'UI Paramètres reste à construire)
- **Livré** : `business-knowledge.service.ts` (CRUD validé, plafond 500 entrées,
  scoping tenant dans le WHERE) + routes `GET/POST/PUT/DELETE /my-dashboard/knowledge`
  et `POST /my-dashboard/knowledge/import-preset` (FAQ pré-rédigée du métier via
  `knowledge-presets.ts`, idempotent par titre, jamais d'écrasement). Chaque
  écriture invalide le cache de profil (sinon `hasKnowledgeBase` reste faux
  jusqu'au TTL) et relance `generateMissing()` hors du chemin d'appel ; une mise
  à jour vide le vecteur périmé.
- **Done partiel** : 8 tests ; reste : UI dans Paramètres (chantier n°2 du
  CLAUDE.md), et le test de recall sur 20 questions (dépend du harness 2.5).

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
