import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { invalidatePrompt, type AgentType, type Lang } from '../services/prompt-loader.service';
import { agentMarketingService } from '../services/agent-marketing.service';
import { agentReputationService } from '../services/agent-reputation.service';
import { agentSchedulingService } from '../services/agent-scheduling.service';
import { agentSupportService } from '../services/agent-support.service';

// Admin oversight of the 8 product agent modules. Mirrors per-client services
// but at the global tenant level — admin can view aggregate metrics, edit
// prompts (versioned), and trigger ad-hoc runs against any client.

const KNOWN_AGENT_TYPES: AgentType[] = [
  'email', 'accounting', 'inventory', 'payments',
  'marketing', 'reputation', 'scheduling', 'support',
];

const DISPLAY_NAMES: Record<AgentType, string> = {
  email: 'Email AI',
  accounting: 'Accounting AI',
  inventory: 'Inventory AI',
  payments: 'Payments AI',
  marketing: 'Marketing AI',
  reputation: 'Reputation AI',
  scheduling: 'Scheduling AI',
  support: 'Support AI',
  closer: 'Closer Agent',
  branding: 'Branding Agent',
  business_plan: 'Business Plan Agent',
  work_planner: 'Work Planner Agent',
  ai_script_generator: 'Script Generator',
};

export class AdminAgentsController {
  // GET /api/admin/agents — high-level list of all product agents
  async list(_req: Request, res: Response) {
    try {
      const sub = await prisma.agentSubscription.groupBy({
        by: ['status'],
        _count: { _all: true },
      });
      const counts: Record<string, number> = {};
      for (const agentType of KNOWN_AGENT_TYPES) {
        counts[agentType] = await countActivities(agentType);
      }
      res.json({
        agents: KNOWN_AGENT_TYPES.map(type => ({
          type,
          displayName: DISPLAY_NAMES[type],
          activitiesLast24h: counts[type] ?? 0,
        })),
        subscriptions: sub,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // GET /api/admin/agents/:agentType
  async detail(req: Request, res: Response) {
    const agentType = req.params.agentType as AgentType;
    if (!KNOWN_AGENT_TYPES.includes(agentType)) return res.status(404).json({ error: 'Unknown agent type' });
    try {
      const promptsFr = await prisma.agentPromptConfig.findFirst({
        where: { agentType, language: 'fr', active: true },
        orderBy: { version: 'desc' },
      });
      const promptsEn = await prisma.agentPromptConfig.findFirst({
        where: { agentType, language: 'en', active: true },
        orderBy: { version: 'desc' },
      });
      const last24h = await countActivities(agentType);
      res.json({
        type: agentType,
        displayName: DISPLAY_NAMES[agentType],
        prompts: { fr: promptsFr, en: promptsEn },
        activitiesLast24h: last24h,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // GET /api/admin/agents/:agentType/prompts
  async getPrompts(req: Request, res: Response) {
    const agentType = req.params.agentType as AgentType;
    if (!KNOWN_AGENT_TYPES.includes(agentType)) return res.status(404).json({ error: 'Unknown agent type' });
    try {
      const rows = await prisma.agentPromptConfig.findMany({
        where: { agentType, active: true },
        orderBy: [{ language: 'asc' }, { version: 'desc' }],
        take: 10,
      });
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // PUT /api/admin/agents/:agentType/prompts
  // Body: { language: 'fr'|'en', systemPrompt: string, userPromptTemplate: string }
  // Creates a new version, deactivates the previous one.
  async updatePrompts(req: Request, res: Response) {
    const agentType = req.params.agentType as AgentType;
    if (!KNOWN_AGENT_TYPES.includes(agentType)) return res.status(404).json({ error: 'Unknown agent type' });
    const { language, systemPrompt, userPromptTemplate } = req.body ?? {};
    if (!['fr', 'en'].includes(language) || typeof systemPrompt !== 'string' || typeof userPromptTemplate !== 'string') {
      return res.status(400).json({ error: 'language (fr|en), systemPrompt, userPromptTemplate required' });
    }
    try {
      const updatedBy = (req as any).user?.email ?? (req as any).user?.id ?? null;
      const result = await prisma.$transaction(async tx => {
        await tx.agentPromptConfig.updateMany({
          where: { agentType, language, active: true },
          data: { active: false },
        });
        const last = await tx.agentPromptConfig.findFirst({
          where: { agentType, language },
          orderBy: { version: 'desc' },
        });
        return tx.agentPromptConfig.create({
          data: {
            agentType,
            language,
            systemPrompt,
            userPromptTemplate,
            version: (last?.version ?? 0) + 1,
            active: true,
            updatedBy,
          },
        });
      });
      invalidatePrompt(agentType, language as Lang);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // GET /api/admin/agents/:agentType/activity?clientId=&limit=&status=
  async activity(req: Request, res: Response) {
    const agentType = req.params.agentType as AgentType;
    if (!KNOWN_AGENT_TYPES.includes(agentType)) return res.status(404).json({ error: 'Unknown agent type' });
    const limit = Math.min(parseInt(String(req.query.limit ?? '100')), 500);
    const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    try {
      const rows = await activityFinder(agentType, where, limit);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // GET /api/admin/agents/:agentType/metrics
  async metrics(req: Request, res: Response) {
    const agentType = req.params.agentType as AgentType;
    if (!KNOWN_AGENT_TYPES.includes(agentType)) return res.status(404).json({ error: 'Unknown agent type' });
    try {
      const now = Date.now();
      const intervals = [
        { label: 'last24h', since: new Date(now - 24 * 60 * 60 * 1000) },
        { label: 'last7d', since: new Date(now - 7 * 24 * 60 * 60 * 1000) },
        { label: 'last30d', since: new Date(now - 30 * 24 * 60 * 60 * 1000) },
      ];
      const metrics: Record<string, { total: number; byStatus: Record<string, number> }> = {};
      for (const { label, since } of intervals) {
        const where = { createdAt: { gte: since } };
        const [total, grouped] = await Promise.all([
          activityCount(agentType, where),
          activityGroupBy(agentType, where),
        ]);
        const byStatus: Record<string, number> = {};
        for (const g of grouped) byStatus[g.status] = g._count?._all ?? 0;
        metrics[label] = { total, byStatus };
      }
      res.json(metrics);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // POST /api/admin/agents/:agentType/run
  // Body: { clientId, params }
  async run(req: Request, res: Response) {
    const agentType = req.params.agentType as AgentType;
    const { clientId, params } = req.body ?? {};
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    try {
      let result: any;
      switch (agentType) {
        case 'marketing': {
          const { contentType, topic, channel, language } = params ?? {};
          if (!contentType || !topic || !channel) return res.status(400).json({ error: 'params.contentType, topic, channel required' });
          result = await agentMarketingService.generate({ clientId, contentType, topic, channel, language });
          break;
        }
        case 'reputation': {
          const { platform, rating, reviewText, reviewId, language } = params ?? {};
          if (!platform || typeof rating !== 'number' || !reviewText) return res.status(400).json({ error: 'params.platform, rating, reviewText required' });
          result = await agentReputationService.draftReply({ clientId, platform, rating, reviewText, reviewId, language });
          break;
        }
        case 'scheduling': {
          const { date, slotCount, language } = params ?? {};
          if (!date) return res.status(400).json({ error: 'params.date required' });
          result = await agentSchedulingService.optimize({ clientId, date, slotCount, language });
          break;
        }
        case 'support': {
          const { channel, ticketText, ticketId, language } = params ?? {};
          if (!channel || !ticketText) return res.status(400).json({ error: 'params.channel, ticketText required' });
          result = await agentSupportService.classify({ clientId, channel, ticketText, ticketId, language });
          break;
        }
        default:
          return res.status(400).json({ error: `Admin run not implemented for ${agentType}` });
      }
      res.json({ ok: true, result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
}

async function countActivities(agentType: AgentType): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const where = { createdAt: { gte: since } };
  return activityCount(agentType, where);
}

async function activityCount(agentType: AgentType, where: any): Promise<number> {
  switch (agentType) {
    case 'marketing': return prisma.agentMarketingActivity.count({ where });
    case 'reputation': return prisma.agentReputationActivity.count({ where });
    case 'scheduling': return prisma.agentSchedulingActivity.count({ where });
    case 'support': return prisma.agentSupportActivity.count({ where });
    case 'email': return prisma.agentEmail.count({ where });
    case 'inventory': return prisma.agentInventoryLog.count({ where });
    case 'payments': return prisma.agentInvoice.count({ where });
    case 'accounting': return prisma.agentExpense.count({ where });
    default: return 0;
  }
}

async function activityGroupBy(agentType: AgentType, where: any): Promise<Array<{ status: string; _count: { _all: number } }>> {
  switch (agentType) {
    case 'marketing': return (await (prisma.agentMarketingActivity.groupBy as any)({ by: ['status'], where, _count: { _all: true } })) as any;
    case 'reputation': return (await (prisma.agentReputationActivity.groupBy as any)({ by: ['status'], where, _count: { _all: true } })) as any;
    case 'scheduling': return (await (prisma.agentSchedulingActivity.groupBy as any)({ by: ['status'], where, _count: { _all: true } })) as any;
    case 'support': return (await (prisma.agentSupportActivity.groupBy as any)({ by: ['status'], where, _count: { _all: true } })) as any;
    default: return [];
  }
}

async function activityFinder(agentType: AgentType, where: any, limit: number): Promise<any[]> {
  switch (agentType) {
    case 'marketing': return prisma.agentMarketingActivity.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
    case 'reputation': return prisma.agentReputationActivity.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
    case 'scheduling': return prisma.agentSchedulingActivity.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
    case 'support': return prisma.agentSupportActivity.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
    case 'email': return prisma.agentEmail.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
    case 'inventory': return prisma.agentInventoryLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
    case 'payments': return prisma.agentInvoice.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
    case 'accounting': return prisma.agentExpense.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
    default: return [];
  }
}

export const adminAgentsController = new AdminAgentsController();
