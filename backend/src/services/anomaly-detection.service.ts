/**
 * Anomaly Detection Service — OPT #10
 * Runs hourly, compares last-24h metrics vs 7-day avg.
 * Creates AgentAnomaly records + Discord alerts on deviation > threshold.
 */
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { discordService } from './discord.service';

interface MetricResult {
  name: string;
  current: number;
  avg7d: number;
  deviation: number; // absolute ratio deviation e.g. 0.8 means 80% change
  sampleSize: number;
}

const THRESHOLDS: Record<string, number> = {
  sms_response_rate: 0.5,
  voicemail_rate: 0.4,
  call_answer_rate: 0.35,
  cost_per_contact: 0.6,
};

class AnomalyDetectionService {
  async runAnomalyCheck(): Promise<number> {
    const metrics = await this.computeMetrics();
    let detected = 0;

    for (const m of metrics) {
      if (m.avg7d === 0 || m.sampleSize < 10) continue;
      const deviation = Math.abs(m.current - m.avg7d) / m.avg7d;
      const threshold = THRESHOLDS[m.name] ?? 0.5;
      if (deviation < threshold) {
        // Possibly resolve existing anomaly
        await this.resolveIfNormal(m.name);
        continue;
      }

      const existing = await prisma.agentAnomaly.findFirst({
        where: { metricName: m.name, resolvedAt: null },
      });
      if (existing) continue; // already flagged

      const severity = deviation > threshold * 2 ? 'critical' : 'warn';
      const diagnosis = await this.getDiagnosis(m.name, m.avg7d, m.current);

      await prisma.agentAnomaly.create({
        data: {
          metricName: m.name,
          currentValue: m.current,
          avgValue: m.avg7d,
          deviation,
          severity,
          diagnosis,
        },
      });

      const deviationPct = Math.round(deviation * 100);
      const emoji = severity === 'critical' ? '🚨' : '⚠️';
      await discordService.notifyErrors(
        `${emoji} ANOMALIE [${m.name}]: ${m.current.toFixed(3)} (moy 7j: ${m.avg7d.toFixed(3)}, déviation: ${deviationPct}%)\n${diagnosis ?? ''}`
      ).catch(() => null);

      logger.warn(`[Anomaly] ${m.name}: current=${m.current.toFixed(3)} avg=${m.avg7d.toFixed(3)} dev=${deviationPct}%`);
      detected++;
    }

    return detected;
  }

  private async computeMetrics(): Promise<MetricResult[]> {
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 3600 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    // --- sms_response_rate ---
    const [smsSent24h, smsReplied24h, smsSent7d, smsReplied7d] = await Promise.all([
      prisma.followUpSequence.count({ where: { sentAt: { gte: h24 }, type: { startsWith: 'sms' } } }),
      prisma.followUpSequence.count({ where: { sentAt: { gte: h24 }, type: { startsWith: 'sms' }, replied: true } }),
      prisma.followUpSequence.count({ where: { sentAt: { gte: d7, lt: h24 }, type: { startsWith: 'sms' } } }),
      prisma.followUpSequence.count({ where: { sentAt: { gte: d7, lt: h24 }, type: { startsWith: 'sms' }, replied: true } }),
    ]);
    const smsRate24h = smsSent24h > 0 ? smsReplied24h / smsSent24h : 0;
    const smsRate7d = smsSent7d > 0 ? smsReplied7d / smsSent7d / 6 : 0; // daily avg

    // --- voicemail_rate ---
    const [calls24h, vm24h, calls7d, vm7d] = await Promise.all([
      prisma.call.count({ where: { createdAt: { gte: h24 } } }),
      prisma.call.count({ where: { createdAt: { gte: h24 }, detectionResult: 'voicemail' } }),
      prisma.call.count({ where: { createdAt: { gte: d7, lt: h24 } } }),
      prisma.call.count({ where: { createdAt: { gte: d7, lt: h24 }, detectionResult: 'voicemail' } }),
    ]);
    const vmRate24h = calls24h > 0 ? vm24h / calls24h : 0;
    const vmRate7d = calls7d > 0 ? vm7d / calls7d : 0;

    // --- call_answer_rate ---
    const [answered24h, answered7d] = await Promise.all([
      prisma.call.count({ where: { createdAt: { gte: h24 }, status: 'completed' } }),
      prisma.call.count({ where: { createdAt: { gte: d7, lt: h24 }, status: 'completed' } }),
    ]);
    const answerRate24h = calls24h > 0 ? answered24h / calls24h : 0;
    const answerRate7d = calls7d > 0 ? answered7d / calls7d : 0;

    return [
      { name: 'sms_response_rate', current: smsRate24h, avg7d: smsRate7d, deviation: 0, sampleSize: smsSent24h },
      { name: 'voicemail_rate', current: vmRate24h, avg7d: vmRate7d, deviation: 0, sampleSize: calls24h },
      { name: 'call_answer_rate', current: answerRate24h, avg7d: answerRate7d, deviation: 0, sampleSize: calls24h },
    ];
  }

  private async resolveIfNormal(metricName: string): Promise<void> {
    await prisma.agentAnomaly.updateMany({
      where: { metricName, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
  }

  private async getDiagnosis(metric: string, avg: number, current: number): Promise<string | null> {
    if (!env.OPENAI_API_KEY) return null;
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 80,
          messages: [
            { role: 'system', content: 'You analyze sales automation anomalies. Reply in 1 sentence, in French.' },
            { role: 'user', content: `Metric "${metric}" dropped from ${avg.toFixed(3)} to ${current.toFixed(3)}. Most likely cause?` },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json() as { choices?: Array<{ message: { content: string } }> };
      return data.choices?.[0]?.message.content ?? null;
    } catch {
      return null;
    }
  }
}

export const anomalyDetectionService = new AnomalyDetectionService();
