-- Grille du 24/11/2026 : plus de minutes incluses à prix égal.
-- Seuls les quotas qui valent EXACTEMENT l'ancien défaut d'un forfait sont
-- relevés (250, 750, 2000, 5000). Un quota posé à la main pour un client
-- garde sa valeur. Aucun quota ne baisse.
UPDATE "clients"
SET "monthly_minutes_quota" = CASE "monthly_minutes_quota"
  WHEN 250 THEN 500
  WHEN 750 THEN 1400
  WHEN 2000 THEN 3500
  WHEN 5000 THEN 8000
END
WHERE "monthly_minutes_quota" IN (250, 750, 2000, 5000);
