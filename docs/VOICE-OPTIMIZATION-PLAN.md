# Plan d'optimisation du réceptionniste — 12 chantiers

Suite de `VOICE-NEXT-GEN.md`. Objectif : le réceptionniste le plus humain, le
plus rapide et le plus intelligent possible, sans reprendre le transport audio
(décision actée : Vapi garde VAD, AMD et transport).

Branche : `feature/qwillio-next-gen-core`.

---

## Ordre d'exécution et pourquoi

L'ordre n'est pas l'ordre d'importance, c'est l'ordre de dépendance.

**1 en premier, seul.** Le monitoring de latence par étage conditionne tout le
reste : sans le découpage STT / LLM / TTS, chaque réglage des chantiers 6 à 9
est un pari sur l'étage responsable. On mesure d'abord, on règle ensuite.

**2 à 5 ensuite.** Les quatre gains d'humanité les moins chers, sans dépendance
entre eux. Ce sont des heuristiques et de la config, pas de l'architecture.

**6 à 9 après le 1.** Optimisations dont l'effet ne se vérifie qu'avec la mesure
par étage en place.

**10 à 12 en dernier.** Les trois plus gros morceaux, chacun touchant du code
hors du module `voice/`.

| # | Chantier | Registre | Dépend de |
|---|---|---|---|
| 1 | Latence par étage | intelligence | — |
| 2 | Backchannels | humanité | — |
| 3 | Récupération après interruption | humanité | — |
| 4 | Variantes d'accueil | humanité | — |
| 5 | Relance sur silence à 4 s | humanité | — |
| 6 | Registre émotionnel en direct | humanité | — |
| 7 | Prompt caching OpenAI | coût | 1 |
| 8 | Pré-synthèse de l'accueil | latence | 4 |
| 9 | Exécution spéculative de l'agenda | latence | 1 |
| 10 | Warm transfer avec résumé | intelligence | — |
| 11 | Boucle d'apprentissage sur l'entrant | intelligence | 1 |
| 12 | Embeddings sur la base de connaissances | intelligence | — |

---

## Détail par chantier

### 1. Latence par étage (STT / LLM / TTS / total)

Aujourd'hui `medianTurnLatencyMs` mesure le bout-en-bout. Elle dit qu'un tour
est lent, jamais où.

Horodatages à poser dans `call-session.store` :

| Étage | Borne basse | Borne haute |
|---|---|---|
| STT | `speech-update` user `stopped` | `transcript` final |
| LLM | entrée dans `llm-stream.handle` | premier delta émis |
| TTS | dernier delta émis | `speech-update` assistant `started` |
| Total | fin de parole appelant | premier audio assistant |

Plus les `performanceMetrics` de Vapi sur `end-of-call-report` quand elles sont
présentes, pour croiser avec notre propre mesure. Persistance dans
`ClientCall.metadata.realtime.latency`, médiane et p95 par étage.

L'étage LLM n'est mesurable que sur le chemin custom-LLM — sur le chemin OpenAI
direct, Vapi ne nous donne pas la main. C'est une raison de plus de garder le
custom-LLM actif.

### 2. Backchannels

Le plus gros écart d'humanité restant. Un humain fait « mhm » *pendant* que vous
parlez ; le nôtre se tait puis répond.

`backchannelingEnabled` côté Vapi, mots par langue. **Piège à vérifier** :
`stopSpeakingPlan.acknowledgementPhrases` contient déjà « mhm » et « d'accord ».
Il faut s'assurer que le backchannel émis par l'agent ne soit pas réinjecté
comme une interruption de l'appelant.

### 3. Récupération après interruption

Le compteur de barge-in existe déjà. Y brancher une phrase courte, avec deux
garde-fous : ne pas la dire à chaque interruption (ce serait pire que le
silence), et seulement si l'agent parlait depuis assez longtemps pour que la
coupure soit brutale.

### 4. Variantes d'accueil

Trois variantes par client et par langue, tirées au hasard. La version
nominative pour appelant connu reste prioritaire.

### 5. Relance sur silence

`VAPI_SILENCE_TIMEOUT` est à 10 s, bien après le moment où l'appelant croit que
la ligne a coupé. Relance douce vers 4 s, timeout de raccrochage inchangé.
Relancer n'est pas raccrocher : ce sont deux réglages distincts.

### 6. Registre émotionnel

Le sentiment n'existe qu'après l'appel. Détection déterministe sur les deux
premiers tours (marqueurs de colère, d'urgence, répétition), puis ajustement :
phrases plus courtes, zéro enthousiasme, transfert proposé plus tôt.

### 7. Prompt caching

~1 500 tokens de prompt système rejoués à chaque tour, soit ~30 000 tokens
d'entrée sur un appel de 20 tours avant la conversation elle-même. Le chemin
custom-LLM nous donne la main sur la requête : préfixe stable en tête, cache
activé. Vérification par les `usage` d'OpenAI, pas par déduction.

### 8. Pré-synthèse de l'accueil

L'audio de l'accueil est stable par client : le synthétiser une fois supprime le
TTFB TTS sur la seconde qui décide de l'impression. Généré à l'onboarding et à
chaque changement de config, invalidé avec le cache profil. Se combine avec le
chantier 4 : pré-synthétiser les trois variantes.

### 9. Exécution spéculative de l'agenda

Dès qu'une date apparaît dans un transcript partiel, lancer `checkAvailability`
sans attendre le modèle, et servir le résultat depuis un cache court. Gagne un
aller-retour complet sur le tour le plus fréquent.

Garde-fous non négociables : ne spéculer que si l'agenda est connecté, borner le
nombre de spéculations par appel, et **jamais** de spéculation qui écrit.

### 10. Warm transfer avec résumé

Transfert chaud Vapi avec `summaryPlan` (résumé parlé à l'opérateur avant le
pont), doublé d'un SMS contenant nom, motif et numéro de rappel. Le résumé se
construit depuis le buffer de transcript en mémoire, pas depuis un appel GPT
bloquant qui ferait attendre les deux parties.

### 11. Boucle d'apprentissage sur l'entrant

`script-learning`, `ai-learning` et `optimization.service` ne tournent que sur la
prospection sortante. Les alimenter avec les appels entrants : transcripts,
issues, latences, barge-ins. **Ajouter une source, ne pas remplacer** — la
boucle sortante existante ne doit pas bouger.

### 12. Embeddings sur la base de connaissances

Le score lexical actuel ne rapproche pas deux formulations sans mot commun.
Couche embeddings activée seulement au-dessus d'un seuil d'entrées : un client
avec douze FAQ ne doit pas payer un aller-retour d'embedding. Repli sur le score
lexical si l'embedding échoue ou dépasse son budget de temps.

---

## Règles qui s'appliquent aux douze

- Rien ne rentre dans le chemin audio sans un mode de défaillance qui parle une
  phrase naturelle. Jamais de silence, jamais de message technique.
- Tout ce qui touche le prompt est mesuré en caractères : il est rejoué à chaque
  tour.
- Chaque chantier arrive avec ses tests. Le typecheck et la suite complète
  passent avant chaque commit.
- Les valeurs de réglage vont dans `config/env.ts` avec, en commentaire, le mode
  de défaillance qu'elles protègent — pas leur valeur, qui se lit dans le code.
