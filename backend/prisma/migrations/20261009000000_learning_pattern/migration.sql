-- La table des enseignements de conversation appris des appels.
-- Voir `services/voice/call-patterns.service.ts` et le modèle Prisma.
CREATE TABLE "learning_pattern" (
    "id" UUID NOT NULL,
    "fingerprint" VARCHAR(140) NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'conversation',
    "title" VARCHAR(200) NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "call_count" INTEGER NOT NULL DEFAULT 0,
    "client_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(20) NOT NULL DEFAULT 'observing',
    "proposal_url" VARCHAR(500),
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_pattern_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_pattern_fingerprint_key" ON "learning_pattern"("fingerprint");
CREATE INDEX "learning_pattern_status_idx" ON "learning_pattern"("status");
