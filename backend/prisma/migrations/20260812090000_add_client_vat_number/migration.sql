-- Numéro de TVA intracommunautaire du client.
-- Colonne NULLABLE et sans valeur par défaut: elle s'ajoute sans réécrire la
-- table ni verrouiller les clients existants, qui restent simplement sans
-- numéro tant qu'ils ne l'ont pas saisi.
ALTER TABLE "clients" ADD COLUMN "vat_number" VARCHAR(32);
