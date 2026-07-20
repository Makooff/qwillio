-- Per-minute billing: monthly included-minutes quota on clients.
-- Additive and nullable — safe on live data. The old monthly_calls_quota
-- column is kept during the transition.
ALTER TABLE "clients" ADD COLUMN "monthly_minutes_quota" INTEGER;
