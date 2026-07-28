-- Prospection: saved searches, and a per-prospect sales script.
-- Purely additive: one new table and two nullable columns, so this is safe to
-- apply to live data.

CREATE TABLE "saved_searches" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "filters" JSONB NOT NULL,
    "last_prospect_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- One name per person, so re-saving a search updates it instead of piling up.
CREATE UNIQUE INDEX "saved_searches_user_id_name_key" ON "saved_searches"("user_id", "name");
CREATE INDEX "saved_searches_user_id_idx" ON "saved_searches"("user_id");

ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The script is generated on demand and kept, so reopening a prospect costs
-- nothing. Nullable: every existing row simply has no script yet.
ALTER TABLE "prospects" ADD COLUMN "sales_script" JSONB;
ALTER TABLE "prospects" ADD COLUMN "sales_script_at" TIMESTAMP(3);
