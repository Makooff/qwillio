import { prisma } from '../config/database';
import { logger } from '../config/logger';

export class ClientDashboardService {

  // ═══════════════════════════════════════════════════════════
  // CLIENT OVERVIEW - Main dashboard stats for a specific client
  // ═══════════════════════════════════════════════════════════
  async getClientOverview(clientId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new Error('Client not found');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCallsAllTime,
      callsThisMonth,
      callsToday,
      callsThisWeek,
      totalBookings,
      bookingsThisMonth,
      upcomingBookings,
      leadsThisMonth,
      avgCallDuration,
      sentimentBreakdown,
    ] = await Promise.all([
      prisma.clientCall.count({ where: { clientId } }),
      prisma.clientCall.count({ where: { clientId, createdAt: { gte: startOfMonth } } }),
      prisma.clientCall.count({ where: { clientId, createdAt: { gte: today } } }),
      prisma.clientCall.count({ where: { clientId, createdAt: { gte: startOfWeek } } }),
      prisma.clientBooking.count({ where: { clientId } }),
      prisma.clientBooking.count({ where: { clientId, createdAt: { gte: startOfMonth } } }),
      prisma.clientBooking.count({ where: { clientId, bookingDate: { gte: now }, status: 'confirmed' } }),
      prisma.clientCall.count({ where: { clientId, isLead: true, createdAt: { gte: startOfMonth } } }),
      prisma.clientCall.aggregate({
        where: { clientId, durationSeconds: { not: null } },
        _avg: { durationSeconds: true },
      }),
      prisma.clientCall.groupBy({
        by: ['sentiment'],
        where: { clientId, sentiment: { not: null } },
        _count: { id: true },
      }),
    ]);

    const sentimentMap: Record<string, number> = {};
    sentimentBreakdown.forEach(s => {
      if (s.sentiment) sentimentMap[s.sentiment] = s._count.id;
    });

    return {
      client: {
        id: client.id,
        businessName: client.businessName,
        businessType: client.businessType,
        planType: client.planType,
        subscriptionStatus: client.subscriptionStatus,
        vapiPhoneNumber: client.vapiPhoneNumber,
        isTrial: client.isTrial,
        trialEndDate: client.trialEndDate,
        monthlyCallsQuota: client.monthlyCallsQuota,
        totalCallsMade: client.totalCallsMade,
      },
      calls: {
        total: totalCallsAllTime,
        thisMonth: callsThisMonth,
        thisWeek: callsThisWeek,
        today: callsToday,
        avgDuration: Math.round(avgCallDuration._avg.durationSeconds || 0),
        quota: client.monthlyCallsQuota || 0,
        quotaUsed: callsThisMonth,
        quotaPercent: client.monthlyCallsQuota
          ? Math.round((callsThisMonth / client.monthlyCallsQuota) * 100)
          : 0,
      },
      bookings: {
        total: totalBookings,
        thisMonth: bookingsThisMonth,
        upcoming: upcomingBookings,
      },
      leads: {
        thisMonth: leadsThisMonth,
      },
      sentiment: sentimentMap,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CALL HISTORY - Paginated list of client calls
  // ═══════════════════════════════════════════════════════════
  async getClientCalls(clientId: string, page = 1, limit = 20, filters?: {
    status?: string;
    sentiment?: string;
    isLead?: boolean;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = { clientId };
    if (filters?.status) where.status = filters.status;
    if (filters?.sentiment) where.sentiment = filters.sentiment;
    if (filters?.isLead !== undefined) where.isLead = filters.isLead;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [calls, total] = await Promise.all([
      prisma.clientCall.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.clientCall.count({ where }),
    ]);

    return {
      data: calls,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // BOOKINGS - Upcoming & past bookings for client
  // ═══════════════════════════════════════════════════════════
  async getClientBookings(clientId: string, page = 1, limit = 20, upcoming = true) {
    const now = new Date();
    const where: any = { clientId };
    if (upcoming) {
      where.bookingDate = { gte: now };
      where.status = 'confirmed';
    }

    const [bookings, total] = await Promise.all([
      prisma.clientBooking.findMany({
        where,
        orderBy: { bookingDate: upcoming ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.clientBooking.count({ where }),
    ]);

    return {
      data: bookings,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // LEADS - People who showed interest during calls
  // ═══════════════════════════════════════════════════════════
  async getClientLeads(clientId: string, page = 1, limit = 20) {
    const where = { clientId, isLead: true };

    const [leads, total] = await Promise.all([
      prisma.clientCall.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          callerName: true,
          callerNumber: true,
          emailCollected: true,
          nameCollected: true,
          phoneCollected: true,
          summary: true,
          leadScore: true,
          bookingRequested: true,
          bookingDetails: true,
          sentiment: true,
          durationSeconds: true,
          createdAt: true,
          tags: true,
        },
      }),
      prisma.clientCall.count({ where }),
    ]);

    return {
      data: leads,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ANALYTICS - Detailed analytics for client dashboard
  // ═══════════════════════════════════════════════════════════
  async getClientAnalytics(clientId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Daily breakdown
    const dailyStats = await prisma.clientAnalyticsDaily.findMany({
      where: {
        clientId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    // Peak hours analysis (from raw call data)
    const calls = await prisma.clientCall.findMany({
      where: {
        clientId,
        createdAt: { gte: startDate },
        startedAt: { not: null },
      },
      select: { startedAt: true, durationSeconds: true, sentiment: true, isLead: true },
    });

    const hourDistribution: Record<number, number> = {};
    const dayDistribution: Record<number, number> = {};

    calls.forEach(call => {
      if (call.startedAt) {
        const hour = call.startedAt.getHours();
        const day = call.startedAt.getDay();
        hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
        dayDistribution[day] = (dayDistribution[day] || 0) + 1;
      }
    });

    // Conversion rate: leads / total calls
    const totalCalls = calls.length;
    const totalLeads = calls.filter(c => c.isLead).length;
    const conversionRate = totalCalls > 0 ? (totalLeads / totalCalls) * 100 : 0;

    // Average sentiment score
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    calls.forEach(c => {
      if (c.sentiment === 'positive') sentimentCounts.positive++;
      else if (c.sentiment === 'negative') sentimentCounts.negative++;
      else sentimentCounts.neutral++;
    });

    const satisfactionScore = totalCalls > 0
      ? Math.round(((sentimentCounts.positive * 100) + (sentimentCounts.neutral * 50)) / totalCalls)
      : 0;

    return {
      period: { days, startDate, endDate: new Date() },
      summary: {
        totalCalls,
        totalLeads,
        conversionRate: Math.round(conversionRate * 10) / 10,
        satisfactionScore,
        avgCallDuration: totalCalls > 0
          ? Math.round(calls.reduce((sum, c) => sum + (c.durationSeconds || 0), 0) / totalCalls)
          : 0,
      },
      daily: dailyStats.map(d => ({
        date: d.date,
        calls: d.totalCalls,
        leads: d.leadsGenerated,
        bookings: d.bookingsMade,
        avgDuration: d.avgDuration,
        sentiment: {
          positive: d.sentimentPositive,
          neutral: d.sentimentNeutral,
          negative: d.sentimentNegative,
        },
      })),
      peakHours: hourDistribution,
      peakDays: dayDistribution,
      sentiment: sentimentCounts,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // AGGREGATE DAILY CLIENT ANALYTICS - Called by CRON
  // ═══════════════════════════════════════════════════════════
  async aggregateClientAnalytics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all active clients
    const activeClients = await prisma.client.findMany({
      where: { subscriptionStatus: { in: ['active', 'trialing'] } },
      select: { id: true, businessName: true },
    });

    let aggregated = 0;

    for (const client of activeClients) {
      try {
        const calls = await prisma.clientCall.findMany({
          where: {
            clientId: client.id,
            createdAt: { gte: today, lt: tomorrow },
          },
        });

        if (calls.length === 0) continue;

        const totalDuration = calls.reduce((sum, c) => sum + (c.durationSeconds || 0), 0);
        const answered = calls.filter(c => c.status === 'completed').length;
        const missed = calls.filter(c => c.status === 'missed' || c.status === 'no-answer').length;
        const leads = calls.filter(c => c.isLead).length;
        const emails = calls.filter(c => c.emailCollected).length;
        const bookings = calls.filter(c => c.bookingRequested).length;
        const positive = calls.filter(c => c.sentiment === 'positive').length;
        const neutral = calls.filter(c => c.sentiment === 'neutral').length;
        const negative = calls.filter(c => c.sentiment === 'negative').length;

        await prisma.clientAnalyticsDaily.upsert({
          where: { clientId_date: { clientId: client.id, date: today } },
          update: {
            totalCalls: calls.length,
            answeredCalls: answered,
            missedCalls: missed,
            totalDuration,
            avgDuration: calls.length > 0 ? Math.round(totalDuration / calls.length) : 0,
            leadsGenerated: leads,
            bookingsMade: bookings,
            emailsCollected: emails,
            sentimentPositive: positive,
            sentimentNeutral: neutral,
            sentimentNegative: negative,
          },
          create: {
            clientId: client.id,
            date: today,
            totalCalls: calls.length,
            answeredCalls: answered,
            missedCalls: missed,
            totalDuration,
            avgDuration: calls.length > 0 ? Math.round(totalDuration / calls.length) : 0,
            leadsGenerated: leads,
            bookingsMade: bookings,
            emailsCollected: emails,
            sentimentPositive: positive,
            sentimentNeutral: neutral,
            sentimentNegative: negative,
          },
        });

        aggregated++;
      } catch (error) {
        logger.error(`Failed to aggregate analytics for client ${client.businessName}:`, error);
      }
    }

    if (aggregated > 0) {
      logger.info(`[ANALYTICS] Aggregated daily stats for ${aggregated} client(s)`);
    }

    return aggregated;
  }
}

export const clientDashboardService = new ClientDashboardService();
