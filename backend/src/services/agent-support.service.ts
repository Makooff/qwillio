import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { getPrompt, type Lang } from './prompt-loader.service';

interface ClassifyOpts {
  clientId: string;
  channel: 'email' | 'chat' | 'sms';
  ticketText: string;
  ticketId?: string;
  language?: Lang;
}

interface ClassifyOutput {
  category: string;
  priority: 'low' | 'normal' | 'high';
  reply: string;
  shouldEscalate: boolean;
  escalationReason: string | null;
}

const sanitize = (s: string) => s.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 5000);

export class AgentSupportService {
  async getConfig(clientId: string) {
    return prisma.agentSupportConfig.upsert({
      where: { clientId },
      update: {},
      create: { clientId },
    });
  }

  async updateConfig(clientId: string, patch: Record<string, unknown>) {
    return prisma.agentSupportConfig.upsert({
      where: { clientId },
      update: patch,
      create: { clientId, ...patch },
    });
  }

  async classify(opts: ClassifyOpts): Promise<{ activityId: string; output: ClassifyOutput }> {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');
    const config = await this.getConfig(opts.clientId);

    const prompt = await getPrompt('support', lang);
    const userPrompt = prompt.user
      .replace('{{channel}}', sanitize(opts.channel))
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{ticketText}}', sanitize(opts.ticketText));

    let output: ClassifyOutput;
    try {
      output = await callOpenAI(prompt.system, userPrompt);
    } catch (e) {
      logger.warn('[support] LLM failed, using fallback', e);
      output = {
        category: 'general',
        priority: 'normal',
        reply: lang === 'fr'
          ? `Merci pour votre message. Un membre de notre équipe va vous répondre rapidement.`
          : `Thank you for your message. A team member will respond shortly.`,
        shouldEscalate: false,
        escalationReason: null,
      };
    }

    // Keyword-based override: if any escalationKeyword is in the ticket, force escalation
    const text = opts.ticketText.toLowerCase();
    const keywordHit = (config.escalationKeywords ?? []).find(k => k && text.includes(k.toLowerCase()));
    if (keywordHit) {
      output.shouldEscalate = true;
      output.escalationReason = `keyword:${keywordHit}`;
    }

    const activity = await prisma.agentSupportActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'ticket_classified',
        channel: opts.channel,
        ticketId: opts.ticketId ?? null,
        content: { ...output, ticketText: opts.ticketText, language: lang },
        status: output.shouldEscalate ? 'escalated' : 'pending',
      },
    });

    return { activityId: activity.id, output };
  }

  async sendReply(activityId: string) {
    return prisma.agentSupportActivity.update({
      where: { id: activityId },
      data: { status: 'sent', performedAt: new Date() },
    });
  }

  async listTickets(clientId: string, limit = 50) {
    return prisma.agentSupportActivity.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getDashboard(clientId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [config, last24h, last30d, byStatus, byPriority] = await Promise.all([
      this.getConfig(clientId),
      prisma.agentSupportActivity.count({
        where: { clientId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.agentSupportActivity.count({ where: { clientId, createdAt: { gte: since } } }),
      prisma.agentSupportActivity.groupBy({
        by: ['status'],
        where: { clientId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.agentSupportActivity.findMany({
        where: { clientId, createdAt: { gte: since } },
        select: { content: true },
        take: 200,
      }),
    ]);
    return { config, last24h, last30d, byStatus, sampleSize: byPriority.length };
  }
}

async function callOpenAI(system: string, user: string): Promise<ClassifyOutput> {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const data = await r.json() as any;
  return JSON.parse(data?.choices?.[0]?.message?.content);
}

export const agentSupportService = new AgentSupportService();
