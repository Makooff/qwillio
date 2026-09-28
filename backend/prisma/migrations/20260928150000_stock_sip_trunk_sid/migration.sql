-- Le trunk SIP Twilio qui achemine un numéro du stock vers LiveKit.
--
-- Additif et nullable : les numéros déjà en stock gardent NULL, ce qui veut
-- dire « pas encore basculé sur le cœur vocal ». Aucune ligne existante ne
-- change de comportement, et rien ne devient injoignable par cette migration.
ALTER TABLE "phone_number_stock" ADD COLUMN IF NOT EXISTS "sip_trunk_sid" VARCHAR(64);
