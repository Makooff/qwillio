// Single source of truth for Qwillio plan pricing — PER-MINUTE model.
//
// Launch prices in EUR (BE/FR market). Each plan bundles a monthly amount of
// INCLUDED MINUTES; usage beyond that is billed per minute of overage. This
// replaces the old per-call quota + per-call overage that was duplicated across
// stripe.service, types/index and quota-alert. Import PLANS / getPlan here
// instead of re-declaring price tables. The frontend keeps its own display copy
// (Pricing.tsx) aligned to these numbers.
//
// Cost basis (public rates, ~0.15 EUR/min all-in): margins stay healthy at
// every tier; overage always keeps >=100% markup over cost. Prices are
// deliberately positioned under human answering services (Smith.ai/Ruby) and
// are treated as launch prices (raise later once credibility grows).

export type PlanId = 'solo' | 'starter' | 'pro' | 'enterprise';

export interface Plan {
  id: PlanId;
  name: string;
  monthlyPriceEur: number;
  includedMinutes: number;
  overagePerMinuteEur: number;
  trialDays: number;
  trialMinutes: number;
  // Env var holding the Stripe recurring Price id for this plan.
  stripePriceEnv:
    | 'STRIPE_PRICE_SOLO_MONTHLY'
    | 'STRIPE_PRICE_BASIC_MONTHLY'
    | 'STRIPE_PRICE_PRO_MONTHLY'
    | 'STRIPE_PRICE_ENTERPRISE_MONTHLY';
}

export const PLANS: Record<PlanId, Plan> = {
  solo: {
    id: 'solo',
    name: 'Solo',
    monthlyPriceEur: 99,
    includedMinutes: 250,
    overagePerMinuteEur: 0.45,
    trialDays: 30,
    trialMinutes: 60,
    stripePriceEnv: 'STRIPE_PRICE_SOLO_MONTHLY',
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPriceEur: 249,
    includedMinutes: 750,
    overagePerMinuteEur: 0.39,
    trialDays: 30,
    trialMinutes: 120,
    stripePriceEnv: 'STRIPE_PRICE_BASIC_MONTHLY',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPriceEur: 599,
    includedMinutes: 2000,
    overagePerMinuteEur: 0.35,
    trialDays: 30,
    trialMinutes: 250,
    stripePriceEnv: 'STRIPE_PRICE_PRO_MONTHLY',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPriceEur: 1290,
    includedMinutes: 5000,
    overagePerMinuteEur: 0.30,
    trialDays: 30,
    trialMinutes: 500,
    stripePriceEnv: 'STRIPE_PRICE_ENTERPRISE_MONTHLY',
  },
};

/** Resolve a plan by id (case-insensitive); defaults to Starter for unknown ids. */
export function getPlan(planType: string | null | undefined): Plan {
  const key = (planType || '').toLowerCase() as PlanId;
  return PLANS[key] ?? PLANS.starter;
}
