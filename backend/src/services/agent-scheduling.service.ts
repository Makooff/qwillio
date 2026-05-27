import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { getPrompt, type Lang } from './prompt-loader.service';

interface OptimizeOpts {
  clientId: string;
  date: string;
  slotCount?: number;
  language?: Lang;
}

interface SlotSuggestion {
  datetime: string;
  reason: string;
}

interface SlotsOutput {
  slots: SlotSuggestion[];
}

const sanitize = (s: string) => s.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200);

export class AgentSchedulingService {
  async getConfig(clientId: string) {
    return prisma.agentSchedulingConfig.upsert({
      where: { clientId },
      update: {},
      create: { clientId },
    });
  }

  async updateConfig(clientId: string, patch: Record<string, unknown>) {
    return prisma.agentSchedulingConfig.upsert({
      where: { clientId },
      update: patch,
      create: { clientId, ...patch },
    });
  }

  async optimize(opts: OptimizeOpts): Promise<{ activityId: string; output: SlotsOutput }> {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');
    const prompt = await getPrompt('scheduling', lang);
    const slotCount = opts.slotCount ?? 3;
    const userPrompt = prompt.user
      .replace('{{slotCount}}', String(slotCount))
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{timezone}}', 'America/New_York')
      .replace('{{date}}', sanitize(opts.date));

    let output: SlotsOutput;
    try {
      output = await callOpenAI(prompt.system, userPrompt);
    } catch (e) {
      logger.warn('[scheduling] LLM failed, using fallback', e);
      const base = new Date(opts.date);
      output = {
        slots: [9, 11, 14].slice(0, slotCount).map((h, idx) => {
          const d = new Date(base);
          d.setHours(h, 0, 0, 0);
          return {
            datetime: d.toISOString(),
            reason: lang === 'fr' ? `Créneau standard #${idx + 1}` : `Standard slot #${idx + 1}`,
          };
        }),
      };
    }

    const activity = await prisma.agentSchedulingActivity.create({
      data: {
        clientId: opts.clientId,
        type: 'slots_recommended',
        content: JSON.parse(JSON.stringify({ ...output, date: opts.date, language: lang })),
        status: 'pending',
      },
    });

    return { activityId: activity.id, output };
  }

  async sendReminder(bookingId: string, clientId: string) {
    // Wire to booking-reminder.service later. For now, record the intent.
    return prisma.agentSchedulingActivity.create({
      data: {
        clientId,
        type: 'reminder_sent',
        bookingId,
        content: { sentAt: new Date().toISOString() },
        status: 'sent',
        performedAt: new Date(),
      },
    });
  }

  async listActivity(clientId: string, limit = 50) {
    return prisma.agentSchedulingActivity.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getDashboard(clientId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [config, last24h, last30d, byStatus] = await Promise.all([
      this.getConfig(clientId),
      prisma.agentSchedulingActivity.count({
        where: { clientId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.agentSchedulingActivity.count({ where: { clientId, createdAt: { gte: since } } }),
      prisma.agentSchedulingActivity.groupBy({
        by: ['status'],
        where: { clientId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);
    return { config, last24h, last30d, byStatus };
  }
}

async function callOpenAI(system: string, user: string): Promise<SlotsOutput> {
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
      temperature: 0.3,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const data = await r.json() as any;
  return JSON.parse(data?.choices?.[0]?.message?.content);
}

export const agentSchedulingService = new AgentSchedulingService();
