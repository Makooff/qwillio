/**
 * Prospecting Engine API Routes
 * Manual triggers, status, and config endpoints
 */
import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import { apifyScrapingService } from '../services/apify-scraping.service';
import { prospectScoringService } from '../services/prospect-scoring.service';
import { outboundEngineService } from '../services/outbound-engine.service';
import { abTestingService } from '../services/ab-testing.service';
import { bestTimeLearningService } from '../services/best-time-learning.service';
import { scriptLearningService } from '../services/script-learning.service';
import { followUpSequencesService } from '../services/follow-up-sequences.service';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';

const router = Router();

// All routes require admin access — clients are rejected with 403
router.use(requireAdmin);

// ─── Manual triggers (admin) ──────────────────────────────

/** POST /api/prospecting/trigger/scrape — Run Apify scraping immediately */
router.post('/trigger/scrape', async (_req: Request, res: Response) => {
  if (!env.APIFY_API_KEY) {
    res.status(400).json({
      error: 'APIFY_API_KEY non configurée',
      message: 'Ajoutez APIFY_API_KEY dans les variables d\'environnement Render pour activer le scraping',
    });
    return;
  }

  // Fire-and-forget — respond immediately, run scraping in background
  res.json({ success: true, message: 'Scraping démarré en arrière-plan', status: 'running' });

  setImmediate(async () => {
    try {
      logger.info('[API] Background scraping started');
      const count = await apifyScrapingService.runDailyScraping();
      logger.info(`[API] Background scraping complete: ${count} prospects`);
    } catch (err) {
      logger.error('[API] Background scraping error:', err);
    }
  });
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
  // Each query wrapped individually so one missing table doesn't break all
  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch { return fallback; }
  };

  const [
    totalProspects,
    eligibleProspects,
    pendingFollowUps,
    activeAbTests,
    recentMutations,
    localPresenceNumbers,
    botStatus,
    todayProspects,
  ] = await Promise.all([
    safe(() => prisma.prospect.count(), 0),
    safe(() => prisma.prospect.count({ where: { eligibleForCall: true, priorityScore: { gte: 10 } } }), 0),
    safe(() => prisma.followUpSequence.count({ where: { sentAt: null, scheduledAt: { lte: new Date() } } }), 0),
    safe(() => prisma.scriptAbTest.count({ where: { active: true, winner: null } }), 0),
    safe(() => prisma.scriptMutation.count({ where: { status: 'testing' } }), 0),
    safe(() => prisma.localPresenceNumber.count({ where: { active: true } }), 0),
    safe(() => prisma.botStatus.findFirst({ select: { lastProspection: true, callsToday: true } }), null),
    safe(() => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return prisma.prospect.count({ where: { createdAt: { gte: today } } });
    }, 0),
  ]);

  res.json({
    totalProspects,
    eligibleProspects,
    pendingFollowUps,
    activeAbTests,
    recentMutations,
    localPresenceNumbers,
    // Fields expected by LiveMonitor
    prospectsFound: totalProspects,
    prospectsQueued: eligibleProspects,
    lastScrape: botStatus?.lastProspection ?? null,
    callsToday: botStatus?.callsToday ?? 0,
    abTestsActive: activeAbTests,
    isRunning: false,
    apifyConfigured: !!env.APIFY_API_KEY,
    todayAdded: todayProspects,
  });
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
    const slots = await bestTimeLearningService.getBestSlots(req.params.niche as string, 10);
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
    await outboundEngineService.processCompletedCall(req.params.vapiCallId as string, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/prospecting/call/:callId/classify-dropout — Classify drop-off stage */
router.post('/call/:callId/classify-dropout', async (req: Request, res: Response) => {
  try {
    const stage = await scriptLearningService.classifyDropOff(req.params.callId as string);
    if (stage) {
      await prisma.call.update({
        where: { id: req.params.callId as string },
        data: { scriptDropOffPoint: stage },
      });
    }
    res.json({ stage });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
