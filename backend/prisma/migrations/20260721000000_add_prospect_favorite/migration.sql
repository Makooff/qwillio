-- Favorite/bookmark flag on prospects. Additive, defaulted — safe on live data.
ALTER TABLE "prospects" ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false;
