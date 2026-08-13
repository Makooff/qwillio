# À faire — guide pas à pas (13/08/2026)

Ce qui ne peut pas être fait depuis une session de code, dans l'ordre où il
faut le faire. Chaque étape dit **pourquoi**, **comment**, et **comment savoir
que c'est bon**.

Repères de temps : ⏱️ 2 min = un réglage, ⏱️ 20 min = un vrai test.

---

# PARTIE 1 — Avant le déploiement (5 minutes, à faire maintenant)

## Étape 1.1 — Vérifier la longueur d'`ADMIN_SECRET` ⏱️ 2 min

**Pourquoi.** La porte de service `x-admin-secret` donnait un accès
administrateur total sans laisser aucune trace. Elle est maintenant journalisée
et comparée à temps constant, mais j'ai aussi imposé **32 caractères minimum** :
en dessous, la porte se **désactive**. Un secret court est une clé maîtresse
qu'on peut énumérer.

**Conséquence si tu ne fais rien** : si ton secret actuel fait moins de 32
caractères, tes scripts d'exploitation cesseront de passer au prochain
déploiement, et tu liras dans les logs Render un message `[Admin] ADMIN_SECRET
fait N caractères, minimum 32`.

**Comment faire.**
1. Render → service `qwillio` → **Environment**.
2. Regarde `ADMIN_SECRET`. S'il fait moins de 32 caractères, remplace-le par un
   secret long. Pour en générer un :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Reporte la nouvelle valeur partout où tu l'utilises (scripts, Postman…).

**C'est bon quand** : la valeur fait au moins 32 caractères.

---

## Étape 1.2 — Décider du sort de l'outbound français ⏱️ décision

**Pourquoi.** La loi n° 2025-594 est entrée en vigueur **le 11 août 2026**, il y
a deux jours. Bloctel a cessé son activité, et le démarchage non sollicité est
**interdit par défaut en France**, tous secteurs, sauf consentement préalable
que **c'est à toi de prouver**.

**Ce que le code fait maintenant** : la France ne sort du silence que pour les
numéros portant un consentement enregistré. Comme le registre est vide,
**l'outbound français s'arrête au déploiement**. C'est voulu : c'est le seul
état défendable tant que la question ci-dessous n'est pas tranchée.

**Ce que tu dois faire** : poser une question à un juriste, en une phrase.

> « Nos appels sortants visent des entreprises trouvées sur Google Maps
> (artisans, commerces, professions libérales). Le nouveau régime d'opt-in de la
> loi 2025-594 s'applique-t-il à nous, sachant que les textes visent le
> "consommateur" mais que beaucoup de nos cibles sont des professionnels en nom
> propre dont la ligne est personnelle ? »

**Selon la réponse :**
- **« Oui, ça s'applique »** → rien à faire, le code est déjà conforme. Il faudra
  construire un moyen de recueillir le consentement (formulaire web, rappel
  demandé) avant de rallumer la France.
- **« Non, le B2B est hors champ »** → une ligne à changer dans
  `backend/src/utils/outbound-legal.ts` : passer `FR.requiresPriorConsent` à
  `false`. Dis-le-moi, je le fais et je le teste.

**En attendant** : la Belgique continue de fonctionner normalement (elle est
restée en opt-out, avec la liste « Ne m'appelez plus ! »).

---

# PARTIE 2 — Le déploiement (10 minutes, surveillé)

## Étape 2.1 — Suivre le déploiement Render ⏱️ 5 min

**Pourquoi.** Ce déploiement embarque **trois migrations de base de données**.
Le conteneur démarre sur `prisma migrate deploy && npm start` : une migration
qui échoue empêche le service de démarrer. J'ai neutralisé les trois pièges que
j'ai trouvés, mais je n'ai pas pu exécuter ces migrations contre une vraie base
(pas d'accès à la base depuis ce poste). **Garde les logs ouverts.**

**Comment faire.**
1. Render → service `qwillio` → onglet **Logs**, et laisse tourner.
2. Attends la fin du déploiement (~3 min).

**C'est bon quand** tu vois le service repasser en `live` et les logs de
démarrage habituels.

**Si ça casse** : le message d'erreur nommera la migration fautive. Envoie-le-moi
tel quel, ne tente pas de corriger la base à la main.

---

## Étape 2.2 — Chercher UN message précis dans les logs ⏱️ 2 min

**Pourquoi.** Une des migrations pose l'index qui empêche de vendre deux fois le
même créneau. Si ta base contient **déjà** deux réservations confirmées au même
créneau, l'index ne peut pas être créé. Plutôt que de faire tomber la
production, la migration **prévient et continue**.

**Comment faire.** Dans les logs Render, cherche `client_bookings`. Deux cas :

- **Tu ne trouves rien** → parfait, l'index est posé, la protection est active.
- **Tu trouves un `WARNING ... créneau(x) déjà réservé(s) en double`** → la
  protection **n'est pas** active. Il faut nettoyer les doublons. Pour les voir :

```sql
SELECT client_id, booking_date, booking_time, COUNT(*)
FROM client_bookings
WHERE status = 'confirmed' AND booking_time IS NOT NULL
GROUP BY client_id, booking_date, booking_time
HAVING COUNT(*) > 1;
```

Annule ou déplace les réservations en trop, puis rejoue la commande que le
message d'avertissement te donne.

---

## Étape 2.3 — Vérifier que la prod tourne la nouvelle version ⏱️ 1 min

```bash
curl -s https://qwillio.onrender.com/api/webhooks/vapi/health
```

**C'est bon quand** la réponse contient `fleetMetrics` avec un
`windowStartedAt` daté d'il y a quelques minutes (preuve du redémarrage).

---

# PARTIE 3 — Les variables d'environnement (10 minutes)

> **Le principe à retenir.** La PR #133 a livré beaucoup de protections **en
> opt-in par variable d'environnement** : tant que la variable est vide, le
> champ n'est même pas envoyé à Vapi. Autrement dit, **ces protections sont
> écrites mais inactives**. C'est la découverte principale du ré-audit.

Tout se passe dans Render → `qwillio` → **Environment** → *Add Environment
Variable*. Chaque ajout redéploie (~3 min) ; ajoute-les toutes puis sauvegarde
une seule fois.

## Étape 3.1 — Lever le point unique de panne STT ⏱️ 2 min

**Pourquoi.** Aujourd'hui, une panne Deepgram = plus aucun appel compris. Le
secours est codé, il n'attend qu'un nom de fournisseur.

| Variable | Valeur |
|---|---|
| `VOICE_STT_FALLBACK_PROVIDER` | `deepgram` (ou un autre fournisseur configuré) |

## Étape 3.2 — Lever le point unique de panne LLM ⏱️ 2 min

| Variable | Valeur |
|---|---|
| `VOICE_LLM_FALLBACK_MODELS` | `gpt-4o-mini` |

## Étape 3.3 — Rendre les évals réelles ⏱️ 3 min

**Pourquoi.** Le harness d'évals teste que ton agent se présente bien comme une
IA, résiste aux tentatives de détournement et n'invente pas de disponibilités.
**Il n'a jamais tourné.** Sans clé, il sautait en affichant un succès ; il le dit
maintenant, mais il ne protège toujours rien tant qu'il ne s'exécute pas.

**Comment faire.**
1. GitHub → dépôt `qwillio` → **Settings** → *Secrets and variables* → *Actions*
   → **New repository secret**.
2. Nom : `OPENAI_API_KEY`. Valeur : ta clé OpenAI.
3. Ensuite, dans `.github/workflows/ci.yml`, décommente la ligne
   `# EVALS_REQUIRE_KEY: '1'`. Dis-le-moi, je le fais.

**C'est bon quand** l'étape « Évals réceptionniste » de la CI affiche `9/9
scénarios verts`. Coût : quelques centimes par exécution.

---

# PARTIE 4 — Les tests réels (45 minutes, ensemble)

C'est la partie que je ne peux pas faire seul, et c'est la plus importante :
**aucun appel n'est encore passé depuis le déploiement**, donc l'objectif de
latence sous 1,1 seconde n'est ni tenu ni manqué, **il n'est pas mesuré**
(`fleetMetrics` affiche `calls: 0`).

## Étape 4.1 — Me donner un accès de test ⏱️ 2 min

Crée-moi un compte client sur la production, ou donne-moi les identifiants d'un
compte existant. Sans ça, je ne peux vérifier ni le tableau de bord, ni les
pages Appels / Leads / Réceptionniste / Facturation.

⚠️ **Ne me donne pas ton mot de passe administrateur.** Un compte de test suffit.

## Étape 4.2 — Le premier clic sur le portail Stripe ⏱️ 5 min

**Pourquoi.** Ce clic n'a **jamais** été fait en production. Si la configuration
du portail n'est pas publiée côté Stripe, il renvoie une erreur : c'est un
réglage du tableau de bord Stripe, pas un bug.

**Comment faire.** Connecte-toi au portail client → **Facturation** → clique sur
le bouton d'accès au portail Stripe. S'il échoue : Stripe → *Settings* →
*Billing* → *Customer portal* → **Activate**.

## Étape 4.3 — Les appels téléphoniques ⏱️ 20 min, avec moi en direct

Préviens-moi quand tu es disponible, je serai sur les logs. Dans l'ordre :

1. **Appel entrant.** Vérifier : la première phrase annonce « assistant IA »
   **et** « cet appel est enregistré » ; tu peux couper la parole nettement ;
   « c'est une IA ? » → elle confirme ; une prise de rendez-vous ; le SMS de
   confirmation ; l'événement dans Google Calendar ; le transfert vers un humain.
2. **Rappelle 2 minutes après.** Elle doit te reconnaître par ton prénom.
3. **Refais l'appel 1** avec `VOICE_SPEECH_TO_SPEECH=off` dans Render (chaîne
   classique ElevenLabs). Les deux modes doivent être vendables.
4. **En néerlandais**, si un client NL est configuré.

Après chaque appel je vérifie le transcript, le résumé, le lead, et la latence
par étage dans `fleetMetrics`.

---

# PARTIE 5 — Ce qui ne dépend que de toi (hors code)

| Quoi | Pourquoi | Où |
|---|---|---|
| Publier l'app Google en Production | Sinon la synchro calendrier expire tous les 7 jours | Google Cloud Console → OAuth consent screen |
| Acheter le numéro belge | Un numéro entrant appartient à UN client ; sans second numéro, pas de second client | Vapi ou Twilio |
| Choisir : région UE ou pas | Render est en Oregon. Le site ne promet plus l'UE (c'est correct). Basculer rendrait la promesse | `docs/MIGRATION-UE-RUNBOOK.md` |
| DPIA voix | Obligatoire pour un traitement de voix à grande échelle | Juriste |
| Mettre à jour la page Confidentialité | Elle annonce 90 jours fermes alors que la durée est désormais réglable par client | `frontend/src/pages/legal/Privacy.tsx` |

---

# Récapitulatif : les 5 choses à faire aujourd'hui

1. ☐ Vérifier qu'`ADMIN_SECRET` fait 32 caractères ou plus **(2 min)**
2. ☐ Surveiller le déploiement et chercher `client_bookings` dans les logs **(5 min)**
3. ☐ Ajouter les 2 variables de secours STT/LLM **(4 min)**
4. ☐ Poser la question B2B à un juriste **(1 message)**
5. ☐ Me dire quand tu es dispo pour les appels **(20 min ensemble)**

Le reste peut attendre la semaine prochaine.
