# 20261030000000_booking_slot_unique_strict

Suivi **strict** (fail-closed) de
`20260813170000_booking_no_double_and_calendar_reconcile`.

## Pourquoi cette migration existe

La migration historique tentait de créer l'index partiel unique
`client_bookings_slot_unique` (« un seul rendez-vous confirmé par créneau par
commerce »), mais enveloppée dans un `DO` qui ne pouvait pas échouer : si la
base contenait déjà des doublons confirmés, elle émettait un `RAISE WARNING`
et Prisma enregistrait la migration comme **réussie**. Un déployé peut donc
croire être protégé contre la double réservation alors que l'index n'existe
pas — sans aucune trace dans l'état des migrations.

## Ce que celle-ci fait

1. **Doublons confirmés présents** → `RAISE EXCEPTION`. La migration échoue,
   `prisma migrate deploy` échoue, le déploiement est bloqué. Rien n'est
   effacé, annulé, ni « dédupliqué » automatiquement.
2. **Index existant mais invalide** (création `CONCURRENTLY` interrompue par un
   crash — Postgres ignore alors un index invalide) → dépôt puis recréation.
3. **Sinon** → création de l'index (no-op si déjà présent et valide).

`CREATE INDEX CONCURRENTLY` n'est pas utilisé volontairement : il est interdit
dans un bloc `DO` / dans une transaction, et Prisma rejoue ce fichier tel
quel. Le `CREATE UNIQUE INDEX` classique prend un verrou court ; le contrôle
de doublons du premier `DO` garantit qu'il ne peut échouer que sur une course
d'écriture — auquel cas échouer est le comportement voulu.

## Résolution manuelle en cas de blocage (jamais automatique)

La requête de diagnostic est dans le message d'erreur :

```sql
SELECT client_id, booking_date, booking_time, COUNT(*)
FROM client_bookings
WHERE status = 'confirmed' AND booking_time IS NOT NULL
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1;
```

Pour chaque créneau en double :

- **déplacer** la réservation en trop vers un autre créneau, ou
- l'**annuler** (`status = 'cancelled'` — l'index est partiel et ne porte que
  sur les `confirmed`, le créneau se libère),

**depuis l'application** (portail / outil métier), jamais par `DELETE`. On ne
supprime jamais de réservation client : une annulation conserve l'historique.

Si Prisma a enregistré une tentative échouée, corriger les doublons ne suffit
pas : il refusera le prochain `migrate deploy` tant que cet échec n'est pas
résolu. Après vérification de l'état réel de la base et des étapes déjà
appliquées, l'opérateur peut marquer cette tentative comme annulée :

```sh
npx prisma migrate resolve --rolled-back 20261030000000_booking_slot_unique_strict
```

Relancer ensuite le déploiement : la migration sera rejouée et créera l'index.
Ces opérations sur la base cible exigent une validation distincte ; le merge
du code n'applique pas la migration et ne résout pas les doublons.

## Portée de la garantie

L'index partiel protège l'intégrité **au niveau base**, y compris contre deux
instances simultanées (le code intercepte aussi la violation Prisma P2002,
cf. `backend/src/services/voice/__tests__/booking-conflict-p2002.test.ts`).
Aucun test local (WASM ou mock) ne prouve le comportement multi-instance en
production ; seule l'application réelle de cette migration sur la base cible
le fait.

## Vérification SQL locale reproductible

Depuis la racine du dépôt :

```sh
npm --prefix backend/tests/sql ci --ignore-scripts
npm --prefix backend/tests/sql test
```

Ce paquet de test isolé utilise PostgreSQL/WASM (PGlite), pas la base du
commerce. Il vérifie le refus des doublons sans suppression de données,
l'index unique partiel, son rejeu, sa remise en état et le refus d'un index
homonyme non unique ou attaché à une autre table. Les dépendances du backend
de production ne sont pas modifiées.
