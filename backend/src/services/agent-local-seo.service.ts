import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { getPrompt, type Lang } from './prompt-loader.service';

interface GeneratePostOpts {
  clientId: string;
  topic: string;
  eventDate?: string;
  offerDetails?: string;
  language?: Lang;
}

interface KeywordsOpts {
  clientId: string;
  count?: number;
  language?: Lang;
}

interface AuditOpts {
  clientId: string;
  listing: { businessName: string; address?: string; phone?: string; website?: string; categories?: string[] };
  language?: Lang;
}

interface RankingOpts {
  clientId: string;
  keyword: string;
  location: string;
  language?: Lang;
}

interface SeoOutput {
  result: Record<string, unknown>;
  recommendations: string[];
}

const sanitize = (s: string) => s.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 1000);

export class AgentLocalSeoService {
  async getConfig(clientId: string) {
    return prisma.agentLocalSeoConfig.upsert({
      where: { clientId },
      update: {},
      create: { clientId },
    });
  }

  async updateConfig(clientId: string, patch: Record<string, unknown>) {
    return prisma.agentLocalSeoConfig.upsert({
      where: { clientId },
      update: patch,
      create: { clientId, ...patch },
    });
  }

  async generateGmbPost(opts: GeneratePostOpts): Promise<{ activityId: string; output: SeoOutput }> {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');
    const prompt = await getPrompt('local_seo', lang);
    const userPrompt = prompt.user
      .replace('{{task}}', 'generate_gmb_post')
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{niche}}', sanitize(client.businessType ?? ''))
      .replace('{{city}}', sanitize(client.city ?? ''))
      .replace('{{details}}', sanitize(JSON.stringify({
        topic: opts.topic,
        eventDate: opts.eventDate ?? null,
        offerDetails: opts.offerDetails ?? null,
      })));

    let output: SeoOutput;
    try {
      output = await callOpenAI(prompt.system, userPrompt);
    } catch (e) {
      logger.warn('[local_seo] generateGmbPost LLM failed', e);
      output = {
        result: { post: `${client.businessName} — ${opts.topic}`, characterCount: 0 },
        recommendations: [],
      };
    }

    const activity = await prisma.agentLocalSeoActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'gmb_post_drafted',
        platform: 'gmb',
        content: JSON.parse(JSON.stringify({ ...output, topic: opts.topic, language: lang })),
        status: 'draft',
      },
    });

    return { activityId: activity.id, output };
  }

  async suggestKeywords(opts: KeywordsOpts): Promise<{ activityId: string; output: SeoOutput }> {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');
    const prompt = await getPrompt('local_seo', lang);
    const count = opts.count ?? 20;
    const userPrompt = prompt.user
      .replace('{{task}}', 'suggest_keywords')
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{niche}}', sanitize(client.businessType ?? ''))
      .replace('{{city}}', sanitize(client.city ?? ''))
      .replace('{{details}}', sanitize(JSON.stringify({ count })));

    let output: SeoOutput;
    try {
      output = await callOpenAI(prompt.system, userPrompt);
    } catch {
      output = {
        result: { keywords: [`${client.businessType} ${client.city}`, `best ${client.businessType} near me`] },
        recommendations: [],
      };
    }

    const activity = await prisma.agentLocalSeoActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'keyword_suggested',
        content: JSON.parse(JSON.stringify({ ...output, language: lang })),
        status: 'completed',
        performedAt: new Date(),
      },
    });

    return { activityId: activity.id, output };
  }

  async auditListing(opts: AuditOpts): Promise<{ activityId: string; output: SeoOutput; score: number }> {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');
    const prompt = await getPrompt('local_seo', lang);
    const userPrompt = prompt.user
      .replace('{{task}}', 'audit_listing')
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{niche}}', sanitize(client.businessType ?? ''))
      .replace('{{city}}', sanitize(client.city ?? ''))
      .replace('{{details}}', sanitize(JSON.stringify(opts.listing)));

    // Deterministic completeness score
    let score = 0;
    if (opts.listing.businessName) score += 20;
    if (opts.listing.address) score += 20;
    if (opts.listing.phone) score += 20;
    if (opts.listing.website) score += 20;
    if (opts.listing.categories?.length) score += 20;

    let output: SeoOutput;
    try {
      output = await callOpenAI(prompt.system, userPrompt);
    } catch {
      output = {
        result: { completeness: `${score}%` },
        recommendations: score < 100
          ? [lang === 'fr' ? 'Compléter les champs manquants' : 'Fill missing fields']
          : [],
      };
    }

    const activity = await prisma.agentLocalSeoActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'citation_audited',
        content: JSON.parse(JSON.stringify({ ...output, score, listing: opts.listing, language: lang })),
        status: 'completed',
        performedAt: new Date(),
      },
    });

    return { activityId: activity.id, output, score };
  }

  async trackRanking(opts: RankingOpts) {
    // TODO v2: integrate SerpAPI or Google Custom Search for real ranking.
    // For now: record the intent and return a placeholder.
    const activity = await prisma.agentLocalSeoActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'ranking_checked',
        keyword: opts.keyword,
        position: null,
        content: {
          keyword: opts.keyword,
          location: opts.location,
          note: 'Ranking API integration pending (v2)',
        },
        status: 'pending',
      },
    });
    return { activityId: activity.id, note: 'Tracking request recorded. Live ranking data requires SerpAPI integration.' };
  }

  async listActivity(clientId: string, limit = 50) {
    return prisma.agentLocalSeoActivity.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getDashboard(clientId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [config, last24h, last30d, byStatus] = await Promise.all([
      this.getConfig(clientId),
      prisma.agentLocalSeoActivity.count({
        where: { clientId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.agentLocalSeoActivity.count({ where: { clientId, createdAt: { gte: since } } }),
      prisma.agentLocalSeoActivity.groupBy({
        by: ['status'],
        where: { clientId, createdAt: { gte: since } },
        _count: { _all: true },
      } as any),
    ]);
    return { config, last24h, last30d, byStatus };
  }
}

async function callOpenAI(system: string, user: string): Promise<SeoOutput> {
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
      temperature: 0.5,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const data = await r.json() as any;
  return JSON.parse(data?.choices?.[0]?.message?.content);
}

export const agentLocalSeoService = new AgentLocalSeoService();
