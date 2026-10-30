-- ═══════════════════════════════════════════════════════════════════
-- SUIVI STRICT de 20260813170000_booking_no_double_and_calendar_reconcile.
--
-- La migration historique tentait l'index unique anti-double-réservation, mais
-- EN SILENCE: si la base contenait déjà des doublons confirmés, elle émettait
-- un WARNING et enregistrait la migration comme RÉUSSIE. Résultat: un déploié
-- qui croit être protégé et ne l'est pas, sans aucune trace dans l'état des
-- migrations. Celle-ci est la version qui DIT NON:
--
--   1. Des doublons confirmés sur le même créneau → la migration ÉCHOUE
--      (RAISE EXCEPTION). Le déploiement est bloqué, pas contourné. AUCUNE
--      donnée n'est supprimée, annulée ni « dédupliquée » automatiquement:
--      la résolution est humaine et explicite (voir README.md de ce dossier).
--   2. L'index existe mais est INVALIDE (CREATE INDEX CONCURRENTLY interrompu
--      par un crash, typiquement) → il est d'abord déposé, puis recréé propre.
--   3. L'index n'existe pas et la base est propre → il est créé.
--
-- Pourquoi pas CREATE INDEX CONCURRENTLY: il est interdit dans un bloc DO et
-- dans une transaction, et Prisma rejoue ce fichier tel quel. On prend le
-- verrou court d'un CREATE UNIQUE INDEX classique — le DO précédent ayant
-- déjà vérifié l'absence de doublons, la création ne peut pas échouer sur
-- des données; si une course insérait un doublon entre les deux, le CREATE
-- échouerait aussi, et c'est voulu: échouer fermé, jamais réussir en silence.
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  duplicate_count INTEGER;
  index_invalid   BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO duplicate_count FROM (
    SELECT 1 FROM "client_bookings"
     WHERE "status" = 'confirmed' AND "booking_time" IS NOT NULL
     GROUP BY "client_id", "booking_date", "booking_time"
    HAVING COUNT(*) > 1
  ) AS dupes;

  IF duplicate_count > 0 THEN
    /* Bloquer LE DÉPLOIEMENT, pas la donnée: lever ici fait échouer
       `prisma migrate deploy`, donc le conteneur ne démarre pas sur une base
       qu'on croit protégée et qui ne l'est pas. La résolution est manuelle et
       jamais destructive: annuler ou déplacer les réservations en trop via
       l'application, puis relancer le déploiement. Voir README.md. */
    RAISE EXCEPTION
      'client_bookings: % créneau(x) confirmé(s) en double — index unique client_bookings_slot_unique NON créé. Résolution manuelle requise AVANT déploiement: identifiez les doublons (SELECT client_id, booking_date, booking_time, COUNT(*) FROM client_bookings WHERE status=''confirmed'' AND booking_time IS NOT NULL GROUP BY 1,2,3 HAVING COUNT(*)>1), annulez ou déplacez les réservations en trop, puis rejouez la migration. AUCUNE donnée n''a été modifiée par cette migration.',
      duplicate_count;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.relname = 'client_bookings_slot_unique'
       AND i.indrelid = 'client_bookings'::regclass
       AND NOT i.indisvalid
  ) INTO index_invalid;

  IF index_invalid THEN
    /* Un index invalide ne protège rien (Postgres l'ignore) mais fait que
       IF NOT EXISTS le « trouverait » et le garderait. On le dépose. DROP
       INDEX sans CONCURRENTLY est autorisé ici (dans le DO/transaction);
       le verrou est bref car la table n'est pas réécrite. */
    RAISE NOTICE 'client_bookings_slot_unique existe mais est invalide — dépôt puis recréation';
    DROP INDEX "client_bookings_slot_unique";
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "client_bookings_slot_unique"
  ON "client_bookings" ("client_id", "booking_date", "booking_time")
  WHERE "status" = 'confirmed' AND "booking_time" IS NOT NULL;

-- Épingle de cohérence: si l'index final n'est ni présent ni valide, on
-- échoue. (Cas théorique — IF NOT EXISTS aurait pu sauter sur un reste —
-- mais « échouer fermé » est la règle de cette migration.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.relname = 'client_bookings_slot_unique'
       AND i.indrelid = 'client_bookings'::regclass
       AND i.indisvalid
       AND i.indisunique
       AND i.indisready
  ) THEN
    RAISE EXCEPTION 'client_bookings_slot_unique introuvable, non unique ou invalide après migration — déploiement bloqué, ne pas démarrer le service.';
  END IF;
END $$;
