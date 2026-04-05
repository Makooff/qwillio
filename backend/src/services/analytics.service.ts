import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { DashboardStats } from '../types';

export class AnalyticsService {
  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const results = await Promise.allSettled([
      prisma.prospect.count(),                                                                                   // 0
      prisma.prospect.count({                                                                                    // 1
        where: { status: 'new', eligibleForCall: true, isMobile: false, priorityScore: { gte: 10 }, callAttempts: { lt: 3 }, phone: { not: null } },
      }),
      prisma.prospect.count({ where: { createdAt: { gte: sevenDaysAgo } } }),                                  // 2
      prisma.call.count({ where: { startedAt: { gte: today } } }),                                             // 3
      prisma.call.count({ where: { startedAt: { gte: sevenDaysAgo } } }),                                      // 4
      prisma.call.count({ where: { status: 'completed', startedAt: { gte: sevenDaysAgo } } }),                 // 5
      prisma.client.count({ where: { subscriptionStatus: 'active' } }),                                        // 6
      prisma.botStatus.findFirst(),                                                                             // 7
    ]);

    const get = <T>(idx: number, fallback: T): T =>
      results[idx].status === 'fulfilled' ? (results[idx] as PromiseFulfilledResult<T>).value : fallback;

    const totalProspects      = get<number>(0, 0);
    const prospectsReadyToCall = get<number>(1, 0);
    const prospectsThisWeek   = get<number>(2, 0);
    const callsToday          = get<number>(3, 0);
    const callsThisWeek       = get<number>(4, 0);
    const answeredCalls       = get<number>(5, 0);
    const activeClients       = get<number>(6, 0);
    const botStatus           = get<{ isActive: boolean; lastProspection?: Date | null; lastCall?: Date | null } | null>(7, null);

    const botIsActive = botStatus?.isActive ?? false;
    const serviceState = (active: boolean): 'idle' | 'inactive' => active ? 'idle' : 'inactive';

    return {
      totalProspects,
      prospectsReadyToCall,
      prospectsThisWeek,
      callsToday,
      callsThisWeek,
      answeredCalls,
      conversionRate: Math.round((answeredCalls / Math.max(callsThisWeek, 1)) * 100),
      activeClients,
      botIsActive,
      lastProspection: botStatus?.lastProspection ? botStatus.lastProspection.toISOString() : null,
      lastCall: botStatus?.lastCall ? botStatus.lastCall.toISOString() : null,
      servicesStatus: {
        prospection: serviceState(botIsActive),
        calling:     serviceState(botIsActive),
        reminders:   serviceState(botIsActive),
        analytics:   serviceState(botIsActive),
        dailyReset:  serviceState(botIsActive),
      },
    };
  }

  async getRevenueHistory(months: number = 6) {
    const results = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const payments = await prisma.payment.aggregate({
        where: {
          status: 'succeeded',
          paidAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      });

      results.push({
        month: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: Number(payments._sum.amount || 0),
      });
    }

    return results;
  }

  async getRecentActivity(limit: number = 20) {
    const [recentCalls, recentQuotes, recentClients, recentPayments] = await Promise.all([
      prisma.call.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { prospect: { select: { businessName: true } } },
      }),
      prisma.quote.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { prospect: { select: { businessName: true } } },
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
      message: `Call ${c.outcome === 'qualified' ? 'qualified' : 'completed'}: ${c.prospect?.businessName || 'N/A'} (interest: ${c.interestLevel || '?'}/10)`,
      date: c.createdAt,
    }));

    recentQuotes.forEach((q) => activities.push({
      type: 'quote',
      icon: '📧',
      message: `Quote sent: ${q.prospect?.businessName || 'N/A'} (${q.packageType.toUpperCase()})`,
      date: q.createdAt,
    }));

    recentClients.forEach((c) => activities.push({
      type: 'client',
      icon: '✅',
      message: `New client: ${c.businessName} (${c.planType.toUpperCase()} - $${c.monthlyFee}/mo)`,
      date: c.createdAt,
    }));

    recentPayments.forEach((p) => activities.push({
      type: 'payment',
      icon: '💰',
      message: `Payment received: $${p.amount} - ${p.client?.businessName || 'N/A'}`,
      date: p.createdAt,
    }));

    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  async aggregateDaily() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

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

    const setupRevenue = payments
      .filter(p => p.paymentType === 'setup_fee')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const subRevenue = payments
      .filter(p => p.paymentType === 'monthly_subscription')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    await prisma.analyticsDaily.upsert({
      where: { date: today },
      update: {
        prospectsAdded: prospects,
        callsMade: calls.length,
        callsSuccessful: calls.filter(c => c.status === 'completed').length,
        callsFailed: calls.filter(c => c.status === 'failed').length,
        totalCallDuration: Number(costs._sum.durationSeconds || 0),
        quotesSent: quotes,
        newClients: clients,
        revenueSetupFees: setupRevenue,
        revenueSubscriptions: subRevenue,
        costVapiCalls: Number(costs._sum.cost || 0),
      },
      create: {
        date: today,
        prospectsAdded: prospects,
        callsMade: calls.length,
        callsSuccessful: calls.filter(c => c.status === 'completed').length,
        callsFailed: calls.filter(c => c.status === 'failed').length,
        totalCallDuration: Number(costs._sum.durationSeconds || 0),
        quotesSent: quotes,
        newClients: clients,
        revenueSetupFees: setupRevenue,
        revenueSubscriptions: subRevenue,
        costVapiCalls: Number(costs._sum.cost || 0),
      },
    });

    logger.info('Daily analytics aggregated');
  }
}

export const analyticsService = new AnalyticsService();
