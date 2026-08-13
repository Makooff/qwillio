-- Durée de conservation des données d'appel, par client (null = défaut 90 j).
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "retention_days" INTEGER;
