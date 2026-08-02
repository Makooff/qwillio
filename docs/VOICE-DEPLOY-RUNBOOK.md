# Mise en production du réceptionniste next-gen

Branche `feature/qwillio-next-gen-core`, PR #67.

L'essentiel est automatique. Ce document liste ce qui l'est, pour ne pas le
refaire à la main, et ce qui ne l'est pas.

---

## 1. Migrations — à faire, contrairement à ce que dit le blueprint

**Constat du 2026-08-02, après merge.** `backend/render.yaml` n'a jamais été
appliqué : le service Render s'appelle `qwillio`, pas `qwillio-backend`, il a été
créé à la main, et il n'existe qu'un seul service dans l'environnement Production
(pas de worker `qwillio-jobs`). Le blueprint est un fichier mort dans le repo.

Conséquence directe : `npx prisma migrate deploy` n'a jamais tourné.
`prisma migrate status` sur l'instance de production affiche **8 migrations non
appliquées**, la plus ancienne datant du 17 juillet. La base est en retard depuis
des semaines, pas depuis cette refonte.

Trois raccourcis existent maintenant dans `backend/package.json`, pour pouvoir
diagnostiquer depuis le Web Shell de Render sans avoir à coller une longue
commande (le presse-papier ne fonctionne pas dans ce shell depuis un mobile) :

```bash
npm run db:status   # quelles migrations manquent
npm run db:check    # le SQL qui manque réellement à la base — lecture seule
npm run db:deploy   # applique les migrations en attente
```

`db:check` avant `db:deploy`, toujours. Il répond à la seule question qui
compte : la base est-elle réellement en retard, ou le schéma est-il déjà là avec
seulement les enregistrements de migration manquants (cas d'un ancien
`prisma db push`) ? Dans le second cas `db:deploy` échoue sur
`relation already exists`, marque la migration en échec et bloque les
déploiements suivants jusqu'à un `prisma migrate resolve --applied` manuel.

- `db:check` renvoie du SQL `CREATE TABLE` → la base est en retard, `db:deploy`
  est sûr.
- `db:check` ne renvoie rien → ne pas lancer `db:deploy`, il faut `resolve`.

Le réglage durable, à faire une fois dans le dashboard, Settings → Build &
Deploy → **Pre-Deploy Command** :

```
npx prisma migrate deploy
```

C'est ce que le blueprint aurait fait si Render l'utilisait :

Cette commande tourne **avant** que le trafic bascule sur la nouvelle version.
Si une migration échoue, le déploiement est annulé et l'ancienne version reste
en ligne : jamais de code neuf sur un schéma ancien.

Les huit migrations en attente sont purement additives — tables nouvelles et
colonnes ajoutées avec valeur par défaut ou nullable, aucun `DROP`, aucune
colonne existante modifiée, aucun backfill. Les trois dernières sont celles de
cette refonte :

```
20260717000000_add_spam_detection
20260719000000_add_minutes_quota
20260721000000_add_prospect_favorite
20260726000000_add_affiliate_programme
20260727000000_add_saved_searches_and_sales_script
20260801130000_add_caller_and_business_memory
20260801180000_add_greeting_audio
20260801190000_add_knowledge_embeddings
```

Rien ne casse tant qu'elles manquent : les quatre services vocaux concernés
attrapent l'erreur et dégradent en silence (`caller-memory.service.ts:53`,
« Memory is an enhancement. A failed lookup must never stop a call from being
answered »). Les appels passent, mais mémoire appelant, accueil pré-synthétisé
et recherche par embeddings restent morts sans rien signaler.

Vérification après déploiement, si tu veux la certitude :

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('caller_memories', 'business_knowledge', 'greeting_audio');
-- doit renvoyer 3 lignes
```

**Le worker `qwillio-jobs` n'existe pas.** Le blueprint le décrit, Render ne l'a
jamais créé. Ce n'est pas cassé pour autant : `RUN_JOBS` n'est pas défini sur le
service, et le défaut est `true` —

```ts
// backend/src/config/env.ts:183
RUN_JOBS: process.env.RUN_JOBS !== 'false',
```

— donc les 44 tâches planifiées, `receptionist-learning` compris, tournent dans
le process web. Comportement d'avant la séparation, rien de perdu. Le seul
inconvénient reste celui qui avait motivé la séparation : un déploiement web
coupe une tâche en cours d'exécution.

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

## 3. Variables d'environnement — déjà en place

`OPENAI_API_KEY` et `ELEVENLABS_API_KEY` sont déclarées dans `render.yaml`.
`VAPI_WEBHOOK_SECRET` ne l'est pas mais est définie dans le dashboard Render, ce
qui suffit : les variables du dashboard ne sont pas écrasées par le blueprint.

À savoir sur chacune, en cas de panne :

| Variable | Sans elle |
|---|---|
| `OPENAI_API_KEY` | le chemin custom-LLM tombe en repli parlé à chaque tour |
| `ELEVENLABS_API_KEY` | pas d'accueil pré-synthétisé, retour à la synthèse live |
| `VAPI_WEBHOOK_SECRET` | webhooks rejetés en 401 en production (échec fermé volontaire) |

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

Déjà couvert : `.github/workflows/keepalive.yml` tourne toutes les 5 minutes et
appelle `/api/auth/warmup`, ce qui garde le process **et** Neon chauds. Rien à
ajouter aujourd'hui.

La route `/ping` (`backend/src/server.ts:229`) reste plus légère — pas de base,
pas d'auth, pas de log, `pong` en texte brut — et sert de repli si tu veux un
cron hors GitHub :

```
GET https://<ton-api>/ping
```

La seule vraie raison de doubler : GitHub désactive un workflow planifié après
60 jours sans activité sur le repo, en silence.

---

## 5. Déploiement

PR #67 en ready, merge. Render construit, applique les migrations, puis
bascule. Vérifications immédiates :

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
