# TEST-VENTE-RESULTATS.md — protocole « prêt à vendre »

Session desktop du **13/08/2026**, contre la production post-PR #133
(`master` = `047c45b`). Chaque ligne porte son horodatage et sa preuve brute.

Légende : ✅ vérifié · ⛔ bloqué (dépend du propriétaire) · ⏳ pas encore joué

---

## Étape 0 — Synchronisation

| Contrôle | Résultat |
|---|---|
| PR #133 mergée | ✅ `047c45b` en tête de `master` |
| `master` à jour | ✅ `master...origin/master`, aucun écart |
| Branche de travail | ✅ aucune reprise depuis la branche mergée |

---

## A. Endpoints — ✅ 4/4 (13/08, 14:52 Paris)

| Endpoint | Attendu | Obtenu | Latence |
|---|---|---|---|
| `GET /api/health` | `{"status":"ok"}` | `{"status":"ok","timestamp":"2026-08-13T12:52:48.173Z"}` | 278 ms |
| `GET /api/auth/warmup` | `{"ready":true}` | `{"ready":true}` | 528 ms |
| `GET /ping` | `pong` | `pong` | 229 ms |
| `GET /api/webhooks/vapi/health` | contient `fleetMetrics` | ✅ présent | 209 ms |

Réponse complète du dernier (**preuve que la PR #133 est déployée**) :

```json
{"liveCalls":0,"sharedCache":false,"endpointingMs":150,"startWaitSeconds":0.12,
 "bargeInBackoffSeconds":1,
 "fleetMetrics":{"windowStartedAt":"2026-08-13T09:40:49.341Z","calls":0,
   "latency":{},"cost":null,"voiceToVoiceObjectiveMs":1100,"meetsObjective":null}}
```

Deux enseignements, au-delà du vert :

1. `windowStartedAt: 09:40:49Z` date le redémarrage Render qui a embarqué la PR.
2. **`calls: 0`, `latency: {}`, `meetsObjective: null`** : aucun appel réel n'est
   passé depuis le déploiement. L'objectif P95 < 1100 ms n'est donc ni tenu ni
   manqué : **il n'est pas encore mesuré**. C'est exactement ce que la
   section C doit produire, et aucun autre test ne peut le remplacer.

---

## Tests unitaires backend — ✅ 676/676 (13/08, 14:55)

`npm test` → **65 fichiers, 676 tests verts, exit 0**. Le chiffre annoncé par
la PR #133 est exact.

**Piège rencontré, à documenter pour la prochaine machine** : au premier lancement,
10 fichiers échouaient au chargement avec

```
Error: @prisma/client did not initialize yet. Please run "prisma generate"
```

Ce n'était **pas** une régression : `npm install` a bloqué le `postinstall` de
Prisma (politique `allow-scripts` de npm, visible dans les warnings d'install).
Le client n'était donc jamais généré. Correctif, à faire après toute installation
de dépendances sur ce poste :

```bash
cd backend && npx prisma generate
```

Sans cela on lit « 562 tests » et 10 fichiers rouges, et on croit à une casse.

---

## B. Parcours web (Playwright) — ⛔ bloqué

Non joué : il faut un compte client réel sur la production pour se connecter.
À fournir par le propriétaire (voir « Ce qu'il me faut », plus bas).

À couvrir une fois débloqué : login → dashboard → Appels / Leads /
Réceptionniste / Facturation (**premier clic sur le portail Stripe en prod,
jamais fait**).

**Démo vocale publique — ✅ vérifiée dans le code, sans attendre le navigateur.**
`public-demo.routes.ts:157` construit son premier message avec
`firstMessageVariants`, c'est-à-dire **la même fonction que les appels réels** :
la divulgation IA y est donc portée par construction, pas par recopie. Et
`recordCalls: false` (`:139`) fait que la notice d'enregistrement ne se
prononce pas, ce qui est correct puisque la démo n'est pas enregistrée. Il
restera à confirmer à l'oreille, mais il n'y a pas de risque de dérive : les
deux chemins ne peuvent pas diverger.

---

## C. Appels téléphoniques réels — ⛔ bloqué

Non joué : nécessite le téléphone du propriétaire. C'est le seul test qui
alimente `fleetMetrics`, donc le seul qui puisse valider la latence.

Ordre prévu, inchangé : (1) entrant complet, (2) rappel 2 min après pour la
mémoire, (3) reprise de l'appel 1 avec `VOICE_SPEECH_TO_SPEECH=off`, (4) NL si
un client néerlandophone est configuré.

---

## D. Évals — ⛔ bloqué, et le piège est sérieux

`npm run evals` **saute silencieusement et sort en 0 sans `OPENAI_API_KEY`** :

```ts
// backend/src/evals/run-evals.ts:133-136
if (!env.OPENAI_API_KEY) {
  console.log('[evals] OPENAI_API_KEY absent — évals sautées (exit 0).');
  return;
}
```

Autrement dit : lancer les évals sans la clé produit un **faux vert**. Il n'y a
pas de `backend/.env` sur ce poste (seulement `.env.example`), donc tant que la
clé n'est pas fournie, la case D reste ⛔ et ne doit surtout pas être cochée.

Coût attendu quand elle tournera : ~9 scénarios × 1-2 tours de gpt-4o, soit
quelques centimes.

---

## Ce qu'il me faut pour finir l'étape 1

1. **Un compte client de test sur la production** (email + mot de passe), ou
   l'accord pour en créer un. Sans ça, ni B ni la vérification post-appel de C.
2. **20 minutes au téléphone** pour la section C, moi sur les logs en direct.
3. **`OPENAI_API_KEY`** pour la section D (à passer en variable d'env, jamais
   dans un fichier versionné).

Point d'attention pour C : sur le portail Stripe, le premier clic en production
n'a jamais été fait. Si la configuration du portail n'est pas publiée côté
Stripe, ce clic renvoie une erreur — c'est un réglage de tableau de bord Stripe,
pas un bug de code.
