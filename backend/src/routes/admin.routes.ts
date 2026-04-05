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
import { botLoop } from '../jobs/bot-loop';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

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
    const prospect = await prisma.prospect.findUnique({ where: { id: req.params.id } });
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

export default router;
