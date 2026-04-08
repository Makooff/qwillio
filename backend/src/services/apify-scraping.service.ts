/**
 * Apify Google Maps scraping service — Part 1 of the prospecting engine
 * Scrapes Home Services & Dental niches across priority US cities
 */
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { discordService } from './discord.service';
import { prospectScoringService } from './prospect-scoring.service';
import { phoneValidationService } from './phone-validation.service';

// ─── Niche query map ─────────────────────────────────────
const SCRAPE_QUERIES: Array<{ niche: string; queries: string[]; cities: string[] }> = [
  {
    niche: 'home_services',
    queries: ['plumber', 'HVAC contractor', 'electrician'],
    cities: [
      'Houston TX', 'Dallas TX', 'San Antonio TX', 'Austin TX',
      'Miami FL', 'Tampa FL', 'Orlando FL', 'Jacksonville FL',
      'Atlanta GA', 'Charlotte NC',
    ],
  },
  {
    niche: 'dental',
    queries: ['dental office', 'dentist'],
    cities: [
      'Los Angeles CA', 'San Diego CA', 'Atlanta GA',
      'Phoenix AZ', 'Houston TX',
    ],
  },
];

// ─── E.164 phone normalizer ───────────────────────────────
function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

interface ApifyResult {
  title?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  totalScore?: number;
  reviewsCount?: number;
  website?: string;
  openingHours?: Array<{ day: string; hours: string }>;
}

export class ApifyScrapingService {
  private readonly BASE_URL = 'https://api.apify.com/v2';

  /** Run actor synchronously (wait for results) */
  private async runActor(input: object): Promise<ApifyResult[]> {
    if (!env.APIFY_API_KEY) {
      logger.warn('[Apify] APIFY_API_KEY not set, skipping scrape');
      return [];
    }

    try {
      // Start actor run
      const startRes = await fetch(
        `${this.BASE_URL}/acts/${env.APIFY_ACTOR_ID}/runs?token=${env.APIFY_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input, maxCrawledPlacesPerSearch: 20 }),
        }
      );

      if (!startRes.ok) {
        const err = await startRes.text();
        logger.error('[Apify] Failed to start actor:', err);
        return [];
      }

      const startData = await startRes.json() as any;
      const runId: string = startData.data?.id;
      if (!runId) return [];

      // Poll until SUCCEEDED (max 5 min)
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));

        const statusRes = await fetch(
          `${this.BASE_URL}/actor-runs/${runId}?token=${env.APIFY_API_KEY}`
        );
        const statusData = await statusRes.json() as any;
        const status: string = statusData.data?.status;

        if (status === 'SUCCEEDED') {
          const datasetId: string = statusData.data?.defaultDatasetId;
          const itemsRes = await fetch(
            `${this.BASE_URL}/datasets/${datasetId}/items?token=${env.APIFY_API_KEY}&format=json`
          );
          return (await itemsRes.json() as any) || [];
        }

        if (status === 'FAILED' || status === 'ABORTED') {
          logger.error(`[Apify] Actor run ${runId} ended with status: ${status}`);
          return [];
        }
      }

      logger.error(`[Apify] Actor run ${runId} timed out after 5 minutes`);
      return [];
    } catch (err) {
      logger.error('[Apify] Actor run error:', err);
      return [];
    }
  }

  /** Main daily scraping job */
  async runDailyScraping(): Promise<number> {
    logger.info('[Apify] Starting daily scraping run...');
    let totalAdded = 0;

    for (const { niche, queries, cities } of SCRAPE_QUERIES) {
      for (const city of cities) {
        for (const query of queries) {
          try {
            const searchStr = `${query} ${city}`;
            logger.info(`[Apify] Scraping: "${searchStr}"`);

            const results = await this.runActor({
              searchStringsArray: [searchStr],
              language: 'en',
              countryCode: 'US',
            });

            for (const item of results) {
              const phone = toE164(item.phone);
              if (!phone) continue;

              // Skip if phone already exists
              const existing = await prisma.prospect.findFirst({
                where: { phone },
              });
              if (existing) continue;

              const [cityName, stateName] = (item.city && item.state)
                ? [item.city, item.state]
                : city.split(' ').reduce<[string, string]>((acc, part, i, arr) => {
                    if (i === arr.length - 1) acc[1] = part;
                    else acc[0] = (acc[0] ? acc[0] + ' ' : '') + part;
                    return acc;
                  }, ['', '']);

              const priorityScore = prospectScoringService.computeScore({
                niche,
                googleRating: item.totalScore ?? null,
                reviewCount: item.reviewsCount ?? null,
                hasWebsite: !!item.website,
                state: stateName,
              });

              await prisma.prospect.create({
                data: {
                  businessName: item.title || 'Unknown',
                  businessType: niche,
                  niche,
                  phone,
                  address: item.address ?? null,
                  city: cityName || city,
                  state: stateName || null,
                  country: 'US',
                  website: item.website ?? null,
                  googleRating: item.totalScore ?? null,
                  googleReviewsCount: item.reviewsCount ?? null,
                  score: priorityScore,
                  priorityScore,
                  status: 'new',
                  eligibleForCall: true,
                  phoneValidated: false,
                },
              });
              totalAdded++;
            }
          } catch (err) {
            logger.error(`[Apify] Error scraping "${query} ${city}":`, err);
          }
        }
      }
    }

    logger.info(`[Apify] Scraping complete: ${totalAdded} new prospects added`);

    // Validate phones for newly added prospects
    if (totalAdded > 0) {
      try {
        await phoneValidationService.validateBatch(Math.min(totalAdded, 50));
      } catch (err) {
        logger.warn('[Apify] Phone validation batch failed:', err);
      }
    }

    // Discord notification (never throws)
    await discordService.notifySystem(
      `🕷️ SCRAPING COMPLETE\n\nNew prospects: ${totalAdded}\nNiches: home_services, dental\nCities: ${SCRAPE_QUERIES.flatMap(n => n.cities).length} targeted`
    );

    // Update analytics (non-critical, don't fail scraping if this errors)
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      await prisma.analyticsDaily.upsert({
        where: { date: today },
        update: { prospectsAdded: { increment: totalAdded } },
        create: { date: today, prospectsAdded: totalAdded },
      });
    } catch (err) {
      logger.warn('[Apify] Analytics update failed (non-critical):', err);
    }

    // Update bot lastProspection timestamp
    try {
      const bot = await prisma.botStatus.findFirst({ select: { id: true } });
      if (bot) {
        await prisma.botStatus.update({
          where: { id: bot.id },
          data: { lastProspection: new Date() },
        });
      }
    } catch (err) {
      logger.warn('[Apify] BotStatus timestamp update failed:', err);
    }

    return totalAdded;
  }
}

export const apifyScrapingService = new ApifyScrapingService();
