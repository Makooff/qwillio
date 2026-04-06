/**
 * Admin API Routes — /api/admin/*
 * All endpoints require JWT auth + admin role.
 * These are canonical admin endpoints; existing routes at /api/dashboard/*,
 * /api/prospects/*, /api/clients/* etc. remain fully functional.
 */
import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { dashboardController } from '../controllers/dashboard.controller';
import { prospectsController } from '../controllers/prospects.controller';
import { clientsController } from '../controllers/clients.controller';
import { outboundEngineService } from '../services/outbound-engine.service';
import { analyticsService } from '../services/analytics.service';
import { botLoop } from '../jobs/bot-loop';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// ─── Dashboard (unified single-call endpoint) ──────────────

const EMPTY_DASHBOARD = {
  prospects: { total: 0, newThisMonth: 0, byStatus: {} as Record<string, number> },
  clients: { totalActive: 0, newThisMonth: 0, byPlan: {} as Record<string, number> },
  revenue: { mrr: 0, setupFeesThisMonth: 0, totalThisMonth: 0 },
  conversion: { prospectToClient: 0, quoteAcceptanceRate: 0 },
  calls: { today: 0, thisWeek: 0, successRate: 0 },
  bot: { isActive: false, callsToday: 0, callsQuota: 50 },
  prospectsReadyToCall: 0,
  activity: [] as any[],
};

/**
 * GET /api/admin/dashboard
 * Returns all dashboard data in one shot. Never returns 500 — falls back to zeros.
 */
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const [statsResult, activityResult, prospectsReadyResult] = await Promise.allSettled([
      analyticsService.getDashboardStats(),
      analyticsService.getRecentActivity(10),
      prisma.prospect.count({
        where: {
          status: 'new',
          eligibleForCall: true,
          callAttempts: { lt: 3 },
          phone: { not: null },
        },
      }),
    ]);

    const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
    const activity = activityResult.status === 'fulfilled' ? activityResult.value : [];
    const prospectsReadyToCall = prospectsReadyResult.status === 'fulfilled' ? prospectsReadyResult.value : 0;

    res.json({
      ...(stats ?? EMPTY_DASHBOARD),
      prospectsReadyToCall,
      activity,
    });
  } catch (err: any) {
    logger.error('[API] Admin dashboard error:', err);
    res.json({ ...EMPTY_DASHBOARD });
  }
});

// ─── Stats ─────────────────────────────────────────────────

/** GET /api/admin/stats — total prospects, calls today/week, answer rate, MRR, active clients */
router.get('/stats', (req, res) => dashboardController.getStats(req, res));

// ─── Activity feed ─────────────────────────────────────────

/** GET /api/admin/activity-feed — last 20 events */
router.get('/activity-feed', (req, res) => dashboardController.getRecentActivity(req, res));

// ─── Bot config ────────────────────────────────────────────

/** GET /api/admin/bot-config — current bot configuration */
router.get('/bot-config', async (_req: Request, res: Response) => {
  try {
    const cfg = {
      vapiBaseUrl: env.VAPI_BASE_URL || '',
      apifyActorId: env.APIFY_ACTOR_ID || '',
      minPriorityScore: env.MIN_PRIORITY_SCORE || 10,
    };
    const status = await prisma.botStatus.findFirst();

    res.json({
      data: {
        isActive: status?.isActive ?? false,
        callsQuotaDaily: status?.callsQuotaDaily ?? 50,
        callsToday: status?.callsToday ?? 0,
        lastProspection: status?.lastProspection ?? null,
        lastCall: status?.lastCall ?? null,
        ...cfg,
      },
    });
  } catch (err: any) {
    logger.error('[API] Admin bot-config GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/bot-config — save bot config overrides */
router.post('/bot-config', async (req: Request, res: Response) => {
  try {
    const { callsQuotaDaily } = req.body as { callsQuotaDaily?: number };
    if (callsQuotaDaily !== undefined) {
      if (typeof callsQuotaDaily !== 'number' || callsQuotaDaily < 1 || callsQuotaDaily > 500) {
        res.status(400).json({ error: 'callsQuotaDaily must be between 1 and 500' });
        return;
      }
      const existing = await prisma.botStatus.findFirst({ select: { id: true } });
      if (!existing) {
        res.status(404).json({ error: 'Bot status record not found' });
        return;
      }
      await prisma.botStatus.update({
        where: { id: existing.id },
        data: { callsQuotaDaily },
      });
      logger.info(`[API] Admin bot-config updated: callsQuotaDaily=${callsQuotaDaily}`);
    }
    const updated = await botLoop.getStatus();
    res.json({ data: updated, message: 'Bot config saved' });
  } catch (err: any) {
    logger.error('[API] Admin bot-config POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Prospects ─────────────────────────────────────────────

/** GET /api/admin/prospects — paginated prospect list */
router.get('/prospects', (req, res) => prospectsController.list(req, res));

/** POST /api/admin/prospects/:id/call — trigger immediate VAPI call for a prospect */
router.post('/prospects/:id/call', async (req: Request, res: Response) => {
  try {
    const prospect = await prisma.prospect.findUnique({ where: { id: req.params.id as string } });
    if (!prospect) {
      res.status(404).json({ error: 'Prospect not found' });
      return;
    }
    if (!prospect.phone) {
      res.status(400).json({ error: 'Prospect has no phone number' });
      return;
    }
    logger.info(`[API] Admin manual call for prospect ${prospect.id} (${prospect.businessName})`);
    const called = await outboundEngineService.callNextProspect();
    res.json({
      success: true,
      called,
      message: called ? 'Call initiated' : 'No eligible prospect or daily quota reached',
    });
  } catch (err: any) {
    logger.error('[API] Admin prospect call error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Clients ───────────────────────────────────────────────

/** GET /api/admin/clients — client list with plan, status, MRR */
router.get('/clients', (req, res) => clientsController.list(req, res));

// ─── Unified dashboard ─────────────────────────────────────

/** GET /api/admin/dashboard — single call for the full dashboard */
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);

    const [
      botStatusRes,
      prospectsTotalRes,
      prospectsReadyRes,
      prospectsWeekRes,
      callsTodayRes,
      callsWeekRes,
      callsAnsweredRes,
      clientsTotalRes,
      recentCallsRes,
      recentClientsRes,
    ] = await Promise.allSettled([
      botLoop.getStatus(),
      prisma.prospect.count(),
      prisma.prospect.count({
        where: {
          status: 'new',
          eligibleForCall: true,
          isMobile: false,
          priorityScore: { gte: 10 },
          callAttempts: { lt: 3 },
          phone: { not: null },
        },
      }),
      prisma.prospect.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.call.count({ where: { startedAt: { gte: today } } }),
      prisma.call.count({ where: { startedAt: { gte: sevenDaysAgo } } }),
      prisma.call.count({ where: { status: 'completed', startedAt: { gte: sevenDaysAgo } } }),
      prisma.client.count({ where: { subscriptionStatus: 'active' } }),
      prisma.call.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: { prospect: { select: { businessName: true } } },
      }),
      prisma.client.findMany({ take: 3, orderBy: { createdAt: 'desc' } }),
    ]);

    const val = <T>(r: PromiseSettledResult<T>, def: T): T =>
      r.status === 'fulfilled' ? r.value : def;

    const botStatus = val(botStatusRes, null as any);
    const isActive: boolean = botStatus?.isActive ?? false;
    const crons: Record<string, string> = botStatus?.crons ?? {};

    const cronStatus = (key: string): 'running' | 'idle' | 'inactive' => {
      if (crons[key] === 'active') return 'running';
      return isActive ? 'idle' : 'inactive';
    };

    const recentCalls = val(recentCallsRes, [] as any[]);
    const recentClients = val(recentClientsRes, [] as any[]);

    const activity: Array<{ id: string; message: string; timestamp: string; type: string }> = [];
    recentCalls.forEach((c: any) => {
      activity.push({
        id: c.id,
        message: `Appel ${c.status === 'completed' ? 'terminé' : c.status}: ${c.prospect?.businessName ?? c.phoneNumber}`,
        timestamp: (c.startedAt ?? c.createdAt).toISOString(),
        type: 'call',
      });
    });
    recentClients.forEach((c: any) => {
      activity.push({
        id: c.id,
        message: `Nouveau client: ${c.businessName} (${c.planType})`,
        timestamp: c.createdAt.toISOString(),
        type: 'client',
      });
    });
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const callsWeekCount = val(callsWeekRes, 0);
    const answeredCount = val(callsAnsweredRes, 0);

    const toIso = (d: Date | string | null | undefined): string | null => {
      if (!d) return null;
      if (typeof d === 'string') return d;
      return d.toISOString();
    };

    res.json({
      bot: {
        isActive,
        lastProspection: toIso(botStatus?.lastProspection),
        lastCall: toIso(botStatus?.lastCall),
        callsToday: botStatus?.callsToday ?? 0,
        callsQuota: botStatus?.callsQuotaDaily ?? 50,
      },
      services: {
        prospection: cronStatus('prospection'),
        calling: cronStatus('calling'),
        reminders: cronStatus('reminders'),
        analytics: cronStatus('analytics'),
      },
      prospects: {
        total: val(prospectsTotalRes, 0),
        readyToCall: val(prospectsReadyRes, 0),
        thisWeek: val(prospectsWeekRes, 0),
      },
      calls: {
        today: val(callsTodayRes, 0),
        thisWeek: callsWeekCount,
        answered: answeredCount,
        conversionRate: callsWeekCount > 0 ? Math.round((answeredCount / callsWeekCount) * 100) : 0,
      },
      clients: {
        total: val(clientsTotalRes, 0),
      },
      activity: activity.slice(0, 6),
    });
  } catch (err: any) {
    logger.error('[API] Admin dashboard error:', err);
    res.json({
      bot: { isActive: false, lastProspection: null, lastCall: null, callsToday: 0, callsQuota: 50 },
      services: { prospection: 'inactive', calling: 'inactive', reminders: 'inactive', analytics: 'inactive' },
      prospects: { total: 0, readyToCall: 0, thisWeek: 0 },
      calls: { today: 0, thisWeek: 0, answered: 0, conversionRate: 0 },
      clients: { total: 0 },
      activity: [],
    });
  }
});

export default router;
