-- Add password reset fields to users (additive, nullable — safe on live data)
ALTER TABLE "users" ADD COLUMN "reset_token" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "reset_token_expiry" TIMESTAMP(3);
CREATE UNIQUE INDEX "users_reset_token_key" ON "users"("reset_token");
