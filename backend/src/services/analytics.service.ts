import { prisma } from '../config/database';
import { getLastAction, getRecentActions } from '../utils/bot-activity';
import { logger } from '../config/logger';

export class AnalyticsService {

  async getDashboardStats() {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const thisHour = new Date(now); thisHour.setMinutes(0, 0, 0);
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const results = await Promise.allSettled([
      // 0 - total prospects
      prisma.prospect.count(),
      // 1 - calls today
      prisma.call.count({ where: { createdAt: { gte: today } } }),
      // 2 - calls this week
      prisma.call.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      // 3 - answered calls this week
      prisma.call.count({ where: { status: 'completed', createdAt: { gte: sevenDaysAgo } } }),
      // 4 - active clients
      prisma.client.count({ where: { subscriptionStatus: 'active' } }),
      // 5 - new clients this month
      prisma.client.count({ where: { createdAt: { gte: monthStart } } }),
      // 6 - MRR (sum of active monthly fees)
      prisma.client.aggregate({
        where: { subscriptionStatus: 'active' },
        _sum: { monthlyFee: true },
      }),
      // 7 - bot status
      prisma.botStatus.findFirst(),
      // 8 - hot leads today (interest >= 7)
      prisma.call.count({
        where: { createdAt: { gte: today }, interestLevel: { gte: 7 } },
      }),
      // 9 - avg interest score this week
      prisma.call.aggregate({
        where: { createdAt: { gte: sevenDaysAgo }, interestLevel: { not: null } },
        _avg: { interestLevel: true },
      }),
      // 10 - calls this hour
      prisma.call.count({ where: { createdAt: { gte: thisHour } } }),
      // 11 - voicemails today
      prisma.call.count({ where: { createdAt: { gte: today }, outcome: 'voicemail' } }),
      // 12 - leads today (interest >= 6)
      prisma.call.count({ where: { createdAt: { gte: today }, interestLevel: { gte: 6 } } }),
      // 13 - avg duration this week
      prisma.call.aggregate({
        where: { createdAt: { gte: sevenDaysAgo }, durationSeconds: { not: null } },
        _avg: { durationSeconds: true },
      }),
      // 14 - setup fees this month
      prisma.payment.aggregate({
        where: { paymentType: 'setup_fee', status: 'succeeded', paidAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // 15 - subscription revenue this month
      prisma.payment.aggregate({
        where: { paymentType: 'monthly_subscription', status: 'succeeded', paidAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // 16 - converted prospects (clients)
      prisma.client.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      // 17 - prospects called last 30 days
      prisma.call.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    const get = <T>(idx: number, fallback: T): T =>
      results[idx].status === 'fulfilled'
        ? (results[idx] as PromiseFulfilledResult<T>).value
        : fallback;

    const totalProspects        = get<number>(0, 0);
    const callsToday            = get<number>(1, 0);
    const callsThisWeek         = get<number>(2, 0);
    const answeredCalls         = get<number>(3, 0);
    const activeClients         = get<number>(4, 0);
    const newClientsThisMonth   = get<number>(5, 0);
    const mrrAgg                = get<any>(6, { _sum: { monthlyFee: 0 } });
    const botStatus             = get<any>(7, null);
    const hotLeadsToday         = get<number>(8, 0);
    const avgScoreAgg           = get<any>(9, { _avg: { interestLevel: null } });
    const callsThisHour         = get<number>(10, 0);
    const voicemailsToday       = get<number>(11, 0);
    const leadsToday            = get<number>(12, 0);
    const avgDurAgg             = get<any>(13, { _avg: { durationSeconds: null } });
    const setupFeesAgg          = get<any>(14, { _sum: { amount: 0 } });
    const subRevenueAgg         = get<any>(15, { _sum: { amount: 0 } });
    const newClients30d         = get<number>(16, 0);
    const callsMade30d          = get<number>(17, 0);

    const mrr              = Number(mrrAgg?._sum?.monthlyFee ?? 0);
    const avgInterestScore = Number(avgScoreAgg?._avg?.interestLevel ?? 0);
    const avgDuration      = Math.round(avgDurAgg?._avg?.durationSeconds ?? 0);
    const setupFees        = Number(setupFeesAgg?._sum?.amount ?? 0);
    const subRevenue       = Number(subRevenueAgg?._sum?.amount ?? 0);
    const totalThisMonth   = setupFees + subRevenue;
    const successRate      = Math.round((answeredCalls / Math.max(callsThisWeek, 1)) * 100);
    const conversionRate   = parseFloat(((newClients30d / Math.max(callsMade30d, 1)) * 100).toFixed(2));

    return {
      // Original fields (backwards compat)
      totalProspects,
      callsToday,
      callsThisWeek,
      answeredCalls,
      conversionRate,
      activeClients,
      botIsActive: botStatus?.isActive ?? false,
      lastProspection: botStatus?.lastProspection?.toISOString() ?? null,
      lastCall: botStatus?.lastCall?.toISOString() ?? null,
      bot: {
        isActive: botStatus?.isActive ?? false,
        callsToday: botStatus?.callsToday ?? 0,
        callsQuota: botStatus?.callsQuotaDaily ?? 50,
        lastAction: getLastAction(),
        recentActions: getRecentActions(5),
      },

      // Frontend-expected nested shape
      prospects: {
        total: totalProspects,
        newThisMonth: 0,
        byStatus: {},
      },
      clients: {
        totalActive: activeClients,
        newThisMonth: newClientsThisMonth,
        byPlan: {},
      },
      revenue: {
        mrr,
        setupFeesThisMonth: setupFees,
        totalThisMonth,
        mrrGrowth: 0, // TODO: compare with last month
      },
      conversion: {
        prospectToClient: conversionRate,
        quoteAcceptanceRate: 0,
      },
      calls: {
        today: callsToday,
        thisWeek: callsThisWeek,
        successRate,
        hotLeadsToday,
        avgInterestScore: parseFloat(avgInterestScore.toFixed(1)),
        avgDuration,
        thisHour: callsThisHour,
        voicemails: voicemailsToday,
        leadsToday,
      },
      servicesStatus: {
        prospection: 'idle' as const,
        calling: 'idle' as const,
        reminders: 'idle' as const,
        analytics: 'idle' as const,
        dailyReset: 'idle' as const,
      },
    };
  }

  async getRevenueHistory(months: number = 6) {
    const results = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const payments = await prisma.payment.aggregate({
        where: { status: 'succeeded', paidAt: { gte: start, lte: end } },
        _sum: { amount: true },
      });

      results.push({
        month: start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        revenue: Number(payments._sum.amount ?? 0),
      });
    }

    return results;
  }

  async getCalls(opts: {
    page?: number;
    limit?: number;
    outcome?: string;
    minScore?: number;
    search?: string;
  } = {}) {
    const { page = 1, limit = 25, outcome, minScore, search } = opts;
    const skip = (page - 1) * Math.min(limit, 100);
    const take = Math.min(limit, 100);

    const where: any = {};
    if (outcome) where.outcome = outcome;
    if (minScore) where.interestLevel = { gte: Number(minScore) };
    if (search) {
      where.prospect = {
        businessName: { contains: search, mode: 'insensitive' },
      };
    }

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          prospect: {
            select: { businessName: true, city: true, businessType: true },
          },
        },
      }),
      prisma.call.count({ where }),
    ]);

    return {
      calls: calls.map((c) => ({
        id: c.id,
        businessName: c.prospect?.businessName ?? 'Unknown',
        city: c.prospect?.city ?? null,
        niche: c.prospect?.businessType ?? null,
        duration: c.durationSeconds ?? null,
        outcome: c.outcome ?? c.status ?? 'unknown',
        interestScore: c.interestLevel ?? null,
        leadCaptured: (c.interestLevel ?? 0) >= 6,
        transcript: c.transcript ?? null,
        summary: c.summary ?? null,
        recordingUrl: (c as any).recordingUrl ?? null,
        createdAt: c.createdAt,
      })),
      total,
      page,
      pages: Math.ceil(total / take),
    };
  }

  async getLeads(opts: { minScore?: number; limit?: number } = {}) {
    const { minScore = 6, limit = 50 } = opts;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [calls, total, avgScore] = await Promise.all([
      prisma.call.findMany({
        where: {
          interestLevel: { gte: minScore },
          createdAt: { gte: sevenDaysAgo },
        },
        orderBy: [{ interestLevel: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        include: {
          prospect: {
            select: {
              id: true, businessName: true, city: true,
              businessType: true, phone: true, email: true,
            },
          },
        },
      }),
      prisma.call.count({
        where: { interestLevel: { gte: minScore }, createdAt: { gte: today } },
      }),
      prisma.call.aggregate({
        where: { interestLevel: { gte: minScore }, createdAt: { gte: sevenDaysAgo } },
        _avg: { interestLevel: true },
      }),
    ]);

    return {
      leads: calls.map((c) => ({
        id: c.id,
        prospectId: c.prospectId,
        businessName: c.prospect?.businessName ?? 'Unknown',
        city: c.prospect?.city ?? null,
        niche: c.prospect?.businessType ?? null,
        phone: c.prospect?.phone ?? null,
        email: c.prospect?.email ?? null,
        interestScore: c.interestLevel ?? minScore,
        transcript: c.transcript ?? null,
        status: 'interested',
        createdAt: c.createdAt,
      })),
      total,
      avgScore: parseFloat((avgScore._avg.interestLevel ?? 0).toFixed(1)),
      demosSent: 0,
      converted: 0,
    };
  }

  async getRecentActivity(limit: number = 20) {
    const [recentCalls, recentClients, recentPayments] = await Promise.all([
      prisma.call.findMany({
        take: Math.ceil(limit * 0.6),
        orderBy: { createdAt: 'desc' },
        include: { prospect: { select: { businessName: true, city: true, businessType: true } } },
      }),
      prisma.client.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        where: { status: 'succeeded' },
        include: { client: { select: { businessName: true } } },
      }),
    ]);

    const activities: any[] = [];

    recentCalls.forEach((c) => activities.push({
      type: 'call',
      icon: '📞',
      message: `${c.prospect?.businessName ?? 'Unknown'}`,
      businessName: c.prospect?.businessName ?? 'Unknown',
      city: c.prospect?.city ?? null,
      niche: c.prospect?.businessType ?? null,
      interestScore: c.interestLevel ?? null,
      outcome: c.outcome ?? c.status,
      duration: c.durationSeconds,
      transcript: c.transcript,
      date: c.createdAt,
    }));

    recentClients.forEach((c) => activities.push({
      type: 'client',
      icon: '✅',
      message: `New client: ${c.businessName}`,
      businessName: c.businessName,
      date: c.createdAt,
    }));

    recentPayments.forEach((p) => activities.push({
      type: 'payment',
      icon: '💰',
      message: `Payment $${p.amount} — ${p.client?.businessName ?? 'N/A'}`,
      date: p.createdAt,
    }));

    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  async aggregateDaily() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const [prospects, calls, quotes, clients, payments, costs] = await Promise.all([
      prisma.prospect.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.call.findMany({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.quote.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.client.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.payment.findMany({ where: { status: 'succeeded', paidAt: { gte: today, lt: tomorrow } } }),
      prisma.call.aggregate({
        where: { createdAt: { gte: today, lt: tomorrow } },
        _sum: { cost: true, durationSeconds: true },
      }),
    ]);

    const setupRevenue = payments.filter(p => p.paymentType === 'setup_fee').reduce((s, p) => s + Number(p.amount), 0);
    const subRevenue = payments.filter(p => p.paymentType === 'monthly_subscription').reduce((s, p) => s + Number(p.amount), 0);

    await prisma.analyticsDaily.upsert({
      where: { date: today },
      update: {
        prospectsAdded: prospects, callsMade: calls.length,
        callsSuccessful: calls.filter(c => c.status === 'completed').length,
        callsFailed: calls.filter(c => c.status === 'failed').length,
        totalCallDuration: Number(costs._sum.durationSeconds ?? 0),
        quotesSent: quotes, newClients: clients,
        revenueSetupFees: setupRevenue, revenueSubscriptions: subRevenue,
        costVapiCalls: Number(costs._sum.cost ?? 0),
      },
      create: {
        date: today, prospectsAdded: prospects, callsMade: calls.length,
        callsSuccessful: calls.filter(c => c.status === 'completed').length,
        callsFailed: calls.filter(c => c.status === 'failed').length,
        totalCallDuration: Number(costs._sum.durationSeconds ?? 0),
        quotesSent: quotes, newClients: clients,
        revenueSetupFees: setupRevenue, revenueSubscriptions: subRevenue,
        costVapiCalls: Number(costs._sum.cost ?? 0),
      },
    });

    logger.info('Daily analytics aggregated');
  }
}

export const analyticsService = new AnalyticsService();
