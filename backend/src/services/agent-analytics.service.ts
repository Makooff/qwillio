import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { getPrompt, type Lang } from './prompt-loader.service';
import { clientDashboardService } from './client-dashboard.service';

interface DigestOpts {
  clientId: string;
  language?: Lang;
}

interface AnomaliesOpts {
  clientId: string;
  windowDays?: number;
  language?: Lang;
}

interface ForecastOpts {
  clientId: string;
  metric: 'calls' | 'bookings' | 'revenue';
  periodDays?: number;
  language?: Lang;
}

interface RecommendOpts {
  clientId: string;
  language?: Lang;
}

interface AnalyticsOutput {
  insights: string[];
  anomalies: Array<{ metric: string; severity: 'info' | 'warn' | 'critical'; explanation: string }>;
  recommendations: string[];
}

const sanitize = (s: string) => s.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 2000);

const ANOMALY_THRESHOLDS = {
  no_show_rate: 0.4,
  voicemail_rate: 0.4,
  call_answer_rate_drop: 0.35,
  booking_rate_drop: 0.5,
};

export class AgentAnalyticsService {
  async getConfig(clientId: string) {
    return prisma.agentAnalyticsConfig.upsert({
      where: { clientId },
      update: {},
      create: { clientId },
    });
  }

  async updateConfig(clientId: string, patch: Record<string, unknown>) {
    return prisma.agentAnalyticsConfig.upsert({
      where: { clientId },
      update: patch,
      create: { clientId, ...patch },
    });
  }

  async generateWeeklyDigest(opts: DigestOpts): Promise<{ activityId: string; output: AnalyticsOutput; metrics: Record<string, unknown> }> {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');
    const overview = await clientDashboardService.getClientOverview(opts.clientId).catch(() => null);

    const metrics = {
      callsThisWeek: (overview as any)?.callsThisWeek ?? 0,
      callsThisMonth: (overview as any)?.callsThisMonth ?? 0,
      totalBookings: (overview as any)?.totalBookings ?? 0,
      avgCallDuration: (overview as any)?.avgCallDuration ?? 0,
      sentiment: (overview as any)?.sentimentMap ?? {},
    };

    const prompt = await getPrompt('analytics', lang);
    const userPrompt = prompt.user
      .replace('{{task}}', 'weekly_digest')
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{niche}}', sanitize(client.businessType ?? ''))
      .replace('{{metrics}}', sanitize(JSON.stringify(metrics)));

    let output: AnalyticsOutput;
    try {
      output = await callOpenAI(prompt.system, userPrompt);
    } catch (e) {
      logger.warn('[analytics] weekly digest LLM failed', e);
      output = {
        insights: [lang === 'fr' ? `${metrics.callsThisWeek} appels cette semaine.` : `${metrics.callsThisWeek} calls this week.`],
        anomalies: [],
        recommendations: [],
      };
    }

    const activity = await prisma.agentAnalyticsActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'digest_sent',
        period: 'weekly',
        content: JSON.parse(JSON.stringify({ ...output, metrics, language: lang })),
        status: 'completed',
        performedAt: new Date(),
      },
    });

    return { activityId: activity.id, output, metrics };
  }

  async detectAnomalies(opts: AnomaliesOpts): Promise<{ activityId: string; anomalies: AnalyticsOutput['anomalies']; checkedMetrics: Record<string, number> }> {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const windowDays = opts.windowDays ?? 7;
    const sinceRecent = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sinceBaseline = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [callsLast24h, callsBaseline, voicemailsBaseline] = await Promise.all([
      prisma.clientCall.count({ where: { clientId: opts.clientId, createdAt: { gte: sinceRecent } } }),
      prisma.clientCall.count({ where: { clientId: opts.clientId, createdAt: { gte: sinceBaseline, lt: sinceRecent } } }),
      prisma.clientCall.count({ where: { clientId: opts.clientId, createdAt: { gte: sinceBaseline, lt: sinceRecent }, outcome: 'voicemail' } }),
    ]);

    const baselineDaily = Math.max(1, callsBaseline / Math.max(1, windowDays - 1));
    const voicemailRate = callsBaseline > 0 ? voicemailsBaseline / callsBaseline : 0;
    const anomalies: AnalyticsOutput['anomalies'] = [];

    // Minimum data points guard
    if (callsBaseline >= 50) {
      const deviation = Math.abs(callsLast24h - baselineDaily) / baselineDaily;
      if (deviation > ANOMALY_THRESHOLDS.call_answer_rate_drop) {
        anomalies.push({
          metric: 'daily_call_volume',
          severity: deviation > ANOMALY_THRESHOLDS.call_answer_rate_drop * 2 ? 'critical' : 'warn',
          explanation: opts.language === 'fr'
            ? `Volume d'appels ${callsLast24h < baselineDaily ? 'en baisse' : 'en hausse'} de ${Math.round(deviation * 100)}% vs moyenne ${windowDays}j.`
            : `Call volume ${callsLast24h < baselineDaily ? 'down' : 'up'} ${Math.round(deviation * 100)}% vs ${windowDays}d average.`,
        });
      }
      if (voicemailRate > ANOMALY_THRESHOLDS.voicemail_rate) {
        anomalies.push({
          metric: 'voicemail_rate',
          severity: voicemailRate > ANOMALY_THRESHOLDS.voicemail_rate * 2 ? 'critical' : 'warn',
          explanation: opts.language === 'fr'
            ? `Taux de voicemail élevé (${Math.round(voicemailRate * 100)}%) sur les ${windowDays}j.`
            : `Voicemail rate high (${Math.round(voicemailRate * 100)}%) over the past ${windowDays}d.`,
        });
      }
    }

    const activity = await prisma.agentAnalyticsActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'anomaly_detected',
        period: `${windowDays}d`,
        content: {
          anomalies,
          checkedMetrics: { callsLast24h, baselineDaily, voicemailRate, callsBaseline },
        },
        status: anomalies.length > 0 ? 'pending' : 'completed',
        performedAt: new Date(),
      },
    });

    return {
      activityId: activity.id,
      anomalies,
      checkedMetrics: { callsLast24h, baselineDaily, voicemailRate, callsBaseline },
    };
  }

  async forecast(opts: ForecastOpts) {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const periodDays = opts.periodDays ?? 30;
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    let lastPeriodValue = 0;
    if (opts.metric === 'calls') {
      lastPeriodValue = await prisma.clientCall.count({ where: { clientId: opts.clientId, createdAt: { gte: since } } });
    } else if (opts.metric === 'bookings') {
      lastPeriodValue = await prisma.clientBooking.count({ where: { clientId: opts.clientId, createdAt: { gte: since } } }).catch(() => 0);
    }

    const projection = Math.round(lastPeriodValue);

    const activity = await prisma.agentAnalyticsActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'forecast_generated',
        metric: opts.metric,
        value: projection,
        period: `${periodDays}d`,
        content: { metric: opts.metric, lastPeriodValue, projection },
        status: 'completed',
        performedAt: new Date(),
      },
    });

    return {
      activityId: activity.id,
      forecast: { metric: opts.metric, lastPeriodValue, projection, periodDays },
    };
  }

  async recommend(opts: RecommendOpts): Promise<{ activityId: string; recommendations: string[] }> {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');
    const subs = await prisma.agentSubscription.findUnique({ where: { clientId: opts.clientId } });
    const activeModules: string[] = [];
    if (subs?.emailAi) activeModules.push('email');
    if (subs?.marketingAi) activeModules.push('marketing');
    if (subs?.reputationAi) activeModules.push('reputation');
    if (subs?.schedulingAi) activeModules.push('scheduling');
    if (subs?.supportAi) activeModules.push('support');

    const prompt = await getPrompt('analytics', lang);
    const userPrompt = prompt.user
      .replace('{{task}}', 'recommend_modules')
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{niche}}', sanitize(client.businessType ?? ''))
      .replace('{{metrics}}', sanitize(JSON.stringify({ activeModules })));

    let output: AnalyticsOutput;
    try {
      output = await callOpenAI(prompt.system, userPrompt);
    } catch {
      output = {
        insights: [],
        anomalies: [],
        recommendations: lang === 'fr'
          ? ['Activez Marketing AI si vous voulez plus de leads.']
          : ['Enable Marketing AI for more leads.'],
      };
    }

    const activity = await prisma.agentAnalyticsActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'recommendation_made',
        content: JSON.parse(JSON.stringify({ ...output, activeModules, language: lang })),
        status: 'completed',
        performedAt: new Date(),
      },
    });

    return { activityId: activity.id, recommendations: output.recommendations };
  }

  async getDigestHistory(clientId: string, limit = 12) {
    return prisma.agentAnalyticsActivity.findMany({
      where: { clientId, type: 'digest_sent' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listActivity(clientId: string, limit = 50) {
    return prisma.agentAnalyticsActivity.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getDashboard(clientId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [config, last24h, last30d, byType] = await Promise.all([
      this.getConfig(clientId),
      prisma.agentAnalyticsActivity.count({
        where: { clientId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.agentAnalyticsActivity.count({ where: { clientId, createdAt: { gte: since } } }),
      prisma.agentAnalyticsActivity.groupBy({
        by: ['type'],
        where: { clientId, createdAt: { gte: since } },
        _count: { _all: true },
      } as any),
    ]);
    return { config, last24h, last30d, byType };
  }
}

async function callOpenAI(system: string, user: string): Promise<AnalyticsOutput> {
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

export const agentAnalyticsService = new AgentAnalyticsService();
