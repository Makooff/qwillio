-- Ce que l'agent NE SAIT PAS, enregistre pour de bon.
--
-- Jusqu'ici, une question a laquelle la receptionniste ne savait pas repondre
-- ne laissait rien: elle disait qu'elle ferait remonter la question, et la
-- question s'arretait la. Le gerant ne l'apprenait jamais, la base de
-- connaissances ne grossissait jamais, et le prochain appelant reposait la
-- meme question pour la meme reponse absente. Un compteur de consultations
-- existait bien (`knowledge_gaps` dans le rapport hebdomadaire), mais il
-- comptait les recherches REUSSIES autant que les autres et ne gardait aucune
-- question.
--
-- La cle est `(client_id, fingerprint)` et non l'identifiant seul: deux
-- appelants qui demandent la meme chose dans des mots differents doivent
-- incrementer une ligne, pas en creer une seconde. Un gerant qui ouvre son
-- portail veut cinq questions triees par frequence, pas quarante variantes.
-- `id` sans defaut SQL, comme toutes les autres tables de ce schema: c'est
-- Prisma Client qui produit l'UUID (`@default(uuid())`). Un
-- `DEFAULT gen_random_uuid()` introduirait une dependance a pgcrypto /
-- PostgreSQL 13 qui n'existe nulle part ailleurs dans ces migrations, pour un
-- filet dont personne ne se sert. La lecon est deja ecrite dans
-- `20260813160000_add_call_consent`.
CREATE TABLE IF NOT EXISTS "knowledge_gaps" (
  "id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "question" VARCHAR(500) NOT NULL,
  "fingerprint" VARCHAR(200) NOT NULL,
  "asked_count" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(20) NOT NULL DEFAULT 'open',
  "language" VARCHAR(5) NOT NULL DEFAULT 'fr',
  "source" VARCHAR(20) NOT NULL DEFAULT 'lookup',
  "answered_entry_id" UUID,
  "first_asked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_asked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answered_at" TIMESTAMP(3),
  CONSTRAINT "knowledge_gaps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_gaps_client_id_fingerprint_key"
  ON "knowledge_gaps"("client_id", "fingerprint");

-- Le tri du portail: les questions ouvertes d'un client, les plus posees en
-- tete. C'est la seule lecture chaude de cette table.
CREATE INDEX IF NOT EXISTS "knowledge_gaps_client_id_status_asked_count_idx"
  ON "knowledge_gaps"("client_id", "status", "asked_count");

-- Le rattachement au client, pose seulement s'il manque: `ADD CONSTRAINT` n'a
-- pas de forme `IF NOT EXISTS`, et le reste de ce fichier en a une. Une
-- migration a moitie idempotente ne l'est pas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_gaps_client_id_fkey'
  ) THEN
    ALTER TABLE "knowledge_gaps" ADD CONSTRAINT "knowledge_gaps_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
