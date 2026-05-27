import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { getPrompt, type Lang } from './prompt-loader.service';

interface GenerateOpts {
  clientId: string;
  contentType: 'social_post' | 'campaign_email' | 'ad_copy';
  topic: string;
  channel: string;
  language?: Lang;
}

interface GenerationOutput {
  title?: string;
  body: string;
  callToAction?: string;
}

const sanitize = (s: string) => s.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 300);

export class AgentMarketingService {
  async getConfig(clientId: string) {
    return prisma.agentMarketingConfig.upsert({
      where: { clientId },
      update: {},
      create: { clientId },
    });
  }

  async updateConfig(clientId: string, patch: Record<string, unknown>) {
    return prisma.agentMarketingConfig.upsert({
      where: { clientId },
      update: patch,
      create: { clientId, ...patch },
    });
  }

  async generate(opts: GenerateOpts): Promise<{ activityId: string; output: GenerationOutput }> {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');
    const config = await this.getConfig(opts.clientId);

    const prompt = await getPrompt('marketing', lang);
    const userPrompt = prompt.user
      .replace('{{contentType}}', sanitize(opts.contentType))
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{niche}}', sanitize(client.businessType ?? ''))
      .replace('{{tone}}', sanitize(config.tone))
      .replace('{{channel}}', sanitize(opts.channel))
      .replace('{{topic}}', sanitize(opts.topic));

    let output: GenerationOutput;
    try {
      output = await callOpenAI(prompt.system, userPrompt);
    } catch (e) {
      logger.warn('[marketing] LLM failed, using fallback', e);
      output = {
        title: `${opts.topic}`,
        body: `${client.businessName}: ${opts.topic}.`,
        callToAction: lang === 'fr' ? 'Contactez-nous' : 'Get in touch',
      };
    }

    const activity = await prisma.agentMarketingActivity.create({
      data: {
        clientId: opts.clientId,
        type: opts.contentType,
        channel: opts.channel,
        content: { ...output, topic: opts.topic, language: lang },
        status: 'pending',
      },
    });

    return { activityId: activity.id, output };
  }

  async approve(activityId: string) {
    return prisma.agentMarketingActivity.update({
      where: { id: activityId },
      data: { status: 'approved', performedAt: new Date() },
    });
  }

  async listActivity(clientId: string, limit = 50) {
    return prisma.agentMarketingActivity.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getDashboard(clientId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [config, last24h, last30d, byStatus] = await Promise.all([
      this.getConfig(clientId),
      prisma.agentMarketingActivity.count({
        where: { clientId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.agentMarketingActivity.count({ where: { clientId, createdAt: { gte: since } } }),
      prisma.agentMarketingActivity.groupBy({
        by: ['status'],
        where: { clientId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);
    return { config, last24h, last30d, byStatus };
  }
}

async function callOpenAI(system: string, user: string): Promise<GenerationOutput> {
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
      temperature: 0.7,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const data = await r.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

export const agentMarketingService = new AgentMarketingService();
