# Migrer l'hébergement vers l'Union européenne

Ce document existe parce que la région d'un service Render **ne se change pas**.
Elle est fixée à la création, et aucun réglage de la console ni du blueprint ne
la déplace : la seule voie est de recréer les services ailleurs, puis de faire
basculer le trafic. Ce n'est pas un bouton, c'est une bascule, et elle se
prépare.

Le site n'annonce plus « Hébergement UE ». Il ne pourra le réannoncer qu'au
terme de l'étape 4, pas de l'étape 2 : c'est le point que ce document tient à
rendre impossible à oublier.

---

## 1. La base de données (Neon)

La région d'un projet Neon est fixée elle aussi. Il faut donc un **nouveau
projet** en `eu-central-1` (Francfort), puis déplacer les données.

```bash
# Depuis l'ancienne base, schéma et données.
pg_dump "$OLD_DATABASE_URL" --no-owner --no-privileges -Fc -f qwillio.dump

# Vers la nouvelle.
pg_restore -d "$NEW_DATABASE_URL" --no-owner --no-privileges qwillio.dump
```

Deux précautions qui coûtent cher si on les saute :

- **Faire la bascule pendant une fenêtre sans appel.** Un appel en cours écrit
  son `end-of-call-report` à la fin : s'il tombe entre le dump et la bascule,
  il est perdu, avec sa transcription et son lead.
- **Vérifier le compte de lignes des tables qui portent de l'argent** avant de
  détruire quoi que ce soit : `Client`, `Payment`, `ClientCall`, `Contact`.

## 2. L'API et les tâches planifiées (Render)

`backend/render.yaml` porte `region: oregon` sur les deux services. Modifier
cette ligne **ne déplace pas** les services existants : la région est un champ
immuable, et la synchronisation du blueprint la refuse.

La marche à suivre :

1. Renommer les services dans le blueprint (`qwillio-backend-eu`,
   `qwillio-jobs-eu`) et passer `region: frankfurt`. Les noms doivent différer,
   sinon Render voit les services existants et refuse.
2. Créer le blueprint. Reporter toutes les variables marquées `sync: false` :
   elles ne sont jamais transportées, c'est le but.
3. Pointer `DATABASE_URL` sur la nouvelle base.
4. **`RUN_JOBS=false` sur les deux services au départ.** Deux processus de
   tâches qui tournent en parallèle enverraient les rappels de rendez-vous en
   double, et un client s'en aperçoit.
5. Vérifier le service européen sur son adresse `onrender.com` : santé, un
   appel de test, la connexion Google.
6. Basculer le domaine de l'API, puis seulement là, activer `RUN_JOBS=true` sur
   le worker européen et le désactiver sur l'ancien.
7. Mettre à jour les adresses de rappel qui pointent vers l'API : les webhooks
   Vapi (`/api/webhooks/vapi/client/:id` et `/api/webhooks/vapi/tools/:id`),
   celui de Stripe, et `GOOGLE_OAUTH_REDIRECT_URI` si l'adresse change.
8. Garder l'ancien service **éteint mais vivant** une semaine. C'est le seul
   retour arrière possible si un webhook a été oublié.

## 3. Le frontend (Vercel)

Rien d'obligatoire : le site est statique, servi par un CDN mondial, et ne
stocke aucune donnée personnelle. Si des fonctions serveur apparaissent un
jour, les épingler sur `fra1`.

## 4. Les sous-traitants, et c'est là que tout se joue

Déplacer Render et Neon met **vos** données en Europe. Cela ne suffit pas à
écrire « Hébergement UE » sur le site, parce que le produit est une chaîne
vocale : chaque appel envoie de l'audio et sa transcription à des tiers.

| Sous-traitant | Rôle | À obtenir |
|---|---|---|
| Vapi | Orchestration de l'appel | Traitement en UE, ou un accord de traitement avec CCT |
| OpenAI | Modèle | Résidence des données UE, proposée sur les offres entreprise |
| ElevenLabs | Voix | Point d'accès UE |
| Deepgram | Transcription | Point d'accès UE |
| Twilio | Téléphonie | Région Irlande |
| Stripe, Resend | Paiement, email | Sous-traitants encadrés, déjà couverts par des CCT |

Tant qu'un seul de ces maillons traite hors UE, la formule honnête reste
« conforme au RGPD, transferts encadrés par des clauses contractuelles types »,
qui est ce que dit aujourd'hui la politique de confidentialité. La différence
entre les deux formules n'est pas rhétorique : la première est vérifiable par
un client, et fausse si un maillon manque.

## 5. Après la bascule

Mettre à jour d'un seul geste, sinon ils divergent :

- `frontend/src/pages/v2/legal/Privacy.tsx` : le tableau des sous-traitants
  porte encore « Render — USA ».
- Les pages marketing, si et seulement si l'étape 4 est terminée.
