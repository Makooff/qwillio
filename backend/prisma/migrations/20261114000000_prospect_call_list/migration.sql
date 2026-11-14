-- La liste d'appels du fondateur et le journal de ses appels passés à la main.
--
-- ADDITIF au sens strict: une colonne nullable et une table neuve. Aucune ligne
-- existante n'est réécrite, aucune contrainte n'est posée sur l'existant, donc
-- la migration ne peut pas échouer sur des données déjà présentes.

ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "call_list_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "prospects_call_list_at_idx" ON "prospects"("call_list_at");

CREATE TABLE IF NOT EXISTS "prospect_call_logs" (
    "id" UUID NOT NULL,
    "prospect_id" UUID NOT NULL,
    "user_id" UUID,
    "outcome" VARCHAR(30) NOT NULL,
    "objection" VARCHAR(40),
    "note" TEXT,
    "callback_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_call_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "prospect_call_logs_prospect_id_created_at_idx" ON "prospect_call_logs"("prospect_id", "created_at");
CREATE INDEX IF NOT EXISTS "prospect_call_logs_created_at_idx" ON "prospect_call_logs"("created_at");
CREATE INDEX IF NOT EXISTS "prospect_call_logs_outcome_idx" ON "prospect_call_logs"("outcome");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prospect_call_logs_prospect_id_fkey') THEN
    ALTER TABLE "prospect_call_logs"
      ADD CONSTRAINT "prospect_call_logs_prospect_id_fkey"
      FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
