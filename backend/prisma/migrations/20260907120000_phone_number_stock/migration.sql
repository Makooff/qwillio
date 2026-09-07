-- Le STOCK de numeros belges achetes d'avance.
--
-- Jusqu'ici, UN seul numero (`VAPI_PHONE_NUMBER`) servait toute la flotte, et
-- `phone-allocation` l'attribuait de facon exclusive: le deuxieme client actif
-- repartait sans ligne. L'autre chemin, `PHONE_AUTO_PROVISION`, achetait un
-- numero par client au moment de l'activation -- donc une dependance externe
-- (dossier reglementaire) sur le chemin critique de l'onboarding.
--
-- Le stock renverse l'ordre: on achete un lot A L'AVANCE, sous le dossier
-- reglementaire de Qwillio, et l'activation ne fait plus qu'y piocher. Le
-- client ne fournit aucune piece et n'attend aucune validation.
CREATE TABLE "phone_number_stock" (
    "id" UUID NOT NULL,
    "number" VARCHAR(50) NOT NULL,
    "country" VARCHAR(2) NOT NULL DEFAULT 'BE',
    "number_type" VARCHAR(20) NOT NULL DEFAULT 'local',
    "twilio_sid" VARCHAR(64),
    "vapi_number_id" VARCHAR(64),
    "bundle_sid" VARCHAR(64),
    "status" VARCHAR(20) NOT NULL DEFAULT 'available',
    "client_id" UUID,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "phone_number_stock_pkey" PRIMARY KEY ("id")
);

-- Un meme numero achete deux fois serait deux lignes facturees pour un seul
-- appel, et deux lignes de stock qu'on pourrait attribuer a deux clients.
CREATE UNIQUE INDEX "phone_number_stock_number_key" ON "phone_number_stock"("number");
CREATE UNIQUE INDEX "phone_number_stock_twilio_sid_key" ON "phone_number_stock"("twilio_sid");
CREATE UNIQUE INDEX "phone_number_stock_vapi_number_id_key" ON "phone_number_stock"("vapi_number_id");

-- La seule requete chaude: prendre le plus ancien numero libre.
CREATE INDEX "phone_number_stock_status_idx" ON "phone_number_stock"("status");
CREATE INDEX "phone_number_stock_client_id_idx" ON "phone_number_stock"("client_id");

-- SET NULL et non CASCADE: un client supprime doit RENDRE son numero au stock,
-- pas l'emporter. La ligne reste facturee chez Twilio de toute facon.
ALTER TABLE "phone_number_stock"
  ADD CONSTRAINT "phone_number_stock_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
