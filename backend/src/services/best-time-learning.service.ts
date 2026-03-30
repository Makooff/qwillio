/**
 * Best Time Learning — Part 8 of the prospecting spec
 * After 500 calls per niche: analyze conversion rate by hour and day.
 * Store in niche_best_times table. Re-evaluate every 500 additional calls.
 */
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { discordService } from './discord.service';

export class BestTimeLearningService {
  private readonly SAMPLE_THRESHOLD = 500;

  /** Run analysis for all niches that have enough data */
  async analyzeAll(): Promise<number> {
    logger.info('[BestTime] Running best-time analysis...');
    let updated = 0;

    // Get distinct niches that have calls
    const niches = await prisma.call.groupBy({
      by: ['niche'],
      where: { niche: { not: null }, detectionResult: 'answered' },
      _count: { id: true },
      having: { id: { _count: { gte: this.SAMPLE_THRESHOLD } } },
    });

    for (const { niche } of niches) {
      if (!niche) continue;
      const count = await this.analyzeNiche(niche);
      if (count > 0) {
        updated += count;
        logger.info(`[BestTime] Updated ${count} time slots for niche: ${niche}`);
      }
    }

    if (updated > 0) {
      await discordService.notifySystem(
        `📊 BEST-TIME LEARNING\nUpdated ${updated} call time slots across all niches`
      );
    }

    return updated;
  }

  /** Analyze one niche and update/create NicheBestTime records */
  private async analyzeNiche(niche: string): Promise<number> {
    // Get all answered calls for this niche
    const calls = await prisma.call.findMany({
      where: {
        niche,
        detectionResult: 'answered',
        createdAt: { not: undefined },
      },
      select: {
        createdAt: true,
        interestScore: true,
      },
    });

    if (calls.length < this.SAMPLE_THRESHOLD) return 0;

    // Bucket by (dayOfWeek, hourUtc)
    type Bucket = { total: number; conversions: number };
    const buckets = new Map<string, Bucket>();

    for (const call of calls) {
      const d = call.createdAt.getUTCDay();   // 0=Sun
      const h = call.createdAt.getUTCHours();
      const key = `${d}_${h}`;

      if (!buckets.has(key)) buckets.set(key, { total: 0, conversions: 0 });
      const b = buckets.get(key)!;
      b.total++;
      if ((call.interestScore ?? 0) >= 5) b.conversions++;
    }

    let updatedCount = 0;

    for (const [key, { total, conversions }] of buckets) {
      if (total < 10) continue; // Need at least 10 calls per slot
      const [dayStr, hourStr] = key.split('_');
      const conversionRate = conversions / total;

      await prisma.nicheBestTime.upsert({
        where: {
          niche_dayOfWeek_hourUtc: {
            niche,
            dayOfWeek: parseInt(dayStr),
            hourUtc: parseInt(hourStr),
          },
        },
        update: { conversionRate, sampleSize: total },
        create: {
          niche,
          dayOfWeek: parseInt(dayStr),
          hourUtc: parseInt(hourStr),
          conversionRate,
          sampleSize: total,
        },
      });
      updatedCount++;
    }

    return updatedCount;
  }

  /** Get the best calling hours for a niche (top 5 slots by conversion rate) */
  async getBestSlots(niche: string, topN = 5) {
    return prisma.nicheBestTime.findMany({
      where: { niche, sampleSize: { gte: 10 } },
      orderBy: { conversionRate: 'desc' },
      take: topN,
    });
  }

  /** Check if current UTC time is in a high-conversion slot for a niche */
  async isHighConversionSlot(niche: string): Promise<boolean> {
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();

    const slot = await prisma.nicheBestTime.findUnique({
      where: { niche_dayOfWeek_hourUtc: { niche, dayOfWeek: day, hourUtc: hour } },
    });

    if (!slot) return true; // No data yet — allow call
    return slot.conversionRate >= 0.1; // At least 10% conversion rate
  }
}

export const bestTimeLearningService = new BestTimeLearningService();
