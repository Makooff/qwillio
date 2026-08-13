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
- [x] **Fait le 13/08/2026** (pipeline complet ; la détection dynamique de langue
  reste à venir)
- **Livré** : `VoiceLanguage` étendu à `'nl'` — le typage `Record<VoiceLanguage,…>`
  a forcé la couverture de TOUTES les tables : system prompt intégral NL (identité,
  règles, contrat outils, mémoire, clause VEILIGHEID), premiers messages NL avec
  divulgation IA + « Dit gesprek wordt opgenomen », fillers d'outils, intents
  (backchannels/adieux/présence flamands), marqueurs d'humeur et d'escalade,
  détection de dates (maandag…), nudges de silence, phrases barge-in, transcriber
  Deepgram `nova-2`/`nl` (nova-3 est anglais d'abord), détecteur de tour Vapi.
  **Opt-in par client** (`agentLanguage: 'nl'`) — la Belgique reste FR par défaut,
  ce choix appartient au client. Onboarding NL inclus.
- **Reste** : voix ElevenLabs NL dédiée dans le catalogue de personnages (les voix
  actuelles sont multilingues, acceptable), détection/switch en cours d'appel,
  WER NL mesuré sur 20 vrais appels < 12 %.
- **Done partiel** : 12 tests NL ; appel de test réel NL à passer avant vente.

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
- [x] **UI livrée le 13/08/2026** : section « Données » de `ClientAccount.tsx`,
  raccourcis 30 j / 90 j / 1 an / 5 ans, champ libre borné, et retour explicite
  au défaut. Le tiroir ne charge son état qu'à l'ouverture.
- [x] **Page Confidentialité corrigée le 13/08/2026** : elle annonçait « 90 jours »
  fermes alors que la durée est réglable de 30 jours à 5 ans. Elle décrit désormais
  le défaut, le réglage, la purge quotidienne et son effet chez le fournisseur de
  téléphonie, et ajoute la conservation de 3 ans des preuves de consentement.
- **Done** : job idempotent testé (8 tests) ; promesse publique et code alignés.

### 2.3 KB/RAG : ouvrir le chemin d'écriture + présets par niche
- [x] **Fait le 13/08/2026** (backend + UI)
- **Livré** : `business-knowledge.service.ts` (CRUD validé, plafond 500 entrées,
  scoping tenant dans le WHERE) + routes `GET/POST/PUT/DELETE /my-dashboard/knowledge`
  et `POST /my-dashboard/knowledge/import-preset` (FAQ pré-rédigée du métier via
  `knowledge-presets.ts`, idempotent par titre, jamais d'écrasement). Chaque
  écriture invalide le cache de profil (sinon `hasKnowledgeBase` reste faux
  jusqu'au TTL) et relance `generateMissing()` hors du chemin d'appel ; une mise
  à jour vide le vecteur périmé.
- [x] **UI livrée le 13/08/2026** : section « Données » de `ClientAccount.tsx`.
  CRUD par entrée nommée (question / personne / règle), mots-clés, confirmation
  de suppression en place, et le bouton « Importer les questions de mon métier »
  câblé sur `import-preset`. Il est désactivé tant qu'aucun métier n'est choisi,
  en le disant : c'est `businessType` qui détermine le préset.
- **Done** : 8 tests backend ; reste : le test de recall sur 20 questions
  (dépend du harness 2.5).

### 2.4 Provisioning automatique de numéros par client
- [x] **Fait le 13/08/2026** (code ; activation = décision d'exploitation)
- **Livré** : `phone-provisioning.service.ts` branché à l'onboarding — quand la
  ligne partagée est prise, achat automatique via `buyPhoneNumber` (qui existait
  sans appelant), numéro enregistré dans `ClientPhoneNumber`. Derrière
  `PHONE_AUTO_PROVISION=1` strict, **off par défaut** : chaque activation achète
  un numéro facturé. Échec ou flag off → chemin manuel existant inchangé.
- **Dépendances restantes (externes)** : budget numéros, bundle réglementaire BE
  (adresse locale + justificatifs) pour des numéros belges.
- **Done** : 5 tests ; onboarding réel d'un 2e client à valider flag activé.

### 2.5 Évals : harness de simulation d'appels + régression de prompts
- [x] **Fait le 13/08/2026** (harness + 9 scénarios ; extension continue)
- **Livré** : `backend/src/evals/` — 9 scénarios FR/EN/NL joués contre le VRAI
  prompt (`buildSystemPrompt`) et le VRAI contrat d'outils (`buildVoiceTools`)
  via l'API OpenAI (`npm run evals`) : divulgation IA dans les 3 langues,
  résistance à l'injection, discipline d'agenda (checkAvailability avant tout
  créneau, bookAppointment après accord), consignes client (pas de prix),
  transfert humain, bruit. Étape CI ajoutée, **skip propre sans le secret**
  `OPENAI_API_KEY` — devient un garde-fou réel dès que le secret est posé.
- **Dépendance externe** : poser le secret `OPENAI_API_KEY` sur le repo GitHub.
- **Done partiel** : 7 tests unitaires du harness ; objectif ≥ 15 scénarios au
  fil des incidents réels.

### 2.6 Tracing Langfuse (ou OTel) + coût LLM par appel
- **Techno** : Langfuse cloud UE ou self-host ; instrumentation du custom-LLM path et
  des analyses post-appel ; coût tokens ajouté au breakdown (`admin-analytics`).
- **Impact** : coût/appel complet, marge par client, débogage par trace.
- **Effort** : M. **Dépendances** : **compte Langfuse + clé + DPA** (externe).
- **Done** : 100 % des appels produisent une trace avec coût total (Vapi + LLM) ;
  dashboard P50/P95/P99 sur 7 jours.

### 2.7 Fallbacks multi-fournisseurs
- [x] **Fait le 13/08/2026** (code ; activation après un appel de validation)
- **Livré** : `transcriber.fallbackPlan` (`VOICE_STT_FALLBACK_PROVIDER`, ex.
  `google`, langue BCP-47 automatique) et `model.fallbackModels`
  (`VOICE_LLM_FALLBACK_MODELS`, chemin Vapi-OpenAI seulement). **Opt-in strict** :
  variables vides = schéma envoyé à Vapi identique au bit près — un champ
  inconnu rejette l'assistant entier (déjà vécu avec `backchannelPlan`).
- **Done partiel** : tests de schéma ; reste le test de chaos sur un vrai appel
  avant de poser les variables en prod. Voix cross-provider : différé.

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
- [x] **Rappels de RDV WhatsApp faits le 13/08/2026** : WhatsApp d'abord, SMS en repli, jamais les deux (double rappel + SMS facturé au segment). Même texte pour les deux canaux, `reminderChannel` dit lequel a servi. 5 tests.
- **Reste du multicanal** : le modèle `Conversation` partagé, qui donnerait un seul
  cerveau à la voix, au texte et à l'email. Les rappels WhatsApp ci-dessus sont un
  canal de sortie, pas encore une conversation.

### 3.3 Outbound conforme (si l'outbound FR/BE doit vivre)
- [~] **Première brique faite le 13/08/2026** : opt-out d'appel.
  `Prospect.callOptedOut/-At/-Source` (migration), détection lexicale
  conservatrice FR/EN/NL du « ne me rappelez plus » sur le transcript brut
  (pas confiée au modèle : un opt-out raté est une infraction), gating du
  moteur sortant, preuve source+date conservée (jamais purgée). La divulgation
  IA d'ouverture est couverte par le quick win 1.
- ⚠️ **Le cadre légal a changé le 11/08/2026, ce lot est à réécrire** (détail et
  sources : `docs/ETAT-DE-LART-2026.md` §1). **Bloctel a cessé son activité** en
  application de la loi n° 2025-594 : le démarchage non sollicité est désormais
  **interdit par défaut en France**, tous secteurs, sauf consentement préalable
  ou contrat en cours. Le régime passe de l'opt-out à **l'opt-in**.
- [x] **Deuxième brique faite le 13/08/2026** : mise en conformité au nouveau régime.
  - ~~consultation Bloctel avant appel~~ — **supprimé, la cible n'existe plus** ;
  - modèle **`CallConsent`** (migration additive) : la preuve incombant au
    professionnel, il stocke l'**origine, la date, le libellé exact accepté,
    l'IP et la révocation** — pas un booléen. Rien n'y est jamais purgé :
    un consentement qu'on ne peut plus produire équivaut à son absence ;
  - **`utils/outbound-legal.ts`** : règle **par pays**. FR exige le
    consentement, BE reste en opt-out. Jours et horaires du décret 2022-1313
    (lun-ven 10 h-13 h et 14 h-20 h, hors fériés), calculés dans le fuseau
    local, fériés mobiles adossés à Pâques. Le consentement **lève** la
    contrainte horaire, comme le prévoit le décret. Un pays inconnu est traité
    comme exigeant le consentement ;
  - le moteur sortant sélectionne désormais les pays appelables **à l'instant t**,
    et les prospects français ne redeviennent éligibles qu'un par un, preuve à
    l'appui. Tant que personne n'a consenti, la France sort du périmètre
    d'elle-même : c'est l'état correct au lendemain de la loi ;
  - l'opt-out verbal **révoque** le consentement, au lieu de laisser le registre
    attester d'un accord retiré.
  - 16 tests sur les règles légales.
- [x] **Troisième brique, même jour** : le plafond de **4 sollicitations par mois**
  (FR) est **appliqué**. Compté sur le mois calendaire et par prospect dans la
  table `Call` (`callAttempts` est cumulatif depuis toujours, il ne pouvait pas
  servir). Au plafond, le prospect est reporté au 1er du mois suivant plutôt
  qu'ignoré, sinon il resterait en tête du tri par score et bloquerait le moteur
  à chaque tick. La carence de **60 jours** après refus reste couverte par
  l'opt-out définitif, plus strict qu'elle.
- [x] **Registre exploitable** : trois routes d'administration
  (`POST/GET/DELETE /api/admin/call-consents`) pour consigner un consentement
  obtenu ailleurs (contrat, rappel demandé), produire l'historique en cas de
  réclamation, et révoquer. Le modèle existait sans aucun moyen de le remplir.
- **Reste** :
  - un **formulaire public** de demande de rappel, qui alimenterait le registre
    sans passer par l'administration ;
  - **position juridique B2B vs B2C — à trancher avec un juriste** : les textes
    visent le « consommateur », notre ciblage est B2B, mais l'artisan en nom
    propre a souvent une ligne personnelle. Hypothèse retenue et implémentée :
    traiter l'outbound FR comme soumis à l'opt-in. Si le conseil dit l'inverse,
    la bascule tient en une ligne de `COUNTRY_RULES`.
- **Done** : aucun appel sortant sans consentement tracé ou base légale
  documentée ; opt-out verbal persisté et respecté ✅ (fait).

### 3.4 Industrialisation : queue + multi-instance + Stripe Meters + RLS
- [x] **Trois briques faites le 13/08/2026**, celles qui ne dépendaient pas de Redis :
  - **contrainte anti-double-réservation** : index unique PARTIEL sur
    (client, date, heure) restreint aux réservations `confirmed`, pour qu'une
    annulation libère le créneau. Les « holds » en mémoire ne couvraient qu'un
    processus ; deux appels simultanés pouvaient confirmer le même horaire.
    L'agent intercepte la collision et propose un autre créneau au lieu
    d'annoncer une réservation qui n'existe pas ;
  - **réconciliation calendrier** : le code annonçait qu'un échec de
    synchronisation relevait « d'un travail de réconciliation » qui n'existait
    pas. Job horaire, rendez-vous à venir seulement, 5 tentatives au plus,
    et alerte explicite sur les abandons (jeton Google révoqué) ;
  - **clés API en condensat** (voir aussi la dette sécurité) : SHA-256
    déterministe, migration additive, aucune rotation nécessaire.
- **Reste** : BullMQ + Redis (remplace 45 crons in-process), verrous distribués,
  Stripe Meters pour l'overage, RLS Postgres ou extension Prisma de scoping tenant,
  et la seconde migration qui retire la colonne de clé en clair.
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
