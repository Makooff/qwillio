import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';

// Apify LinkedIn Company Scraper actor: "curious_coder/linkedin-company-search-scraper"
// Falls back to Google Maps-style lead quality but for B2B

const LINKEDIN_NICHES = [
  { query: 'agence marketing', niche: 'marketing_agency' },
  { query: 'cabinet de recrutement', niche: 'recruitment' },
  { query: 'agence immobilière', niche: 'real_estate' },
  { query: 'cabinet comptable', niche: 'accountant' },
  { query: 'agence web', niche: 'web_agency' },
  { query: "cabinet d'avocats", niche: 'law_firm' },
  { query: 'coach business', niche: 'coach' },
  { query: 'consultant formation', niche: 'training' },
];

interface LinkedInCompany {
  name?: string;
  website?: string;
  phone?: string;
  industry?: string;
  employeeCount?: number;
  description?: string;
  city?: string;
  country?: string;
}

export class LinkedInScrapingService {
  private readonly apifyToken: string;

  constructor() {
    this.apifyToken = env.APIFY_API_KEY || '';
  }

  async scrapeNiche(query: string, niche: string, country = 'France', limit = 30): Promise<number> {
    if (!this.apifyToken) {
      logger.warn('[LinkedIn] No APIFY_API_KEY — skipping');
      return 0;
    }

    try {
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/curious_coder~linkedin-company-search-scraper/runs?token=${this.apifyToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchQueries: [`${query} ${country}`],
            maxResults: limit,
          }),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!runRes.ok) {
        logger.error(`[LinkedIn] Apify run failed: ${runRes.status}`);
        return 0;
      }

      const run = await runRes.json() as { data: { id: string } };
      const runId = run.data?.id;
      if (!runId) return 0;

      // Poll for completion (max 2 minutes)
      let attempts = 0;
      let datasetId: string | null = null;
      while (attempts < 24) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}?token=${this.apifyToken}`
        );
        const status = await statusRes.json() as { data: { status: string; defaultDatasetId: string } };
        if (status.data?.status === 'SUCCEEDED') {
          datasetId = status.data.defaultDatasetId;
          break;
        }
        if (status.data?.status === 'FAILED') break;
        attempts++;
      }

      if (!datasetId) return 0;

      const itemsRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${this.apifyToken}&limit=${limit}`
      );
      const items = await itemsRes.json() as LinkedInCompany[];

      return this.saveCompanies(items, niche, country);
    } catch (err) {
      logger.error(`[LinkedIn] Scrape failed for ${niche}:`, err);
      return 0;
    }
  }

  private async saveCompanies(companies: LinkedInCompany[], niche: string, country: string): Promise<number> {
    let saved = 0;
    for (const c of companies) {
      if (!c.name) continue;
      if (!c.website && !c.phone) continue;

      // Dedup by website
      if (c.website) {
        const exists = await prisma.prospect.findFirst({ where: { website: c.website } });
        if (exists) continue;
      }

      await prisma.prospect.create({
        data: {
          businessName: c.name,
          businessType: niche,
          website: c.website ?? null,
          phone: c.phone ?? '',
          niche,
          city: c.city ?? null,
          country: country,
          status: 'new',
          score: this.scoreLinkedInProspect(c),
          notes: c.description ? c.description.slice(0, 500) : null,
        },
      }).catch(() => {}); // Skip duplicates
      saved++;
    }
    logger.info(`[LinkedIn] Saved ${saved} prospects for niche ${niche}`);
    return saved;
  }

  private scoreLinkedInProspect(c: LinkedInCompany): number {
    let score = 50;
    if (c.website) score += 10;
    if (c.phone) score += 15;
    if (c.employeeCount && c.employeeCount >= 5 && c.employeeCount <= 50) score += 15;
    if (c.description && c.description.length > 100) score += 5;
    return Math.min(score, 100);
  }

  async scrapeAllNiches(): Promise<{ total: number; byNiche: Record<string, number> }> {
    const byNiche: Record<string, number> = {};
    let total = 0;

    for (const { query, niche } of LINKEDIN_NICHES) {
      const count = await this.scrapeNiche(query, niche, 'France', 25);
      byNiche[niche] = count;
      total += count;
      await new Promise(r => setTimeout(r, 2000));
    }

    logger.info(`[LinkedIn] Total scraped: ${total}`);
    return { total, byNiche };
  }
}

export const linkedInScrapingService = new LinkedInScrapingService();
