-- Spam / bot detection for inbound receptionist calls.
-- All changes are additive and safe on live data.

-- Spam classification columns on client_calls (nullable / defaulted).
ALTER TABLE "client_calls" ADD COLUMN "is_spam" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "client_calls" ADD COLUMN "spam_score" INTEGER;
ALTER TABLE "client_calls" ADD COLUMN "spam_reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Per-client spam blocklist.
CREATE TABLE "spam_numbers" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "phone_number" VARCHAR(50) NOT NULL,
    "reason" VARCHAR(255),
    "source" VARCHAR(20) NOT NULL DEFAULT 'auto',
    "hit_count" INTEGER NOT NULL DEFAULT 1,
    "last_hit_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spam_numbers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "spam_numbers_client_id_phone_number_key" ON "spam_numbers"("client_id", "phone_number");
CREATE INDEX "spam_numbers_client_id_idx" ON "spam_numbers"("client_id");

ALTER TABLE "spam_numbers" ADD CONSTRAINT "spam_numbers_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
