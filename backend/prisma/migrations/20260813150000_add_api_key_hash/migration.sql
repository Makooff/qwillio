-- Condensat des clés API (voir `utils/api-key-hash.ts`).
--
-- Migration ADDITIVE et réversible: la colonne en clair est conservée à ce
-- stade. Elle ne sera vidée puis retirée que dans une seconde migration, une
-- fois vérifié en production que toutes les lignes portent bien un condensat.
-- Faire les deux d'un coup rendrait toute erreur de calcul irrécupérable: un
-- condensat ne se rétro-calcule pas en clé.
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "key_hash" TEXT;

-- Reprise de l'existant. `sha256()` est natif depuis PostgreSQL 11 et calcule
-- exactement le même condensat que `crypto.createHash('sha256')` côté Node,
-- donc les clés déjà distribuées continuent de fonctionner sans rotation.
UPDATE "api_keys"
   SET "key_hash" = encode(sha256("key"::bytea), 'hex')
 WHERE "key_hash" IS NULL;

-- Unique, comme l'était la colonne en clair: deux clés distinctes ne peuvent
-- pas partager un condensat, et la recherche reste un accès par index.
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_hash_key" ON "api_keys" ("key_hash");
