# ETAT-DE-LART-2026.md — ce qui a bougé, et ce qui mérite d'être adopté

Recherche refaite à neuf le **13/08/2026**, comparée au code de `master`
(`1de6575`, post-PR #133). Chaque recommandation porte son impact, son effort et
la variable d'environnement qui permet de la tenter puis de revenir en arrière.

**Règle appliquée** : les choix délibérés documentés dans le code (endpointing FR
sur `vapi`, NL sur `nova-2`, pas de pgvector) ne sont remis en cause **qu'avec
une preuve chiffrée**. Deux le sont, un est au contraire **confirmé** par la
recherche.

---

## Ce que le dépôt utilise aujourd'hui

| Étage | Valeur | Source |
|---|---|---|
| Speech-to-speech (défaut) | `gpt-realtime-2025-08-28` | `env.ts:97` |
| LLM en cascade | `gpt-4o` | `env.ts:38` |
| STT | Deepgram `nova-3` (fr/en), `nova-2` (nl) | `speech-plans.ts:34` |
| TTS | ElevenLabs `eleven_flash_v2_5` | `speech-plans.ts:173` |
| Fin de tour | `vapi` (fr/nl), `livekit` (en) | `speech-plans.ts:106-109` |
| RAG | hybride sémantique/lexical en mémoire, pas de pgvector | `knowledge-embeddings.service.ts:20-22` |

---

## 1. Conformité — la vraie urgence, et elle date de deux jours

### 1.1 Bloctel n'existe plus. La roadmap vise une cible morte.

`ROADMAP.md` niveau 3, lot 2, prévoit « préparation Bloctel (l'abonnement est
externe) ». **Cette ligne est caduque.**

En application de la loi n° 2025-594 du 30 juin 2025, **Bloctel a cessé son
activité le 11 août 2026** — avant-hier. À cette date, le démarchage
téléphonique non sollicité devient **interdit par défaut, tous secteurs
confondus**, sauf consentement préalable ou appel relatif à un contrat en cours
d'exécution. Le régime bascule de l'opt-out (liste d'opposition) vers
**l'opt-in**.

Le consentement y est défini strictement : manifestation de volonté **libre,
spécifique, éclairée, univoque et révocable**, par un acte positif clair, et
**c'est au professionnel d'apporter la preuve** de sa collecte.

**Conséquences concrètes :**

- Construire un connecteur Bloctel serait construire contre un système éteint.
  À supprimer de la roadmap.
- Le modèle `CallConsent` prévu au lot 2 n'est plus une amélioration : il
  devient **le seul mécanisme légal d'appel sortant en France**. Sa priorité
  monte.
- La charge de la preuve étant sur nous, `CallConsent` doit stocker non pas un
  booléen mais **l'origine, la date, le libellé exact accepté et la révocation**.
  L'opt-out verbal déjà livré (`utils/call-optout.ts:34`) devient le canal de
  révocation : il est nécessaire, il n'est pas suffisant.
- **Point à trancher avec un juriste, que je ne peux pas trancher ici** : les
  textes visent le « consommateur ». Le ciblage de Qwillio est B2B (prospects
  scrapés Google Maps = entreprises), ce qui semble hors champ direct. Mais
  « entreprise » inclut l'artisan et le professionnel en nom propre, dont la
  ligne est souvent personnelle. **Hypothèse retenue faute de conseil : traiter
  l'outbound FR comme soumis à l'opt-in.** C'est le seul choix qui reste valable
  si l'avis juridique dit oui.

### 1.2 Belgique : toujours l'opt-out, ne pas calquer sur la France

La Belgique conserve la liste **« Ne m'appelez plus ! »** : le démarchage y est
autorisé sauf opposition expresse. **Les deux pays divergent donc désormais**,
et un moteur outbound unique appliquant une seule règle sera soit illégal en
France, soit inutilement bridé en Belgique. La règle doit être **par pays**.

### 1.3 AI Act art. 50 : le dépôt est en règle, et le calendrier s'est figé

Les obligations s'appliquent depuis le **2 août 2026**. La Commission a publié
ses **lignes directrices définitives sur l'article 50 le 20 juillet 2026**
(projet du 8 mai), accompagnées d'un **code de bonnes pratiques sur le marquage
des contenus générés, finalisé le 10 juin 2026**.

Le code de Qwillio satisfait l'exigence de fond : la divulgation est portée par
la **première phrase**, avant toute collecte (`system-prompt.ts:297-318`), avec
un défaut fail-safe (`env.ts:133`). **Rien à changer.** À faire, en revanche :
relire les lignes directrices du 20/07 pour vérifier qu'aucune exigence de
forme (formulation type, moment, traçabilité de la divulgation) n'appelle un
ajustement. C'est une lecture, pas un chantier.

---

## 2. Modèles — deux retards d'une ligne d'environnement chacun

### 2.1 Le modèle realtime a deux générations de retard

Le défaut est `gpt-realtime-2025-08-28`. Depuis :

- **GPT-Realtime-2** (7 mai 2026) : raisonnement de classe GPT-5 en
  speech-to-speech, 96,6 % sur Big Bench Audio, contexte 128K, effort de
  raisonnement ajustable.
- **gpt-realtime-2.1** et **2.1-mini** (6 juillet 2026) : raisonnement
  configurable et usage d'outils en speech-to-speech basse latence.
- **Prix en baisse de 20 %** : ~0,05 $/minute de conversation sur la 2.1, et
  ~0,016 $ sur le mini.

C'est le meilleur rapport gain/effort du document : **une variable
d'environnement** (`VOICE_REALTIME_MODEL`), un retour arrière immédiat, et
`fleetMetrics` expose déjà `cost` pour mesurer l'effet. Le `mini` mérite un test
sérieux sur les appels simples : à 0,016 $/min il change la marge par client,
qui est aujourd'hui inconnue (cf. AUDIT §D).

**Réserve honnête** : OpenAI ne publie pas de latence P90 bout-en-bout, donc le
gain de latence ne se saura qu'en mesurant nos propres appels. D'où l'ordre :
passer les appels du protocole d'abord (établir la référence), changer le modèle
ensuite.

### 2.2 La cascade tourne encore sur `gpt-4o`

Même raisonnement, même facilité (`VAPI_MODEL`). À ne toucher qu'**après** avoir
fait tourner les évals, qui existent précisément pour ça : c'est le premier
changement de prompt-critique qu'elles doivent garder.

---

## 3. STT — le point où le code demandait lui-même une mesure

Le code documente son propre doute : le NL tourne sur `nova-2` parce que
`nova-3` est « documenté anglais d'abord », et le commentaire appelle « un WER
mesuré sur de vrais appels flamands » (`speech-plans.ts:30-33`).

La recherche apporte un candidat que le commentaire n'envisageait pas :
**ElevenLabs Scribe v2 Realtime** (lancé le 9 janvier 2026) affiche **le WER le
plus bas de tous les modèles ASR basse latence sur FLEURS**, sur 30 langues,
devant Whisper, Gemini Flash, Amazon Transcribe et Deepgram. Le **néerlandais
et le français** figurent tous deux dans le palier « Excellent » (≤ 5 % d'erreur).
En comparaison de référence, Scribe v2 est mesuré à 2,2 % contre 5,2 % pour
Deepgram Nova-3.

Trois raisons d'y regarder de près :

1. Le NL est le point faible connu et assumé de la chaîne.
2. **ElevenLabs est déjà fournisseur** (TTS) : pas de nouveau contrat, pas de
   nouveau DPA, pas de nouveau secret à gérer.
3. Le mécanisme d'essai existe déjà : `VOICE_STT_FALLBACK_PROVIDER`
   (`speech-plans.ts:59-67`) permet de le déclarer en **secours** avant d'en
   faire un primaire. C'est le chemin à faible risque.

**Nuance** : ces chiffres viennent de FLEURS (lecture propre), pas d'appels
téléphoniques bruités en 8 kHz. Ils justifient un test, pas une bascule.

---

## 4. Fin de tour — la preuve demandée par le code existe maintenant

Le code garde le FR sur `provider: 'vapi'` et documente pourquoi : le modèle
LiveKit historique était anglophone, et le FR tournait dessus par erreur, ce qui
« coupait la parole ou laissait un blanc ». Le flag
`VOICE_FR_ENDPOINTING_PROVIDER=livekit` a été laissé exprès pour valider le
nouveau modèle multilingue.

**Les chiffres sont désormais publiés** : le modèle multilingue LiveKit couvre
14 langues dont le **français et le néerlandais**, avec un taux de vrais positifs
de **99,3 %** pour les deux, et un taux de vrais négatifs de **84,9 % en
français** contre **73,4 % en néerlandais**. Empreinte ~400 Mo, inférence ~25 ms.

Lecture pour nous :

- **Français : le test est justifié.** 84,9 % de vrais négatifs, c'est un modèle
  qui reconnaît correctement une phrase inachevée dans 5 cas sur 6.
- **Néerlandais : garder `vapi`.** À 73,4 %, un quart des phrases inachevées
  seraient prises pour finies : c'est exactement le défaut « elle me coupe ».
  Le choix du code reste le bon pour le NL, et le document le confirme.
- **Vérification préalable indispensable** : les chiffres ci-dessus décrivent le
  modèle de LiveKit dans son propre SDK. Rien ne garantit que
  `smartEndpointingPlan: { provider: 'livekit' }` **chez Vapi** pointe vers le
  modèle multilingue plutôt que vers l'ancien anglophone. À confirmer auprès de
  Vapi **avant** de poser le flag, sinon on rejoue le bug d'origine.
- Le modèle s'appuie sur la langue rapportée par le STT pour choisir son seuil :
  un STT muet sur la langue dégrade le détecteur.

---

## 5. RAG voix — le choix « pas de pgvector » est confirmé, pas toléré

L'audit classait l'absence de pgvector en réserve assumée. La recherche 2026 va
plus loin : elle en fait un **bon choix**.

Le budget de latence d'un tour de parole est de l'ordre de **200 ms**, or une
requête vers une base vectorielle de production coûte **50 à 300 ms** de
round-trip réseau : à elle seule, elle peut consommer tout le budget. D'où deux
directions dominantes en 2026, aucune des deux n'étant « ajouter pgvector » :

- **Récupération lexicale rapide** : un BM25 avec expansion de graphe atteint la
  sous-milliseconde **sans base vectorielle**. C'est, à peu de choses près, la
  moitié lexicale de ce que fait déjà `business-memory.service.ts`.
- **Cache sémantique et préchargement prédictif** : l'architecture
  « Fast Talker / Slow Thinker » de Salesforce (VoiceAgentRAG, mars 2026)
  atteint 75 % de taux de succès de cache (95 % sur conversation cohérente) et
  un facteur **316×** sur la récupération en cas de succès (110 ms → 0,35 ms),
  en préchargeant pendant les pauses naturelles à partir des 6 derniers tours.

**Ce pattern existe déjà dans le dépôt**, appliqué à un autre problème :
`availability-speculator.ts` précharge les disponibilités calendrier pendant que
l'appelant parle. L'étendre à la base de connaissance est une extension
naturelle, pas une réécriture. À garder pour quand la KB sera réellement
remplie (donc après l'étape 4.1).

---

## 6. Évals — garder le harness maison, corriger son défaut

Le marché s'est structuré : **Coval** (simulation d'appelants synthétiques à
grande échelle, méthodologie héritée du test de véhicules autonomes Waymo) et
**Cekura** (génération automatique de cas de test, serveur MCP pour l'IDE). Une
étude académique indépendante les note **48,9 pour Coval** contre **43,0 pour
Cekura** sur sa mesure de justesse d'évaluation.

**Recommandation : ne pas acheter maintenant.** Le harness maison teste la
couche qu'on possède (le prompt et le contrat d'outils) sur 9 scénarios ciblés,
pour quelques centimes. Un outil de simulation se justifie quand le nombre de
scénarios dépasse ce qu'on écrit à la main, ce qui n'est pas le cas.

**En revanche, corriger le défaut identifié au ré-audit est urgent et gratuit** :
sans `OPENAI_API_KEY`, `run-evals.ts:133-136` sort en **0**. Un CI qui embarque
les évals sans la clé est vert sans rien avoir testé. Il faut un mode strict
(`EVALS_REQUIRE_KEY=1` ou équivalent) qui **échoue** si la clé manque.

---

## 7. MCP — la porte est ouverte côté Vapi

L'audit relevait « MCP : zéro hit repo-wide ». Entre-temps, **Vapi supporte MCP
nativement** : un assistant peut consommer dynamiquement les outils d'un serveur
MCP pendant l'appel, Vapi prenant en charge le JSON-RPC sur HTTP/2, la
validation de schéma et les reprises.

Intérêt réel mais **pas prioritaire** : les 6 outils actuels sont écrits,
testés, et couverts par les évals. MCP devient intéressant le jour où un client
veut brancher **son** outillage (Odoo, HubSpot) sans qu'on écrive un connecteur.
À garder au chaud pour le lot intégrations.

---

## Tableau de décision

| # | Action | Impact | Effort | Levier |
|---|---|---|---|---|
| 1 | Réécrire le lot outbound : supprimer Bloctel, `CallConsent` avec preuve (origine, date, libellé, révocation), règle **par pays** | **Critique** (légal FR depuis le 11/08) | S (roadmap) + M (modèle) | — |
| 2 | Faire échouer les évals sans clé | Élevé (le filet est troué) | S | `EVALS_REQUIRE_KEY` |
| 3 | Passer `VOICE_REALTIME_MODEL` en `gpt-realtime-2.1`, tester le `mini` | Élevé (qualité + 20 % de coût) | S | env, réversible |
| 4 | Tester Scribe v2 Realtime en **secours** STT, mesurer le WER NL | Élevé sur le NL | S (déclarer) + M (mesurer) | `VOICE_STT_FALLBACK_PROVIDER` |
| 5 | Confirmer auprès de Vapi ce que vaut `provider: 'livekit'`, puis tester le FR | Moyen (perception « robot ») | S | `VOICE_FR_ENDPOINTING_PROVIDER` |
| 6 | Poser les variables de secours STT/LLM sur Render | Élevé (le SPOF est encore ouvert) | S | env |
| 7 | Relire les lignes directrices art. 50 du 20/07 | Moyen (forme) | S | — |
| 8 | `VAPI_MODEL` vers un modèle de classe GPT-5, **après** évals vertes | Moyen | S | env |
| 9 | Cache sémantique + préchargement KB (pattern `availability-speculator`) | Moyen, **après** l'étape 4.1 | M | — |
| 10 | MCP côté Vapi | Faible aujourd'hui | M | — |
| — | ~~pgvector~~ | **Ne pas faire** : la recherche 2026 confirme le choix actuel | — | — |

**Ordre recommandé** : 1 et 2 tout de suite (l'un est légal, l'autre rend tous
les autres tests fiables), puis 6, puis les appels réels du protocole pour
établir la référence de latence, **et seulement ensuite** 3, 4 et 5, qui doivent
se mesurer contre cette référence.

---

## Sources

- [LiveKit turn detector plugin — docs](https://docs.livekit.io/agents/build/turns/turn-detector/) · [modèle sur Hugging Face](https://huggingface.co/livekit/turn-detector)
- [ElevenLabs Scribe v2 — guide et benchmarks 2026](https://elevenlabsmagazine.com/elevenlabs-scribe-v2-speech-to-text-guide-2026/) · [Coval — benchmarks STT indépendants](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)
- [OpenAI — gpt-realtime et mises à jour Realtime API](https://openai.com/index/introducing-gpt-realtime/) · [gpt-realtime-2.1](https://mer.vin/2026/07/gpt-realtime-2-1-api-reasoning-voice-agents-and-mini-pricing/)
- [Commission européenne — lignes directrices art. 50](https://www.nicfab.eu/en/posts/ai-act-art50-guidelines/) · [Article 50 — texte](https://artificialintelligenceact.eu/article/50/) · [code de bonnes pratiques (Bird & Bird)](https://www.twobirds.com/en/insights/2026/taking-the-eu-ai-act-to-practice-understanding-the-draft-transparency-code-of-practice)
- [DGCCRF — démarchage interdit sans consentement](https://www.economie.gouv.fr/dgccrf/actualites-dgccrf/le-demarchage-telephonique-desormais-interdit-si-vous-ny-avez-pas-consenti) · [Légifrance — art. L223-1 à L223-7 au 11/08/2026](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032221441/2026-08-11) · [Bloctel](https://fr.wikipedia.org/wiki/Bloctel)
- [Belgique — liste « Ne m'appelez plus ! »](https://aide-sociale.be/liste-ne-mappelez-plus/) · [comparaison FR/BE (L'Avenir, 12/08/2026)](https://www.lavenir.net/actu/belgique/politique/2026/08/12/la-france-vient-dadopter-une-loi-pour-controler-davantage-le-demarchage-telephonique-quen-est-il-de-la-belgique-2FPKUFYNCRFELGVMTCN7ZEVUAI/)
- [VoiceAgentRAG (Salesforce, arXiv 2603.02206)](https://arxiv.org/html/2603.02206v1) · [analyse MarkTechPost](https://www.marktechpost.com/2026/03/30/salesforce-ai-research-releases-voiceagentrag-a-dual-agent-memory-router-that-cuts-voice-rag-retrieval-latency-by-316x/)
- [Coval vs Cekura](https://www.coval.ai/blog/coval-vs-cekura) · [Vapi — intégration MCP](https://docs.vapi.ai/tools/mcp)
