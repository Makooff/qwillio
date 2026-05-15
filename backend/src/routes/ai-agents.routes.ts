/**
 * AI Agents API Routes
 * Work Planner, Business Plan, Branding, Agent Evolution
 */
import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import { workPlannerAgentService } from '../services/work-planner-agent.service';
import { businessPlanAgentService } from '../services/business-plan-agent.service';
import { brandingAgentService } from '../services/branding-agent.service';
import { agentEvolutionService } from '../services/agent-evolution.service';
import { agentMemoryService } from '../services/agent-memory.service';
import { logger } from '../config/logger';

const router = Router();

router.use(requireAdmin);

// ─── Work Planner ─────────────────────────────────────────

/** POST /api/ai-agents/work-planner/day-plan — Generate today's call plan */
router.post('/work-planner/day-plan', async (req: Request, res: Response) => {
  try {
    const { date, maxProspects } = req.body as { date?: string; maxProspects?: number };
    const targetDate = date ? new Date(date) : new Date();
    const plan = await workPlannerAgentService.generateDayPlan(targetDate, maxProspects ?? 50);
    res.json({ success: true, plan });
  } catch (err) {
    logger.error('[API/WorkPlanner] Error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/ai-agents/work-planner/outcome — Record plan outcome */
router.post('/work-planner/outcome', async (req: Request, res: Response) => {
  try {
    const { actionId, contactedCount, qualifiedCount } = req.body as {
      actionId: string;
      contactedCount: number;
      qualifiedCount: number;
    };
    if (!actionId) {
      res.status(400).json({ error: 'actionId required' });
      return;
    }
    await workPlannerAgentService.recordPlanOutcome(actionId, contactedCount ?? 0, qualifiedCount ?? 0);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Business Plan ────────────────────────────────────────

/** POST /api/ai-agents/business-plan/generate — Generate ROI pitch for a prospect */
router.post('/business-plan/generate', async (req: Request, res: Response) => {
  try {
    const { prospectId } = req.body as { prospectId: string };
    if (!prospectId) {
      res.status(400).json({ error: 'prospectId required' });
      return;
    }
    const result = await businessPlanAgentService.generateBusinessPlan(prospectId);
    res.json({ success: true, result });
  } catch (err) {
    logger.error('[API/BusinessPlan] Error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/ai-agents/business-plan/outcome — Record plan outcome */
router.post('/business-plan/outcome', async (req: Request, res: Response) => {
  try {
    const { actionId, outcome } = req.body as {
      actionId: string;
      outcome: 'converted' | 'rejected' | 'no_response';
    };
    if (!actionId || !outcome) {
      res.status(400).json({ error: 'actionId and outcome required' });
      return;
    }
    await businessPlanAgentService.recordPlanOutcome(actionId, outcome);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Branding Agent ───────────────────────────────────────

/** POST /api/ai-agents/branding/analyze — Analyze brand identity */
router.post('/branding/analyze', async (req: Request, res: Response) => {
  try {
    const { prospectId } = req.body as { prospectId: string };
    if (!prospectId) {
      res.status(400).json({ error: 'prospectId required' });
      return;
    }
    const analysis = await brandingAgentService.analyzeBrand(prospectId);
    res.json({ success: true, analysis });
  } catch (err) {
    logger.error('[API/Branding] Error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/ai-agents/branding/:prospectId — Get cached brand analysis */
router.get('/branding/:prospectId', async (req: Request, res: Response) => {
  try {
    const analysis = await brandingAgentService.getBrandForProspect(req.params.prospectId as string);
    res.json({ success: true, analysis });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Agent Evolution ──────────────────────────────────────

/** POST /api/ai-agents/evolve — Trigger weekly evolution cycle */
router.post('/evolve', async (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Evolution cycle started' });

  setImmediate(async () => {
    try {
      const result = await agentEvolutionService.evolveAll();
      logger.info(`[API/Evolution] Complete: ${result.evolved} evolved, ${result.skipped} skipped`);
    } catch (err) {
      logger.error('[API/Evolution] Error:', err);
    }
  });
});

// ─── Agent Memory / Strategies ───────────────────────────

/** GET /api/ai-agents/strategies — List active strategies */
router.get('/strategies', async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import('../config/database');
    const strategies = await prisma.agentStrategy.findMany({
      where: { isActive: true },
      orderBy: [{ agentType: 'asc' }, { niche: 'asc' }],
    });
    res.json({ success: true, strategies });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/ai-agents/strategies/:agentType/:niche — Get strategy for combo */
router.get('/strategies/:agentType/:niche', async (req: Request, res: Response) => {
  try {
    const { agentType, niche } = req.params as { agentType: string; niche: string };
    const lang = (req.query['lang'] as string) ?? 'en';
    const result = await agentMemoryService.getStrategy(
      agentType as 'closer' | 'work_planner' | 'business_plan' | 'branding',
      niche,
      lang,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/ai-agents/insights — List active cross-agent insights */
router.get('/insights', async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import('../config/database');
    const insights = await prisma.agentInsight.findMany({
      where: { isActive: true },
      orderBy: [{ confidence: 'desc' }, { sampleSize: 'desc' }],
      take: 50,
    });
    res.json({ success: true, insights });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/ai-agents/actions/:id/outcome — Update action outcome */
router.post('/actions/:id/outcome', async (req: Request, res: Response) => {
  try {
    const { outcome, reward } = req.body as {
      outcome: 'converted' | 'rejected' | 'no_response' | 'bounced';
      reward: number;
    };
    if (!outcome || reward === undefined) {
      res.status(400).json({ error: 'outcome and reward required' });
      return;
    }
    await agentMemoryService.updateOutcome(req.params.id as string, outcome, reward);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/ai-agents/dashboard — Real-time agent performance metrics */
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import('../config/database');
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      closerActive, closerConverted, closerRejected, closerTotal,
      plannerActions, businessPlanActions, brandingActions,
      strategies, insights, anomalies,
      recentEvolution,
    ] = await Promise.all([
      prisma.followUpSequence.count({ where: { sentAt: null, type: { startsWith: 'sms_closer_' } } }),
      prisma.agentAction.count({ where: { agentType: 'closer', outcome: 'converted', createdAt: { gte: since7d } } }),
      prisma.agentAction.count({ where: { agentType: 'closer', outcome: 'rejected', createdAt: { gte: since7d } } }),
      prisma.agentAction.count({ where: { agentType: 'closer', createdAt: { gte: since7d } } }),
      prisma.agentAction.findMany({ where: { agentType: 'work_planner', createdAt: { gte: since7d } }, select: { output: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 7 }),
      prisma.agentAction.count({ where: { agentType: 'business_plan', createdAt: { gte: since7d } } }),
      prisma.agentAction.count({ where: { agentType: 'branding', createdAt: { gte: since7d } } }),
      prisma.agentStrategy.count({ where: { isActive: true } }),
      prisma.agentInsight.count({ where: { isActive: true } }),
      prisma.agentAnomaly.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.agentStrategy.findFirst({ where: { isActive: true }, orderBy: { evolvedAt: 'desc' }, select: { evolvedAt: true, agentType: true, niche: true } }),
    ]);

    const closerConvRate = closerTotal > 0 ? closerConverted / closerTotal : 0;

    const avgQualifiedPerDay = plannerActions.length > 0
      ? plannerActions.reduce((sum, a) => {
          const out = a.output as Record<string, unknown>;
          return sum + (((out.plannedCount as number) ?? 0));
        }, 0) / plannerActions.length
      : 0;

    res.json({
      success: true,
      closerAgent: {
        sequencesActive: closerActive,
        converted7d: closerConverted,
        rejected7d: closerRejected,
        total7d: closerTotal,
        conversionRate: Math.round(closerConvRate * 100) / 100,
      },
      workPlanner: {
        plansGenerated7d: plannerActions.length,
        avgPlannedPerDay: Math.round(avgQualifiedPerDay),
      },
      businessPlan: {
        pitchesGenerated7d: businessPlanActions,
      },
      brandingAgent: {
        analysesRun7d: brandingActions,
      },
      evolution: {
        activeStrategies: strategies,
        activeInsights: insights,
        lastEvolved: recentEvolution?.evolvedAt ?? null,
        lastEvolvedAgent: recentEvolution ? `${recentEvolution.agentType}/${recentEvolution.niche}` : null,
      },
      anomalies: anomalies.map(a => ({
        id: a.id,
        metric: a.metricName,
        current: a.currentValue,
        avg: a.avgValue,
        deviation: a.deviation,
        severity: a.severity,
        diagnosis: a.diagnosis,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

