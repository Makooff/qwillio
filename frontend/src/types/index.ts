export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailConfirmed?: boolean;
  onboardingCompleted?: boolean;
  clientId?: string;
}

export interface Prospect {
  id: string;
  businessName: string;
  businessType: string;
  sector?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  contactName?: string;
  googleRating?: number;
  googleReviewsCount?: number;
  score: number;
  status: string;
  interestLevel?: number;
  painPoints: string[];
  lastCallDate?: string;
  callTranscript?: string;
  nextAction?: string;
  nextActionDate?: string;
  createdAt: string;
  calls?: Call[];
  quotes?: Quote[];
}

export interface Call {
  id: string;
  prospectId: string;
  vapiCallId?: string;
  phoneNumber: string;
  direction: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  status: string;
  transcript?: string;
  summary?: string;
  interestLevel?: number;
  outcome?: string;
  recommendedPackage?: string;
  createdAt: string;
}

export interface Quote {
  id: string;
  prospectId?: string;
  packageType: string;
  setupFee: number;
  monthlyFee: number;
  validUntil: string;
  status: string;
  stripePaymentLink?: string;
  createdAt: string;
  prospect?: { businessName: string; contactName?: string; email?: string };
}

export interface Client {
  id: string;
  businessName: string;
  businessType: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  city?: string;
  planType: string;
  setupFee: number;
  monthlyFee: number;
  subscriptionStatus: string;
  vapiPhoneNumber?: string;
  onboardingStatus: string;
  totalCallsMade: number;
  isTrial: boolean;
  trialStartDate?: string;
  trialEndDate?: string;
  trialConvertedAt?: string;
  createdAt: string;
  payments?: Payment[];
}

export interface Payment {
  id: string;
  amount: number;
  paymentType: string;
  status: string;
  paidAt?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  createdAt: string;
}

export interface DashboardStats {
  prospects: { total: number; newThisMonth: number; byStatus: Record<string, number> };
  clients: { totalActive: number; newThisMonth: number; byPlan: Record<string, number> };
  revenue: { mrr: number; setupFeesThisMonth: number; totalThisMonth: number; mrrGrowth?: number };
  conversion: { prospectToClient: number; quoteAcceptanceRate: number };
  calls: {
    today: number; thisWeek: number; successRate: number;
    hotLeadsToday?: number; avgInterestScore?: number; avgDuration?: number;
    thisHour?: number; voicemails?: number; leadsToday?: number;
  };
  bot: { isActive: boolean; callsToday: number; callsQuota: number };
}

export interface BotStatus {
  isActive: boolean;
  callsToday: number;
  callsQuotaDaily: number;
  lastProspection?: string;
  lastCall?: string;
  crons: Record<string, string>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}
