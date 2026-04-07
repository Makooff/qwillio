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
    const [statsResult, activityResult, readyResult] = await Promise.allSettled([
      analyticsService.getDashboardStats(),
      analyticsService.getRecentActivity(10),
      prisma.prospect.count({ where: { status: 'new', eligibleForCall: true, callAttempts: { lt: 3 }, phone: { not: null } } }),
    ]);
    const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
    const activity = activityResult.status === 'fulfilled' ? activityResult.value : [];
    const prospectsReadyToCall = readyResult.status === 'fulfilled' ? readyResult.value : 0;
    res.json({ ...(stats ?? EMPTY_DASHBOARD), prospectsReadyToCall, activity });
  } catch (err: any) {
    logger.error('[API] Admin dashboard error:', err);
    res.json({ ...EMPTY_DASHBOARD });
  }
});

router.get('/prospects', async (_req: Request, res: Response) => {
  try {
    const prospects = await prisma.prospect.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json(prospects);
  } catch (err: any) {
    logger.error('[API] Prospects error:', err);
    res.json([]);
  }
});

router.get('/clients', async (_req: Request, res: Response) => {
  try {
    const clients = await prisma.client.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json(clients);
  } catch (err: any) {
    logger.error('[API] Clients error:', err);
    res.json([]);
  }
});

router.get('/calls', async (_req: Request, res: Response) => {
  res.json([]);
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
    logger.error('[API] Leads error:', err);
    res.json([]);
  }
});

router.get('/billing', async (_req: Request, res: Response) => {
  try {
    const clients = await prisma.client.findMany({ take: 200 });
    const total = clients.reduce((sum: number, c: any) => sum + Number(c.monthlyFee ?? c.setupFee ?? 0), 0);
    res.json({ totalMrr: total, clientCount: clients.length, byPlan: {} });
  } catch (err: any) {
    res.json({ totalMrr: 0, clientCount: 0, byPlan: {} });
  }
});

router.get('/system', async (_req: Request, res: Response) => {
  try {
    const [pc, cc] = await Promise.allSettled([prisma.prospect.count(), prisma.client.count()]);
    res.json({
      db: 'connected',
      prospects: pc.status === 'fulfilled' ? pc.value : 0,
      clients: cc.status === 'fulfilled' ? cc.value : 0,
      calls: 0,
      uptime: process.uptime(),
      nodeVersion: process.version,
      env: process.env.NODE_ENV,
    });
  } catch (err: any) {
    res.json({ db: 'error', error: err.message });
  }
});

router.post('/bot/start', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Bot started' });
});

router.post('/bot/stop', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Bot stopped' });
});

export default router;