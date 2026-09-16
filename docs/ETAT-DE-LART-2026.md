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

**Corrigé le 16/09/2026 contre `voice:doctor`, qui lit l'assistant DISTANT.**
Trois lignes de ce tableau décrivaient un état qui n'existait plus, et un
document d'état de l'art faux coûte plus cher qu'un document absent
(6sexvicies).

| Étage | Valeur | Source |
|---|---|---|
| Niveau vendu | `base` (classique) ou `superagent` (parole-à-parole) | `voice-tiers.ts` |
| Speech-to-speech | `gpt-realtime-2025-08-28`, **éteint par défaut** | `env.ts:472`, `env.ts:533` |
| LLM en cascade | **`gpt-4.1-mini`** par l'env de Render (le défaut du code est encore `gpt-4o`) | `env.ts:38`, relevé au docteur |
| Boucle de tour | **custom-LLM**: notre backend choisit le modèle à chaque tour | `env.ts:639`, `llm-stream.service.ts` |
| STT | Deepgram `nova-3` (fr/en), `nova-2` (nl) | `speech-plans.ts:36` |
| TTS | **Cartesia `sonic-3.5`** (ElevenLabs `eleven_turbo_v2_5` en repli) | `env.ts:430`, `env.ts:403` |
| Fin de tour | **`livekit`** sur l'assistant qui décroche, attente 0,4 s, ponctuation 0,4 s | relevé au docteur |
| RAG | hybride sémantique/lexical en mémoire, pas de pgvector | `knowledge-embeddings.service.ts:20-22` |

### Ce que deux appels réels ont mesuré (16/09/2026)

Premier relevé complet par étage, sur `voice:audit`. Il faut le lire avant toute
décision d'architecture :

| Étage | Mesuré | Cible | Lecture |
|---|---|---|---|
| PREP (notre serveur) | médiane **1 ms** | 150 ms | rien à gagner |
| LLM (OpenAI seul) | médiane **1073 ms** | 900 ms | dépassement modeste |
| Cache de préfixe | **76 %** | ≥ 40 % | la correction du 16/09 a marché |
| TTFA (premier son) | médiane **318 ms** | 700 ms | large marge |
| **TOTAL** | médiane **1620 ms** | 2000 ms | **dans la médiane de l'industrie** |
| Délai ressenti (horloge Vapi) | médiane 2,2 s | 2 s | TOTAL + détection de fin de tour |
| Durée des outils | 2,4 à **9,4 s** | 1,5 s | **le vrai goulot** |

**Conclusion qui renverse l'hypothèse de départ** : la chaîne classique n'est
pas mal réglée, elle est dans les clous de sa propre catégorie. Ce qui a rendu
ces appels pénibles, ce sont les outils (neuf appels en boucle) et trois défauts
fonctionnels, pas la latence de conversation. Voir CLAUDE.md, 6sexquadragesies.

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

**Relecture faite le 13/08. Conclusion : rien à changer, et sur un point nous
dépassons l'exigence.** Confrontation point par point :

| Exigence de l'article 50(1) | Ce que fait Qwillio |
|---|---|
| Divulgation **au plus tard lors de la première interaction** | Portée par la **première phrase** du décroché, avant toute collecte (`system-prompt.ts:297-318`). Plus strict que le texte |
| **Manière claire et distinguable** ; les lignes directrices visent les mentions minuscules ou noyées dans les CGU | Phrase parlée, en clair, au même volume que le reste. L'équivalent vocal du défaut visé n'existe pas ici |
| Exemption « évident pour une personne raisonnablement informée » | **Non invoquée**, et c'est heureux : les lignes directrices mettent en garde contre le fait de s'y fier |
| Conservation d'une preuve de divulgation | **Aucune exigence** dans le texte. Rien à construire |

Un point que la relecture a permis de vérifier et qui n'était pas acquis : la
**démo publique du site est couverte elle aussi**, et elle est conforme **par
construction**. `public-demo.routes.ts:157` appelle `firstMessageVariants`, la
même fonction que les appels réels : les deux chemins ne peuvent pas diverger.
Et `recordCalls: false` fait que la notice d'enregistrement ne s'y prononce
pas, ce qui est correct puisque rien n'y est enregistré.

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

## 2 bis. Le SIP natif d'OpenAI, et pourquoi ce n'est pas la réponse aujourd'hui

**Le fait nouveau** (recherche du 16/09/2026) : l'API Realtime d'OpenAI accepte
désormais un **trunk SIP direct**. Un opérateur (Twilio) compose vers un point
d'entrée hébergé par OpenAI, sans serveur de téléphonie au milieu, **250 à
350 ms bout en bout**. L'appel se pilote sur un websocket
(`wss://api.openai.com/v1/realtime?call_id=...`) avec des verbes de première
classe : `reject`, `refer` (transfert vers un humain) et `hangup`.

C'est la latence la plus basse qui existe, et ça supprime la marge de
l'intermédiaire : le tableau de bord Vapi facture 0,645 $/min pour
`gpt-realtime-2` là où la tarification OpenAI donne ~0,05 $/min. L'écart entre
les deux chiffres, qui semblait une erreur de lecture, est la marge de Vapi sur
le modèle temps réel.

**Pourquoi ce n'est pas la réponse maintenant**, et c'est la mesure qui le dit :

1. **Le SIP sert la latence, et la latence va déjà bien** (TOTAL 1620 ms, dans
   la médiane de l'industrie). Ce qui a duré sur les appels réels, ce sont les
   outils à 2,4-9,4 s, que le SIP ne touche pas.
2. **Les trois défauts fonctionnels du 16/09 voyageraient tels quels** : la
   phrase d'attente qui ment est NOTRE chaîne (et le mécanisme de filler
   n'existe même pas en SIP, il serait à construire) ; la boucle d'outil est du
   modèle plus notre texte de retour ; l'affirmation contre un retour d'outil
   est de la discipline de modèle. Zéro sur trois, et le parole-à-parole est
   justement le terrain où l'appel d'outils est le plus faible, ce qu'OpenAI dit
   lui-même en positionnant son modèle complet pour « le meilleur usage
   d'outils ».
3. **La production 2026 reste majoritairement en cascade**, et pas par
   conservatisme : pour la fiabilité de l'appel d'outils et pour
   l'observabilité.
4. **Coût caché, relevé en écrivant ceci** : le traqueur de latence par étage se
   nourrit des webhooks `speech-update` de Vapi. Partir en SIP, c'est perdre la
   mesure le jour où elle commence enfin à dire quelque chose.

`VOICE-NEXT-GEN.md` avait écarté « le transport audio propre » à raison, mais
contre une autre proposition (Twilio Media Streams, qu'il aurait fallu
construire). Le SIP natif n'a pas de pipeline média à écrire : la décision est
**déplacée**, pas renversée.

**Deux conditions pour rouvrir** : les défauts fonctionnels corrigés et un appel
propre qui tient ; et une cible réelle sous 600 ms dont on a mesuré que la
cascade ne peut pas l'atteindre. Ce sera alors un prototype sur UNE ligne, en
parallèle de la production, jamais une migration.

---

## 2 ter. Ce qui fait « humain », et où nous en sommes

La recherche converge sur quatre choses, dans cet ordre : la **prosodie**, une
réponse **sous 600 ms**, l'**interruption** qui marche, et le **backchannel**
(les « mm-hmm » pendant que l'autre parle). Le point de référence humain est un
écart de **200 ms** entre deux tours.

| Pilier | Chez nous | Où |
|---|---|---|
| Prosodie | Cartesia `sonic-3.5`, TTS en `turbo` et non `flash` (+200-300 ms assumés pour le naturel) | `env.ts:376-402` |
| Interruption | deux mots transcrits + 0,4 s d'énergie, montés après « elle s'arrête au moindre bruit » | `env.ts:157-217` |
| Backchannel | `backchannelingEnabled: true`, accepté par Vapi. La cadence et les mots nous échappent : `backchannelPlan` est refusé par l'API, et `buildBackchannelPlan` est du **code mort** conservé pour le jour où elle l'acceptera | `speech-plans.ts:1011-1025` |
| Réponse sous 600 ms | **non**, et c'est le seul manquant : 1620 ms de médiane | mesure du 16/09 |

Trois piliers sur quatre sont donc en place. Le quatrième n'est pas une
fonctionnalité à écrire, c'est du temps à gagner, et le parole-à-parole est
aujourd'hui le seul chemin qui y mène (320-800 ms).

**Piège à connaître** : `VOICE_BACKCHANNEL_START_DELAY_SECONDS` et
`VOICE_BACKCHANNEL_FREQUENCY_SECONDS` ne sont lus que par le code mort. Les
poser sur Render ne change rien à un appel.

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

## 4 bis. Détection automatique de langue — ce qu'il faut, et pourquoi je ne l'ai pas faite

Le néerlandais est livré, mais **en opt-in par client** (`agentLanguage: 'nl'`).
Un appelant flamand qui tombe sur un client configuré en français reste donc
accueilli en français. C'est le dernier morceau du blocage belge.

**Ce n'est pas un réglage, c'est une fonctionnalité**, et elle se heurte à un
problème d'ordre : *on ne peut pas détecter la langue avant que l'appelant ait
parlé*, or la première phrase est justement celle qui porte la divulgation IA.
Il faut donc choisir la langue du décroché sans information, puis basculer.

Trois décisions à prendre, dont **aucune ne se tranche sans appels réels** :

1. **Quelle langue au décroché ?** Le français pour un client bruxellois, le
   néerlandais pour un client anversois, ou un décroché bilingue ? Le bilingue
   double la longueur de la première phrase, donc le temps avant que l'appelant
   puisse parler.
2. **Quel STT ?** Le code fait tourner le NL sur `nova-2` et documente pourquoi
   (`speech-plans.ts:30-33`). Une détection multilingue supposerait `nova-3` en
   mode multi, ou Scribe v2 (§3) — c'est-à-dire de **défaire un choix délibéré
   sans la mesure qui le justifierait**.
3. **Que faire à la bascule ?** Changer la langue change aussi la voix TTS et le
   prompt. Une bascule au milieu d'une phrase s'entend.

**Recommandation** : traiter ce point **après** les appels de test, et avec un
locuteur néerlandophone au bout du fil. C'est le seul item de ce document que je
range volontairement après la mesure : le faire maintenant serait exactement
l'erreur contre laquelle ce document met en garde ailleurs.

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
| ~~1~~ | ~~Réécrire le lot outbound~~ | **Fait le 13/08** : `CallConsent` avec preuve, règle par pays, jours/horaires du décret, plafond mensuel appliqué, registre ouvert par API d'administration. **Reste l'avis juridique B2B** | — | `COUNTRY_RULES` |
| ~~2~~ | ~~Faire échouer les évals sans clé~~ | **Fait le 13/08** : le saut est visible et `EVALS_REQUIRE_KEY=1` le rend fatal. **Reste à poser la clé** | S | `EVALS_REQUIRE_KEY` |
| 3 | Passer `VOICE_REALTIME_MODEL` en `gpt-realtime-2.1`, tester le `mini` | Élevé (qualité + 20 % de coût) | S | env, réversible |
| 4 | Tester Scribe v2 Realtime en **secours** STT, mesurer le WER NL | Élevé sur le NL | S (déclarer) + M (mesurer) | `VOICE_STT_FALLBACK_PROVIDER` |
| 5 | Confirmer auprès de Vapi ce que vaut `provider: 'livekit'`, puis tester le FR | Moyen (perception « robot ») | S | `VOICE_FR_ENDPOINTING_PROVIDER` |
| 6 | Poser les variables de secours STT/LLM sur Render | Élevé (le SPOF est encore ouvert) | S | env |
| ~~7~~ | ~~Relire les lignes directrices art. 50~~ | **Fait le 13/08 : conforme, rien à changer** | — | — |
| 8 | `VAPI_MODEL` vers un modèle de classe GPT-5, **après** évals vertes | Moyen | S | env |
| 9 | Cache sémantique + préchargement KB (pattern `availability-speculator`) | Moyen, **après** l'étape 4.1 | M | — |
| 10 | MCP côté Vapi | Faible aujourd'hui | M | — |
| — | ~~pgvector~~ | **Ne pas faire** : la recherche 2026 confirme le choix actuel | — | — |

**Ordre recommandé** : 1 et 2 tout de suite (l'un est légal, l'autre rend tous
les autres tests fiables), puis 6, puis les appels réels du protocole pour
établir la référence de latence, **et seulement ensuite** 3, 4 et 5, qui doivent
se mesurer contre cette référence.

### Révision du 16/09/2026, après les deux premiers appels réels

La référence de latence existe enfin, et elle réordonne ce tableau.

| # | Action | Impact | État |
|---|---|---|---|
| ~~11~~ | ~~Régler la chaîne de 3,4 s vers 1,5 s~~ | — | **Sans objet** : TOTAL mesuré à 1620 ms, déjà dans la médiane de l'industrie |
| 12 | Phrases d'attente qui n'annoncent plus le résultat | **Le plus élevé du document** | **Fait le 16/09** (`filler-says-nothing-done.test.ts`) |
| 13 | Garde de boucle sur les outils (2 échecs identiques = stop) | Élevé | **Fait le 16/09** (`CallSession.toolFailures`) |
| 14 | Règles de prompt : un outil qui dit NON, un rappel promis exige `captureLead` | Élevé | **Fait le 16/09**, plafond du prompt à 3500 |
| 15 | Durée des outils : `findCallerBookings` charge 300 réservations et filtre en JS | Moyen, montera avec le volume | À mesurer avant d'indexer |
| 16 | Premier tour : le seul sans cache de préfixe, et c'est lui qui dépasse `VOICE_FIRST_TOKEN_TIMEOUT_MS` | Moyen (première impression) | À instrumenter |
| 17 | Étage `transcriptFinal → llmStart` non nommé dans le traqueur | Moyen | Les 800 ms de fin de tour n'apparaissent que par soustraction |
| — | ~~Baisser `VOICE_START_WAIT_SECONDS`~~ | — | **Ne pas faire** : montés exprès le 12/09 après « il parle par-dessus moi », et la chaîne est dans les clous |
| — | ~~SIP natif OpenAI~~ | — | **Pas maintenant** : voir §2 bis, zéro des trois défauts réels n'y serait corrigé |

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
- **16/09/2026** : [OpenAI — Realtime API avec SIP](https://developers.openai.com/api/docs/guides/realtime-sip) · [CelloIP — SIP natif contre passerelle websocket](https://celloip.com/blog/openai-realtime-native-sip-vs-bridge/) · [Inworld — Vapi contre Pipecat contre LiveKit](https://inworld.ai/resources/vapi-vs-pipecat-vs-livekit) · [Forasoft — architecture LiveKit en production](https://www.forasoft.com/learn/livekit-for-ai-agents-guide) · [Regal.ai — ce qui fait une voix humaine](https://www.regal.ai/blog/what-makes-ai-sound-human)
