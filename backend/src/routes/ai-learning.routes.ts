import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { prisma } from '../config/database';

const router = Router();

// AI Learning routes are admin-only (mutation/decision data is internal)
router.use(authMiddleware);
router.use(adminMiddleware);

// ─── Script Mutations ─────────────────────────────────────

// GET /api/ai/mutations — list script mutations (filterable by niche, status)
router.get('/mutations', async (req: Request, res: Response) => {
  try {
    const { niche, status, language, page = '1', limit = '50' } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);

    const where: any = {};
    if (niche) where.niche = { contains: niche, mode: 'insensitive' };
    if (status) where.status = status;
    if (language) where.language = language;

    const [mutations, total] = await Promise.all([
      prisma.scriptMutation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.scriptMutation.count({ where }),
    ]);

    res.json({
      mutations,
      pagination: {
        total,
        page: parseInt(page),
        limit: take,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch script mutations' });
  }
});

// ─── AI Decisions ─────────────────────────────────────────

// GET /api/ai/decisions — list AI decisions log
router.get('/decisions', async (req: Request, res: Response) => {
  try {
    const { type, niche, outcome, page = '1', limit = '50' } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);

    const where: any = {};
    if (type) where.type = type;
    if (niche) where.niche = { contains: niche, mode: 'insensitive' };
    if (outcome) where.outcome = outcome;

    const [decisions, total] = await Promise.all([
      prisma.aiDecision.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take,
      }),
      prisma.aiDecision.count({ where }),
    ]);

    res.json({
      decisions,
      pagination: {
        total,
        page: parseInt(page),
        limit: take,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch AI decisions' });
  }
});

// ─── A/B Tests ────────────────────────────────────────────

// GET /api/ai/ab-tests — list A/B tests
router.get('/ab-tests', async (req: Request, res: Response) => {
  try {
    const { niche, language, hasWinner } = req.query as Record<string, string>;

    const where: any = {};
    if (niche) where.niche = { contains: niche, mode: 'insensitive' };
    if (language) where.language = language;
    if (hasWinner === 'true') where.winner = { not: null };
    if (hasWinner === 'false') where.winner = null;

    const tests = await prisma.scriptAbTest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Add computed conversion rates
    const enriched = tests.map((t) => ({
      ...t,
      conversionRateA: t.callsA > 0 ? (t.conversionsA / t.callsA) * 100 : 0,
      conversionRateB: t.callsB > 0 ? (t.conversionsB / t.callsB) * 100 : 0,
      isRunning: t.winner == null,
    }));

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch A/B tests' });
  }
});

// ─── Best Times ───────────────────────────────────────────

// GET /api/ai/best-times — get best times per niche
router.get('/best-times', async (req: Request, res: Response) => {
  try {
    const { niche } = req.query as Record<string, string>;

    const where: any = {};
    if (niche) where.niche = { contains: niche, mode: 'insensitive' };

    const bestTimes = await prisma.nicheBestTime.findMany({
      where,
      orderBy: [{ niche: 'asc' }, { conversionRate: 'desc' }],
    });

    // Group by niche for convenient consumption
    const grouped: Record<string, typeof bestTimes> = {};
    for (const entry of bestTimes) {
      if (!grouped[entry.niche]) grouped[entry.niche] = [];
      grouped[entry.niche].push(entry);
    }

    res.json({ bestTimes, grouped });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch best times' });
  }
});

// ─── Summary Stats ────────────────────────────────────────

// GET /api/ai/stats — summary stats (mutations this month, reverts, blocked, avg confidence)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      mutationsThisMonth,
      reverts,
      blocked,
      avgConfidenceRaw,
      totalMutations,
      totalDecisions,
      activeTests,
      completedTests,
    ] = await Promise.all([
      prisma.scriptMutation.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      prisma.scriptMutation.count({
        where: { revertedAt: { not: null } },
      }),
      prisma.scriptMutation.count({
        where: { status: 'blocked' },
      }),
      prisma.scriptMutation.aggregate({
        _avg: { confidenceScore: true },
        where: { confidenceScore: { not: null } },
      }),
      prisma.scriptMutation.count(),
      prisma.aiDecision.count(),
      prisma.scriptAbTest.count({ where: { winner: null } }),
      prisma.scriptAbTest.count({ where: { winner: { not: null } } }),
    ]);

    res.json({
      mutationsThisMonth,
      reverts,
      blocked,
      avgConfidenceScore: avgConfidenceRaw._avg.confidenceScore ?? null,
      totalMutations,
      totalDecisions,
      activeTests,
      completedTests,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch AI stats' });
  }
});

export default router;
