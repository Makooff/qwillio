-- Persistent caller memory and business knowledge for the AI receptionist.
-- Purely additive: two new tables, no change to any existing column.

-- CreateTable
CREATE TABLE "caller_memories" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "caller_number" VARCHAR(50) NOT NULL,
    "known_name" VARCHAR(255),
    "email" VARCHAR(255),
    "profile_summary" TEXT,
    "preferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "facts" JSONB,
    "total_calls" INTEGER NOT NULL DEFAULT 0,
    "last_call_at" TIMESTAMP(3),
    "last_summary" TEXT,
    "last_outcome" VARCHAR(100),
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caller_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_knowledge" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "caller_memories_client_id_caller_number_key" ON "caller_memories"("client_id", "caller_number");
CREATE INDEX "caller_memories_client_id_idx" ON "caller_memories"("client_id");
CREATE INDEX "caller_memories_client_id_last_call_at_idx" ON "caller_memories"("client_id", "last_call_at");
CREATE INDEX "business_knowledge_client_id_kind_is_active_idx" ON "business_knowledge"("client_id", "kind", "is_active");
CREATE INDEX "business_knowledge_client_id_priority_idx" ON "business_knowledge"("client_id", "priority");

-- AddForeignKey
ALTER TABLE "caller_memories" ADD CONSTRAINT "caller_memories_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_knowledge" ADD CONSTRAINT "business_knowledge_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
