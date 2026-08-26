-- Un agent par ligne telephonique, en SURCHARGE de celui du client.
--
-- `client_phone_numbers.label` existait deja (« Boutique Ixelles »), et
-- `inbound-routing` calculait meme un `lineLabel`... qu'il jetait ensuite: il
-- n'atteignait jamais le prompt. Un garage avec une ligne atelier et une ligne
-- vente avait donc le meme agent sur les deux, et l'agent ne savait meme pas
-- laquelle avait ete composee.
--
-- Toutes les colonnes sont NULLABLES et valent « garde celui du client ».
-- Aucune ligne existante ne change de comportement: sans reglage, la
-- receptionniste servie est exactement celle d'avant.
ALTER TABLE "client_phone_numbers" ADD COLUMN "agent_name" VARCHAR(80);
ALTER TABLE "client_phone_numbers" ADD COLUMN "greeting" TEXT;
ALTER TABLE "client_phone_numbers" ADD COLUMN "instructions" TEXT;
ALTER TABLE "client_phone_numbers" ADD COLUMN "transfer_number" VARCHAR(50);
ALTER TABLE "client_phone_numbers" ADD COLUMN "character_id" VARCHAR(60);
