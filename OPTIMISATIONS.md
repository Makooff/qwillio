# OPTIMISATIONS.md — plan de mise à niveau technique de l'agent Qwillio

> Fichier de travail. Il est fait pour être exécuté par Claude Code, ligne par ligne.
> Version 1 — 26 août 2026. Sources : audit de l'état de l'art des agents vocaux téléphoniques, août 2026.

## Comment ce fichier s'utilise

Chaque ligne porte un identifiant stable (`LAT-1`, `BEL-3`…), une action, la raison, et **un critère d'acceptation testable**.

Le champ `Statut` prend une de ces cinq valeurs, et **une seule** :

| Statut | Sens |
|---|---|
| `À AUDITER` | valeur initiale, personne n'a encore regardé |
| `DÉJÀ FAIT` | présent dans le code ET le critère d'acceptation passe. Exige une preuve : `fichier:ligne` + le test qui le prouve |
| `PARTIEL` | présent mais le critère d'acceptation ne passe pas. Décrire précisément ce qui manque |
| `ABSENT` | rien dans le code |
| `NON APPLICABLE` | ne s'applique pas à notre architecture. **Justifier en une phrase**, sinon c'est `ABSENT` |

## Règles de travail — non négociables

1. **Un audit complet avant toute modification.** Aucun code n'est écrit tant que les 63 lignes n'ont pas un statut motivé.
2. **Ne jamais écrire `DÉJÀ FAIT` sans preuve.** Un chemin de fichier et un numéro de ligne, ou un test qui passe. Une intuition n'est pas une preuve.
3. **Le critère d'acceptation est la définition de « fini ».** Pas « le code est écrit » — « le test passe ».
4. **Une famille par session.** Ne pas mélanger la latence et la conformité dans la même conversation.
5. **Les tests avant le code**, systématiquement.
6. **Mesurer avant et après.** Toute optimisation de latence sans chiffre avant/après est invérifiable, donc nulle.
7. Si une ligne demande une décision produit ou un coût (changer de fournisseur, acheter un service), **s'arrêter et demander**. Ne pas trancher seul.

## Le contexte produit

Qwillio est un réceptionniste téléphonique IA pour TPE et PME en **Belgique et en France**. Il décroche 24/7, prend les rendez-vous, transfère les urgences, transcrit, résume, analyse le sentiment, bloque le démarchage et capture les leads. Langues aujourd'hui : français et anglais. **Le néerlandais est un chantier prioritaire** — c'est le seul marché où Qwillio joue à domicile.

La cible de latence est **800 à 1 000 ms au p50 et moins de 1 500 ms au p95**, de la fin de parole de l'appelant au premier son de l'agent. Les cinq plateformes concurrentes mesurées sur protocole neutre en 2026 sont entre 1 296 et 1 740 ms de médiane.

---

## LAT — Latence

*Le poste le plus visible. Cible : 800–1 000 ms p50, moins de 1 500 ms p95.*

Les cinq plateformes managées mesurées en 2026 sur un protocole neutre (2 078 tours, enregistrement bicanal) sont entre 1 296 et 1 740 ms de médiane : Telnyx 1 296, ElevenLabs 1 424, Bland 1 520, Vapi 1 558, Retell 1 740. La médiane de l'industrie sur plus de 10 millions de minutes analysées est de 1,4 à 1,7 s. Une pile bien optimisée descend à 800–1 000 ms, soit un facteur 2. Repère humain : la transition de tour dans une conversation réelle est à ~200 ms (Stivers, PNAS 2009), et un silence de 700 ms à 1 s n'est pas perçu comme de la lenteur mais comme de l'embarras ou de l'évasion.

### LAT-1 — Tout héberger en région UE

- **Statut** : `ABSENT`
- **Preuve** : `backend/render.yaml:5` et `:68` portent `region: oregon` pour l'API et le worker. Tous les points de sortie sont mondiaux/US par défaut : `api.openai.com` (`backend/src/services/voice/llm-stream.service.ts:62`), `api.elevenlabs.io` (`backend/src/services/voice/greeting-audio.service.ts:22`), `api.cartesia.ai` (`backend/src/services/voice/cartesia.service.ts:26`), `api.vapi.ai` (`backend/src/config/env.ts:37`). Le média SIP appartient à Vapi/Twilio, aucun code d'ici ne le place. `docs/MIGRATION-UE-RUNBOOK.md` décrit la bascule mais dit lui-même que la région Render est immuable et que rien n'a été fait. Aucun relevé de RTT nulle part.
- **Action** : STT, LLM et TTS dans une région européenne (eu-west-3, eu-central-1). Vérifier aussi que le média SIP ne sort pas d'Europe.
- **Pourquoi** : Un aller-retour Royaume-Uni → us-west-1 coûte ~140 ms, contre ~15 ms vers eu-west-2. Il y a trois aller-retours par tour. C'est 300 à 450 ms perdus, soit la moitié du budget cible — et le plus gros levier unique du projet.
- **Critère d'acceptation** : Traceroute et mesure de RTT vers chaque fournisseur depuis la région de production, consignés. Aucun composant hors UE sur le chemin critique.
- **Impact / effort** : fort / court

### LAT-2 — Réduire le buffer de lecture

- **Statut** : `PARTIEL`
- **Preuve** : Un paramètre de latence de flux EXISTE et est explicite : `optimizeStreamingLatency: env.VAPI_OPTIMIZE_LATENCY` (`backend/src/services/voice/speech-plans.ts:467`, défaut 2, `backend/src/config/env.ts:94`), plus la taille de morceau `minCharacters` (`speech-plans.ts:351`, `env.ts:186` = 60). Ce qui manque : le buffer joueur de 500 ms n'est exposé nulle part dans la surface Vapi qu'on utilise (on ne parle pas à ElevenLabs en direct sur l'appel, c'est Vapi qui le fait), et aucun TTFA n'a été mesuré avant/après — `fleetMetrics` est à `calls: 0`.
- **Action** : Le buffer joueur par défaut d'ElevenLabs est de 500 ms. Le descendre à 50–150 ms sur connexion stable.
- **Pourquoi** : 350 à 450 ms gratuits, sans contrepartie sur une liaison stable. C'est le paramètre le plus souvent oublié.
- **Critère d'acceptation** : Le buffer est un paramètre de configuration explicite, pas une valeur par défaut héritée. Mesure du TTFA avant/après.
- **Impact / effort** : fort / court

### LAT-3 — Ne jamais utiliser un modèle TTS multilingue lent

- **Statut** : `PARTIEL`
- **Preuve** : Le modèle rapide est choisi et épinglé : `VOICE_TTS_MODEL` défaut `eleven_turbo_v2_5` (`backend/src/config/env.ts:237`), Cartesia `sonic-3.5` (`env.ts:264`), servi par `buildVoice` (`speech-plans.ts:465`), avec un test qui garantit que l'aperçu et l'appel servent le MÊME modèle (`backend/src/services/voice/__tests__/speech-plans.test.ts:148`). Ce qui manque : le critère demande un TTFA p50 MESURÉ sous 300 ms sur audio français. L'étage `tts` est instrumenté (`latency-tracker.ts`) mais n'a jamais reçu un seul appel réel. Son biais est corrigé le 07/09 (voir LAT-5) : c'est `ttfa` qu'il faut lire pour ce critère, puisque c'est le seul des deux qui survit au streaming par clause.
  **Relevé de production (27/08)** : `VOICE_TTS_PROVIDER=cartesia`, donc le modèle réellement servi est `CARTESIA_MODEL` (défaut `sonic-3.5`), pas Turbo — à condition que `CARTESIA_VOICES` ou `CARTESIA_DEFAULT_VOICE_ID` soit posée, sans quoi `cartesiaVoiceFor` rend `null` et `buildVoice` retombe silencieusement sur ElevenLabs (`cartesia.service.ts:79`, `speech-plans.ts:405-408`).
  **Tranché (27/08)** : `CARTESIA_VOICES` porte un identifiant unique sans deux-points, c'est-à-dire la forme « couverture » prévue par `cartesiaVoiceFor` (`cartesia.service.ts:68-72`). La bascule PREND donc : le synthétiseur réellement servi est Cartesia sur `CARTESIA_MODEL`, absente et donc au défaut `sonic-3.5` (`env.ts:264`). C'est le modèle le plus rapide du relevé cité par cette ligne, mais son TTFA reste non mesuré : le statut ne bouge pas.
- **Action** : ElevenLabs Multilingual v2 mesure 1 232 ms de TTFA. Flash v2.5 est à 288 ms, Turbo v2.5 à 264 ms, Cartesia Sonic-3 à 188 ms.
- **Pourquoi** : Le piège classique du projet francophone : choisir « le modèle multilingue » par réflexe. Flash et Turbo gèrent très bien le français. Benchmark Coval, relevé du 4 mai 2026, sur endpoints de production.
- **Critère d'acceptation** : Le modèle TTS en production a un TTFA p50 mesuré sous 300 ms sur audio français.
- **Impact / effort** : fort / court

### LAT-4 — Demander directement le codec de sortie télécom

- **Statut** : `ABSENT`
- **Preuve** : Aucun codec, aucun SDP, aucun `alaw`/`pcma`/`pcmu` dans tout le dépôt (grep). Les numéros sont achetés à travers Vapi (`backend/src/services/voice/phone-provisioning.service.ts:43`) qui porte lui-même le compte Twilio : le leg SIP ne nous appartient pas, donc rien ici ne demande ni n'observe un codec. Atteindre ce critère suppose un trunk SIP en propre, c'est-à-dire une décision fournisseur, pas un patch.
- **Action** : Demander `alaw_8000` au TTS (a-law, standard européen — pas µ-law, qui est nord-américain).
- **Pourquoi** : Évite un transcodage complet à chaque énoncé. Forcer PCMU vers un opérateur belge ajoute une conversion inutile.
- **Critère d'acceptation** : Le SDP négocié montre PCMA. Aucun transcodage dans le chemin TTS → RTP.
- **Impact / effort** : moyen / court

### LAT-5 — Streamer le TTS par clause

- **Statut** : `PARTIEL`
- **Preuve** : Le streaming par clause est configuré : `chunkPlan` avec `punctuationBoundaries: ['.', '!', '?']` et `minCharacters` 60 (`backend/src/services/voice/speech-plans.ts:348-363`), testé (`__tests__/speech-plans.test.ts:158` et `:169`). Reste à le VÉRIFIER sur un appel réel : aucun n'a encore été passé.

  **Corrigé le 07/09, et la cause n'était pas celle écrite ici.** L'instrument effaçait bien la preuve, mais pas par le rejet des échantillons négatifs de `push()` : aucun négatif n'était jamais calculé. `markAssistantSpeechStart` était gardé par `if (lastDeltaAt !== null)`, et quand le streaming FONCTIONNE le dernier token n'est pas encore arrivé au moment du premier son — le garde sautait donc l'échantillon entier. L'étage `tts` ne portait ainsi que les tours où le streaming avait échoué, et sa médiane décrivait le mauvais chemin tout seul. Le suivi mesure désormais `ttfa` (premier token → premier son), qui existe dans les deux cas, et COMPTE les tours où le premier son a précédé le dernier token : c'est le critère d'acceptation de cette ligne, énoncé en nombre plutôt qu'en affirmation (`latency-tracker.ts`, `streamingSplit()`, visible dans la ligne de journal `clause-stream 7/8`).
- **Action** : Agréger les tokens du LLM jusqu'à une frontière de clause, envoyer au TTS, lire pendant que la clause suivante se génère.
- **Pourquoi** : La technique à plus fort rendement du pipeline classique. L'agrégation de phrase coûte 20 ms et récupère l'essentiel du budget.
- **Critère d'acceptation** : Le premier son sort avant que le LLM ait fini de générer sa réponse. Vérifiable en log : timestamp du premier chunk audio < timestamp du dernier token.
- **Impact / effort** : fort / moyen

### LAT-6 — Activer le cache de préfixe de prompt

- **Statut** : `PARTIEL`
- **Preuve** : Le cache de préfixe est demandé et VÉRIFIÉ : `prompt_cache_key` posé au-delà de 4 000 caractères de préfixe (`backend/src/services/voice/llm-stream.service.ts:224-228`), `stream_options.include_usage` pour récupérer `cached_tokens` (`llm-stream.service.ts:274`), lecture du bloc usage (`llm-stream.service.ts:99-116`), accumulation par appel (`call-session.store.ts:222`), journalisation du taux à la fin de l'appel (`realtime-orchestrator.service.ts:440`), alerte hebdomadaire (`receptionist-learning.service.ts:225-246`). Ce qui manque : ça ne vaut QUE sur le chemin custom-LLM ; le seuil codé est 30 % (`receptionist-learning.service.ts:75`), pas 90 % ; et aucun taux réel n'a jamais été observé (aucun appel entrant).
  **Relevé de production (27/08)** : `VOICE_CUSTOM_LLM_DEFAULT` n'est pas posée, donc elle vaut `true` (`env.ts:432`) et tous les clients passent par le chemin custom-LLM — le cache s'applique donc bien à toute la flotte, ce qui lève la première réserve.
- **Action** : Le prompt système d'un réceptionniste — script, ton, définitions d'outils — fait 2 000 à 5 000 tokens et repart à chaque tour.
- **Pourquoi** : 200 à 400 ms, et surtout une économie massive : sur les API temps réel, l'audio en entrée caché est facturé ~99 % moins cher.
- **Critère d'acceptation** : Le taux de hit du cache est loggé et supérieur à 90 % après le deuxième tour.
- **Impact / effort** : fort / court

### LAT-7 — Pré-générer l'audio des phrases statiques

- **Statut** : `PARTIEL`
- **Preuve** : L'accueil est pré-synthétisé et servi comme URL à Vapi : `backend/src/services/voice/greeting-audio.service.ts` (3 variantes par client, table `GreetingAudio`, route `/api/voice/greeting/:clientId/:variant`), branché en `firstMessage` (`realtime-orchestrator.service.ts:200-214`). Loin du critère : 3 phrases et non 10, en MP3 et non en PCMA 8 kHz, servies par une requête HTTP de Vapi vers notre API (donc pas un TTFA de 0 ms), et désactivées en parole-à-parole (`realtime-orchestrator.service.ts:206`). Les accusés de réception et phrases d'attente ne sont PAS pré-générés : ce sont des textes synthétisés en direct (`voice-tools.ts:31-123`).

  **Corrigé le 09/09 — la fonctionnalité était ÉTEINTE, et servait quand même de mauvaises lignes.** Deux défauts distincts, dont le second est le grave. `generate()` ne savait synthétiser que chez ElevenLabs et se taisait dès que la flotte passait à Cartesia : depuis le 27/08, plus aucun accueil n'était enregistré, pour personne. Surtout, le garde-fou était posé à la GÉNÉRATION et pas à la LECTURE, donc les lignes écrites avant la bascule continuaient d'être servies : une voix accueillait, une autre répondait, au milieu du premier tour de parole.

  Ce qui a changé : chaque ligne porte la voix qui l'a dite (`provider`, `voice_id`, `tts_model`, migration `20260909120000`), calculée par `buildVoice` — la MÊME fonction que l'assistant de l'appel, et non une reconstitution des règles de bascule, qui aurait divergé. La génération suit désormais le fournisseur de l'appel, Cartesia compris (`synthesiseWithCartesia`), et la lecture (`available(profile)`) écarte toute ligne dont la signature ne correspond pas, y compris celles de provenance inconnue, qui retournent à la synthèse en direct le temps d'être refaites. Six tests couvrent les deux défauts (`__tests__/greeting-audio.test.ts`), et `npm run voice:greetings` refabrique la flotte entière sans attendre qu'un réglage bouge — sans quoi une bascule de voix laisserait l'optimisation éteinte jusqu'au prochain changement de fiche.

  Ce qui reste pour lever le `PARTIEL` : les dix phrases, le PCMA 8 kHz, et un TTFA mesuré — donc un appel réel.
- **Action** : Salutation d'ouverture, accusés de réception (« très bien », « je vérifie »), formules de clôture, phrases d'attente pendant un appel d'outil.
- **Pourquoi** : Latence nulle sur les moments les plus visibles de l'appel — dont la première phrase, celle qui décide de l'impression. Coût : zéro.
- **Critère d'acceptation** : Au moins dix phrases servies depuis un cache audio PCMA 8 kHz. TTFA mesuré à 0 ms sur la salutation.
- **Impact / effort** : fort / court

### LAT-8 — Ouvrir la connexion TTS avant d'avoir le texte

- **Statut** : `NON APPLICABLE`
- **Preuve** : La WebSocket TTS appartient à Vapi : `buildVoice` ne fait que DÉCRIRE une voix dans le JSON de l'assistant (`backend/src/services/voice/speech-plans.ts:411-476`), aucun code d'ici n'ouvre, ne garde ni ne réutilise une connexion vers ElevenLabs ou Cartesia pendant un appel.
- **Action** : Établir la WebSocket TTS dès le début du tour, pas au moment d'envoyer la première clause.
- **Pourquoi** : 50 à 150 ms. Le keep-alive de connexion économise en plus 20 à 100 ms par requête.
- **Critère d'acceptation** : Aucune ouverture de connexion TTS sur le chemin critique d'un tour.
- **Impact / effort** : moyen / court

### LAT-9 — Surveiller le p95, pas le p50

- **Statut** : `PARTIEL`
- **Preuve** : Les percentiles existent, par étage : `voice-metrics.service.ts` rend p50/p95/p99 pour `stt`/`llm`/`tts`/`ttfa`/`total`, exposés sur `/api/webhooks/vapi/health` (`backend/src/controllers/voice-webhook.controller.ts:257`), et une alerte p95 hebdomadaire nomme l'étage fautif (`receptionist-learning.service.ts:152-186`).

  **La remise à zéro au redéploiement est corrigée le 09/09.** La mesure de chaque appel n'a jamais été perdue (`persistMetrics` l'écrit dans `ClientCall.metadata.realtime.latency`) ; c'est l'agrégat qui mourait avec le processus. Sur Render, qui redéploie plusieurs fois par jour, la fenêtre ne disait donc jamais autre chose que « depuis le dernier déploiement », c'est-à-dire la seule période où l'on est certain qu'il ne s'est presque rien passé. `hydrate()` la reprend au démarrage depuis les mille derniers appels mesurés, du plus ancien au plus récent, et date `windowStartedAt` du premier appel relu plutôt que du boot (`server.ts`, après les migrations, non bloquant). Quatre tests, dont la base injoignable qui ne doit pas empêcher un démarrage.

  Ce qui manque encore : aucun tableau de bord ne les affiche (aucun consommateur côté `frontend/src`, grep), et l'« alerte » reste un `logger.warn` sans destinataire.
- **Action** : Un appel fait 30 à 60 tours : chaque appel touche plusieurs fois la queue de distribution.
- **Pourquoi** : GPT-4.1 : 536 ms de TTFT médian mais 1 771 ms au p95. Gemini 2.5 Flash : 597 / 1 137 ms — moins rapide en médiane, bien meilleur en queue. Pour la voix, c'est le second qui compte.
- **Critère d'acceptation** : Le tableau de bord affiche p50, p95 et p99 par étage. Une alerte se déclenche sur le p95, pas sur la moyenne.
- **Impact / effort** : fort / moyen

### LAT-10 — Masquer les appels d'outils, pas les accélérer

- **Statut** : `PARTIEL`
- **Preuve** : Les trois moyens sont là : outils exécutés EN PARALLÈLE (`Promise.all`, `backend/src/services/voice/realtime-orchestrator.service.ts:386`), meublage non bloquant à l'invocation + relance à 1 200 ms (`voice-tools.ts:133-153`, `env.ts:360`), et préchargement spéculatif de l'agenda dès que l'appelant nomme un jour (`availability-speculator.ts`, déclenché en `realtime-orchestrator.service.ts:302`). Ce qui manque : le meublage est du TEXTE synthétisé, pas de l'audio pré-généré ; le préchargement se fait sur la date entendue, pas sur l'identification du numéro appelant ; et aucune mesure ne vérifie le plafond de 500 ms de silence.
- **Action** : Un appel d'outil double le nombre d'inférences LLM, et une requête de function call ne peut pas être streamée. Exécuter les outils en parallèle, jouer un accusé de réception pré-généré, précharger sur identification du numéro appelant.
- **Pourquoi** : C'est mécanique : 2× le TTFT plus la latence de l'API externe. On ne peut pas la supprimer, seulement la couvrir.
- **Critère d'acceptation** : Aucun tour avec appel d'outil ne laisse plus de 500 ms de silence. Les outils indépendants s'exécutent en parallèle.
- **Impact / effort** : moyen / moyen

## TUR — Tours de parole et interruption

*Le poste qui décide du naturel. Et celui où le VAD nu échoue une fois sur deux.*

Un VAD par énergie seul coupe la parole à l'appelant dans 55,6 % des cas quand on lui donne 300 ms de budget de décision. Un modèle sémantique de fin de tour tombe à 9,9 %, et décide en 543 ms contre 1 600 ms. C'est le plus gros levier de latence de tout le pipeline, devant le choix du LLM. Source : EOT-Bench, benchmark ouvert, 14 langues dont le français — publié par LiveKit, qui le remporte ; Deepgram publie des résultats inverses sur ses propres critères. À revalider sur tes appels français.

### TUR-1 — Passer à un modèle sémantique de fin de tour

- **Statut** : `PARTIEL`
- **Preuve** : Un modèle sémantique de fin de tour est bien demandé, et choisi par langue : `smartEndpointingEnabled: true` + `smartEndpointingPlan` = `livekit` en anglais, `vapi` en français et néerlandais (`backend/src/services/voice/speech-plans.ts:190-222`), avec bascule française vers LiveKit par `VOICE_FR_ENDPOINTING_PROVIDER` (`env.ts:402`). Tests : `__tests__/speech-plans.test.ts:74-101`. Ce qui manque, et c'est tout le critère : aucun taux de faux découpages n'a été mesuré, sur aucun appel réel. Le modèle retenu en FR/NL est celui de Vapi, pas le Turn Detector v1 de LiveKit ni Deepgram Flux.
- **Action** : Remplacer le VAD nu par un modèle d'end-of-turn : LiveKit Turn Detector v1 (14 langues dont le français, part directement de l'audio sans attendre le STT) ou Deepgram Flux Multilingual (modèle conjoint transcription + tour, français inclus depuis le 29 avril 2026).
- **Pourquoi** : Faux découpages de 55,6 % à 9,9 %. Latence de décision de 1 600 ms à 543 ms. Attention : la variante embarquée CPU `v1-mini` est à 27,8 % — ce n'est pas le modèle des benchmarks.
- **Critère d'acceptation** : Taux de faux découpages mesuré sur 100 appels réels, sous 10 %.
- **Impact / effort** : fort / moyen

### TUR-2 — Garder le VAD comme garde-fou de premier étage

- **Statut** : `PARTIEL`
- **Preuve** : Seul l'étage 2 existe chez nous (`smartEndpointingPlan`, `speech-plans.ts:213`). L'étage 1 (VAD énergie) est interne à Vapi : on ne le configure pas et il n'émet rien qu'on journalise. L'étage 3 (étiquetage par le LLM pour le contexte de tâche) n'existe pas. Le critère (« les trois étages présents et chacun loggé séparément ») échoue sur les deux points : deux étages sur trois sont absents ou invisibles, et rien n'est loggé par étage.
- **Action** : Architecture à trois étages : Silero VAD (moins d'1/8 de cœur CPU) → modèle sémantique en parallèle de la transcription → étiquetage par le LLM pour le contexte de tâche.
- **Pourquoi** : Le VAD reste utile comme filtre rapide. Le modèle sémantique décide. Le LLM ajoute le contexte de tâche que l'acoustique ignore.
- **Critère d'acceptation** : Les trois étages sont présents et chacun est loggé séparément.
- **Impact / effort** : moyen / moyen

### TUR-3 — Adapter l'endpointing au slot attendu — le plus important pour un réceptionniste

- **Statut** : `PARTIEL`
- **Preuve** : Le seuil après un chiffre passe de 0,5 s à **1 s** et devient réglable (`VOICE_ENDPOINTING_NUMBER_SECONDS`, `speech-plans.ts`). C'était le point du critère qui coupait vraiment les appelants : un numéro dicté en trois groupes espacés de 800 ms était coupé après le deuxième, et il fallait tout redicter. Deux tests : le seuil survit à une pause de 900 ms, et il est plus long que celui de la ponctuation — une ponctuation dit que le tour est fini, un chiffre dit le contraire, et les deux seuils doivent aller dans des sens opposés.
- **Le lien avec BEL-1/2/3** : capter un numéro dicté ne sert à rien si le transcripteur coupe l'appelant au milieu. Les deux lignes ne valent que prises ensemble.
- **Ce qui manque** : la table complète slot → seuil. Vapi n'expose qu'un seuil « chiffres » global sur l'assistant, pas un mode patient décidé tour par tour selon ce que l'agent vient de demander ; les adresses n'ont donc pas de seuil propre. Il faudrait tenir la boucle de tour nous-mêmes, ce qui dépasse cette ligne.
- **Action** : L'agent sait ce qu'il vient de demander. S'il attend un numéro de téléphone ou une adresse, il bascule en mode patient pour ce tour, puis revient au défaut.
- **Pourquoi** : Un appelant qui dicte « zéro deux… cinq cent douze… trente-quatre… » produit des pauses de 400 à 900 ms entre groupes. Un endpointing à 500 ms le coupe après le deuxième groupe. C'est le mode d'échec le plus fréquent et le plus irritant d'un agent de prise de rendez-vous.
- **Critère d'acceptation** : Une table de configuration lie chaque type de slot à un seuil : défaut ~500 ms, capture de chiffres ~1 000 ms, capture d'adresse ~1 000–1 500 ms. Test automatisé sur un numéro dicté en trois groupes espacés de 800 ms.
- **Impact / effort** : fort / moyen

### TUR-4 — Moduler selon la ponctuation prédite

- **Statut** : `DÉJÀ FAIT`
- **Preuve** : Deux seuils distincts, configurés et testés : `onPunctuationSeconds: 0.1` contre `onNoPunctuationSeconds: 1.0` (`backend/src/services/voice/speech-plans.ts:218-219`), assertion explicite « répond plus vite après un point d'interrogation qu'après une clause en suspens » (`backend/src/services/voice/__tests__/speech-plans.test.ts:67-72`). Réserve honnête : ces seuils partent avec l'assistant à chaque appel, mais aucun appel réel n'a encore validé le rendu à l'oreille.
- **Action** : Si la transcription partielle se termine par une ponctuation forte, répondre presque immédiatement (~100 ms). Si elle se termine sans ponctuation — donc en suspens — attendre nettement plus (~1 500 ms).
- **Pourquoi** : De l'endpointing sémantique pauvre mais quasi gratuit, implémentable sur n'importe quel STT qui prédit la ponctuation. C'est le modèle du Start Speaking Plan de Telnyx.
- **Critère d'acceptation** : Deux seuils distincts configurés et vérifiés en test : phrase finie vs phrase en suspens.
- **Impact / effort** : fort / court

### TUR-5 — Exiger 2 ou 3 mots avant d'accepter une interruption

- **Statut** : `PARTIEL`
- **Preuve** : Le paramètre est à 2 : `numWords: tuning.bargeInWords` (`backend/src/services/voice/speech-plans.ts:274`), `VOICE_BARGE_IN_WORDS` défaut 2 (`env.ts:169`), test qui interdit le retour à 0 (`__tests__/speech-plans.test.ts:27-36`). Deux manques : aucun test avec un fichier de bruit domestique, et surtout le mode parole-à-parole force `numWords: 0` (`speech-plans.ts:266`, faute de transcripteur) — sur ce chemin le critère est faux par construction, seul `voiceSeconds` protège.
  **Relevé de production (27/08)** : `VOICE_BARGE_IN_WORDS` n'est pas posée, donc la valeur servie est bien le défaut 2 ; et `VOICE_SPEECH_TO_SPEECH` n'est pas posée non plus, donc le mode parole-à-parole est **inactif** par défaut (`env.ts:306`) — la réserve ci-dessus ne concerne que les clients qui ont explicitement choisi `voiceMode: 'realtime'`.
- **Action** : Le paramètre `min_interruption_words` est à 0 par défaut chez LiveKit — c'est-à-dire désactivé.
- **Pourquoi** : C'est probablement le réglage le plus impactant pour un agent téléphonique en environnement domestique ou en atelier. Un aboiement, une porte, un « ah » d'enfant n'ont pas de contenu lexical. Contrepartie : ajoute la latence du STT au chemin d'interruption.
- **Critère d'acceptation** : Le paramètre est à 2 ou 3. Test avec un fichier de bruit domestique : aucune interruption déclenchée.
- **Impact / effort** : fort / court

### TUR-6 — Exiger une durée minimale de parole

- **Statut** : `PARTIEL`
- **Preuve** : Le paramètre est explicite et vaut 0,4 s : `voiceSeconds: tuning.bargeInVoiceSeconds` (`backend/src/services/voice/speech-plans.ts:275`), `VOICE_BARGE_IN_VOICE_SECONDS` (`env.ts:152`), test qui exige > 0,2 s et ≤ 0,6 s (`__tests__/speech-plans.test.ts:37-46`). Ce qui manque : 0,4 s au lieu des 0,5 s demandés, et aucun test avec de vrais transitoires de 100 à 400 ms — le test actuel vérifie une valeur de configuration, pas un comportement sur de l'audio.
- **Action** : `min_interruption_duration` à 0,5 s.
- **Pourquoi** : Filtre les transitoires : claquements, toux, chocs. Le filtre le plus rentable et le plus simple.
- **Critère d'acceptation** : Paramètre explicite, testé avec des transitoires de 100 à 400 ms.
- **Impact / effort** : moyen / court

### TUR-7 — Court-circuiter le seuil sur les mots d'arrêt

- **Statut** : `PARTIEL`
- **Preuve** : La liste est désormais RÉGLABLE, à trois niveaux et sans déploiement : par client (`VoiceTuning.interruptionPhrases`), par environnement (`VOICE_INTERRUPTION_PHRASES`), sinon celle du code (`speech-plans.ts`, `phraseList`). Elle est dédoublonnée et minusculée, parce que Vapi refuse l'assistant ENTIER sur une répétition et qu'une liste réglable rend le doublon bien plus probable qu'un tableau écrit à la main. Elle ne peut jamais finir vide : le nettoyage passe avant le choix, sans quoi une liste de blancs serait retenue pour sa longueur puis vidée — et sans mot d'arrêt, plus rien ne coupe une réceptionniste lancée. 3 tests.
- **Ce qui manque** : la seconde moitié du critère est une MESURE (« attendez » seul interrompt en moins de 300 ms), donc un appel réel. Et la liste disparaît toujours en parole-à-parole, où Vapi n'expose pas ce plan.
- **Action** : Une liste de mots — « attendez », « stop », « non », « pardon », « excusez-moi » — interrompt immédiatement, sans attendre les 2 mots ni les 500 ms.
- **Pourquoi** : Sinon un « stop ! » monosyllabique ne passe plus. C'est le complément indispensable de TUR-5.
- **Critère d'acceptation** : Liste configurable. Test : « attendez » seul interrompt en moins de 300 ms.
- **Impact / effort** : fort / court

### TUR-8 — Reprendre après une fausse interruption

- **Statut** : `ABSENT`
- **Preuve** : Rien ne reprend un énoncé interrompu. `backoffSeconds` (1 s, `speech-plans.ts:276`) ne fait que retarder la reprise de parole, il ne rejoue rien. À noter : `recoveryLine()` et `newRepairState()` (`backend/src/services/voice/conversational-repair.ts:61-76`) sont écrits ET testés (`__tests__/conversational-repair.test.ts:11-26`) mais ne sont appelés depuis AUCUN point du runtime (grep : seul leur test les importe). C'est du code mort, pas une fonctionnalité.
- **Action** : Si l'agent s'est arrêté mais qu'aucune transcription n'arrive dans les 2 secondes, il reprend là où il en était.
- **Pourquoi** : C'est le filet de sécurité qui permet de configurer un barge-in sensible sans que les faux positifs soient fatals. `resume_false_interruption` à True, `false_interruption_timeout` à 2 s.
- **Critère d'acceptation** : Test : injecter un bruit pendant l'énoncé de l'agent, vérifier qu'il reprend le fil et non qu'il attend indéfiniment.
- **Impact / effort** : fort / moyen

### TUR-9 — Tronquer le contexte à ce que l'appelant a réellement entendu

- **Statut** : `ABSENT`
- **Preuve** : Aucun horodatage au mot n'est lu nulle part, et rien ne tronque l'historique. Sur le chemin custom-LLM, `llm-stream.service.ts` relaie les `messages` que Vapi envoie sans y toucher (`handle()`, `:166-203` ; les seuls ajouts sont l'humeur en QUEUE et la clé de cache). Si Vapi tronque de son côté, ce n'est ni configuré, ni vérifié, ni observable ici.
- **Action** : Le pipeline génère plus vite que le temps réel. À l'interruption, l'agent a peut-être généré quatre phrases et l'appelant n'en a entendu qu'une et demie. Utiliser les timestamps au niveau du mot fournis par le TTS pour couper l'historique.
- **Pourquoi** : Sinon l'agent croit avoir dit des choses que l'appelant n'a jamais entendues, et toute la suite de la conversation déraille. C'est un bug silencieux, très difficile à diagnostiquer depuis les transcripts.
- **Critère d'acceptation** : Test automatisé : interrompre à 1,5 s d'un énoncé de 6 s, vérifier que l'historique ne contient que ce qui a été joué.
- **Impact / effort** : fort / moyen

### TUR-10 — Ne pas traiter les acquiescements comme des interruptions

- **Statut** : `PARTIEL`
- **Preuve** : Même mécanisme et mêmes garanties pour les acquiescements (`VOICE_ACKNOWLEDGEMENT_PHRASES`, `VoiceTuning.acknowledgementPhrases`), qui s'ajoutent aux deux mécanismes déjà là : la liste envoyée à Vapi et le routeur d'intention qui répond par le silence.
- **Ce qui manque** : le test demandé injecte un « hm-hm » PENDANT un énoncé et vérifie que l'audio continue — c'est une mesure sur un appel, pas une assertion de configuration.
- **Action** : « oui », « d'accord », « hm-hm », « mmh » sont des signaux d'écoute, pas des prises de tour. Ils ne doivent pas annuler l'audio en cours.
- **Pourquoi** : L'agent qui s'arrête net à chaque « mm-hm » est un des défauts les plus caractéristiques de la génération précédente. Cela demande une classification sémantique des énoncés courts, pas un seuil de durée.
- **Critère d'acceptation** : Liste d'acquiescements configurée. Test : injecter « hm-hm » pendant l'énoncé, l'agent continue.
- **Impact / effort** : moyen / moyen

### TUR-11 — Annuler l'écho côté serveur et baisser le micro pendant que l'agent parle

- **Statut** : `ABSENT`
- **Preuve** : Aucune annulation d'écho et aucun ducking. La seule ligne voisine est `backgroundDenoisingEnabled: true` (`backend/src/services/voice/speech-plans.ts:728`), qui débruite le flux ENTRANT et n'utilise jamais le signal TTS comme référence. Le chemin audio appartient à Vapi : atteindre ce critère demanderait de tenir le média nous-mêmes. Côté navigateur, l'appel test se contente de `getUserMedia({ audio: true })` (`frontend/src/components/client/VapiLiveCall.tsx:770`), donc de l'AEC par défaut du terminal.
- **Action** : AEC côté serveur avec le signal TTS comme référence (vous le connaissez exactement), plus un ducking partiel de −10 à −20 dB — pas une coupure totale.
- **Pourquoi** : Au téléphone, une part importante des appelants est en mains-libres ou en voiture, ce qui défait l'AEC du terminal. Le ducking partiel laisse passer une interruption volontaire (forte) et supprime l'écho résiduel (faible). Un ducking total supprimerait le barge-in.
- **Critère d'acceptation** : Test en haut-parleur : l'agent ne se coupe pas lui-même, et une interruption volontaire passe.
- **Impact / effort** : fort / long

### TUR-12 — Désactiver le barge-in pendant la salutation

- **Statut** : `ABSENT`
- **Preuve** : Rien ne suspend le barge-in au début de l'appel : `firstMessageMode: 'assistant-speaks-first'` (`backend/src/services/voice/speech-plans.ts:727`) et les deux plans de parole s'appliquent dès la première milliseconde (`speech-plans.ts:669-731`). Aucun délai de convergence, aucune fenêtre de garde sur la salutation.
- **Action** : Les algorithmes d'annulation d'écho mettent 3 à 4 secondes à converger en début d'appel.
- **Pourquoi** : Les premières secondes sont les plus vulnérables aux faux barge-in — et c'est précisément le moment de la phrase d'accueil, celle qui décide de l'impression.
- **Critère d'acceptation** : Barge-in inactif sur les 2 à 3 premières secondes, ou jusqu'à la fin de la salutation.
- **Impact / effort** : moyen / court

### TUR-13 — Viser 5 % de faux découpages, pas 10 %

- **Statut** : `ABSENT`
- **Preuve** : Aucun taux de faux découpages n'est mesuré, donc aucun seuil de confiance ne peut être réglé dessus. Les seuls compteurs voisins vont dans l'AUTRE sens : `bargeIns` / `hardBargeIns` comptent l'appelant qui coupe l'AGENT (`backend/src/services/voice/call-session.store.ts:256-266`), jamais l'agent qui coupe l'appelant.
- **Action** : L'arbitrage n'est pas symétrique : couper la parole à quelqu'un coûte beaucoup plus cher que 250 ms de silence en plus.
- **Pourquoi** : Avec un bon modèle : 5 % de faux découpages coûte ~550 ms, 10 % coûte ~295 ms. Le gain de 250 ms ne compense pas le doublement des interruptions.
- **Critère d'acceptation** : Le seuil de confiance est réglé sur cette cible et le taux est mesuré en continu.
- **Impact / effort** : moyen / court

## BEL — Le français, le belge, le néerlandais

*Le terrain où aucun concurrent ne s'est aventuré. C'est là que se construit ton avance.*

Il n'existe aucun corpus public de français belge téléphonique en 8 kHz, aucun benchmark de WER sur français de Belgique, et aucun éditeur d'ASR ne documente le traitement de « septante » et « nonante ». C'est un angle mort commercial complet — donc une opportunité. Le passage du studio au téléphone multiplie le taux d'erreur par environ 2,2, et le flamand téléphonique était pire que le néerlandais téléphonique de 31 % relatif alors qu'il était meilleur en broadcast : la diglossie se paie au téléphone.

### BEL-1 — Écrire ton propre normaliseur de nombres FR-BE

- **Statut** : `DÉJÀ FAIT`
- **Preuve** : `backend/src/utils/spoken-numbers.ts` (`spokenDigits`), descente récursive sur la grammaire française plutôt qu'une table de correspondances : les formes se composent (« quatre-vingt-dix-sept » vaut 80 + 10 + 7) et énumérer les compositions revient à écrire la grammaire en moins lisible. Test exhaustif `__tests__/spoken-numbers.test.ts` : **0 à 100 dans les deux variantes**, engendrés par la fonction inverse pour qu'il n'y ait aucun trou, plus les formes en « et un » que le normaliseur de référence rate (`septante-et-un`, `nonante-et-un`), plus huit dictées réelles. 13 tests verts.
- **Le point qui décide** : 60 et 80 absorbent une dizaine complète (« soixante-douze »), 70 et 90 non — « septante-douze » ne se dit pas, et l'accepter fabriquerait un nombre là où l'appelant en dictait deux. Toute la différence entre la France et la Belgique tient dans cette condition.
- **Action** : Le normaliseur de référence en français (NeMo) contient bien `septante` et `nonante`, mais il lui manque les formes en « et un » : ni `septante-et-un`, ni `nonante-et-un`. Or c'est exactement ce que dit un Belge.
- **Pourquoi** : 71 et 91 en belge échouent silencieusement. C'est le genre de bug qui ne remonte jamais dans les logs mais fait rappeler le client.
- **Critère d'acceptation** : Jeu de tests couvrant 0 à 100 en français de Belgique ET de France, plus les formes hybrides. 100 % de réussite.
- **Impact / effort** : fort / court

### BEL-2 — Ajouter les gabarits de numéros belges

- **Statut** : `DÉJÀ FAIT`
- **Preuve** : `backend/src/utils/phone-spoken.ts` (`parseSpokenPhone`), et les gabarits ne sont **pas** écrits à la main : `libphonenumber-js/max` porte la table complète, tenue à jour par pays, y compris les préfixes ouverts l'an prochain. La métadonnée COMPLÈTE et non réduite, parce que la réduite valide sur la seule longueur et accepte `045123456` comme un mobile belge. Tests `__tests__/phone-spoken.test.ts` : les neuf préfixes principaux (Bruxelles, Anvers, Gand, Liège, Namur, Charleroi, Courtrai, deux mobiles) dictés dans les deux groupements, 20 tests verts.
- **Le numéro dicté est enfin capté** : `captureLead` porte un champ `phone` (`voice-tools.ts`), validé avant écriture (`tool-runtime.service.ts`), et un numéro donné de vive voix l'emporte sur l'identifiant d'appelant — c'est là que l'appelant veut être rappelé.
- **Action** : Le normaliseur téléphone français est câblé sur exactement cinq paires, soit dix chiffres. Les fixes belges en font neuf : `0x xxx xx xx` à Bruxelles, Anvers, Liège, Gand ; `0xx xx xx xx` à Namur, Charleroi, Courtrai. Les mobiles en font dix, en `04xx`.
- **Pourquoi** : Les fixes belges ne sont tout simplement pas parsables par un normaliseur français. Et le groupement à trois chiffres (`02 512 34 56`, dicté « cinq cent douze ») n'existe pas dans le graphe français.
- **Critère d'acceptation** : Jeu de tests avec des numéros réels des neuf préfixes principaux, dictés dans les deux groupements. 100 % de réussite.
- **Impact / effort** : fort / moyen

### BEL-3 — Valider chaque numéro capté avec libphonenumber

- **Statut** : `DÉJÀ FAIT`
- **Preuve** : `libphonenumber-js` est une dépendance (`backend/package.json`), et aucun numéro n'est écrit sans avoir passé `parseSpokenPhone`. Un échec n'enregistre rien et rend une consigne de relance (`RETRY_PHONE`, `tool-runtime.service.ts`), formulée comme un geste (« relis chiffre par chiffre, redemande, rappelle captureLead ») et non comme un diagnostic : un modèle à qui l'on dit « invalide » s'excuse, un modèle à qui l'on dit quoi faire le fait. La FICHE, elle, est conservée : refuser le nom, le motif et l'urgence pour un chiffre douteux perdrait tout ce que l'appelant vient de donner. 6 tests (`__tests__/capture-lead-phone.test.ts`).
- **L'ambiguïté qu'aucun code ne lève** : `0475 12 34 56` est un mobile belge ET un fixe français du Sud-Est, tous deux valides. Le contexte tranche, dans l'ordre où il est fiable : le pays lu sur la ligne de l'appelant, puis celui du commerce, puis BE et FR. C'est aussi la raison d'être de la relecture à l'appelant.
- **Action** : Région BE en priorité, repli FR. Rejeter avant de relire à l'appelant.
- **Pourquoi** : C'est la seule façon de détecter une capture erronée avant de la confirmer à voix haute. Sur des séquences alphanumériques structurées, les systèmes ASR commerciaux sont à 43–58 % de précision, contre 95–99 % sur la parole générale — l'ordre de grandeur du problème.
- **Critère d'acceptation** : Aucun numéro n'est enregistré sans avoir passé la validation. Les échecs déclenchent une relance, pas un enregistrement.
- **Impact / effort** : fort / court

### BEL-4 — Relire systématiquement, et basculer en DTMF au deuxième échec

- **Statut** : `PARTIEL`
- **Preuve** : Les trois pièces existent et sont testées. La relecture : `retryPhone` rend à l'agent les chiffres ENTENDUS en toutes lettres (`backend/src/services/voice/tool-runtime.service.ts:67`), ce qui est ce qui permet à l'appelant de repérer LEQUEL de ses chiffres a été mal compris. Le compteur : `callSessionStore.recordPhoneCaptureFailure` compte par appel et rend le rang de l'échec (`call-session.store.ts`). La bascule : `keypadFallback` au deuxième échec interdit explicitement une troisième dictée et demande la saisie clavier terminée par dièse (`tool-runtime.service.ts`). Le clavier lui-même est armé sur TOUS les appels via `keypadInputPlan` (`speech-plans.ts`, dans `buildRealtimePlans`, hors du bloc parole-à-parole), donc il est prêt avant qu'on en ait besoin — l'assistant ne se reconstruit pas en cours d'appel. Tests : `__tests__/capture-lead-phone.test.ts` (« la bascule clavier au deuxième échec », 8 cas), `__tests__/call-session.store.test.ts` (3 cas), `__tests__/vapi-schema.test.ts` (2 cas, dont le type de `delimiters`).
- **Ce qui manque pour `DÉJÀ FAIT`** : la moitié du critère qui ne s'écrit pas ici. « Les tonalités sont reçues en RFC 4733 et ne polluent pas le transcript » se vérifie sur un appel réel : le SDP appartient à Vapi/Twilio, et la documentation Vapi dit que les chiffres traités sont ajoutés à la conversation comme message utilisateur, donc ils APPARAISSENT au transcript — proprement, en chiffres, ce qui est le contraire du bug visé (des tonalités transcrites en charabia par le STT), mais ce n'est pas « absent du transcript ». À trancher sur le premier appel réel.
- **Action** : Relecture par paires à l'appelant. Si la confirmation échoue deux fois, proposer la saisie au clavier.
- **Pourquoi** : Le DTMF est le seul canal à 0 % de taux d'erreur. C'est le repli qui sauve l'appel — et personne ne le fait.
- **Critère d'acceptation** : Test : deux échecs de capture consécutifs déclenchent la bascule DTMF. Les tonalités sont reçues en RFC 4733 et ne polluent pas le transcript.
- **Impact / effort** : fort / moyen

### BEL-5 — Injecter les noms de rues de la commune dans le biasing, en cours d'appel

- **Statut** : `ABSENT`
- **Preuve** : `buildTranscriber` n'envoie aucun mot-clé : provider, modèle, langue, `smartFormat`, `endpointing` et un éventuel `fallbackPlan`, rien d'autre (`backend/src/services/voice/speech-plans.ts:155-180`). Aucune intégration BeSt Address, aucune mise à jour de mots-clés en cours de flux, et aucun champ adresse dans les outils (`voice-tools.ts`).
- **Action** : Une fois la commune ou le code postal identifiés, charger dynamiquement les noms de rues correspondants dans les mots-clés du STT. La source est BeSt Address, le registre officiel des adresses belges, en français, néerlandais et allemand, gratuit et en open data.
- **Pourquoi** : Le registre complet fait des centaines de milliers d'entrées, la fenêtre de biasing en accepte 100 (Deepgram, 500 tokens) à 1 000 (Speechmatics). Le chargement dynamique est le seul moyen de tenir dans le quota. Deepgram Flux permet la mise à jour des mots-clés en cours de flux.
- **Critère d'acceptation** : Test : dicter trois noms de rue difficiles de trois communes différentes, avec et sans biasing. Amélioration mesurée.
- **Impact / effort** : fort / long

### BEL-6 — Gérer les communes bilingues

- **Statut** : `ABSENT`
- **Preuve** : Aucune table d'équivalence de communes dans le dépôt. Les seules occurrences d'« Ixelles » sont un libellé d'exemple d'interface (`frontend/src/pages/client/ClientSetupForwarding.tsx` et `backend/src/config/knowledge-presets.ts:194`), jamais une correspondance FR/NL.
- **Action** : À Bruxelles, chaque commune a deux noms officiels : Ixelles/Elsene, Schaerbeek/Schaarbeek, Uccle/Ukkel, Woluwe-Saint-Lambert/Sint-Lambrechts-Woluwe. En périphérie, un francophone dictera parfois le nom français d'une commune officiellement néerlandophone.
- **Pourquoi** : Sans table d'équivalence, l'agent enregistre deux adresses différentes pour le même endroit, et le client rappelle.
- **Critère d'acceptation** : Table d'équivalence complète pour les 19 communes bruxelloises et la périphérie. Test dans les deux langues.
- **Impact / effort** : fort / moyen

### BEL-7 — Utiliser `sounds_like` pour les patronymes flamands

- **Statut** : `ABSENT`
- **Preuve** : Speechmatics n'est pas utilisé : la transcription est Deepgram, et le seul secours possible est un autre fournisseur générique posé par variable d'environnement (`backend/src/services/voice/speech-plans.ts:66-71`). Aucun dictionnaire de prononciation, aucun `sounds_like`, aucun patronyme nulle part.
- **Action** : Speechmatics est le seul moteur grand public à permettre d'écrire la prononciation approximative d'un nom : `Vandenbossche` → `vandenbosje`, `Dhaenens` → `danens`.
- **Pourquoi** : Les patronymes flamands sont le second point de rupture après les numéros, et personne ne les traite. Le nom mal orthographié, c'est le rappel qui n'aboutit pas.
- **Critère d'acceptation** : Dictionnaire d'au moins 200 patronymes fréquents en Belgique avec leur prononciation. Test sur 20 noms.
- **Impact / effort** : moyen / moyen

### BEL-8 — Apprendre les belgicismes au LLM, pas à l'ASR

- **Statut** : `DÉJÀ FAIT`
- **Preuve** : Section « FRANÇAIS DE BELGIQUE » dans `buildSystemPrompt` (`system-prompt.ts`), servie aux seuls appelants belges francophones — un commerce français n'a que faire de « septante », et chaque ligne inutile dilue les autres. 17 assertions de prompt (`__tests__/system-prompt.test.ts`) plus deux scénarios d'évaluation contre le vrai modèle : `fr-be-diner-midi` et `fr-be-je-ne-sais-pas`.
- **Pourquoi au modèle et pas au transcripteur** : ces mots sont correctement TRANSCRITS, c'est leur sens qui diffère. Un biais de transcription ne réparerait rien.
- **Action** : « Dîner » désigne le repas de midi en Belgique, « souper » celui du soir, « déjeuner » le petit-déjeuner. « Je ne sais pas venir » signifie « je ne peux pas venir ». « S'il vous plaît » en fin d'énoncé signifie souvent « voilà, tenez ».
- **Pourquoi** : Un agent de prise de rendez-vous qui interprète « dîner » comme le repas du soir se trompera systématiquement de créneau en Belgique. Et « je ne sais pas venir » lu au premier degré par un LLM entraîné sur du français hexagonal donne une réponse absurde.
- **Critère d'acceptation** : Section dédiée dans le prompt système. Jeu de tests avec 15 énoncés belges typiques et le comportement attendu.
- **Impact / effort** : fort / court

### BEL-9 — Ne pas utiliser la locale fr-BE d'Azure

- **Statut** : `NON APPLICABLE`
- **Preuve** : Aucune locale Azure n'est en jeu : la transcription est Deepgram et reçoit `fr` / `nl` / `en-US` (`backend/src/services/voice/speech-plans.ts:29`), jamais `fr-BE` ni `nl-BE`, donc le piège décrit ne peut pas se produire chez nous. Le fond de la ligne (le biasing lourd qui compense) reste, lui, entièrement à faire : voir BEL-5.
- **Action** : Les locales `fr-BE` et `nl-BE` existent chez Azure mais n'y supportent ni les listes de phrases, ni le lexique de prononciation, ni le formatage intelligent — exactement les trois outils dont on a besoin.
- **Pourquoi** : `fr-FR` avec un biasing lourd bat `fr-BE` sans biasing. C'est contre-intuitif et c'est documenté.
- **Critère d'acceptation** : Décision tranchée après un test A/B sur ton propre audio, consignée avec les chiffres.
- **Impact / effort** : moyen / court

### BEL-10 — Choisir la voix en connaissance de cause

- **Statut** : `PARTIEL`
- **Preuve** : Un crochet belge existe : `VAPI_VOICE_ID_BE` remplace le timbre pour un client BE francophone sans personnage choisi (`backend/src/config/voice-characters.ts:353-357`, variable `env.ts:42`). Trois réserves : la variable est VIDE par défaut, donc personne n'entend une voix belge aujourd'hui ; elle ne s'applique pas si le client a choisi un personnage ; et un client NÉERLANDOPHONE retombe sur `DEFAULT_CHARACTER_EN` (`voice-characters.ts:353`), c'est-à-dire une voix de personnage anglais. Aucun test à l'aveugle, aucun verdict consigné.
  **Relevé de production (27/08) — le crochet belge est INERTE** : `CARTESIA_VOICES` porte une voix unique en forme « couverture », et `useCartesia` traduit vers elle TOUT identifiant ElevenLabs (`speech-plans.ts:383-409`). Or `resolveCharacter` pose `VAPI_VOICE_ID_BE` comme un `voiceId` ElevenLabs (`voice-characters.ts:354-357`), c'est-à-dire AVANT cette traduction : même renseignée, la voix belge serait écrasée par la voix de couverture. Trois conséquences de la même cause : les dix personnages du catalogue sortent tous avec le même timbre, le genre du personnage n'est plus respecté, et une voix de bibliothèque choisie par un client ne l'est plus non plus. L'aperçu du sélecteur pose la même question par le même code (`preview-audio.service.ts:77` et `:180`), donc le client entend bien ce qui sera servi : le sélecteur est cohérent, mais décoratif. Seuls un vrai clone et une voix choisie directement chez Cartesia échappent à la couverture.
- **Action** : Seul Azure propose des voix belges (deux en français, deux en néerlandais) et elles sont toutes de génération « Standard » : aucun style, aucun contrôle prosodique, une génération de retard.
- **Pourquoi** : Le risque est asymétrique : un francophone belge n'est pas choqué par une voix de France ; un Flamand est en revanche sensible à une voix des Pays-Bas, perçue comme distante. La troisième voie est le clonage d'une voix belge consentante.
- **Critère d'acceptation** : Test à l'aveugle sur 10 Belges francophones et 10 néerlandophones, avec le verdict consigné.
- **Impact / effort** : moyen / moyen

### BEL-11 — Contraindre le code-switching à FR et NL uniquement

- **Statut** : `ABSENT`
- **Preuve** : Une seule langue par client, figée à la construction du profil (`backend/src/services/voice/realtime-context.service.ts:268-274`), et un seul code envoyé au transcripteur (`speech-plans.ts:29` et `:158`). Aucun `language_codes`, aucun mode `multi`, aucune détection au mot, ni AssemblyAI. Un appel bruxellois qui alterne FR et NL est transcrit dans une seule des deux langues.
- **Action** : AssemblyAI Universal-3.5 Pro permet de passer `language_codes: ["fr","nl"]` et de contraindre le modèle à ne basculer qu'entre ces deux langues. Deepgram Flux Multilingual fait de la détection au niveau du mot, français et néerlandais inclus.
- **Pourquoi** : C'est exactement ce qu'il faut pour Bruxelles : on élimine d'un coup les confusions avec l'allemand, l'anglais et le danois. Attention au piège de version : Universal-3 Pro streaming ne couvrait que six langues, sans néerlandais. Il faut la 3.5.
- **Critère d'acceptation** : Test sur 20 énoncés mélangeant les deux langues dans la même phrase, comme on parle réellement à Bruxelles.
- **Impact / effort** : fort / moyen

### BEL-12 — Normaliser le texte avant de l'envoyer au TTS

- **Statut** : `PARTIEL`
- **Preuve** : Le normaliseur existe et il est à nous : `backend/src/utils/text-for-speech.ts` — `numberWords` (0 à 9999, variante belge ou française), `phoneWords` (chiffre par chiffre, la virgule servant de pause : aucune balise, comprise des deux synthétiseurs), `timeWords` (« et demie », « et quart », « moins le quart »), `priceWords`, et `addressWords` avec son dictionnaire d'abréviations. 36 tests (`__tests__/text-for-speech.test.ts`), dont les **trente numéros** et les **vingt adresses** du critère.
- **Ce qui rend le jeu de tests solide** : un ALLER-RETOUR. Ce que l'agent dit est relu par notre propre lecteur (`spokenDigits`, BEL-1) et doit rendre les mêmes chiffres, pour 0 à 999 dans les deux variantes et pour les trente numéros. Deux tables écrites à la main ne prouveraient que leur propre cohérence ; une boucle qui se referme prouve les deux sens.
- **Premier branchement** : la relecture d'un numéro mal compris (`tool-runtime.service.ts`). Rendre à l'agent les chiffres ENTENDUS, en toutes lettres, est ce qui permet à l'appelant de repérer lequel a été mal pris — redicter à l'aveugle recommence la même erreur.
- **Ce qui manque, et pourquoi ce n'est pas fait à l'aveugle** : la phrase que l'appelant entend est composée par le MODÈLE, et elle transite par le relais octet par octet de `llm-stream.service.ts`. Normaliser ce flux suppose de le découper par clause avant de le réécrire, donc de toucher au seul chemin dont la latence est mesurée en millisecondes — et aucune mesure n'existe encore (`fleetMetrics: calls 0`). Le faire sans repère mesuré, c'est troquer une prononciation contre une latence, sans savoir laquelle on perd.
- **Action** : Ne jamais envoyer `02 512 34 56` au TTS. Envoyer l'énoncé complet, avec les pauses explicites.
- **Pourquoi** : Le TTS ne doit jamais avoir à deviner. Et le contrôle phonémique en français chez ElevenLabs force sur `eleven_v3`, qui n'est pas le modèle basse latence : on ne peut pas avoir à la fois les 288 ms de Flash et le contrôle IPA français. Le repli est un dictionnaire d'alias orthographique, qui marche sur tous les modèles.
- **Critère d'acceptation** : Aucun chiffre brut, aucune abréviation, aucune adresse non normalisée ne sort vers le TTS. Test de relecture sur 30 numéros et 20 adresses.
- **Impact / effort** : fort / moyen

## REL — Fiabilité

*Ce qui casse en production, et que les plateformes ne documentent pas.*

Les fils de support des plateformes sont la source la plus honnête de tout ce dossier : ils documentent des modes d'échec que les pages produit taisent. Un warm transfer dont la cible est mal classée comme messagerie peut laisser l'appelant sur de la musique d'attente indéfiniment — bug confirmé, non résolu. Les codes de cause SIP ne sont exposés comme variables de branchement chez aucune plateforme.

### REL-1 — Un repli par étage, avec circuit breaker

- **Statut** : `PARTIEL`
- **Preuve** : Les trois étages DÉCLARENT un secours à Vapi : STT `fallbackPlan` (`backend/src/services/voice/speech-plans.ts:170-177`), TTS `fallbackPlan.voices` (`speech-plans.ts:469-474`, et la variante Cartesia → ElevenLabs `:441-457`), LLM `fallbackModels` (`speech-plans.ts:597-599`). Ce qui manque : deux des trois sont DÉSACTIVÉS par défaut (`VOICE_STT_FALLBACK_PROVIDER` et `VOICE_LLM_FALLBACK_MODELS` sont vides, `env.ts:410-413`) ; la bascule est faite par Vapi, donc pas de circuit breaker, pas de sondage en arrière-plan, pas de restauration ; et aucun test d'injection de panne n'existe.
  **Relevé de production (27/08) — deux constats qui aggravent la ligne** : (1) `VOICE_STT_FALLBACK_PROVIDER=deepgram` et `VOICE_LLM_FALLBACK_MODELS=gpt-4o-mini` désignent le MÊME fournisseur que le primaire (Deepgram nova-3 → Deepgram nova-2, OpenAI gpt-4o → OpenAI gpt-4o-mini) : ils couvrent une panne de modèle, jamais la panne de fournisseur que le commentaire de `speech-plans.ts:74-79` dit viser. (2) Le secours LLM n'est **jamais envoyé** : `fallbackModels` est conditionné à `!opts.customLlmUrl` (`speech-plans.ts:597`) alors que custom-LLM est actif par défaut pour toute la flotte (`env.ts:432`). C'est de la configuration morte, et le seul repli réel sur ce chemin est une phrase parlée d'excuse (`llm-stream.service.ts:318`), pas un second modèle.
- **Action** : Basculement automatique de fournisseur sur toute erreur : échec de connexion, timeout, 4xx/5xx, déconnexion en cours de flux. Le fournisseur en échec est marqué indisponible, sondé en arrière-plan, et restauré automatiquement.
- **Pourquoi** : Le patron est documenté et éprouvé (LiveKit FallbackAdapter). Garde-fou indispensable : le TTS ne doit jamais basculer en cours d'énoncé si de l'audio est déjà parti — sinon la phrase sort à deux voix.
- **Critère d'acceptation** : Test d'injection de panne sur chacun des trois étages, en cours d'appel. L'appel survit. Aucune phrase à deux voix.
- **Impact / effort** : fort / moyen

### REL-2 — Une banque d'audio de secours

- **Statut** : `ABSENT`
- **Preuve** : Aucune banque d'audio de secours. `greeting-audio.service.ts` ne stocke QUE des accueils, par client, en MP3, et refuse même de fonctionner hors ElevenLabs (`:57`). Le seul repli parlé est textuel et sur le LLM uniquement (`llm-stream.service.ts:318-322`) : il est synthétisé par le même TTS qui, dans le scénario visé, est justement mort. Aucun chien de garde sur le temps de premier son.
- **Action** : Cinq à dix phrases pré-rendues en PCMA 8 kHz — « un instant s'il vous plaît », « je vous mets en relation » — servies par un chien de garde sur le temps de premier son.
- **Pourquoi** : Aucune plateforme n'offre de repli audio quand le TTS meurt. C'est à construire, et c'est ce qui sépare un appel dégradé d'un appel perdu.
- **Critère d'acceptation** : Test : couper le TTS en plein appel. L'appelant entend une phrase intelligible en moins d'une seconde, puis l'appel est traité en mode dégradé.
- **Impact / effort** : fort / moyen

### REL-3 — Un détecteur de silence

- **Statut** : `DÉJÀ FAIT` (chemin custom-LLM)
- **Preuve** : Le plafond sur le premier token passe de 4 s à **2,5 s** et devient réglable sans déploiement (`VOICE_FIRST_TOKEN_TIMEOUT_MS`, lu à chaque tour dans `llm-stream.service.ts`). Le test demandé existe : il bloque le modèle pour de bon (une promesse qui ne se résout jamais, rejetée sur l'abandon), avance l'horloge à 2,9 s et vérifie que la phrase de secours est DÉJÀ partie (`__tests__/llm-stream.test.ts`). La phrase existe aussi en néerlandais, sans quoi un appelant flamand s'entendait répondre en anglais au moment précis où quelque chose venait de mal se passer.
- **Le compromis, assumé** : un modèle lent mais vivant se fait couper, et l'appelant entend « pouvez-vous répéter ? » au lieu de la vraie réponse. Entre les deux, une phrase de trop vaut mieux qu'un silence de trop.
- **Portée** : le chemin custom-LLM, donc toute la flotte. En parole-à-parole, le garde-temps reste celui de Vapi.
- **Action** : Un silence de l'agent supérieur à 3 secondes déclenche une action, sans attendre le timeout du fournisseur.
- **Pourquoi** : Le silence est le mode d'échec le plus fréquent et le plus dommageable. Personne ne le surveille activement.
- **Critère d'acceptation** : Test : bloquer artificiellement le LLM. Une phrase de secours part avant 3 secondes.
- **Impact / effort** : fort / court

### REL-4 — Détecter les répondeurs sur la jambe sortante

- **Statut** : `ABSENT`
- **Preuve** : Rien ne vérifie qui décroche avant de ponter une urgence : `warmTransferService.destination()` rend une destination et un `transferPlan`, sans aucune détection (`backend/src/services/voice/warm-transfer.service.ts:141-157`). La seule détection de répondeur du dépôt vit sur le robot de PROSPECTION de Qwillio, en prose dans son prompt (`backend/src/services/vapi.service.ts:1112-1131`) et via l'`endedReason` de Vapi après coup (`voice-webhook.controller.ts:195`). Ni l'un ni l'autre ne protège la jambe de transfert.
- **Action** : Avant de transférer une urgence vers le mobile du gérant, vérifier que c'est bien un humain qui décroche.
- **Pourquoi** : Sans cela, l'agent dépose l'urgence dans la boîte vocale du gérant et personne ne le saura jamais. Une détection heuristique classique plafonne à 60–75 % de précision en 3 à 5 secondes ; une approche transcript + classification atteint 94,7 % en 840 ms.
- **Critère d'acceptation** : Test sur 30 appels vers des répondeurs réels et 30 vers des humains. Précision mesurée et consignée.
- **Impact / effort** : fort / moyen

### REL-5 — Sur le doute, considérer que c'est un humain

- **Statut** : `PARTIEL`
- **Preuve** : La règle du doute est désormais ÉCRITE, et elle passe avant toutes les autres : « dans le doute, c'est un HUMAIN », suivie de la raison — les deux erreurs ne coûtent pas la même chose. On ne raccroche plus que sur un signe EXPLICITE (`backend/src/services/voice/machine-detection.ts`, 8 tests).
- **Le marqueur retiré, et pourquoi il était dangereux** : « une réponse trop parfaite, sans hésitation naturelle » figurait parmi les signes d'IA. C'est la description exacte d'une secrétaire expérimentée qui décroche mille fois par jour, c'est-à-dire du prospect le mieux tenu de la liste. Le bloc dit maintenant qu'une voix trop parfaite ne prouve RIEN.
- **Un module, pas deux copies** : la règle vivait en double, une fois en français et une fois en anglais, dans deux fonctions de six cents lignes. Deux copies d'une règle finissent toujours par diverger, et celle-ci décide de qui se fait raccrocher au nez.
- **Ce qui manque** : le critère demande un verdict mesuré à 100 % sur des salutations d'une syllabe, donc des appels réels. Et la règle ne couvre que la jambe SORTANTE : sur le réceptionniste et sur la jambe de transfert, il n'y a toujours rien à trancher, faute de détection.
- **Action** : Sur une énonciation minimale — un mot, un bip, un silence — le verdict par défaut doit être « humain ».
- **Pourquoi** : Le coût des deux erreurs est asymétrique : classer un humain en machine, c'est raccrocher au nez d'un client.
- **Critère d'acceptation** : Test avec des salutations d'une seule syllabe. Verdict = humain dans 100 % des cas.
- **Impact / effort** : fort / court

### REL-6 — Un transfert qui échoue doit rendre la main

- **Statut** : `PARTIEL`
- **Preuve** : L'échec est CONSTATÉ et transformé en rappel : `logTransfer` écrit un `CallTransfer` avec `transferStatus`, `failedReason`, `callbackRequested` et une priorité haute (`backend/src/services/client-call.service.ts:359-401`), alimenté par l'événement `transfer-update` (`voice-webhook.controller.ts:115-123`). Ce qui manque, et c'est le cœur du critère : aucune durée de sonnerie n'est fixée (ni 15-20 s ni autre), l'agent ne reprend PAS la main en cours d'appel, aucune dégradation n'est décidée pendant que l'appelant est là, et rien n'a été testé sur non-réponse / occupé / répondeur.
- **Action** : Sonnerie de 15 à 20 secondes, pas 30. Si personne ne décroche : l'agent reprend l'appelant avec une phrase honnête, puis dégrade — prise de message, SMS au gérant, rappel programmé.
- **Pourquoi** : Le cold transfer est irréversible : la session de l'agent se ferme, l'appelant part ailleurs, et vous ne pouvez plus rien faire. Sur une urgence, c'est inacceptable.
- **Critère d'acceptation** : Test : transférer vers un numéro qui ne répond pas, vers un numéro occupé, vers un répondeur. Dans les trois cas l'agent reprend la main.
- **Impact / effort** : fort / long

### REL-7 — Tracer les codes de cause SIP toi-même

- **Statut** : `ABSENT`
- **Preuve** : Aucun code de cause SIP nulle part. `logTransfer` n'enregistre que nos propres libellés (`initiated` / `completed` / `failed`) et un `event.message.error` de forme libre (`backend/src/services/client-call.service.ts:370-390`). Aucun 486/408/480/603, aucun tableau de bord de tunnel tenté → sonne → décroché → abouti.
- **Action** : 486 occupé, 408 timeout, 480 indisponible, 603 refusé. Les plateformes ne les exposent pas comme variables de branchement — il faut les récupérer côté opérateur.
- **Pourquoi** : Sans eux, vous ne pouvez pas distinguer « il était occupé » de « le numéro est faux », donc pas décider quoi faire ensuite.
- **Critère d'acceptation** : Chaque tentative de transfert est loggée avec son code de cause. Tableau de bord du tunnel : tenté → sonne → décroché → abouti.
- **Impact / effort** : moyen / moyen

### REL-8 — DTMF hors bande uniquement

- **Statut** : `PARTIEL`
- **Preuve** : Le DTMF est désormais reçu, par `keypadInputPlan` (`backend/src/services/voice/speech-plans.ts`, `buildRealtimePlans`) : Vapi remonte les touches comme un message utilisateur fait de chiffres propres, au lieu de laisser le STT transcrire les tonalités comme de la parole — c'est exactement le bug que cette ligne vise. Ce qui reste hors de portée du code d'ici : la négociation SDP elle-même. Le leg SIP appartient à Vapi/Twilio, aucun `telephone-event` ne se déclare depuis ce dépôt, et rien ici ne peut imposer le RFC 4733 ni le repli SIP INFO. Vérifiable seulement sur un appel réel, en lisant le transcript après une séquence de touches.
- **Action** : Négocier le RFC 4733 (`telephone-event/8000`) dans le SDP. Repli SIP INFO si l'opérateur ne le supporte pas. Jamais en bande.
- **Pourquoi** : En bande, le STT transcrit les tonalités comme de la parole et pollue le contexte du LLM. C'est le bug classique.
- **Critère d'acceptation** : Test : envoyer une séquence DTMF pendant que l'agent parle. Elle est reçue comme événement et n'apparaît pas dans le transcript.
- **Impact / effort** : fort / court

### REL-9 — G.711 a-law en Europe

- **Statut** : `ABSENT`
- **Preuve** : Identique à LAT-4 : aucun `PCMA`, `PCMU`, `alaw` ou `ulaw` dans le dépôt, et le SDP est négocié par Vapi/Twilio hors de notre vue. Rien ne permet aujourd'hui d'affirmer ce qui est négocié sur un appel belge, encore moins de l'imposer.
- **Action** : PCMA, pas PCMU. µ-law est nord-américain.
- **Pourquoi** : Forcer µ-law vers un opérateur belge ou français ajoute un transcodage inutile, avec sa latence et sa dégradation.
- **Critère d'acceptation** : Le SDP négocié montre PCMA sur les appels européens.
- **Impact / effort** : moyen / court

### REL-10 — Désactiver la messagerie de l'opérateur avant tout renvoi

- **Statut** : `ABSENT`
- **Preuve** : La procédure de renvoi existe (`frontend/src/pages/client/ClientSetupForwarding.tsx`, codes MMI par type de renvoi) mais ne dit pas un mot de la messagerie de l'opérateur, et la « vérification » est une auto-déclaration du client (`PUT /my-dashboard/settings { forwardingStatus: 'verified' }`, `ClientSetupForwarding.tsx:39`). Pire : le cron quotidien `forwarding-verification` (`backend/src/jobs/bot-loop.ts:847-867`) écrit `forwardingVerifiedAt` APRÈS avoir seulement journalisé le numéro — il ne passe aucun appel. La case « vérifié » est donc fausse par construction.
- **Action** : Sur un renvoi conditionnel, la boîte vocale de l'opérateur capte l'appel avant votre agent si elle est active.
- **Pourquoi** : C'est la cause numéro un de « le renvoi ne marche pas » — et elle coûte des heures de support à chaque installation.
- **Critère d'acceptation** : Étape obligatoire de la procédure d'installation, avec une vérification par appel test.
- **Impact / effort** : fort / court

### REL-11 — Lire les en-têtes Diversion et P-Asserted-Identity

- **Statut** : `PARTIEL`
- **Preuve** : L'en-tête `Diversion` (et `ForwardedFrom`, `X-Original-Called-Number`…) est bien lu, avec plusieurs emplacements parcourus (`backend/src/services/voice/inbound-routing.service.ts:98-132`), mais pour répondre à « QUEL CLIENT a été appelé », pas « QUI appelle » (`resolveClient`, `:153-172`). Le numéro de l'appelant vient toujours de `call.customer.number` seul (`realtime-orchestrator.service.ts:52`). `P-Asserted-Identity` et `Remote-Party-ID` n'apparaissent nulle part. Le commentaire du fichier reconnaît lui-même que la forme du webhook n'a jamais été vérifiée et qu'aucun appel entrant réel n'a été passé — donc zéro opérateur testé sur trois.
- **Action** : Sur un appel renvoyé, la jambe qui arrive chez l'agent peut présenter le numéro du commerce, pas celui de l'appelant.
- **Pourquoi** : Cela casse toute recherche client et tout rappel. À tester dès le premier jour, dans les deux pays, et opérateur par opérateur.
- **Critère d'acceptation** : Le numéro réel de l'appelant est extrait et loggé sur 100 % des appels renvoyés, chez au moins trois opérateurs différents.
- **Impact / effort** : fort / moyen

### REL-12 — Renvoi conditionnel d'abord, portage seulement après preuve

- **Statut** : `PARTIEL`
- **Preuve** : Le produit fait bien du renvoi et rien que du renvoi : la fiche d'installation est entièrement bâtie dessus (`frontend/src/pages/client/ClientSetupForwarding.tsx`), et aucun portage n'est implémenté nulle part. Le séquencement « renvoi pendant l'essai puis portage » est écrit, mais seulement dans les pages de comparaison marketing (`frontend/src/content/comparisons.ts:266` et `:457`). Ce qui manque : nulle part n'est consigné l'avertissement qui compte — l'irréversibilité pratique du portage et le couplage du numéro au pack internet — ni dans une procédure commerciale ni dans la fiche d'installation.
- **Action** : Le renvoi se désactive en trente secondes. Le portage est irréversible en pratique, et le numéro d'un commerce est souvent couplé à son pack internet — le porter peut résilier la ligne.
- **Pourquoi** : Séquence saine pour un commerce : renvoi pendant l'essai, portage quand l'agent a fait ses preuves. Le portage se fait en un jour ouvrable en Belgique comme en France.
- **Critère d'acceptation** : Documenté dans la procédure commerciale et dans la fiche d'installation.
- **Impact / effort** : moyen / court

### REL-13 — Un test d'appel synthétique toutes les cinq minutes

- **Statut** : `ABSENT`
- **Preuve** : Aucune sonde d'appel synthétique : les ~40 crons de `backend/src/jobs/bot-loop.ts` ne placent aucun appel de bout en bout (le seul candidat, `forwarding-verification:847`, ne fait que journaliser). `/api/webhooks/vapi/health` (`voice-webhook.controller.ts:243-259`) ne rend que des compteurs en mémoire, il ne teste rien. Pas de page de statut, et donc pas de règle d'exclusion de facturation à écrire.
- **Action** : Un vrai appel de bout en bout, mesuré, qui vérifie que la chaîne complète répond.
- **Pourquoi** : C'est la seule sonde qui teste ce qui compte. Elle ne doit évidemment jamais être comptée dans la facturation ni les statistiques d'un client.
- **Critère d'acceptation** : Sonde active, résultat publié sur la page de statut, exclue de toute facturation.
- **Impact / effort** : fort / moyen

## LEG — Conformité

*L'article 50 de l'AI Act est applicable depuis le 2 août 2026. Il n'y a pas de période de grâce.*

L'obligation de transparence pèse sur le fournisseur du système d'IA — c'est-à-dire toi, pas ton client. Les sanctions vont jusqu'à 15 millions d'euros ou 3 % du chiffre d'affaires mondial. La Commission a publié ses lignes directrices le 20 juillet 2026 et précise que l'exception « c'est évident pour la personne » doit être interprétée de manière restrictive.

### LEG-1 — Annoncer l'IA dès la première interaction

- **Statut** : `DÉJÀ FAIT`
- **Preuve** : Les trois trous sont bouchés. (1) Le booléen est consigné sur CHAQUE appel (`callSessionStore.setDisclosure`, persisté dans `metadata.realtime.disclosureSpoken`) et une alerte de niveau critique part quand il est faux (`realtime-orchestrator.service.ts`). (2) L'accueil PAR LIGNE ne peut plus remplacer l'annonce : `ensureDisclosure` COMPLÈTE la phrase du client au lieu de l'écarter — il l'a écrite pour cette ligne, et c'est la première seconde de son appel — et n'y touche pas quand elle annonce déjà l'IA. (3) `VOICE_COMPLIANCE_GREETING=off` reste le seul chemin qui peut rendre le booléen faux, et c'est exactement le cas que l'alerte critique nomme. 4 tests de plus dans `__tests__/compliance-disclosure.test.ts`.
- **Le détail qui compte** : la notice d'enregistrement n'est ajoutée que si l'appel est RÉELLEMENT enregistré. Annoncer un enregistrement qui n'a pas lieu est un mensonge de confort, et il se retourne aussi bien qu'une annonce manquante.
- **Action** : De manière claire et distinguable, dès le début. Pas au milieu, pas en petits caractères sur le site.
- **Pourquoi** : Article 50(1) de l'AI Act, applicable depuis le 2 août 2026. L'obligation pèse sur le fournisseur : si tu vends l'agent à un commerçant, c'est toi.
- **Critère d'acceptation** : Un booléen « annonce IA prononcée » est loggé sur chaque appel. Une alerte de niveau critique se déclenche s'il est faux.
- **Impact / effort** : fort / court

### LEG-2 — Annoncer l'enregistrement avant la fin de l'appel

- **Statut** : `PARTIEL`
- **Preuve** : L'annonce d'enregistrement est dans la phrase d'ouverture, et seulement quand l'appel est réellement enregistré (`backend/src/services/voice/system-prompt.ts:372-375`, `shouldRecord` en `realtime-context.service.ts:123`), avec le test des deux sens (`__tests__/compliance-disclosure.test.ts:67-94`) ; l'enregistrement suit la même décision (`realtime-orchestrator.service.ts:181`). Ce qui manque : le droit d'opposition n'est pas praticable PAR L'APPELANT. L'effacement existe mais c'est le CLIENT qui doit l'actionner après coup (`DELETE /my-dashboard/callers/:number`, `backend/src/routes/my-dashboard.routes.ts:152` → `data-retention.service.ts:174-195`), rien ne l'expose à l'appelant pendant l'appel, et il n'est pas testé de bout en bout. Même trou que LEG-1 sur l'accueil de ligne, qui peut faire sauter la notice.
- **Action** : Et prévoir un droit d'opposition praticable.
- **Pourquoi** : La CNIL exige que l'information parvienne à l'interlocuteur avant la fin de l'appel, et interdit l'enregistrement permanent ou systématique hors obligation légale.
- **Critère d'acceptation** : L'annonce est dans la phrase d'ouverture. L'opposition est possible et testée.
- **Impact / effort** : fort / court

### LEG-3 — Une phrase d'ouverture qui coche les trois obligations

- **Statut** : `PARTIEL`
- **Preuve** : Deux obligations sur trois sont tenues dans la phrase d'ouverture (IA + enregistrement, `backend/src/services/voice/system-prompt.ts:372-413`), et « jouée sur 100 % des appels » reste faux tant qu'un accueil de ligne peut la remplacer (voir LEG-1).

  **La seconde moitié du critère est tenue depuis le 09/09 : le mot déclenche réellement un transfert.** Le routeur d'intentions reconnaît la demande d'humain (`intent-router.ts`, `HUMAN_HANDOFF`, trois langues) et `llm-stream.service.ts` appelle lui-même l'outil `transferCall` au lieu de laisser le modèle en décider. C'est le point : la règle TRANSFERT du prompt reste, mais elle n'est plus le seul chemin, et l'éval qui échouait une fois sur deux ne décide plus du sort d'un appelant qui a demandé à partir.
  Deux gardes portent tout le risque. L'outil n'est appelé que s'il est DÉCLARÉ dans la requête : un client sans numéro de transfert, ou dont le numéro boucle vers la réceptionniste, n'a pas cet outil, et le modèle reprend la main pour proposer un message plutôt que de laisser un silence. Et la reconnaissance exige l'ordre verbe → nom en français et en anglais, sans quoi « est-ce que quelqu'un peut passer demain ? » raccrocherait au nez d'un client qui prend rendez-vous ; le néerlandais accepte les deux ordres, son verbe étant rejeté en fin de proposition.
  **Portée exacte** : le chemin custom-LLM, c'est-à-dire toute la flotte (`VOICE_CUSTOM_LLM_DEFAULT` absent donc `true`). En parole-à-parole, le modèle tient la boucle de tour et le routeur n'alimente que les statistiques : là, le transfert dépend encore du prompt.
  Ce qui manque pour lever le `PARTIEL` : la phrase d'accueil ne propose toujours pas la porte de sortie, et LEG-1 empêche encore de dire qu'elle est jouée sur 100 % des appels.
- **Action** : « Bonjour, ici l'assistant vocal automatisé de [commerce]. Cet appel est enregistré pour [finalité]. Dites « conseiller » à tout moment pour parler à une personne. »
- **Pourquoi** : Annonce de l'IA, annonce de l'enregistrement, porte de sortie humaine — en une phrase, dans les cinq premières secondes. Et elle est pré-générée, donc à latence nulle (voir LAT-7).
- **Critère d'acceptation** : La phrase est jouée sur 100 % des appels. Le mot « conseiller » déclenche effectivement un transfert.
- **Impact / effort** : fort / court

### LEG-4 — Purger les enregistrements à six mois

- **Statut** : `PARTIEL`
- **Preuve** : La purge existe, automatique, quotidienne, journalisée, et elle efface l'audio distant chez Vapi avant la ligne locale (`data-retention.service.ts`, cron 04h15).

  **Chaque appel porte désormais sa date limite** (`ClientCall.retainUntil`, migration `20260909150000`), posée à l'ÉCRITURE et non recalculée à chaque passage : « jusqu'à quand gardez-vous cet appel » a maintenant une réponse vérifiable, ce qui est précisément ce que la CNIL demande de pouvoir montrer. La purge efface au PREMIER des deux termes échus, la date posée ou le calcul courant : un client qui RALLONGE sa conservation ne prolonge pas les appels déjà enregistrés, un client qui la RACCOURCIT les efface plus tôt. Les deux vont dans le sens de l'appelant. Un `AND` explicite sépare l'échéance de la forme de la ligne, sans quoi les deux `OR` fondus effaceraient des appels non échus. 3 tests, migration vérifiée sur un vrai Postgres sans dérive.

- **Ce qui reste, et qui n'est pas à moi** : le PLAFOND est toujours à 1825 jours (5 ans, `MAX_RETENTION_DAYS`), au-dessus des six mois CNIL. Le baisser supprimerait des enregistrements chez les clients qui ont réglé plus haut : c'est une décision d'exploitation, pas un correctif, et la règle 7 du plan dit de s'arrêter et de demander. Le corpus de régression que cette ligne vise (TST-5) n'existe toujours pas.
- **Action** : La CNIL plafonne la conservation des enregistrements à six mois, et un an pour les documents d'analyse.
- **Pourquoi** : Cela s'applique aussi à ton corpus de tests de régression, qui est constitué de données personnelles.
- **Critère d'acceptation** : Purge automatique, datée, loggée. Chaque enregistrement porte sa date limite.
- **Impact / effort** : fort / court

### LEG-5 — Permettre de désactiver l'audio et de ne garder que le résumé

- **Statut** : `PARTIEL`
- **Preuve** : Le mode existe et est honoré de bout en bout (`recordCalls` → `shouldRecord` → `recordingEnabled: false` sur l'assistant, notice retirée de l'accueil, compte rendu écrit conservé). Il est désormais ATTEIGNABLE sans écrire de JSON à la main : `PUT /my-dashboard/settings` accepte `recordCalls` au premier niveau (`client-dashboard.controller.ts`).
- **Le défaut trouvé en chemin, et qui dépassait cette ligne** : `vapiConfig` était REMPLACÉ par ce que l'appel envoyait. Tout tient dans ce seul champ — moteur de synthèse du client, chemin custom-LLM, base de connaissances, mode sans enregistrement — donc une omission les effaçait tous, en silence, et personne ne s'en apercevait avant le prochain appel entrant. Il est maintenant FUSIONNÉ, `null` retirant une clé explicitement. C'est le même piège que le PUT partiel documenté dans `CLAUDE.md`, en pire, parce qu'ici un seul champ porte tout. 5 tests.
- **Ce qui manque** : l'écran. Le réglage se pose par l'API, pas encore par une case à cocher dans le portail, et le test de bout en bout du mode (assistant + accueil + compte rendu dans un même parcours) n'existe toujours pas.
- **Action** : Un mode où rien n'est enregistré, seul le compte rendu écrit subsiste.
- **Pourquoi** : Indispensable pour vendre au médical. Et c'est un argument, pas une contrainte.
- **Critère d'acceptation** : Mode disponible par client, testé de bout en bout.
- **Impact / effort** : moyen / moyen

## TST — Tests et observabilité

*Ce qui permet de savoir que ça marche — et de le prouver à un prospect.*

Le meilleur signal neutre du domaine est EVA-Bench : sur douze systèmes évalués, aucun ne dépasse 0,5 simultanément en exactitude et en expérience, et la performance chute jusqu'à 0,314 sous perturbation d'accent et de bruit. L'écart médian entre capacité de pointe et performance fiable est de 0,44. Autrement dit : le mur n'est pas la capacité, c'est la fiabilité.

### TST-1 — Rejouer au niveau du tour, pas de la conversation

- **Statut** : `ABSENT`
- **Preuve** : Le harnais existant est TEXTUEL : `backend/src/evals/run-evals.ts` rejoue des tours écrits à la main contre le vrai prompt et le vrai contrat d'outils, via l'API OpenAI (`run-evals.ts:1-16`, scénarios `evals/scenarios.ts:63-206`). Aucun segment audio n'est figé, aucune transcription n'est assertée, aucune extraction de slot n'est comparée à une vérité terrain. Le rejeu au niveau du tour, au sens de cette ligne, n'existe pas.
- **Action** : Figer un segment audio réel et asserter de façon déterministe : transcription, extraction de slots, décision d'outil.
- **Pourquoi** : Le rejeu d'une conversation entière est une boucle ouverte : dès que la nouvelle version répond différemment, la suite de l'échange devient invalide. Seul le premier tour reste comparable. Aucun outil ne contourne cette limite — c'est la méthode qui doit s'y adapter.
- **Critère d'acceptation** : Suite de régression audio exécutable à chaque commit, sans juge LLM, sur au moins 100 tours réels.
- **Impact / effort** : fort / moyen

### TST-2 — Faire passer tout l'audio de test par G.711 a-law 8 kHz

- **Statut** : `ABSENT`
- **Preuve** : Il n'y a aucun audio dans le harnais de test (voir TST-1), donc rien à faire passer par G.711. Le seul audio produit par le dépôt est un aperçu MP3 à 44,1 kHz (`backend/src/services/voice/cartesia.service.ts:111`), c'est-à-dire exactement le canal qu'on ne verra jamais en production.
- **Action** : Avant injection, systématiquement.
- **Pourquoi** : Tester à 24 kHz revient à tester un canal que tu ne verras jamais en production. Le bruit se comporte très différemment après compression télécom.
- **Critère d'acceptation** : Étape obligatoire du harnais de test, vérifiée automatiquement.
- **Impact / effort** : fort / court

### TST-3 — Mesurer l'exactitude au niveau des entités, pas le WER global

- **Statut** : `ABSENT`
- **Preuve** : Aucune mesure d'exactitude par entité. `backend/src/services/call-intelligence.service.ts` fait extraire des champs par un modèle pour l'usage métier, sans vérité terrain, sans précision ni rappel, et sans tableau de bord par type d'entité. Le WER n'est pas mesuré non plus — il n'y a simplement aucune mesure de transcription.
- **Action** : Nom, numéro, date, adresse, motif d'appel.
- **Pourquoi** : Un taux d'erreur de 12 % qui n'affecte jamais un slot est sans conséquence. Un taux de 4 % qui casse systématiquement les noms de rue est fatal. Le WER mesure ton STT, pas ton agent.
- **Critère d'acceptation** : Tableau de bord par type d'entité, avec précision et rappel.
- **Impact / effort** : fort / moyen

### TST-4 — Calibrer le juge automatique

- **Statut** : `ABSENT`
- **Preuve** : Il n'y a pas de juge à calibrer : les évals utilisent des assertions par expression régulière et par nom d'outil, pas un modèle juge (`backend/src/evals/run-evals.ts`, `evals/scenarios.ts:21-26`). Et là où un modèle JUGE réellement (`call-intelligence.service.ts`, `analytics`), aucun accord avec un étiquetage humain n'est mesuré ni publié.
- **Action** : Étiqueter 100 appels à la main, mesurer l'accord entre le juge et l'étiquetage humain, et republier ce chiffre à chaque changement de modèle de juge.
- **Pourquoi** : Sans cette calibration, les métriques dérivent silencieusement et tu prends des décisions sur du bruit.
- **Critère d'acceptation** : Score d'accord publié, recalculé à chaque changement de juge.
- **Impact / effort** : moyen / moyen

### TST-5 — Construire le corpus de régression stratifié

- **Statut** : `ABSENT`
- **Preuve** : Le « corpus » est de dix scénarios écrits à la main, en texte (`backend/src/evals/scenarios.ts:63-206`) : pas d'axe accent, pas d'axe bruit, pas d'axe issue, aucun sur-échantillonnage des échecs, aucune conservation des escalades et transferts, aucun versionnement conjoint avec le prompt. Aucun audio réel n'est conservé à cette fin.
- **Action** : Croiser intention × langue et accent (français de Belgique, de France, néerlandophone parlant français, anglais approximatif) × niveau de bruit × issue. Sur-échantillonner les échecs. Conserver 100 % des escalades, des transferts et des verdicts de détection incertains.
- **Pourquoi** : 100 à 300 appels suffisent pour démarrer. Il n'existe aucun corpus public de téléphonie francophone ou belge pour ce cas d'usage : c'est un actif propriétaire.
- **Critère d'acceptation** : Corpus versionné avec le prompt — un corpus figé contre un prompt qui bouge ne détecte rien. Rétention alignée sur les six mois de la CNIL.
- **Impact / effort** : fort / long

### TST-6 — Tester l'adversité systématiquement

- **Statut** : `PARTIEL`
- **Preuve** : Un seul des neuf cas est approché, et en texte : un transcript inintelligible (`backend/src/evals/scenarios.ts`, `fr-bruit-interruption`, avec assertion de réponse courte et de non-déclenchement d'outil). L'injection de prompt est couverte à part (`fr-injection-appelant`). Absents : SNR paramétrable (20/10/5/0 dB), accents, interruption injectée à 200/500/1500 ms, double-parole de 1,5 s, silence total, DTMF en cours d'énoncé, raccrochage brutal, changement de sujet en plein remplissage de slots.
- **Action** : Bruit à SNR fixe (20, 10, 5, 0 dB), accents, interruption injectée à 200/500/1500 ms, double-parole superposée 1,5 s, silence total, DTMF en cours d'énoncé, raccrochage brutal en plein tour, changement de sujet au milieu du remplissage de slots.
- **Pourquoi** : Ce sont les neuf modes d'échec réels. Le SNR doit être un paramètre, pas un fichier figé.
- **Critère d'acceptation** : Chaque cas a un test automatisé avec une assertion explicite sur le comportement attendu.
- **Impact / effort** : fort / long

### TST-7 — Instrumenter en spans OpenTelemetry

- **Statut** : `ABSENT`
- **Preuve** : Aucune dépendance OpenTelemetry et aucun span dans le dépôt (grep `opentelemetry`, `otel`, `langfuse` : zéro). L'observabilité se limite à Sentry pour les erreurs (`backend/src/server.ts:18-26`), à des lignes de log, et aux agrégats en mémoire de `voice-metrics.service.ts`. Aucune trace exportable, ni par étage ni par tour.
- **Action** : Conventions GenAI officielles pour les spans LLM et outils, extensions maison préfixées pour STT, TTS, VAD et SIP.
- **Pourquoi** : Les conventions OpenTelemetry ne couvrent pas encore la voix — chaque éditeur invente les siennes. En préfixant proprement, tu resteras compatible avec ce qui sortira.
- **Critère d'acceptation** : Un span par étage et par tour, exportable.
- **Impact / effort** : moyen / moyen

### TST-8 — Alerter sur le taux d'activation des replis

- **Statut** : `ABSENT`
- **Preuve** : Impossible en l'état, et rien ne l'approche : les bascules de secours sont décidées À L'INTÉRIEUR de Vapi à partir des `fallbackPlan` qu'on déclare (`speech-plans.ts:170`, `:469`, `:597`). Aucun événement ne nous en informe, rien ne les compte, donc il n'y a ni taux, ni seuil, ni destinataire d'alerte.
- **Action** : C'est le canari : il monte avant que les clients se plaignent.
- **Pourquoi** : Un fournisseur qui se dégrade se voit d'abord dans le taux de bascule, pas dans les réclamations.
- **Critère d'acceptation** : Alerte configurée, avec seuil et destinataire.
- **Impact / effort** : fort / court

### TST-9 — Suivre l'abandon par index de tour

- **Statut** : `PARTIEL`
- **Preuve** : L'abandon est découpé par index de tour et remonte dans le rapport hebdomadaire (`receptionist-learning.service.ts`, code `abandon_by_turn`) : histogramme tour 1 / 2 / 3 / 4-6 / 7+, le pire tour nommé, et surtout une ACTION différente selon l'endroit où ils partent — au tour 1 ils n'ont entendu que l'accueil, aux tours 2-3 la première réponse n'a pas suffi, plus tard c'est la prise de rendez-vous qui les perd. Confondre les trois est précisément ce qui rend un taux global inexploitable. 5 tests.
- **Le choix qui protège le rapport** : la liste des issues « sans résultat » est POSITIVE (`missed`, `other`, ou rien). Compter comme abandon « tout ce qui n'est pas un succès » ferait crier au loup dès qu'une issue nouvelle apparaîtrait dans le vocabulaire, et un rapport hebdomadaire qui se trompe une fois est un rapport qu'on cesse de lire.
- **Ce qui manque** : l'histogramme n'est pas AFFICHÉ dans le tableau de bord, il est écrit dans le rapport hebdomadaire. Et il n'a encore rien à décrire : aucun appel entrant réel.
- **Action** : Un abandon au tour 1 et un abandon au tour 7 n'ont pas les mêmes causes.
- **Pourquoi** : Le taux d'abandon global ne dit rien d'exploitable. Découpé par tour, il pointe directement l'endroit où l'agent perd les gens.
- **Critère d'acceptation** : Histogramme dans le tableau de bord, revu chaque semaine.
- **Impact / effort** : moyen / court

### TST-10 — Adopter un harnais d'évaluation gratuit

- **Statut** : `PARTIEL`
- **Preuve** : Un harnais existe, il est gratuit, il tourne à chaque intégration continue : `npm run evals` dans `.github/workflows/ci.yml:54-58`, avec assertions sur le texte ET sur les appels d'outils (`backend/src/evals/run-evals.ts`, `evals/scenarios.ts:21-26`). Il tourne RÉELLEMENT : le log du run CI #576 montre `OPENAI_API_KEY: ***` puis les onze scénarios joués un à un contre gpt-4o, « [evals] 11/11 scénarios verts » (le secret est donc bien posé sur le dépôt, et l'étape verte signifie quelque chose). Les 893 tests unitaires passent au même run.
  Ce n'est pas Pipecat Evals et il lui manque tout ce qui fait la valeur citée : pas de mode audio, aucune assertion de latence, aucune injection d'interruption à un offset précis. Reste aussi un défaut de garde : `EVALS_REQUIRE_KEY` est commenté (`ci.yml:56`), donc le jour où le secret disparaîtrait, l'étape redeviendrait verte en silence.
- **Action** : Pipecat Evals est open source, avec un mode texte qui court en quelques secondes sans coût de service audio, et un mode audio complet. Assertions sur le texte, sur les appels d'outils avec leurs arguments, sur la latence, et injection d'interruption à un offset précis.
- **Pourquoi** : C'est le seul mécanisme déterministe de test de barge-in que j'aie trouvé, et il est gratuit.
- **Critère d'acceptation** : Suite d'évaluation lancée à chaque release, comme le fait le projet lui-même sur plus de 100 agents d'exemple.
- **Impact / effort** : fort / moyen

---

## Journal

| Date | Ligne | De → vers | Commit | Note |
|---|---|---|---|---|
| 2026-09-09 | TUR-3 | preuve complétée, reste `PARTIEL` | `claude/optimisations-audit-vocal-68tgg2` | Le silence toléré après un chiffre passe de 0,5 s à 1 s: un numéro dicté en groupes espacés de 800 ms n'est plus coupé au milieu. La table slot → seuil complète demanderait de tenir la boucle de tour nous-mêmes. |
| 2026-09-09 | LEG-5 | preuve complétée, reste `PARTIEL` | `claude/optimisations-audit-vocal-68tgg2` | Le mode sans enregistrement s'active par l'API. Et `vapiConfig` est fusionné au lieu d'être remplacé: le remplacement effaçait en silence tous les réglages absents de l'appel. |
| 2026-09-09 | LEG-1 | `PARTIEL` → `DÉJÀ FAIT` | `claude/optimisations-audit-vocal-68tgg2` | Un accueil de ligne en texte libre ne peut plus faire sauter l'annonce IA: il est complété, pas écarté. Booléen consigné par appel et alerte critique s'il est faux. |
| 2026-09-09 | TST-9 | `ABSENT` → `PARTIEL` | `claude/optimisations-audit-vocal-68tgg2` | Abandon découpé par index de tour dans le rapport hebdomadaire, avec une action différente selon l'endroit où l'appelant part. Reste l'affichage au tableau de bord, et des appels à décrire. |
| 2026-09-09 | REL-5 | preuve complétée, reste `PARTIEL` | `claude/optimisations-audit-vocal-68tgg2` | « Dans le doute, c'est un humain » écrit en tête du bloc de détection, marqueur « voix trop parfaite » retiré (c'est la description d'une secrétaire expérimentée), et la règle sort des deux prompts pour vivre dans un seul module. |
| 2026-09-09 | LEG-4 | preuve complétée, reste `PARTIEL` | `claude/optimisations-audit-vocal-68tgg2` | Chaque appel porte sa date limite, posée à l'écriture; la purge efface au premier des deux termes échus. Le plafond à cinq ans reste une décision à prendre, pas un correctif. |
| 2026-09-09 | REL-3 | `PARTIEL` → `DÉJÀ FAIT` | `claude/optimisations-audit-vocal-68tgg2` | Le plafond sur le premier token descend de 4 s à 2,5 s, réglable, et un test bloque le modèle pour vérifier que la phrase de secours part avant trois secondes. Phrase de secours ajoutée en néerlandais. |
| 2026-09-09 | TUR-7, TUR-10 | preuve complétée, restent `PARTIEL` | `claude/optimisations-audit-vocal-68tgg2` | Mots d'arrêt et acquiescements réglables par client puis par environnement, dédoublonnés (Vapi refuse l'assistant entier sur une répétition) et jamais vides. Les deux critères demandent une mesure sur appel réel. |
| 2026-09-09 | BEL-12 | preuve complétée, reste `PARTIEL` | `claude/optimisations-audit-vocal-68tgg2` | Normaliseur de sortie écrit et testé (30 numéros, 20 adresses), vérifié par aller-retour contre le lecteur de BEL-1. Le flux du modèle n'est pas encore normalisé : ce chemin porte la latence, et aucune mesure n'existe pour arbitrer. |
| 2026-09-09 | BEL-1, BEL-2, BEL-3, BEL-8 | `ABSENT` → `DÉJÀ FAIT` | `claude/optimisations-audit-vocal-68tgg2` | La chaîne complète du numéro dicté : « septante-cinq » lu en chiffres, gabarits belges par libphonenumber (métadonnée complète, pas réduite), validation avant écriture avec relance, et les belgicismes appris au modèle. Aucun numéro dicté n'était capté nulle part avant. |
| 2026-09-09 | LEG-3 | reste `PARTIEL`, le mot déclenche le transfert | `claude/optimisations-audit-vocal-68tgg2` | Le routeur reconnaît la demande d'humain en trois langues et le chemin custom-LLM appelle `transferCall` lui-même, au lieu de s'en remettre au modèle. Reste la phrase d'accueil, qui ne propose pas encore la porte de sortie. |
| 2026-09-09 | LAT-9 | reste `PARTIEL`, la fenêtre survit aux déploiements | `claude/optimisations-audit-vocal-68tgg2` | L'agrégat de latence repartait de zéro à chaque redéploiement alors que chaque appel avait écrit sa mesure en base. `hydrate()` reprend la fenêtre au démarrage et la date du premier appel relu. Restent le tableau de bord et un destinataire pour l'alerte p95. |
| 2026-09-09 | LAT-7 | reste `PARTIEL`, défaut de production corrigé | `claude/optimisations-audit-vocal-68tgg2` | L'accueil pré-enregistré suivait ElevenLabs seul (éteint depuis la bascule Cartesia) et servait quand même les lignes de l'ancienne voix. Chaque ligne porte désormais sa signature vocale, la lecture écarte ce qui ne correspond pas, et `npm run voice:greetings` refait la flotte. Le critère (dix phrases, PCMA 8 kHz, TTFA 0 ms) demande toujours un appel réel. |
| 2026-08-27 | LAT-3, BEL-10 | preuve complétée | — | `CARTESIA_VOICES` relevée : identifiant unique sans deux-points, donc forme « couverture ». La bascule Cartesia prend (sonic-3.5), et la même couverture neutralise `VAPI_VOICE_ID_BE` ainsi que le choix de personnage. |
| 2026-08-27 | LAT-3, LAT-6, LAT-7, TUR-5, REL-1, LEG-1 | preuve complétée | — | Valeurs de production relevées sur Render : `VOICE_TTS_PROVIDER=cartesia`, `VOICE_STT_FALLBACK_PROVIDER=deepgram`, `VOICE_LLM_FALLBACK_MODELS=gpt-4o-mini`, `VOICE_REALTIME_MODEL=gpt-realtime-2.1`. Toutes les autres `VOICE_*` sont absentes, donc aux défauts du code. Aucun statut ne change, mais LAT-7 est éteint en production et le secours LLM de REL-1 n'est jamais envoyé. |
| 2026-08-26 | les 63 | `À AUDITER` → statut motivé | audit `claude/optimisations-audit-vocal-68tgg2` | Audit de lecture seule. Aucun code écrit. Décompte : 1 `DÉJÀ FAIT`, 29 `PARTIEL`, 31 `ABSENT`, 2 `NON APPLICABLE`. Rappel de méthode : tout critère qui exige une MESURE sur appels réels reste hors d'atteinte tant que `fleetMetrics` affiche `calls: 0`. |
