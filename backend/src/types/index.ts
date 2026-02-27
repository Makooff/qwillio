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
  basic: {
    name: 'BASIC',
    setupFee: 699,
    monthlyFee: 199,
    callsQuota: 200,
    trialDays: 30,
    trialCallsQuota: 50,
    features: [
      'AI Receptionist available 24/7',
      'Automatic booking & reservations',
      'FAQ answers (hours, menu, pricing)',
      'Urgent call transfers to your team',
      'All messages logged & recorded',
      'Real-time tracking dashboard',
      'Email technical support',
      '200 calls included per month',
    ],
  },
  pro: {
    name: 'PRO',
    setupFee: 999,
    monthlyFee: 349,
    callsQuota: 500,
    trialDays: 30,
    trialCallsQuota: 100,
    features: [
      'Everything in BASIC, plus:',
      'Automatic lead qualification',
      'Detailed analytics (conversion rates, sources, etc.)',
      'Email & customer data collection',
      'Automatic customer reminders',
      'Integration with your booking system',
      'Priority support (phone + email)',
      '500 calls included per month',
    ],
  },
  enterprise: {
    name: 'ENTERPRISE',
    setupFee: 1499,
    monthlyFee: 499,
    callsQuota: 1000,
    trialDays: 30,
    trialCallsQuota: 150,
    features: [
      'Everything in PRO, plus:',
      'Multilingual support (EN, ES, FR, ZH)',
      'Advanced integrations (CRM, POS, Google Calendar)',
      'Custom AI assistant for your industry',
      'Team training (2 hours)',
      'Continuous optimization based on your data',
      'Dedicated account manager',
      '24/7 support (phone, email, chat)',
      '1000 calls included per month',
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
