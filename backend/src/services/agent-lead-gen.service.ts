import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { getPrompt, type Lang } from './prompt-loader.service';

interface DiscoverOpts {
  clientId: string;
  niches?: string[];
  cities?: string[];
  count?: number;
}

interface SequenceOpts {
  clientId: string;
  prospectId: string;
  channel?: 'email' | 'sms';
  tone?: string;
  stepCount?: number;
  language?: Lang;
}

interface SequenceTouch {
  channel: string;
  delayDays: number;
  subject: string;
  body: string;
  callToAction: string;
}

interface SequenceOutput {
  touches: SequenceTouch[];
}

const sanitize = (s: string) => s.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 1000);

export class AgentLeadGenService {
  async getConfig(clientId: string) {
    return prisma.agentLeadGenConfig.upsert({
      where: { clientId },
      update: {},
      create: { clientId },
    });
  }

  async updateConfig(clientId: string, patch: Record<string, unknown>) {
    return prisma.agentLeadGenConfig.upsert({
      where: { clientId },
      update: patch,
      create: { clientId, ...patch },
    });
  }

  async discover(opts: DiscoverOpts) {
    const config = await this.getConfig(opts.clientId);
    const niches = opts.niches ?? config.targetNiches ?? [];
    const cities = opts.cities ?? config.targetCities ?? [];
    const count = Math.min(opts.count ?? 10, config.dailyQuota ?? 20);

    // Pull prospects from the global pool matching client's targeting.
    // We do NOT reshape the Prospect model — we tag matches in AgentLeadGenActivity.
    const where: any = {};
    if (niches.length > 0) where.niche = { in: niches };
    if (cities.length > 0) where.city = { in: cities };
    where.priorityScore = { gte: 10 };

    // Exclude prospects already tagged to this client in last 90 days
    const taggedRecent = await prisma.agentLeadGenActivity.findMany({
      where: {
        clientId: opts.clientId,
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        prospectId: { not: null },
      },
      select: { prospectId: true },
    });
    const excludeIds = new Set(taggedRecent.map(t => t.prospectId).filter(Boolean));

    const candidates = await prisma.prospect.findMany({
      where: {
        ...where,
        id: excludeIds.size > 0 ? { notIn: Array.from(excludeIds) as string[] } : undefined,
      },
      orderBy: { priorityScore: 'desc' },
      take: count * 3, // over-fetch then filter
    });

    const selected = candidates.slice(0, count);
    const activities = await Promise.all(selected.map(p =>
      prisma.agentLeadGenActivity.create({
        data: {
          clientId: opts.clientId,
          type: 'lead_discovered',
          prospectId: p.id,
          channel: null,
          content: {
            businessName: p.businessName,
            phone: p.phone,
            city: p.city,
            niche: p.niche,
            priorityScore: p.priorityScore,
          },
          status: 'discovered',
        },
      })
    ));

    return { discoveredCount: activities.length, prospectIds: selected.map(p => p.id) };
  }

  async generateSequence(opts: SequenceOpts): Promise<{ activityId: string; output: SequenceOutput }> {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const prospect = await prisma.prospect.findUnique({ where: { id: opts.prospectId } });
    if (!prospect) throw new Error('Prospect not found');

    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');
    const stepCount = Math.min(opts.stepCount ?? 3, 5);
    const channel = opts.channel ?? 'email';
    const tone = opts.tone ?? 'professional';

    const prompt = await getPrompt('lead_gen', lang);
    const userPrompt = prompt.user
      .replace('{{stepCount}}', String(stepCount))
      .replace('{{prospectName}}', sanitize(prospect.businessName ?? ''))
      .replace('{{prospectNiche}}', sanitize(prospect.niche ?? ''))
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{channel}}', sanitize(channel))
      .replace('{{tone}}', sanitize(tone));

    let output: SequenceOutput;
    try {
      output = await callOpenAI(prompt.system, userPrompt);
    } catch (e) {
      logger.warn('[lead_gen] generateSequence LLM failed', e);
      output = {
        touches: [
          { channel, delayDays: 0,  subject: lang === 'fr' ? 'Quick question' : 'Quick question', body: '', callToAction: lang === 'fr' ? 'Répondre' : 'Reply' },
          { channel, delayDays: 3,  subject: lang === 'fr' ? 'Suivi' : 'Following up', body: '', callToAction: lang === 'fr' ? 'Répondre' : 'Reply' },
          { channel, delayDays: 7,  subject: lang === 'fr' ? 'Dernier essai' : 'Last try', body: '', callToAction: lang === 'fr' ? 'Répondre' : 'Reply' },
        ].slice(0, stepCount),
      };
    }

    const activity = await prisma.agentLeadGenActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'sequence_drafted',
        prospectId: opts.prospectId,
        channel,
        step: 0,
        content: JSON.parse(JSON.stringify({ ...output, language: lang, tone })),
        status: 'pending',
      },
    });

    return { activityId: activity.id, output };
  }

  async sendNextStep(activityId: string) {
    const activity = await prisma.agentLeadGenActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new Error('Activity not found');
    const sequence = (activity.content as any)?.touches as SequenceTouch[] | undefined;
    if (!sequence || sequence.length === 0) throw new Error('No sequence to send');

    const nextIndex = activity.step;
    if (nextIndex >= sequence.length) {
      return prisma.agentLeadGenActivity.update({
        where: { id: activityId },
        data: { status: 'completed', performedAt: new Date() },
      });
    }

    // TODO v2: actually send via email.service.ts / sms.service.ts.
    // For initial release: record the intent. The user can review before sending.
    return prisma.agentLeadGenActivity.update({
      where: { id: activityId },
      data: {
        type: 'sequence_sent',
        step: nextIndex + 1,
        status: nextIndex + 1 >= sequence.length ? 'completed' : 'in_progress',
        performedAt: new Date(),
      },
    });
  }

  async handoffToReceptionist(activityId: string) {
    const activity = await prisma.agentLeadGenActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new Error('Activity not found');
    return prisma.agentLeadGenActivity.update({
      where: { id: activityId },
      data: {
        type: 'handoff_to_receptionist',
        status: 'handed_off',
        performedAt: new Date(),
      },
    });
  }

  async getCampaignStats(clientId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [discovered, drafted, sent, handed] = await Promise.all([
      prisma.agentLeadGenActivity.count({ where: { clientId, type: 'lead_discovered', createdAt: { gte: since } } }),
      prisma.agentLeadGenActivity.count({ where: { clientId, type: 'sequence_drafted', createdAt: { gte: since } } }),
      prisma.agentLeadGenActivity.count({ where: { clientId, type: 'sequence_sent', createdAt: { gte: since } } }),
      prisma.agentLeadGenActivity.count({ where: { clientId, type: 'handoff_to_receptionist', createdAt: { gte: since } } }),
    ]);
    return { period: '30d', discovered, drafted, sent, handedOff: handed };
  }

  async listActivity(clientId: string, limit = 50) {
    return prisma.agentLeadGenActivity.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getDashboard(clientId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [config, last24h, last30d, stats] = await Promise.all([
      this.getConfig(clientId),
      prisma.agentLeadGenActivity.count({
        where: { clientId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.agentLeadGenActivity.count({ where: { clientId, createdAt: { gte: since } } }),
      this.getCampaignStats(clientId),
    ]);
    return { config, last24h, last30d, stats };
  }
}

async function callOpenAI(system: string, user: string): Promise<SequenceOutput> {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.6,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const data = await r.json() as any;
  return JSON.parse(data?.choices?.[0]?.message?.content);
}

export const agentLeadGenService = new AgentLeadGenService();
