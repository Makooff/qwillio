export interface PackageConfig {
  name: string;
  setupFee: number;
  monthlyFee: number;
  callsQuota: number;
  features: string[];
  trialDays: number;
  trialCallsQuota: number;
}

export const PACKAGES: Record<string, PackageConfig> = {
  starter: {
    name: 'STARTER',
    setupFee: 0,
    monthlyFee: 497,
    callsQuota: 800,
    trialDays: 30,
    trialCallsQuota: 100,
    features: [
      'Ashley (EN) or Marie (FR) dedicated AI voice',
      '800 calls/month included',
      'Appointment booking + calendar sync',
      'Analytics dashboard',
      'Email support',
      'Call recording & transcripts',
      'Lead qualification',
      'Overage: $0.22/call',
    ],
  },
  pro: {
    name: 'PRO',
    setupFee: 0,
    monthlyFee: 1297,
    callsQuota: 2000,
    trialDays: 30,
    trialCallsQuota: 200,
    features: [
      'Everything in Starter, plus:',
      '2,000 calls/month included',
      'Advanced analytics + sentiment analysis',
      'Smart call transfer',
      'Priority support (phone + email)',
      'Native CRM integrations',
      'Overage: $0.18/call',
    ],
  },
  enterprise: {
    name: 'ENTERPRISE',
    setupFee: 0,
    monthlyFee: 2497,
    callsQuota: 4000,
    trialDays: 30,
    trialCallsQuota: 400,
    features: [
      'Everything in Pro, plus:',
      '4,000 calls/month included',
      'Bilingual agent EN/FR',
      'Dedicated account manager',
      '99.5% SLA guaranteed',
      'Self-learning AI optimization',
      'Overage: $0.15/call',
    ],
  },
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
  prospects: {
    total: number;
    newThisMonth: number;
    byStatus: Record<string, number>;
  };
  clients: {
    totalActive: number;
    newThisMonth: number;
    byPlan: Record<string, number>;
  };
  revenue: {
    mrr: number;
    setupFeesThisMonth: number;
    totalThisMonth: number;
  };
  conversion: {
    prospectToClient: number;
    quoteAcceptanceRate: number;
  };
  calls: {
    today: number;
    thisWeek: number;
    successRate: number;
  };
  bot: {
    isActive: boolean;
    callsToday: number;
    callsQuota: number;
  };
}
