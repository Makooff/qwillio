import { Router, Request, Response } from 'express';
import { botController } from '../controllers/bot.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// Bot loop control
router.post('/start', (req, res) => botController.start(req, res));
router.post('/stop', (req, res) => botController.stop(req, res));
router.get('/status', (req, res) => botController.getStatus(req, res));

// Manual triggers (for testing)
router.post('/trigger/prospection', (req, res) => botController.triggerProspection(req, res));
router.post('/trigger/call', (req, res) => botController.triggerCall(req, res));
router.post('/trigger/reminders', (req, res) => botController.triggerReminders(req, res));
router.post('/trigger/test-call', (req, res) => botController.triggerTestCall(req, res));
router.post('/trigger/simulate-call', (req, res) => botController.simulateCallResult(req, res));
router.post('/trigger/niche-learning', (req, res) => botController.triggerNicheLearning(req, res));

// Bot Control Panel manual run endpoints
router.post('/run/prospecting', (req, res) => botController.runProspecting(req, res));
router.post('/run/scoring', (req, res) => botController.runScoring(req, res));
router.post('/run/calling', (req, res) => botController.runCalling(req, res));
router.post('/run/followup', (req, res) => botController.runFollowUp(req, res));

// GET /api/bot/config — current bot configuration
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = await prisma.botStatus.findFirst({
      select: {
        isActive: true,
        callsQuotaDaily: true,
        callsToday: true,
        lastProspection: true,
        lastCall: true,
      },
    });
    if (!config) {
      res.status(404).json({ error: 'Bot config not found' });
      return;
    }
    res.json({ data: config });
  } catch (err: any) {
    logger.error('[API] Bot config GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bot/config — save bot config overrides
router.post('/config', async (req: Request, res: Response) => {
  try {
    const { callsQuotaDaily } = req.body as { callsQuotaDaily?: number };
    const updates: Record<string, unknown> = {};
    if (callsQuotaDaily !== undefined) {
      if (typeof callsQuotaDaily !== 'number' || callsQuotaDaily < 1 || callsQuotaDaily > 500) {
        res.status(400).json({ error: 'callsQuotaDaily must be a number between 1 and 500' });
        return;
      }
      updates.callsQuotaDaily = callsQuotaDaily;
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }
    const existing = await prisma.botStatus.findFirst({ select: { id: true } });
    if (!existing) {
      res.status(404).json({ error: 'Bot status record not found' });
      return;
    }
    const updated = await prisma.botStatus.update({
      where: { id: existing.id },
      data: updates,
    });
    logger.info('[API] Bot config updated:', updates);
    res.json({ data: updated, message: 'Bot config updated' });
  } catch (err: any) {
    logger.error('[API] Bot config POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
