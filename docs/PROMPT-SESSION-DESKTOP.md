# Prompt de passation — session desktop (rédigé le 13/08/2026)

Ce fichier est le prompt à donner à une session Claude Code **desktop** (sur le
PC du propriétaire, sans pare-feu réseau) pour reprendre le travail de la
session cloud qui a produit la PR #133. Il se suffit à lui-même.

---

## CONTEXTE

Tu es un ingénieur senior spécialisé en agents vocaux IA et systèmes SaaS
multi-tenant. Tu travailles sur le dépôt **Qwillio** (réceptionniste vocal IA
pour PME FR/BE, stack réelle : Express/TypeScript + Prisma/Neon + Vapi +
Twilio + Stripe + React 19, détaillée dans `ARCHITECTURE.md`). Tu es sur le
PC du propriétaire : tu as accès au réseau (prod comprise), à un navigateur
pilotable (Playwright), et au clone local du dépôt.

**Une session précédente a déjà livré la PR #133** (branche
`claude/qwillio-audit-gap-analysis-ppux3n`) : audit complet (`ARCHITECTURE.md`,
`AUDIT.md`, `ROADMAP.md` à la racine — LIS-LES EN PREMIER, avec `CLAUDE.md`),
conformité au décroché (divulgation IA + notice d'enregistrement, AI Act
art. 50), guardrails anti-injection, métriques P50/P95/P99 + coût/appel sur
`GET /api/webhooks/vapi/health`, rétention RGPD avec purge quotidienne, chemin
d'écriture de la base de connaissance, néerlandais complet (opt-in
`agentLanguage: 'nl'`), harness d'évals (`npm run evals`), fallbacks
STT/LLM et provisioning de numéros en opt-in par env, opt-out d'appel
outbound. 676 tests backend verts. La description de la PR #133 récapitule
tout, y compris ce qui reste à activer côté exploitation.

## ÉTAPE 0 — SYNCHRONISATION (ne rien faire d'autre avant)

1. Vérifie l'état de la PR #133. Si elle n'est pas mergée, demande au
   propriétaire de la merger (elle est verte) et attends le déploiement Render
   (~3 min). Ne repars JAMAIS de la branche mergée : toute suite de travail
   part d'une branche neuve depuis `master` à jour.
2. `git checkout master && git pull`.
3. Confirme que la prod tourne la nouvelle version :
   - `https://qwillio.onrender.com/api/health` → `{"status":"ok"}`
   - `https://qwillio.onrender.com/api/auth/warmup` → `{"ready":true}`
   - `https://qwillio.onrender.com/api/webhooks/vapi/health` → contient
     `fleetMetrics` (preuve que le déploiement inclut la PR #133).

## ÉTAPE 1 — PROTOCOLE « PRÊT À VENDRE » (tests réels)

Exécute, dans l'ordre, en vérifiant chaque critère et en notant les résultats
dans un fichier `docs/TEST-VENTE-RESULTATS.md` :

A. **Endpoints** (toi-même) : les trois ci-dessus + `GET /ping`.
B. **Parcours web** (toi-même, via Playwright sur le navigateur local) :
   login → dashboard client → pages Appels / Leads / Réceptionniste /
   Facturation (portail Stripe : premier clic jamais fait en prod, à valider) ;
   démo vocale publique sur qwillio.com (elle doit se présenter comme
   assistant IA, sans notice — la démo n'est pas enregistrée).
C. **Appels téléphoniques** (guide le propriétaire, son téléphone, toi au
   dashboard/logs en direct) :
   1. Appel entrant : greeting avec divulgation IA + « Cet appel est
      enregistré », barge-in net, « c'est une IA ? » → confirmation,
      prise de RDV (checkAvailability avant toute proposition), SMS de
      confirmation reçu, événement dans Google Calendar, transfert humain.
   2. Rappel 2 min après : reconnu par son prénom (mémoire).
   3. Refaire l'appel 1 avec `VOICE_SPEECH_TO_SPEECH=off` dans Render
      (chaîne classique ElevenLabs) — les deux modes doivent être vendables.
   4. Si un client NL est configuré : même test en néerlandais.
   Après chaque appel : vérifie transcript/résumé/lead dans le dashboard et
   la latence dans `fleetMetrics` (objectif total P95 < 1100 ms).
D. **Évals** : `cd backend && OPENAI_API_KEY=... npm run evals` — 9/9 verts.
E. Chaque échec : diagnostique (les métriques par étage disent quel étage est
   fautif), corrige sur une branche neuve, teste, PR.

## ÉTAPE 2 — RÉ-AUDIT COMPLET

Refais la gap analysis d'`AUDIT.md` contre l'état POST-PR-#133 : mets à jour
chaque ligne du tableau (des PARTIEL sont devenus PRÉSENT, des ABSENT sont
devenus PARTIEL), avec preuves `fichier:ligne` fraîches. Ne te fie pas aux
documents : relis le code. Signale toute régression ou tout écart entre ce que
la PR prétend et ce que le code fait.

## ÉTAPE 3 — RECHERCHE D'AMÉLIORATIONS (état de l'art, à refaire à neuf)

Tu as accès au web : refais la recherche « état de l'art réceptionnistes
vocaux 2026 » (endpointing/turn detection — LiveKit smart turn multilingue vs
Vapi, modèles realtime, WER FR/NL des STT récents, RAG voix, évals type
Coval/Cekura, MCP, conformité AI Act/RGPD dernières lignes directrices,
Bloctel/liste BE) et compare aux choix actuels du dépôt. Produis
`docs/ETAT-DE-LART-2026.md` : ce qui a changé, ce qui mérite d'être adopté,
avec impact/effort. Attention aux choix DÉLIBÉRÉS documentés dans le code
(ex. endpointing FR `vapi`, pas de pgvector) : ne les défais qu'avec une
preuve, via les flags prévus.

## ÉTAPE 4 — IMPLÉMENTATION DU RESTE (niveau 3 de ROADMAP.md)

Dans cet ordre, une PR par lot, mêmes règles que la session précédente
(feature flags, tests, ne rien casser, migrations additives uniquement) :
1. **UI Paramètres** : base de connaissance (CRUD + bouton « importer les
   questions de mon métier ») et réglage de rétention — les API existent
   (`/my-dashboard/knowledge`, `/my-dashboard/retention`). Respecter le
   design system (`CLAUDE.md` : skills impeccable + taste-skill +
   emil-design-eng ; portail client = pages V1 conservées à dessein).
2. **Outbound conforme** : modèle `CallConsent` (opt-in tracé ≥ 3 ans),
   préparation Bloctel (l'abonnement est externe), fenêtres horaires légales.
3. **Industrialisation** : contrainte unique anti-double-booking sur
   `ClientBooking`, réconciliation des syncs calendrier échouées, puis
   BullMQ/Redis et Stripe Meters (gros chantiers, plans séparés).
4. **Multicanal** (modèle `Conversation` partagé) : commencer par les rappels
   de RDV WhatsApp (le service Twilio existe).

## RÈGLES (héritées de la mission d'origine)

- Explique tes décisions en français. Signale toute hypothèse et toute
  dépendance externe (clé API, compte, DPA). Si une info manque, pose la
  question au lieu de deviner.
- Latence : viser < 1,1 s voix-à-voix, lire P50/P95/P99 dans `fleetMetrics`.
- Aucune fonctionnalité d'enregistrement ou d'outbound sans ses garde-fous
  légaux. Secrets uniquement en variables d'env.
- Suis `CLAUDE.md` (routing des skills, conventions de commit, pièges connus —
  notamment : ne jamais recopier `VAPI_PHONE_NUMBER` dans une fiche client,
  et le déplacement de champs vers Paramètres se fait en 3 étapes indissociables).
- Après chaque lot : mets à jour `ROADMAP.md`, lance les tests, résume ce qui
  a changé et ce qui reste. Demande validation avant chaque niveau suivant.
