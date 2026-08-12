import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { planFeatures } from '../config/plan-features';
import { getPlan } from '../config/plans';

export class ClientDashboardService {

  // ═══════════════════════════════════════════════════════════
  // BILLING OVERVIEW - The plan, the quota and the minutes really used
  // ═══════════════════════════════════════════════════════════
  /**
   * What the billing page needs, and nothing else.
   *
   * It exists because the page had no such source: it read
   * `GET /my-dashboard/billing`, which returns a LIST OF PAYMENTS. Every field
   * it asked that array for — `plan`, `minutesUsed`, `isTrial`, `status` — came
   * back `undefined`, so the page fell through to its own defaults and showed
   * every client the Starter plan with a quota bar at zero. Nothing looked
   * broken, which is why it went unnoticed: the defaults were plausible.
   *
   * Minutes are derived, not stored: the quota is consumed by the sum of real
   * call durations for the current month, the same aggregate the overview and
   * the quota alerts use. Spam calls are excluded, as they are everywhere else
   * — a blocked call must not eat the quota it was blocked to protect.
   */
  async getBillingOverview(clientId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new Error('Client not found');

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const minutesAgg = await prisma.clientCall.aggregate({
      where: { clientId, isSpam: false, startedAt: { gte: startOfMonth } },
      _sum: { durationSeconds: true },
    });
    const minutesUsed = Math.round((minutesAgg._sum.durationSeconds ?? 0) / 60);

    const plan = getPlan(client.planType);

    return {
      plan: client.planType || plan.id,
      status: client.subscriptionStatus,
      // Nothing on `Client` stores the next charge date, so it comes from
      // Stripe or not at all. A plausible-looking guess (activation date plus a
      // month) is exactly the kind of invented figure this method exists to
      // remove, so `null` is returned and the page hides the line.
      renewalDate: await this.nextRenewalDate(client),
      minutesUsed,
      // The client's own quota wins: it can be negotiated away from the plan's
      // standard allowance, and the catalogue is only the fallback.
      minutesLimit: client.monthlyMinutesQuota || plan.includedMinutes,
      trialEndsAt: client.trialEndDate,
      isTrial: client.isTrial,
      /* LA CARTE ENREGISTRÉE. La page annonçait le forfait et son prix, mais
         jamais ce qui allait être débité: le client devait ouvrir le portail
         Stripe pour savoir quelle carte paie son abonnement. Chez Stripe,
         Linear ou ElevenLabs, cette ligne est toujours à l'écran. */
      ...(await this.defaultPaymentMethod(client)),
    };
  }

  /**
   * La carte par défaut du client, telle que Stripe la connaît.
   *
   * Rien n'est stocké chez nous, et c'est volontaire: un numéro tronqué et une
   * date d'expiration recopiés en base seraient une seconde vérité, périmée dès
   * que le client change de carte dans le portail. La source est Stripe, ou
   * rien.
   *
   * L'échec est silencieux, comme pour la date de renouvellement: une panne
   * Stripe ne doit pas emporter la page de facturation.
   */
  private async defaultPaymentMethod(client: any): Promise<{
    paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null;
    /* « Pas de carte » et « Stripe n'a pas répondu » ne se disent pas de la
       même façon au client: le premier appelle une action de sa part, le
       second n'en appelle aucune. Confondus, la page annonçait « aucune carte
       enregistrée » à un client qui en a une, ce qui inquiète pour rien. */
    paymentMethodUnavailable?: boolean;
  }> {
    if (!client.stripeCustomerId) return { paymentMethod: null };
    try {
      const { stripe } = await import('../config/stripe');
      const customer: any = await stripe.customers.retrieve(client.stripeCustomerId, {
        expand: ['invoice_settings.default_payment_method'],
      });
      let pm: any = customer?.invoice_settings?.default_payment_method;
      /* Un client qui n'a jamais changé de carte n'a pas de moyen de paiement
         « par défaut » posé sur sa fiche: la carte vit alors sur l'abonnement.
         Sans ce repli, la ligne restait vide pour la majorité des clients. */
      if (!pm && client.stripeSubscriptionId) {
        const sub: any = await stripe.subscriptions.retrieve(client.stripeSubscriptionId, {
          expand: ['default_payment_method'],
        });
        pm = sub?.default_payment_method;
      }
      if (!pm?.card) return { paymentMethod: null };
      return {
        paymentMethod: {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        },
      };
    } catch (error: any) {
      logger.warn(`[BILLING] Stripe payment method unavailable for ${client.id}: ${error.message}`);
      return { paymentMethod: null, paymentMethodUnavailable: true };
    }
  }

  /**
   * The next charge date, straight from Stripe, or null.
   *
   * A trial has no Stripe period yet, so its end date IS the next billing
   * moment and is the honest answer. Any failure here is silent on purpose:
   * a Stripe outage must not take the whole billing page down with it.
   */
  private async nextRenewalDate(client: any): Promise<Date | null> {
    if (client.isTrial && client.trialEndDate) return client.trialEndDate;
    if (!client.stripeSubscriptionId) return null;
    try {
      const { stripe } = await import('../config/stripe');
      const sub: any = await stripe.subscriptions.retrieve(client.stripeSubscriptionId);
      return sub?.current_period_end ? new Date(sub.current_period_end * 1000) : null;
    } catch (error: any) {
      logger.warn(`[BILLING] Stripe renewal date unavailable for ${client.id}: ${error.message}`);
      return null;
    }
  }

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
      spamBlockedThisMonth,
      spamBlockedTotal,
      minutesThisMonthAgg,
    ] = await Promise.all([
      // Real-call metrics exclude spam so the client's numbers (and quota) only
      // reflect genuine calls. Spam is surfaced separately below.
      prisma.clientCall.count({ where: { clientId, isSpam: false } }),
      prisma.clientCall.count({ where: { clientId, isSpam: false, createdAt: { gte: startOfMonth } } }),
      prisma.clientCall.count({ where: { clientId, isSpam: false, createdAt: { gte: today } } }),
      prisma.clientCall.count({ where: { clientId, isSpam: false, createdAt: { gte: startOfWeek } } }),
      prisma.clientBooking.count({ where: { clientId } }),
      prisma.clientBooking.count({ where: { clientId, createdAt: { gte: startOfMonth } } }),
      prisma.clientBooking.count({ where: { clientId, bookingDate: { gte: now }, status: 'confirmed' } }),
      prisma.clientCall.count({ where: { clientId, isLead: true, isSpam: false, createdAt: { gte: startOfMonth } } }),
      prisma.clientCall.aggregate({
        where: { clientId, isSpam: false, durationSeconds: { not: null } },
        _avg: { durationSeconds: true },
      }),
      prisma.clientCall.groupBy({
        by: ['sentiment'],
        where: { clientId, isSpam: false, sentiment: { not: null } },
        _count: { id: true },
      }),
      prisma.clientCall.count({ where: { clientId, isSpam: true, createdAt: { gte: startOfMonth } } }),
      prisma.clientCall.count({ where: { clientId, isSpam: true } }),
      // Per-minute billing: minutes used this month = sum of real-call duration.
      prisma.clientCall.aggregate({
        where: { clientId, isSpam: false, startedAt: { gte: startOfMonth } },
        _sum: { durationSeconds: true },
      }),
    ]);

    const minutesUsedThisMonth = Math.round((minutesThisMonthAgg._sum.durationSeconds ?? 0) / 60);

    /* Série des 30 derniers jours, pour la courbe de l'aperçu.
       Elle n'existait pas: le tableau de bord traçait `buildDemoSeries()`, une
       courbe montante écrite en dur, à TOUS les clients. Le libellé disait bien
       « données de démonstration », mais un client paie pour voir SES appels, et
       un prospect à qui on montre l'écran voit une invention.
       Le regroupement se fait en mémoire: Prisma ne sait pas grouper par jour
       sans SQL brut, et trente jours d'appels d'un client tiennent largement. */
    /* UTC de bout en bout: la borne etait posee a minuit LOCAL alors que les
       cles sont derivees de `toISOString()`, donc en UTC. Sur un hote qui n'est
       pas en UTC, la serie commencait un jour trop tot et perdait les appels du
       jour courant. */
    const seriesEnd = new Date();
    seriesEnd.setUTCHours(0, 0, 0, 0);
    const seriesStart = new Date(seriesEnd);
    seriesStart.setUTCDate(seriesStart.getUTCDate() - 29);
    const seriesCalls = await prisma.clientCall.findMany({
      where: { clientId, isSpam: false, createdAt: { gte: seriesStart } },
      select: { createdAt: true },
    });
    const perDay = new Map<string, number>();
    for (const c of seriesCalls) {
      const key = c.createdAt.toISOString().slice(0, 10);
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    /* Tous les jours, y compris les vides: sans eux la courbe raccourcirait les
       périodes creuses et mentirait sur la tendance. */
    const dailyCalls: { date: string; count: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(seriesStart);
      d.setUTCDate(seriesStart.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyCalls.push({ date: key, count: perDay.get(key) ?? 0 });
    }

    const sentimentMap: Record<string, number> = {};
    sentimentBreakdown.forEach(s => {
      if (s.sentiment) sentimentMap[s.sentiment] = s._count.id;
    });

    // Onboarding flags derived from existing data — marks steps done
    // as soon as the user has completed them, no separate boolean column.
    const cfg = (client.vapiConfig as any) || {};
    const hasCustomConfig = !!(
      (Array.isArray(cfg.items) && cfg.items.some((i: any) => i?.name)) ||
      (cfg.hours && typeof cfg.hours === 'object') ||
      (typeof cfg.personalityNotes === 'string' && cfg.personalityNotes.trim()) ||
      (typeof cfg.faq === 'string' && cfg.faq.trim())
    );
    const hasTestCall = totalCallsAllTime > 0 || (client.totalCallsMade ?? 0) > 0;

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
        monthlyMinutesQuota: client.monthlyMinutesQuota,
        totalCallsMade: client.totalCallsMade,
        monthlyFee: Number(client.monthlyFee || 0),
        setupFee: Number(client.setupFee || 0),
        transferNumber: client.transferNumber || null,
        currency: client.currency,
        activationDate: client.activationDate,
        cancellationDate: client.cancellationDate,
        trialStartDate: client.trialStartDate,
        trialConvertedAt: client.trialConvertedAt,
        contactName: client.contactName,
        contactEmail: client.contactEmail,
        // Onboarding checklist flags
        hasCustomConfig,
        hasTestCall,
        forwardingStatus: client.forwardingStatus,
        forwardingVerifiedAt: client.forwardingVerifiedAt,
        // What this plan includes (packaging labels for display)
        planFeatures: planFeatures(client.planType),
      },
      calls: {
        total: totalCallsAllTime,
        thisMonth: callsThisMonth,
        thisWeek: callsThisWeek,
        today: callsToday,
        avgDuration: Math.round(avgCallDuration._avg.durationSeconds || 0),
      },
      // Per-minute billing: quota is expressed and tracked in minutes.
      minutes: {
        quota: client.monthlyMinutesQuota || 0,
        used: minutesUsedThisMonth,
        percent: client.monthlyMinutesQuota
          ? Math.round((minutesUsedThisMonth / client.monthlyMinutesQuota) * 100)
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
      // Trente jours d'appels réels, jour par jour. Vide tant qu'aucun appel
      // n'est arrivé, et l'interface doit alors le dire plutôt qu'inventer.
      dailyCalls,
      spam: {
        blockedThisMonth: spamBlockedThisMonth,
        blockedTotal: spamBlockedTotal,
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
    isSpam?: boolean;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = { clientId };
    if (filters?.status) where.status = filters.status;
    if (filters?.sentiment) where.sentiment = filters.sentiment;
    if (filters?.isLead !== undefined) where.isLead = filters.isLead;
    // Default view hides spam; pass isSpam=true to see the spam-only list.
    where.isSpam = filters?.isSpam === true;
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
