import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { DashboardStats } from '../types';

export class AnalyticsService {
  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalProspects,
      newProspectsMonth,
      prospectsByStatus,
      activeClients,
      newClientsMonth,
      clientsByPlan,
      mrrData,
      setupFeesMonth,
      totalQuotes,
      acceptedQuotes,
      callsToday,
      callsWeek,
      successfulCallsWeek,
      botStatus,
    ] = await Promise.all([
      prisma.prospect.count(),
      prisma.prospect.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.prospect.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.client.count({ where: { subscriptionStatus: 'active' } }),
      prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.client.groupBy({ by: ['planType'], where: { subscriptionStatus: 'active' }, _count: { id: true } }),
      prisma.client.aggregate({ where: { subscriptionStatus: 'active' }, _sum: { monthlyFee: true } }),
      prisma.payment.aggregate({
        where: { paymentType: 'setup_fee', status: 'succeeded', paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.quote.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.quote.count({ where: { status: 'accepted', createdAt: { gte: startOfMonth } } }),
      prisma.call.count({ where: { startedAt: { gte: today } } }),
      prisma.call.count({ where: { startedAt: { gte: startOfWeek } } }),
      prisma.call.count({ where: { status: 'completed', outcome: 'qualified', startedAt: { gte: startOfWeek } } }),
      prisma.botStatus.findFirst(),
    ]);

    const statusMap: Record<string, number> = {};
    prospectsByStatus.forEach((s) => { statusMap[s.status] = s._count.id; });

    const planMap: Record<string, number> = {};
    clientsByPlan.forEach((p) => { planMap[p.planType] = p._count.id; });

    const mrr = Number(mrrData._sum.monthlyFee || 0);
    const setupFees = Number(setupFeesMonth._sum.amount || 0);

    return {
      prospects: {
        total: totalProspects,
        newThisMonth: newProspectsMonth,
        byStatus: statusMap,
      },
      clients: {
        totalActive: activeClients,
        newThisMonth: newClientsMonth,
        byPlan: planMap,
      },
      revenue: {
        mrr,
        setupFeesThisMonth: setupFees,
        totalThisMonth: setupFees + mrr,
      },
      conversion: {
        prospectToClient: totalProspects > 0 ? (activeClients / totalProspects) * 100 : 0,
        quoteAcceptanceRate: totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0,
      },
      calls: {
        today: callsToday,
        thisWeek: callsWeek,
        successRate: callsWeek > 0 ? (successfulCallsWeek / callsWeek) * 100 : 0,
      },
      bot: {
        isActive: botStatus?.isActive || false,
        callsToday: botStatus?.callsToday || 0,
        callsQuota: botStatus?.callsQuotaDaily || 50,
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
