-- Pre-synthesised greeting audio. Additive: one new table, nothing modified.

-- CreateTable
CREATE TABLE "greeting_audio" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "variant" INTEGER NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "text" TEXT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL DEFAULT 'audio/mpeg',
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "greeting_audio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "greeting_audio_client_id_variant_key" ON "greeting_audio"("client_id", "variant");
CREATE INDEX "greeting_audio_client_id_idx" ON "greeting_audio"("client_id");

-- AddForeignKey
ALTER TABLE "greeting_audio" ADD CONSTRAINT "greeting_audio_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
