-- L'attribution de la ligne entrante devient un ETAT, pas une supposition.
--
-- Trois chemins la decidaient sans jamais dire ou ils s'etaient arretes:
-- l'allocation du numero partage, l'achat automatique, et le numero declare
-- par le client. Un client sans ligne etait indistinguable d'un client dont
-- l'achat avait echoue.
--
-- Valeur par defaut 'none' pour tout le monde: la reconciliation se fait au
-- premier passage de l'orchestrateur, qui est idempotent. Aucun client
-- existant ne perd sa ligne, `vapi_phone_number` n'est pas touche.
ALTER TABLE "clients" ADD COLUMN "phone_setup_state" VARCHAR(30) NOT NULL DEFAULT 'none';
ALTER TABLE "clients" ADD COLUMN "phone_setup_reason" TEXT;
ALTER TABLE "clients" ADD COLUMN "phone_setup_at" TIMESTAMP(3);

-- Un client qui a DEJA un numero est actif: sans cette ligne, le premier
-- passage de l'orchestrateur le croirait a provisionner et rachèterait une
-- ligne facturee pour rien.
UPDATE "clients" SET "phone_setup_state" = 'active', "phone_setup_at" = NOW()
WHERE "vapi_phone_number" IS NOT NULL AND "vapi_phone_number" <> '';

CREATE INDEX "clients_phone_setup_state_idx" ON "clients"("phone_setup_state");
