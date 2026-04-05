import { Request, Response } from 'express';
import { prisma } from '../config/database';

export class AdminController {
  async getStats(_req: Request, res: Response) {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7)); // Monday

      const [
        totalProspects,
        prospectsCalledToday,
        prospectsCalledThisWeek,
        callsToday,
        callsAnsweredWeek,
        callsTotalWeek,
        callsInterestedWeek,
        campaignStats,
        activeClients,
        trialClients,
        clientsForMrr,
      ] = await Promise.all([
        prisma.prospect.count(),
        prisma.prospect.count({ where: { lastCallDate: { gte: startOfToday } } }),
        prisma.prospect.count({ where: { lastCallDate: { gte: startOfWeek } } }),
        prisma.call.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.call.count({
          where: { outcome: { not: 'no-answer' }, createdAt: { gte: sevenDaysAgo } },
        }),
        prisma.call.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.call.count({
          where: { interestScore: { gte: 5 }, createdAt: { gte: sevenDaysAgo } },
        }),
        prisma.campaign.aggregate({
          _sum: { deliveredCount: true, bouncedCount: true },
        }),
        prisma.client.count({
          where: { subscriptionStatus: 'active', isTrial: false },
        }),
        prisma.client.count({ where: { isTrial: true } }),
        prisma.client.findMany({
          where: { subscriptionStatus: 'active' },
          select: { monthlyFee: true },
        }),
      ]);

      // Follow-ups sent today: prospects that have emailSmsFollowupSent and were updated today
      const followupsSentToday = await prisma.prospect.count({
        where: { emailSmsFollowupSent: true, updatedAt: { gte: startOfToday } },
      });

      const answerRate =
        callsTotalWeek > 0 ? Math.round((callsAnsweredWeek / callsTotalWeek) * 100) : 0;
      const interestRate =
        callsAnsweredWeek > 0
          ? Math.round((callsInterestedWeek / callsAnsweredWeek) * 100)
          : 0;

      const mrr = clientsForMrr.reduce((sum, c) => sum + Number(c.monthlyFee), 0);

      res.json({
        totalProspects,
        prospectsCalledToday,
        prospectsCalledThisWeek,
        callsToday,
        answerRate,
        interestRate,
        followupsSentToday,
        emailsDelivered: campaignStats._sum.deliveredCount ?? 0,
        emailsBounced: campaignStats._sum.bouncedCount ?? 0,
        activeClients,
        trialClients,
        mrr,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getActivityFeed(_req: Request, res: Response) {
    try {
      const [recentCalls, recentProspects, recentClients] = await Promise.all([
        prisma.call.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            prospect: { select: { businessName: true, city: true } },
          },
        }),
        prisma.prospect.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { businessName: true, city: true, score: true, createdAt: true },
        }),
        prisma.client.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { businessName: true, planType: true, createdAt: true },
        }),
      ]);

      const feed: Array<{
        icon: string;
        message: string;
        date: string;
        type: string;
      }> = [];

      for (const call of recentCalls) {
        const biz = call.prospect?.businessName ?? call.phoneNumber;
        const city = call.prospect?.city ? ` (${call.prospect.city})` : '';
        if (call.interestScore && call.interestScore >= 5) {
          feed.push({
            icon: '📞',
            message: `Appel: ${biz}${city} — score ${call.interestScore}/10 — intéressé`,
            date: call.createdAt.toISOString(),
            type: 'call_interested',
          });
        } else {
          feed.push({
            icon: '📞',
            message: `Appel: ${biz}${city} — ${call.outcome ?? call.status}`,
            date: call.createdAt.toISOString(),
            type: 'call',
          });
        }
      }

      for (const p of recentProspects) {
        const city = p.city ? ` (${p.city})` : '';
        feed.push({
          icon: '🔍',
          message: `Nouveau prospect: ${p.businessName}${city} — score ${p.score}`,
          date: p.createdAt.toISOString(),
          type: 'new_prospect',
        });
      }

      for (const c of recentClients) {
        feed.push({
          icon: '✅',
          message: `Nouveau client: ${c.businessName} — plan ${c.planType}`,
          date: c.createdAt.toISOString(),
          type: 'new_client',
        });
      }

      feed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json(feed.slice(0, 20));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getBotConfig(_req: Request, res: Response) {
    try {
      let config = await prisma.adminConfig.findFirst();
      if (!config) {
        config = await prisma.adminConfig.create({ data: {} });
      }
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async saveBotConfig(req: Request, res: Response) {
    try {
      const {
        callsPerDay,
        callWindowStart,
        callWindowEnd,
        activeDays,
        callIntervalMinutes,
        prospectionQuotaPerDay,
        minPriorityScore,
        targetCities,
        vapiAssistantId,
        vapiVoiceId,
        maxCallDurationMin,
        silenceTimeoutSeconds,
        apifyActorId,
        targetNiches,
        apifyTargetCities,
      } = req.body;

      const data: Record<string, unknown> = {};
      if (callsPerDay !== undefined) data.callsPerDay = Number(callsPerDay);
      if (callWindowStart !== undefined) data.callWindowStart = Number(callWindowStart);
      if (callWindowEnd !== undefined) data.callWindowEnd = Number(callWindowEnd);
      if (activeDays !== undefined) data.activeDays = activeDays;
      if (callIntervalMinutes !== undefined) data.callIntervalMinutes = Number(callIntervalMinutes);
      if (prospectionQuotaPerDay !== undefined) data.prospectionQuotaPerDay = Number(prospectionQuotaPerDay);
      if (minPriorityScore !== undefined) data.minPriorityScore = Number(minPriorityScore);
      if (targetCities !== undefined) data.targetCities = targetCities;
      if (vapiAssistantId !== undefined) data.vapiAssistantId = vapiAssistantId;
      if (vapiVoiceId !== undefined) data.vapiVoiceId = vapiVoiceId;
      if (maxCallDurationMin !== undefined) data.maxCallDurationMin = Number(maxCallDurationMin);
      if (silenceTimeoutSeconds !== undefined) data.silenceTimeoutSeconds = Number(silenceTimeoutSeconds);
      if (apifyActorId !== undefined) data.apifyActorId = apifyActorId;
      if (targetNiches !== undefined) data.targetNiches = targetNiches;
      if (apifyTargetCities !== undefined) data.apifyTargetCities = apifyTargetCities;

      let config = await prisma.adminConfig.findFirst();
      if (!config) {
        config = await prisma.adminConfig.create({ data });
      } else {
        config = await prisma.adminConfig.update({ where: { id: config.id }, data });
      }
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const adminController = new AdminController();
