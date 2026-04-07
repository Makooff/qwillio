import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { analyticsService } from '../services/analytics.service';

const router = Router();

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

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const [statsResult, activityResult, prospectsReadyResult] = await Promise.allSettled([
      analyticsService.getDashboardStats(),
      analyticsService.getRecentActivity(10),
      prisma.prospect.count({ where: { status: 'new', eligibleForCall: true, callAttempts: { lt: 3 }, phone: { not: null } } }),
    ]);
    const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
    const activity = activityResult.status === 'fulfilled' ? activityResult.value : [];
    const prospectsReadyToCall = prospectsReadyResult.status === 'fulfilled' ? prospectsReadyResult.value : 0;
    res.json({ ...(stats ?? EMPTY_DASHBOARD), prospectsReadyToCall, activity });
  } catch (err: any) {
    logger.error('[API] Admin dashboard error:', err);
    res.json({ ...EMPTY_DASHBOARD });
  }
});

router.get('/prospects', async (_req: Request, res: Response) => {
  try {
    const prospects = await prisma.prospect.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        company: true, status: true, eligibleForCall: true, callAttempts: true,
        createdAt: true, updatedAt: true,
      }
    });
    res.json(prospects);
  } catch (err: any) {
    logger.error('[API] Prospects list error:', err);
    res.json([]);
  }
});

router.get('/clients', async (_req: Request, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        company: true, plan: true, status: true, mrr: true, createdAt: true,
      }
    });
    res.json(clients);
  } catch (err: any) {
    logger.error('[API] Clients list error:', err);
    res.json([]);
  }
});

router.get('/calls', async (_req: Request, res: Response) => {
  try {
    const calls = await prisma.callLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        prospect: { select: { firstName: true, lastName: true, company: true, phone: true } }
      }
    });
    res.json(calls);
  } catch (err: any) {
    logger.error('[API] Calls list error:', err);
    res.json([]);
  }
});

router.get('/leads', async (_req: Request, res: Response) => {
  try {
    const leads = await prisma.prospect.findMany({
      where: { status: { in: ['contacted', 'qualified', 'proposal'] } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    res.json(leads);
  } catch (err: any) {
    logger.error('[API] Leads list error:', err);
    res.json([]);
  }
});

router.get('/billing', async (_req: Request, res: Response) => {
  try {
    const [clients, mrr] = await Promise.allSettled([
      prisma.client.findMany({ where: { status: 'active' }, select: { plan: true, mrr: true } }),
      prisma.client.aggregate({ where: { status: 'active' }, _sum: { mrr: true } })
    ]);
    const activeClients = clients.status === 'fulfilled' ? clients.value : [];
    const totalMrr = mrr.status === 'fulfilled' ? (mrr.value._sum.mrr ?? 0) : 0;
    const byPlan = activeClients.reduce((acc: Record<string, number>, c: any) => {
      acc[c.plan] = (acc[c.plan] || 0) + 1;
      return acc;
    }, {});
    res.json({ totalMrr, clientCount: activeClients.length, byPlan });
  } catch (err: any) {
    logger.error('[API] Billing error:', err);
    res.json({ totalMrr: 0, clientCount: 0, byPlan: {} });
  }
});

router.get('/system', async (_req: Request, res: Response) => {
  try {
    const [prospectCount, clientCount, callCount] = await Promise.allSettled([
      prisma.prospect.count(),
      prisma.client.count(),
      prisma.callLog.count(),
    ]);
    res.json({
      db: 'connected',
      prospects: prospectCount.status === 'fulfilled' ? prospectCount.value : 0,
      clients: clientCount.status === 'fulfilled' ? clientCount.value : 0,
      calls: callCount.status === 'fulfilled' ? callCount.value : 0,
      uptime: process.uptime(),
      nodeVersion: process.version,
      env: process.env.NODE_ENV,
    });
  } catch (err: any) {
    logger.error('[API] System error:', err);
    res.json({ db: 'error', error: err.message });
  }
});

router.post('/bot/start', async (_req: Request, res: Response) => {
  try {
    const bot = await (prisma as any).botStatus?.upsert?.({
      where: { id: 1 },
      update: { isActive: true },
      create: { id: 1, isActive: true, callsQuotaDaily: 50, callsTodayCount: 0 },
    }).catch(() => null);
    res.json({ success: true, message: 'Bot started', bot });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bot/stop', async (_req: Request, res: Response) => {
  try {
    const bot = await (prisma as any).botStatus?.upsert?.({
      where: { id: 1 },
      update: { isActive: false },
      create: { id: 1, isActive: false, callsQuotaDaily: 50, callsTodayCount: 0 },
    }).catch(() => null);
    res.json({ success: true, message: 'Bot stopped', bot });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI endpoints ──────────────────────────────────────────

// GET /api/admin/ai/insights
router.get('/ai/insights', async (_req: Request, res: Response) => {
  try {
    const insights = await (prisma as any).nicheInsight?.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }) ?? [];
    res.json({ insights });
  } catch (e) {
    logger.error('[API] AI insights error:', e);
    res.json({ insights: [] });
  }
});

// GET /api/admin/ai/scripts
router.get('/ai/scripts', async (_req: Request, res: Response) => {
  try {
    const scripts = await (prisma as any).scriptMutation?.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }) ?? [];
    res.json({ scripts });
  } catch (e) {
    logger.error('[API] AI scripts error:', e);
    res.json({ scripts: [] });
  }
});

// GET /api/admin/ai/decisions
router.get('/ai/decisions', async (_req: Request, res: Response) => {
  try {
    const decisions = await (prisma as any).aiDecision?.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    }) ?? [];
    res.json({ decisions });
  } catch (e) {
    logger.error('[API] AI decisions error:', e);
    res.json({ decisions: [] });
  }
});

export default router;
