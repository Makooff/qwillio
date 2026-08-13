-- 1. Anti-double-réservation.
--
-- Les « holds » de créneau vivent en mémoire du processus: ils empêchent deux
-- tours d'un MÊME appel de réserver deux fois, et rien d'autre. Deux appels
-- simultanés — ou deux instances — pouvaient donc confirmer le même créneau au
-- même client, chacun annonçant « c'est réservé » à voix haute.
--
-- Index PARTIEL, et c'est le point important: une réservation annulée doit
-- libérer le créneau. Une contrainte pleine l'aurait gelé définitivement.
-- (Prisma ne sait pas exprimer un index partiel dans le schéma; il est donc
-- déclaré ici, et le code intercepte la violation P2002.)
CREATE UNIQUE INDEX IF NOT EXISTS "client_bookings_slot_unique"
  ON "client_bookings" ("client_id", "booking_date", "booking_time")
  WHERE "status" = 'confirmed' AND "booking_time" IS NOT NULL;

-- 2. Réconciliation des synchronisations calendrier échouées.
--
-- L'écriture Google n'est délibérément pas attendue: le correspondant a déjà
-- sa confirmation et la ligne en base fait foi. Le commentaire du code
-- annonçait qu'un échec relevait « d'un travail de réconciliation » — travail
-- qui n'existait pas. Le rendez-vous restait en base, absent du calendrier,
-- et personne ne le savait.
--
-- Ces deux colonnes donnent au job de quoi distinguer les trois états:
--   syncedAt renseigné            → à jour (ou rien à synchroniser);
--   syncedAt nul + attempts = 0   → jamais tenté;
--   syncedAt nul + attempts > 0   → en échec, à reprendre avec retenue.
ALTER TABLE "client_bookings"
  ADD COLUMN IF NOT EXISTS "calendar_synced_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "calendar_sync_attempts" INTEGER NOT NULL DEFAULT 0;

-- L'existant est marqué comme réglé: une réservation déjà porteuse d'un
-- identifiant d'événement est synchronisée, et rétro-tenter les anciennes
-- déclencherait une vague d'écritures Google sur des rendez-vous passés.
UPDATE "client_bookings"
   SET "calendar_synced_at" = "created_at"
 WHERE "calendar_synced_at" IS NULL
   AND ("google_event_id" IS NOT NULL OR "booking_date" < NOW());

-- Le job ne balaie que les lignes en attente: index restreint à celles-là.
CREATE INDEX IF NOT EXISTS "client_bookings_pending_sync_idx"
  ON "client_bookings" ("calendar_sync_attempts", "booking_date")
  WHERE "calendar_synced_at" IS NULL;
