-- Numéros supplémentaires par client (multi-sites).
--
-- Purement additive : aucune colonne existante n'est touchée, le numéro
-- principal reste sur clients.vapi_phone_number. Un client sans ligne ici
-- fonctionne exactement comme avant.
CREATE TABLE "client_phone_numbers" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "number" VARCHAR(50) NOT NULL,
    "label" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_phone_numbers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_phone_numbers_client_id_idx" ON "client_phone_numbers"("client_id");

ALTER TABLE "client_phone_numbers"
    ADD CONSTRAINT "client_phone_numbers_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
