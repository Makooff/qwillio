import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { getPrompt, type Lang } from './prompt-loader.service';

interface DraftReplyOpts {
  clientId: string;
  platform: string;
  rating: number;
  reviewText: string;
  reviewId?: string;
  language?: Lang;
}

interface ReplyOutput {
  reply: string;
  shouldEscalate: boolean;
  escalationReason: string | null;
}

const sanitize = (s: string) => s.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 2000);

export class AgentReputationService {
  async getConfig(clientId: string) {
    return prisma.agentReputationConfig.upsert({
      where: { clientId },
      update: {},
      create: { clientId },
    });
  }

  async updateConfig(clientId: string, patch: Record<string, unknown>) {
    return prisma.agentReputationConfig.upsert({
      where: { clientId },
      update: patch,
      create: { clientId, ...patch },
    });
  }

  async draftReply(opts: DraftReplyOpts): Promise<{ activityId: string; output: ReplyOutput }> {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');
    const config = await this.getConfig(opts.clientId);

    const prompt = await getPrompt('reputation', lang);
    const userPrompt = prompt.user
      .replace('{{rating}}', String(opts.rating))
      .replace('{{platform}}', sanitize(opts.platform))
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{reviewText}}', sanitize(opts.reviewText))
      .replace('{{tone}}', sanitize(config.replyTone));

    let output: ReplyOutput;
    try {
      output = await callOpenAI(prompt.system, userPrompt);
    } catch (e) {
      logger.warn('[reputation] LLM failed, using fallback', e);
      output = {
        reply: lang === 'fr'
          ? `Merci pour votre retour. Nous prenons votre commentaire très au sérieux.`
          : `Thank you for your feedback. We take your comment very seriously.`,
        shouldEscalate: opts.rating <= config.escalationThreshold,
        escalationReason: opts.rating <= config.escalationThreshold ? 'low_rating' : null,
      };
    }

    const activity = await prisma.agentReputationActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'reply_drafted',
        platform: opts.platform,
        rating: opts.rating,
        reviewId: opts.reviewId ?? null,
        content: { ...output, reviewText: opts.reviewText, language: lang },
        status: output.shouldEscalate ? 'escalated' : 'pending',
      },
    });

    return { activityId: activity.id, output };
  }

  async send(activityId: string) {
    // Production wiring to Google Business / Facebook Graph would go here.
    // For now, mark as sent — actual API call is platform-specific and
    // requires OAuth setup, which is out of scope for the initial release.
    return prisma.agentReputationActivity.update({
      where: { id: activityId },
      data: { status: 'sent', performedAt: new Date() },
    });
  }

  async listReviews(clientId: string, limit = 50) {
    return prisma.agentReputationActivity.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getDashboard(clientId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [config, last24h, last30d, byStatus, ratings] = await Promise.all([
      this.getConfig(clientId),
      prisma.agentReputationActivity.count({
        where: { clientId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.agentReputationActivity.count({ where: { clientId, createdAt: { gte: since } } }),
      prisma.agentReputationActivity.groupBy({
        by: ['status'],
        where: { clientId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.agentReputationActivity.aggregate({
        where: { clientId, rating: { not: null }, createdAt: { gte: since } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);
    return { config, last24h, last30d, byStatus, avgRating: ratings._avg.rating, reviewCount: ratings._count._all };
  }
}

async function callOpenAI(system: string, user: string): Promise<ReplyOutput> {
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
      temperature: 0.5,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const data = await r.json() as any;
  return JSON.parse(data?.choices?.[0]?.message?.content);
}

export const agentReputationService = new AgentReputationService();
