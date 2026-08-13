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
--
-- `convert_to(..., 'UTF8')` et NON `"key"::bytea`: le cast direct texte→bytea
-- passe par la fonction d'entrée de `bytea`, qui INTERPRÈTE les séquences
-- d'échappement (`\x`, `\\`). Sur une clé en contenant une, le condensat SQL
-- différerait de celui que Node calcule sur les octets UTF-8, et cette clé
-- cesserait de fonctionner sans qu'on sache pourquoi. `convert_to` encode les
-- octets, sans interprétation: c'est exactement ce que fait
-- `createHash('sha256').update(key, 'utf8')`.
UPDATE "api_keys"
   SET "key_hash" = encode(sha256(convert_to("key", 'UTF8')), 'hex')
 WHERE "key_hash" IS NULL;

-- Unique, comme l'était la colonne en clair: deux clés distinctes ne peuvent
-- pas partager un condensat, et la recherche reste un accès par index.
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_hash_key" ON "api_keys" ("key_hash");
