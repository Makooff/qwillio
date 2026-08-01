-- Semantic search over the knowledge base. Additive: two nullable/defaulted
-- columns on an existing table, no backfill required — an entry with no
-- embedding simply falls back to the lexical score.

ALTER TABLE "business_knowledge" ADD COLUMN "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[];
ALTER TABLE "business_knowledge" ADD COLUMN "embedding_model" VARCHAR(100);
