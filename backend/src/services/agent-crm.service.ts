import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { getPrompt, type Lang } from './prompt-loader.service';
import { crmSyncService } from './crm-sync.service';

interface ProgressDealOpts {
  clientId: string;
  dealId: string;
  newStage: string;
  notes?: string;
}

interface AnalyzeLostOpts {
  clientId: string;
  dealId?: string;
  lostReason?: string;
  language?: Lang;
}

interface ForecastOpts {
  clientId: string;
  periodMonths?: number;
  language?: Lang;
}

interface RelanceOpts {
  clientId: string;
  dealId: string;
  language?: Lang;
}

const sanitize = (s: string) => s.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 1000);

export class AgentCrmService {
  async getConfig(clientId: string) {
    return prisma.agentCrmConfig.upsert({
      where: { clientId },
      update: {},
      create: { clientId },
    });
  }

  async updateConfig(clientId: string, patch: Record<string, unknown>) {
    return prisma.agentCrmConfig.upsert({
      where: { clientId },
      update: patch,
      create: { clientId, ...patch },
    });
  }

  async progressDeal(opts: ProgressDealOpts) {
    const deal = await prisma.deal.findFirst({
      where: { id: opts.dealId, clientId: opts.clientId },
    });
    if (!deal) throw new Error('Deal not found');

    const updated = await prisma.deal.update({
      where: { id: opts.dealId },
      data: { stage: opts.newStage },
    });

    await prisma.agentCrmActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'deal_progressed',
        dealId: opts.dealId,
        content: { from: deal.stage, to: opts.newStage, notes: opts.notes ?? null },
        status: 'completed',
        performedAt: new Date(),
      },
    });

    return updated;
  }

  async analyzeLostDeal(opts: AnalyzeLostOpts) {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const lostDeals = await prisma.deal.findMany({
      where: { clientId: opts.clientId, stage: { in: ['lost', 'closed_lost'] } },
      include: { contact: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');
    const prompt = await getPrompt('crm', lang);
    const ctx = lostDeals.map(d => ({
      stage: d.stage,
      value: Number(d.value ?? 0),
      contact: d.contact?.name ?? 'n/a',
    }));

    const userPrompt = prompt.user
      .replace('{{task}}', 'analyze_lost_deals')
      .replace('{{context}}', sanitize(JSON.stringify({ deals: ctx, lostReason: opts.lostReason ?? null })))
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{niche}}', sanitize(client.businessType ?? ''));

    let output: { summary: string; actionItems: string[]; details: Record<string, unknown> };
    try {
      output = await callOpenAI(prompt.system, userPrompt);
    } catch (e) {
      logger.warn('[crm] analyzeLostDeal LLM failed', e);
      output = {
        summary: lang === 'fr'
          ? `Analyse non disponible. ${lostDeals.length} deals perdus dans la période.`
          : `Analysis unavailable. ${lostDeals.length} lost deals in the period.`,
        actionItems: [],
        details: { lostCount: lostDeals.length },
      };
    }

    const activity = await prisma.agentCrmActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'lost_deal_analyzed',
        dealId: opts.dealId ?? null,
        content: JSON.parse(JSON.stringify({ ...output, lostCount: lostDeals.length, language: lang })),
        status: 'completed',
        performedAt: new Date(),
      },
    });

    return { activityId: activity.id, output, lostCount: lostDeals.length };
  }

  async forecastRevenue(opts: ForecastOpts) {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const horizon = opts.periodMonths ?? 3;
    const horizonDate = new Date();
    horizonDate.setMonth(horizonDate.getMonth() + horizon);

    const openDeals = await prisma.deal.findMany({
      where: {
        clientId: opts.clientId,
        stage: { notIn: ['lost', 'closed_lost', 'won', 'closed_won'] },
      },
    });

    // Deterministic forecast: sum(value × probability/100). LLM only comments.
    let weightedTotal = 0;
    let lowConfidence = 0;
    let highConfidence = 0;
    for (const d of openDeals) {
      const value = Number(d.value ?? 0);
      const p = (d.probability ?? 30) / 100;
      const weighted = value * p;
      weightedTotal += weighted;
      if (p < 0.4) lowConfidence += value;
      else if (p >= 0.7) highConfidence += value;
    }

    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');
    const prompt = await getPrompt('crm', lang);
    const userPrompt = prompt.user
      .replace('{{task}}', 'forecast_revenue')
      .replace('{{context}}', sanitize(JSON.stringify({
        horizonMonths: horizon,
        openDealCount: openDeals.length,
        weightedTotal: Math.round(weightedTotal),
        lowConfidence: Math.round(lowConfidence),
        highConfidence: Math.round(highConfidence),
      })))
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{niche}}', sanitize(client.businessType ?? ''));

    let commentary: { summary: string; actionItems: string[]; details: Record<string, unknown> };
    try {
      commentary = await callOpenAI(prompt.system, userPrompt);
    } catch {
      commentary = {
        summary: lang === 'fr'
          ? `Forecast: ~${Math.round(weightedTotal)} sur ${horizon} mois (basé sur ${openDeals.length} deals ouverts).`
          : `Forecast: ~${Math.round(weightedTotal)} over ${horizon} months (based on ${openDeals.length} open deals).`,
        actionItems: [],
        details: {},
      };
    }

    const activity = await prisma.agentCrmActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'forecast_generated',
        content: JSON.parse(JSON.stringify({
          horizonMonths: horizon,
          weightedTotal,
          lowConfidence,
          highConfidence,
          openDealCount: openDeals.length,
          ...commentary,
          language: lang,
        })),
        status: 'completed',
        performedAt: new Date(),
      },
    });

    return {
      activityId: activity.id,
      forecast: {
        horizonMonths: horizon,
        weightedTotal: Math.round(weightedTotal),
        lowConfidence: Math.round(lowConfidence),
        highConfidence: Math.round(highConfidence),
        openDealCount: openDeals.length,
      },
      commentary,
    };
  }

  async generateRelance(opts: RelanceOpts) {
    const deal = await prisma.deal.findFirst({
      where: { id: opts.dealId, clientId: opts.clientId },
      include: { contact: true },
    });
    if (!deal) throw new Error('Deal not found');

    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const daysSinceLastContact = Math.floor((Date.now() - new Date(deal.createdAt).getTime()) / 86_400_000);

    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');
    const prompt = await getPrompt('crm', lang);
    const userPrompt = prompt.user
      .replace('{{task}}', 'generate_relance')
      .replace('{{context}}', sanitize(JSON.stringify({
        dealTitle: deal.title,
        dealValue: Number(deal.value ?? 0),
        dealStage: deal.stage,
        daysSinceLastContact,
        contactName: deal.contact?.name ?? 'n/a',
      })))
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{niche}}', sanitize(client.businessType ?? ''));

    let output: { summary: string; actionItems: string[]; details: Record<string, unknown> };
    try {
      output = await callOpenAI(prompt.system, userPrompt);
    } catch {
      output = {
        summary: lang === 'fr'
          ? `Bonjour, je reviens vers vous concernant ${deal.title}. Avez-vous des questions ?`
          : `Hi, I'm following up on ${deal.title}. Any questions on your end?`,
        actionItems: ['send_email'],
        details: { dealId: opts.dealId },
      };
    }

    const activity = await prisma.agentCrmActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'relance_drafted',
        dealId: opts.dealId,
        contactId: deal.contactId,
        content: JSON.parse(JSON.stringify({ ...output, daysSinceLastContact, language: lang })),
        status: 'pending',
      },
    });

    return { activityId: activity.id, output, daysSinceLastContact };
  }

  async syncAll(clientId: string) {
    const integrations = await prisma.crmIntegration.findMany({ where: { clientId } }).catch(() => []);
    let synced = 0;
    for (const integ of integrations) {
      try {
        await crmSyncService.syncIntegration(integ);
        synced++;
      } catch (e) {
        logger.warn(`[crm] sync integration ${integ.id} failed`, e);
      }
    }
    await prisma.agentCrmActivity.create({
      data: {
        clientId,
        type: 'deal_synced',
        content: { integrationCount: integrations.length, syncedCount: synced },
        status: 'completed',
        performedAt: new Date(),
      },
    });
    return { synced, total: integrations.length };
  }

  async listActivity(clientId: string, limit = 50) {
    return prisma.agentCrmActivity.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getDashboard(clientId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [config, deals, last24h, last30d] = await Promise.all([
      this.getConfig(clientId),
      prisma.deal.findMany({ where: { clientId } }),
      prisma.agentCrmActivity.count({
        where: { clientId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.agentCrmActivity.count({ where: { clientId, createdAt: { gte: since } } }),
    ]);
    const byStage: Record<string, number> = {};
    for (const d of deals) byStage[d.stage] = (byStage[d.stage] ?? 0) + 1;
    return { config, dealCount: deals.length, byStage, last24h, last30d };
  }
}

async function callOpenAI(system: string, user: string): Promise<{ summary: string; actionItems: string[]; details: Record<string, unknown> }> {
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
      temperature: 0.4,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const data = await r.json() as any;
  return JSON.parse(data?.choices?.[0]?.message?.content);
}

export const agentCrmService = new AgentCrmService();
