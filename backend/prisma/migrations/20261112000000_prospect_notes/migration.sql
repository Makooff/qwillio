-- Notes datees par prospect, et index de la page « Mes prospects ».
-- Additif uniquement (une table neuve, un index) : sans risque sur les donnees.
CREATE TABLE "prospect_notes" (
    "id" UUID NOT NULL,
    "prospect_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "prospect_notes_prospect_id_created_at_idx" ON "prospect_notes"("prospect_id", "created_at");

ALTER TABLE "prospect_notes" ADD CONSTRAINT "prospect_notes_prospect_id_fkey"
    FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "prospects_last_contact_date_idx" ON "prospects"("last_contact_date");
