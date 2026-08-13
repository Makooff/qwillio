-- Opt-out d'appel sortant, avec trace (source + date) conservée comme preuve.
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "call_opted_out" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "call_opted_out_at" TIMESTAMP(3);
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "call_opt_out_source" VARCHAR(20);
