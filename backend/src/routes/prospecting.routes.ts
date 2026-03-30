/**
 * Prospecting Engine API Routes
 * Manual triggers, status, and config endpoints
 */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { apifyScrapingService } from '../services/apify-scraping.service';
import { prospectScoringService } from '../services/prospect-scoring.service';
import { outboundEngineService } from '../services/outbound-engine.service';
import { abTestingService } from '../services/ab-testing.service';
import { bestTimeLearningService } from '../services/best-time-learning.service';
import { scriptLearningService } from '../services/script-learning.service';
import { followUpSequencesService } from '../services/follow-up-sequences.service';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ─── Manual triggers (admin) ──────────────────────────────

/** POST /api/prospecting/trigger/scrape — Run Apify scraping immediately */
router.post('/trigger/scrape', async (_req: Request, res: Response) => {
  try {
    logger.info('[API] Manual scraping triggered');
    const count = await apifyScrapingService.runDailyScraping();
    res.json({ success: true, prospectsAdded: count });
  } catch (err) {
    logger.error('[API] Scraping trigger error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/prospecting/trigger/call — Attempt one outbound call */
router.post('/trigger/call', async (_req: Request, res: Response) => {
  try {
    const called = await outboundEngineService.callNextProspect();
    res.json({ success: true, called });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/prospecting/trigger/ab-analysis — Run A/B test analysis */
router.post('/trigger/ab-analysis', async (_req: Request, res: Response) => {
  try {
    await abTestingService.analyzeAll();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/prospecting/trigger/best-time — Run best-time learning */
router.post('/trigger/best-time', async (_req: Request, res: Response) => {
  try {
    const updated = await bestTimeLearningService.analyzeAll();
    res.json({ success: true, slotsUpdated: updated });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/prospecting/trigger/script-learning — Run script learning analysis */
router.post('/trigger/script-learning', async (_req: Request, res: Response) => {
  try {
    await scriptLearningService.runWeeklyAnalysis();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/prospecting/trigger/follow-ups — Process due follow-ups */
router.post('/trigger/follow-ups', async (_req: Request, res: Response) => {
  try {
    const sent = await followUpSequencesService.processDue();
    res.json({ success: true, sent });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/prospecting/trigger/rescore — Re-score unscored prospects */
router.post('/trigger/rescore', async (_req: Request, res: Response) => {
  try {
    const updated = await prospectScoringService.rescoreUnscored(500);
    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/prospecting/trigger/seed-local-presence — Seed local presence numbers */
router.post('/trigger/seed-local-presence', async (_req: Request, res: Response) => {
  try {
    await outboundEngineService.seedLocalPresenceNumbers();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Status & analytics ───────────────────────────────────

/** GET /api/prospecting/status — Overview of prospecting engine */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const [
      totalProspects,
      eligibleProspects,
      pendingFollowUps,
      activeAbTests,
      recentMutations,
      localPresenceNumbers,
    ] = await Promise.all([
      prisma.prospect.count(),
      prisma.prospect.count({ where: { eligibleForCall: true, isMobile: false, priorityScore: { gte: 10 } } }),
      prisma.followUpSequence.count({ where: { sentAt: null, scheduledAt: { lte: new Date() } } }),
      prisma.scriptAbTest.count({ where: { active: true, winner: null } }),
      prisma.scriptMutation.count({ where: { status: 'testing' } }),
      prisma.localPresenceNumber.count({ where: { active: true } }),
    ]);

    res.json({
      totalProspects,
      eligibleProspects,
      pendingFollowUps,
      activeAbTests,
      recentMutations,
      localPresenceNumbers,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/prospecting/ab-tests — List active A/B tests */
router.get('/ab-tests', async (_req: Request, res: Response) => {
  try {
    const tests = await prisma.scriptAbTest.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/prospecting/mutations — List script mutations */
router.get('/mutations', async (_req: Request, res: Response) => {
  try {
    const mutations = await prisma.scriptMutation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(mutations);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/prospecting/best-times/:niche — Best calling times for a niche */
router.get('/best-times/:niche', async (req: Request, res: Response) => {
  try {
    const slots = await bestTimeLearningService.getBestSlots(req.params.niche, 10);
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/prospecting/local-presence — List local presence numbers */
router.get('/local-presence', async (_req: Request, res: Response) => {
  try {
    const numbers = await prisma.localPresenceNumber.findMany({
      where: { active: true },
      orderBy: { areaCode: 'asc' },
    });
    res.json(numbers);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/prospecting/call/:vapiCallId/complete — Process completed call */
router.post('/call/:vapiCallId/complete', async (req: Request, res: Response) => {
  try {
    await outboundEngineService.processCompletedCall(req.params.vapiCallId, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/prospecting/call/:callId/classify-dropout — Classify drop-off stage */
router.post('/call/:callId/classify-dropout', async (req: Request, res: Response) => {
  try {
    const stage = await scriptLearningService.classifyDropOff(req.params.callId);
    if (stage) {
      await prisma.call.update({
        where: { id: req.params.callId },
        data: { scriptDropOffPoint: stage },
      });
    }
    res.json({ stage });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
