# Mise en production du réceptionniste next-gen

Branche `feature/qwillio-next-gen-core`, PR #67.

Sept étapes, dans cet ordre. L'étape 2 est celle qui décide si tout le reste
sert à quelque chose : sans elle, le code est déployé mais aucun appel entrant
ne le traverse.

---

## 1. Migrations

Trois migrations, purement additives : trois tables nouvelles, deux colonnes
ajoutées, aucune colonne existante modifiée, aucun backfill.

```bash
cd backend
npx prisma migrate deploy
```

Sur staging d'abord. Vérifier ensuite que les tables existent :

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('caller_memories', 'business_knowledge', 'greeting_audio');
-- doit renvoyer 3 lignes
```

**Si cette étape est sautée**, la construction du profil échoue à chaque appel
entrant : le code lit `callerMemory`, `businessKnowledge` et `greetingAudio`.

---

## 2. Le numéro Vapi — l'étape qui décide de tout

Le nouveau pipeline ne démarre que sur l'événement `assistant-request`. Vapi ne
l'envoie **que** si le numéro est configuré avec un Server URL, et non attaché à
un assistant statique. Rien dans le code ne configure ce numéro : c'est de la
configuration dans le dashboard Vapi.

**État constaté le 2026-08-02** : le numéro `+1 (607) 354-8569` porte bien un
Server URL, `https://qwillio.onrender.com/api/webhooks/vapi`. C'est la bonne
nouvelle — `assistant-request` sera envoyé.

Cette URL est celle du handler de prospection sortante, qui ne connaissait pas
`assistant-request`. Le code le gère désormais : il résout le tenant depuis le
**numéro appelé** puis construit le vrai réceptionniste. Aucun changement à
faire dans le dashboard.

| Ce que tu vois | Ce que ça veut dire |
|---|---|
| **Server URL** `.../api/webhooks/vapi` | correct, routage par numéro appelé |
| **Server URL** `.../api/webhooks/vapi/client/<id>` | correct aussi, mais épingle un seul client |
| Un **Assistant** sélectionné, pas de Server URL | `assistant-request` n'est jamais envoyé, rien ne s'exécute |

### La limite à connaître

Le routage se fait sur le numéro appelé. Tant qu'un client possède son numéro,
c'est exact. **Si plusieurs clients actifs partagent le même numéro, rien dans
l'appel ne dit lequel était visé** : le service refuse alors de deviner et
l'appelant entend « cette ligne n'est pas encore configurée ».

Répondre au hasard serait pire — un appelant d'un client entendrait l'agent d'un
autre commerce. Il faut donc un numéro Vapi par client avant d'en ouvrir un
deuxième. `logger.error` le dit explicitement quand le cas se produit.

---

## 3. Variables d'environnement (Render)

| Variable | Sans elle |
|---|---|
| `OPENAI_API_KEY` | le chemin custom-LLM tombe en repli parlé à chaque tour |
| `ELEVENLABS_API_KEY` | pas d'accueil pré-synthétisé, retour à la synthèse live |
| `VAPI_WEBHOOK_SECRET` | en production les webhooks sont rejetés en 401 (échec fermé volontaire) |

Optionnelles, toutes avec un défaut sain : `VOICE_*` (voir `config/env.ts`),
`REDIS_URL` (absent = cache par processus).

Deux interrupteurs à connaître avant un incident :

```bash
VOICE_CUSTOM_LLM_DEFAULT=false   # rebascule tout le monde sur le chemin OpenAI de Vapi
VOICE_BACKCHANNEL_ENABLED=false  # coupe les acquiescements si le rendu déplaît
```

Aucun des deux ne nécessite de redéployer les assistants : l'appel suivant les
prend en compte.

---

## 4. Keepalive

Le custom-LLM est actif par défaut, donc ce backend est dans le chemin audio de
chaque tour. Une instance froide devient un silence en ligne.

Cron externe, toutes les 5 minutes :

```
GET https://<ton-api>/ping
```

C'est l'endpoint le plus léger du service : pas de base, pas d'auth, pas de log,
il renvoie `pong` en texte brut.

---

## 5. Déploiement

PR #67 en ready, merge, déploiement Render. Vérifications immédiates :

```bash
curl https://<ton-api>/ping                      # pong
curl https://<ton-api>/api/webhooks/vapi/health  # liveCalls, endpointingMs, ...
```

---

## 6. Premier appel

Appeler le numéro. Dans les logs Render, dans cet ordre :

```
[Voice] assistant-request for <Business> built in XXms (known caller: false)
[Voice] call <id> latency — STT …ms | LLM …ms | TTS …ms | total …ms
[Voice] call <id> tokens — in NNNN (cache NN%), out NNN
```

**La première ligne absente = l'étape 2 n'est pas faite.** Tout le reste est
alors inerte, quel que soit ce que dit le déploiement.

Ce qu'il faut écouter pendant l'appel :

- couper l'agent en plein milieu d'une phrase : il doit s'arrêter net, sans
  bégayer ni reprendre par-dessus ;
- parler vingt secondes d'affilée : il doit glisser des « mhm » ;
- se taire quatre secondes : il doit relancer, pas raccrocher ;
- demander un créneau : il doit consulter l'agenda et proposer une heure réelle.

---

## 7. Réglage, après mesure et pas avant

Aucune des valeurs par défaut n'est mesurée sur un appel réel. Elles sont
argumentées. La ligne `latency` du premier appel dit laquelle corriger :

| Ce que dit la mesure | Levier |
|---|---|
| STT élevé | `VOICE_ENDPOINTING_MS` trop haut pour cet audio |
| LLM élevé | vérifier le taux de cache, et si le modèle cher est trop souvent choisi |
| TTS élevé | `VOICE_TTS_MIN_CHUNK_CHARS`, ou réponses trop longues |
| total élevé, étages bas | le temps est entre les étages : ordonnancement Vapi ou réseau |

Au bout d'une semaine, le job `receptionist-learning` (dimanche 2h UTC) fait ce
diagnostic tout seul et le remonte sur Discord.

---

## Ce qui reste ouvert

- **Un numéro partagé entre clients** ne peut pas router par `clientId` dans
  l'URL. À trancher avant le deuxième client.
- **Les règles de l'assistant de config** sont des instructions au modèle. Le
  seul garde-fou dur en place refuse d'enregistrer un service sans prix ni nom ;
  le reste (une question à la fois, ne pas inventer un tarif) reste probabiliste.
- **Le transport audio** reste chez Vapi. Décision actée.
