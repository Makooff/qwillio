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
appliquées**, la plus ancienne datant du 17 juillet.

### La vraie cause : une migration en échec, jamais résolue

Une fois le `preDeployCommand` en place, le déploiement a échoué :

```
Error: P3009
migrate found failed migrations in the target database, new migrations will not be applied.
The `20260611000000_add_password_reset` migration started at 2026-07-26 14:14:43 UTC failed
```

Voilà ce qui gelait réellement la base. Une migration a planté le 26 juillet et
a laissé dans `_prisma_migrations` une ligne sans `finished_at` ni
`rolled_back_at`. À partir de là, `migrate deploy` refuse d'appliquer **quoi que
ce soit**, y compris les migrations qui n'ont rien à voir. Le blueprint non
appliqué n'a fait que masquer le symptôme : sans `preDeployCommand`, personne
n'a jamais vu l'erreur.

L'échec du pre-deploy s'est comporté comme prévu : le trafic n'a pas basculé,
l'ancienne version est restée en ligne.

### Comment ça s'est terminé, le 2026-08-03

Les dix migrations ont été résolues en **`applied`**, sans exception. Chacune
échouait sur `already exists` — `is_spam`, `affiliates`, `saved_searches`,
`caller_memories`, `greeting_audio`, `embedding` — parce que le schéma complet
était déjà en base, créé par un `prisma db push` et jamais enregistré comme
migration.

Autrement dit : rien n'a été créé pendant la réparation, seule la comptabilité a
été remise d'équerre. Le SQL des migrations n'a jamais été rejoué.

Preuve finale, `npm run db:check` :

```
-- This is an empty migration.
```

`information_schema` correspond exactement à `schema.prisma`. C'est la seule
vérification qui compte : `migrate resolve` n'écrit que dans `_prisma_migrations`
et ne prouve rien sur le schéma réel.

**La leçon.** `db:push` sur une base de production laisse le schéma juste et
l'historique faux. Tout marche, jusqu'au jour où une migration s'exécute enfin et
trouve ses objets déjà là. Les migrations, désormais, ou rien.

### P1002 pendant un déploiement : à relancer, pas à réparer

```
Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369))
```

Prisma prend un verrou consultatif avant d'appliquer, pour empêcher deux
migrations simultanées. Ces verrous sont liés à une session PostgreSQL, et l'URL
de production passe par le pooler Neon (`...-pooler.c-5.us-east-1.aws.neon.tech`)
qui peut servir une connexion différente d'une requête à l'autre.

C'est arrivé deux fois pendant la réparation, et la simple relance a suffi. Rien
n'est cassé, rien n'est à moitié appliqué : le verrou est pris *avant* toute
écriture. Si un déploiement échoue là-dessus, relancer le déploiement.

Contournement ponctuel si ça persiste, sans rien modifier durablement :

```bash
DATABASE_URL="${DATABASE_URL/-pooler/}" npx prisma migrate deploy
```

### Résoudre une migration en échec

Prisma veut savoir dans quel sens enregistrer la tentative ratée :

| Direction | Quand |
|---|---|
| `--applied` | les objets sont en base, seul l'enregistrement manque |
| `--rolled-back` | les objets sont absents, la migration doit être rejouée |

Se tromper laisse le schéma et son historique en désaccord, ce qui est pire que
l'échec d'origine. `prisma/db-doctor.mjs` tranche à partir des faits plutôt que
d'une intuition : il lit le SQL de la migration en échec, demande à
`information_schema` si chaque table, colonne et index existe, et n'annonce une
direction que si la réponse est unanime. Une application **partielle** est
signalée et laissée en l'état, parce qu'aucune des deux directions n'est vraie
dans ce cas.

```bash
npm run db:doctor   # constat seul, n'écrit rien
npm run db:heal     # applique le verdict si il est sans ambiguïté
```

`migrate resolve` n'écrit que dans `_prisma_migrations`, jamais dans les données
applicatives, dans les deux directions.

### Les autres raccourcis

Tous existent pour être tapés depuis le Web Shell de Render, où le
presse-papier ne fonctionne pas depuis un mobile :

```bash
npm run db:status   # quelles migrations manquent
npm run db:check    # le SQL qui manque réellement à la base — lecture seule
npm run db:deploy   # applique les migrations en attente
```

Ordre à suivre après un P3009 : `db:doctor`, puis `db:heal`, puis `db:status`
pour vérifier, puis `db:deploy`.

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
| `ELEVENLABS_API_KEY` | pas d'accueil pré-synthétisé, aperçus de voix en 503 (le dashboard retombe sur la voix du navigateur et le dit), clonage de voix indisponible |
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
