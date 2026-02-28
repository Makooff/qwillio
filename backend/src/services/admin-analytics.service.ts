import { prisma } from '../config/database';
import { logger } from '../config/logger';

export class AdminAnalyticsService {
  /**
   * Operating costs breakdown: VAPI, Twilio SMS, Twilio Lookup, APIs
   */
  async getCosts(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const dailyCosts = await prisma.analyticsDaily.findMany({
      where: { date: { gte: startDate } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        costVapiCalls: true,
        costApis: true,
        costTwilioSms: true,
        costTwilioLookup: true,
        callsMade: true,
        smsSent: true,
        phonesValidated: true,
      },
    });

    const totals = dailyCosts.reduce(
      (acc, d) => ({
        vapiCalls: acc.vapiCalls + Number(d.costVapiCalls),
        apis: acc.apis + Number(d.costApis),
        twilioSms: acc.twilioSms + Number(d.costTwilioSms),
        twilioLookup: acc.twilioLookup + Number(d.costTwilioLookup),
        totalCalls: acc.totalCalls + d.callsMade,
        totalSms: acc.totalSms + d.smsSent,
        totalValidations: acc.totalValidations + d.phonesValidated,
      }),
      { vapiCalls: 0, apis: 0, twilioSms: 0, twilioLookup: 0, totalCalls: 0, totalSms: 0, totalValidations: 0 }
    );

    const totalCost = totals.vapiCalls + totals.apis + totals.twilioSms + totals.twilioLookup;

    // Revenue in same period
    const revenue = dailyCosts.reduce((acc, d) => acc, 0);
    const revenueData = await prisma.analyticsDaily.aggregate({
      where: { date: { gte: startDate } },
      _sum: { revenueSetupFees: true, revenueSubscriptions: true },
    });

    const totalRevenue = Number(revenueData._sum.revenueSetupFees || 0) + Number(revenueData._sum.revenueSubscriptions || 0);

    return {
      period: { days, startDate },
      daily: dailyCosts.map(d => ({
        date: d.date,
        vapi: Number(d.costVapiCalls),
        apis: Number(d.costApis),
        twilioSms: Number(d.costTwilioSms),
        twilioLookup: Number(d.costTwilioLookup),
        total: Number(d.costVapiCalls) + Number(d.costApis) + Number(d.costTwilioSms) + Number(d.costTwilioLookup),
      })),
      totals: {
        ...totals,
        totalCost,
        totalRevenue,
        profit: totalRevenue - totalCost,
      },
    };
  }

  /**
   * Retention & churn metrics
   */
  async getRetention() {
    const now = new Date();

    // Total active clients
    const totalActive = await prisma.client.count({ where: { subscriptionStatus: 'active' } });

    // Trials currently running
    const activeTrial = await prisma.client.count({ where: { subscriptionStatus: 'trialing' } });

    // Trial → paid conversion rate
    const totalTrials = await prisma.client.count({ where: { isTrial: true } });
    const convertedTrials = await prisma.client.count({
      where: { isTrial: true, trialConvertedAt: { not: null } },
    });
    const trialConversionRate = totalTrials > 0 ? (convertedTrials / totalTrials) * 100 : 0;

    // Churned clients (canceled in last 90 days)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const churned = await prisma.client.count({
      where: { subscriptionStatus: 'canceled', cancellationDate: { gte: ninetyDaysAgo } },
    });

    // Monthly churn rate
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const churnedThisMonth = await prisma.client.count({
      where: { subscriptionStatus: 'canceled', cancellationDate: { gte: thirtyDaysAgo } },
    });
    const churnRate = totalActive > 0 ? (churnedThisMonth / (totalActive + churnedThisMonth)) * 100 : 0;

    // Average client lifetime (days)
    const clientsWithDates = await prisma.client.findMany({
      where: { activationDate: { not: null } },
      select: { activationDate: true, cancellationDate: true, createdAt: true },
    });
    const avgLifetimeDays = clientsWithDates.length > 0
      ? clientsWithDates.reduce((acc, c) => {
          const start = c.activationDate || c.createdAt;
          const end = c.cancellationDate || now;
          return acc + (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / clientsWithDates.length
      : 0;

    // Clients by plan
    const byPlan = await prisma.client.groupBy({
      by: ['planType'],
      where: { subscriptionStatus: { in: ['active', 'trialing'] } },
      _count: true,
    });

    return {
      totalActive,
      activeTrial,
      totalTrials,
      convertedTrials,
      trialConversionRate: Math.round(trialConversionRate * 10) / 10,
      churned90d: churned,
      churnedThisMonth,
      churnRate: Math.round(churnRate * 10) / 10,
      avgLifetimeDays: Math.round(avgLifetimeDays),
      byPlan: byPlan.reduce((acc, p) => ({ ...acc, [p.planType]: p._count }), {} as Record<string, number>),
    };
  }

  /**
   * Follow-up management stats
   */
  async getFollowUps() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Pending reminders
    const pending = await prisma.reminder.count({ where: { status: 'pending' } });

    // Sent last 30 days
    const sent = await prisma.reminder.count({
      where: { status: 'sent', sentAt: { gte: thirtyDaysAgo } },
    });

    // Failed last 30 days
    const failed = await prisma.reminder.count({
      where: { status: 'failed', createdAt: { gte: thirtyDaysAgo } },
    });

    // By type breakdown
    const byType = await prisma.reminder.groupBy({
      by: ['reminderType'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    });

    // SMS stats from analytics
    const smsStats = await prisma.analyticsDaily.aggregate({
      where: { date: { gte: thirtyDaysAgo } },
      _sum: { smsSent: true, smsDelivered: true, smsFailed: true },
    });

    return {
      pending,
      sent,
      failed,
      successRate: sent + failed > 0 ? Math.round((sent / (sent + failed)) * 1000) / 10 : 100,
      byType: byType.reduce((acc, t) => ({ ...acc, [t.reminderType]: t._count }), {} as Record<string, number>),
      sms: {
        sent: Number(smsStats._sum.smsSent || 0),
        delivered: Number(smsStats._sum.smsDelivered || 0),
        failed: Number(smsStats._sum.smsFailed || 0),
      },
    };
  }

  /**
   * Phone validation pipeline stats
   */
  async getPhoneValidation() {
    const totalProspects = await prisma.prospect.count({ where: { phone: { not: null } } });
    const validated = await prisma.prospect.count({ where: { phoneValidated: true } });
    const notValidated = await prisma.prospect.count({
      where: { phone: { not: null }, phoneValidated: false },
    });

    // By source
    const bySource = await prisma.prospect.groupBy({
      by: ['phoneValidationSource'],
      where: { phoneValidated: true },
      _count: true,
    });

    // Confidence distribution
    const highConf = await prisma.prospect.count({
      where: { phoneNumberConfidence: { gte: 0.8 } },
    });
    const medConf = await prisma.prospect.count({
      where: { phoneNumberConfidence: { gte: 0.5, lt: 0.8 } },
    });
    const lowConf = await prisma.prospect.count({
      where: { phoneNumberConfidence: { lt: 0.5, gt: 0 } },
    });

    return {
      totalWithPhone: totalProspects,
      validated,
      notValidated,
      validatedPct: totalProspects > 0 ? Math.round((validated / totalProspects) * 1000) / 10 : 0,
      bySource: bySource.reduce((acc, s) => ({
        ...acc,
        [s.phoneValidationSource || 'unknown']: s._count,
      }), {} as Record<string, number>),
      confidence: { high: highConf, medium: medConf, low: lowConf },
    };
  }

  /**
   * CPA (cost per acquisition) by niche and country
   */
  async getCPA() {
    // Get all clients with their prospect data
    const clients = await prisma.client.findMany({
      select: { businessType: true, country: true, createdAt: true },
    });

    // Get total costs
    const totalCosts = await prisma.analyticsDaily.aggregate({
      _sum: { costVapiCalls: true, costApis: true, costTwilioSms: true, costTwilioLookup: true },
    });
    const totalCost = Number(totalCosts._sum.costVapiCalls || 0) +
      Number(totalCosts._sum.costApis || 0) +
      Number(totalCosts._sum.costTwilioSms || 0) +
      Number(totalCosts._sum.costTwilioLookup || 0);

    // CPA by niche
    const byNiche: Record<string, { clients: number; cpa: number }> = {};
    const nicheCounts: Record<string, number> = {};
    clients.forEach(c => {
      nicheCounts[c.businessType] = (nicheCounts[c.businessType] || 0) + 1;
    });
    const totalClients = clients.length || 1;
    for (const [niche, count] of Object.entries(nicheCounts)) {
      byNiche[niche] = {
        clients: count,
        cpa: Math.round((totalCost * (count / totalClients)) / count * 100) / 100,
      };
    }

    // CPA by country
    const countryCounts: Record<string, number> = {};
    clients.forEach(c => {
      countryCounts[c.country] = (countryCounts[c.country] || 0) + 1;
    });
    const byCountry: Record<string, { clients: number; cpa: number }> = {};
    for (const [country, count] of Object.entries(countryCounts)) {
      byCountry[country] = {
        clients: count,
        cpa: Math.round((totalCost * (count / totalClients)) / count * 100) / 100,
      };
    }

    return {
      overallCPA: totalClients > 0 ? Math.round((totalCost / totalClients) * 100) / 100 : 0,
      totalCost,
      totalClients: clients.length,
      byNiche,
      byCountry,
    };
  }

  /**
   * Conversion rate by day of week
   */
  async getConversionByDay() {
    const calls = await prisma.call.findMany({
      where: { status: 'completed' },
      select: { startedAt: true, outcome: true, interestLevel: true },
    });

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayStats = days.map(() => ({ total: 0, qualified: 0 }));

    calls.forEach(call => {
      if (!call.startedAt) return;
      const dayIndex = call.startedAt.getDay();
      dayStats[dayIndex].total++;
      if ((call.interestLevel || 0) >= 7 || call.outcome === 'qualified') {
        dayStats[dayIndex].qualified++;
      }
    });

    return days.map((day, i) => ({
      day,
      total: dayStats[i].total,
      qualified: dayStats[i].qualified,
      rate: dayStats[i].total > 0 ? Math.round((dayStats[i].qualified / dayStats[i].total) * 1000) / 10 : 0,
    }));
  }
  /**
   * Transfer stats for admin dashboard
   */
  async getTransfers(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const totalTransfers = await prisma.callTransfer.count({
      where: { createdAt: { gte: startDate } },
    });

    const completed = await prisma.callTransfer.count({
      where: { createdAt: { gte: startDate }, transferStatus: 'completed' },
    });

    const failed = await prisma.callTransfer.count({
      where: { createdAt: { gte: startDate }, transferStatus: 'failed' },
    });

    const callbacksPending = await prisma.callTransfer.count({
      where: { callbackRequested: true, callbackCompletedAt: null },
    });

    const callbacksHighPriority = await prisma.callTransfer.count({
      where: { callbackRequested: true, callbackPriority: 'high', callbackCompletedAt: null },
    });

    // By reason breakdown
    const byReason = await prisma.callTransfer.groupBy({
      by: ['reason'],
      where: { createdAt: { gte: startDate } },
      _count: true,
    });

    // Recent transfers
    const recent = await prisma.callTransfer.findMany({
      where: { createdAt: { gte: startDate } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { client: { select: { businessName: true } } },
    });

    return {
      period: { days, startDate },
      totalTransfers,
      completed,
      failed,
      successRate: totalTransfers > 0 ? Math.round((completed / totalTransfers) * 1000) / 10 : 100,
      callbacksPending,
      callbacksHighPriority,
      byReason: byReason.reduce((acc, r) => ({ ...acc, [r.reason]: r._count }), {} as Record<string, number>),
      recent: recent.map(t => ({
        id: t.id,
        client: t.client.businessName,
        transferNumber: t.transferNumber,
        reason: t.reason,
        status: t.transferStatus,
        callbackRequested: t.callbackRequested,
        callbackPriority: t.callbackPriority,
        createdAt: t.createdAt,
      })),
    };
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
