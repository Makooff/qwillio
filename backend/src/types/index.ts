import { PLANS, type PlanId } from '../config/plans';

export interface PackageConfig {
  name: string;
  setupFee: number;
  monthlyFee: number;         // EUR/month
  includedMinutes: number;    // minutes included per month
  overagePerMinuteEur: number;
  features: string[];
  trialDays: number;
  trialMinutes: number;
}

// Feature copy per plan, layered on top of the shared PLANS pricing so prices
// live in exactly one place (config/plans.ts). Minutes/overage strings are
// derived from PLANS so they can never drift from what Stripe actually bills.
const PACKAGE_FEATURES: Record<PlanId, string[]> = {
  solo: [
    'Marie (FR) or Ashley (EN) dedicated AI voice',
    'Appointment booking + calendar sync',
    'Analytics dashboard',
    'Email support',
    'Call recording & transcripts',
  ],
  starter: [
    'Everything in Solo, plus:',
    'Lead qualification',
    'Priority email support',
    'Native CRM integrations',
  ],
  pro: [
    'Everything in Starter, plus:',
    'Advanced analytics + sentiment analysis',
    'Smart call transfer',
    'Priority support (phone + email)',
  ],
  enterprise: [
    'Everything in Pro, plus:',
    'Bilingual agent EN/FR',
    'Dedicated account manager',
    '99.5% SLA guaranteed',
    'Self-learning AI optimization',
    'API access',
  ],
};

function toPackage(id: PlanId): PackageConfig {
  const p = PLANS[id];
  const overage = p.overagePerMinuteEur.toFixed(2).replace('.', ',');
  return {
    name: p.name.toUpperCase(),
    setupFee: 0,
    monthlyFee: p.monthlyPriceEur,
    includedMinutes: p.includedMinutes,
    overagePerMinuteEur: p.overagePerMinuteEur,
    trialDays: p.trialDays,
    trialMinutes: p.trialMinutes,
    features: [
      `${p.includedMinutes} minutes incluses / mois`,
      ...PACKAGE_FEATURES[id],
      `Dépassement : ${overage} €/min`,
    ],
  };
}

export const PACKAGES: Record<string, PackageConfig> = {
  solo: toPackage('solo'),
  starter: toPackage('starter'),
  pro: toPackage('pro'),
  enterprise: toPackage('enterprise'),
  // `basic` is a legacy alias used as a fallback in several services.
  basic: toPackage('starter'),
};

export interface ProspectScoreFactors {
  rating: number | null;
  reviewsCount: number | null;
  hasWebsite: boolean;
  hasPhone: boolean;
  businessType: string;
  country?: string;
  phoneValidated?: boolean;
}

export interface CallAnalysis {
  contactName: string | null;
  email: string | null;
  interestLevel: number;
  painPoints: string[];
  dailyCallsVolume: number | null;
  budgetAvailable: string | null;
  timeline: string | null;
  objections: string[];
  recommendedPackage: string;
  decisionMaker: boolean;
  outcome: string;
  nextAction: string;
  summary: string;
}

export interface DashboardStats {
  totalProspects: number;
  prospectsReadyToCall: number;
  prospectsThisWeek: number;
  callsToday: number;
  callsThisWeek: number;
  answeredCalls: number;
  conversionRate: number;
  activeClients: number;
  botIsActive: boolean;
  lastProspection: string | null;
  lastCall: string | null;
  servicesStatus: {
    prospection: 'running' | 'idle' | 'inactive';
    calling: 'running' | 'idle' | 'inactive';
    reminders: 'running' | 'idle' | 'inactive';
    analytics: 'running' | 'idle' | 'inactive';
    dailyReset: 'running' | 'idle' | 'inactive';
  };
}
