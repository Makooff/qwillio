-- Referral programme. Purely additive: three new tables, no change to any
-- existing column, so this is safe to apply to live data.

CREATE TABLE "affiliates" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "commission_pct" DOUBLE PRECISION NOT NULL DEFAULT 0.30,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "payout_email" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "affiliates_user_id_key" ON "affiliates"("user_id");
CREATE UNIQUE INDEX "affiliates_code_key" ON "affiliates"("code");

CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- One affiliate per customer, fixed at sign-up: a later link cannot steal an
-- existing customer.
CREATE UNIQUE INDEX "referrals_client_id_key" ON "referrals"("client_id");
CREATE INDEX "referrals_affiliate_id_idx" ON "referrals"("affiliate_id");

CREATE TABLE "affiliate_commissions" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "stripe_invoice_id" VARCHAR(255) NOT NULL,
    "invoice_amount_eur" DECIMAL(10,2) NOT NULL,
    "amount_eur" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id")
);

-- A retried Stripe webhook must never credit the same invoice twice.
CREATE UNIQUE INDEX "affiliate_commissions_stripe_invoice_id_key" ON "affiliate_commissions"("stripe_invoice_id");
CREATE INDEX "affiliate_commissions_affiliate_id_status_idx" ON "affiliate_commissions"("affiliate_id", "status");

ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
