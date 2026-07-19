/**
 * Apify Google Maps scraping service — Part 1 of the prospecting engine
 * Scrapes 18 niches across US, France, and Belgium
 */
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { discordService } from './discord.service';
import { prospectScoringService } from './prospect-scoring.service';
import { phoneValidationService } from './phone-validation.service';
import { CITIES_COORDINATES } from '../utils/constants';

// ─── Belgian cities (no state abbreviation in query strings) ─
const BE_CITIES = new Set([
  'Bruxelles', 'Liège', 'Charleroi', 'Namur', 'Mons', 'La Louvière', 'Tournai',
]);

// ─── French cities ────────────────────────────────────────
const FR_CITIES = new Set([
  'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Montpellier',
  'Strasbourg', 'Bordeaux', 'Lille', 'Rennes', 'Reims', 'Saint-Étienne',
  'Toulon', 'Grenoble', 'Dijon', 'Angers', 'Nîmes', 'Aix-en-Provence',
  'Clermont-Ferrand',
]);

/** Derive country code and timezone from a city name */
function getCityMeta(cityName: string): { country: string; timezone: string } {
  // Try exact match in CITIES_COORDINATES first
  const meta = CITIES_COORDINATES[cityName];
  if (meta) return { country: meta.country, timezone: meta.timezone };

  // Fallback by set membership
  if (BE_CITIES.has(cityName)) return { country: 'BE', timezone: 'Europe/Brussels' };
  if (FR_CITIES.has(cityName)) return { country: 'FR', timezone: 'Europe/Paris' };
  return { country: 'US', timezone: 'America/New_York' };
}

// ─── Niche query map ─────────────────────────────────────
// Ordered by revenue priority (highest-value niches first).
// Each city string must include state abbreviation for accurate geo.
const SCRAPE_QUERIES: Array<{ niche: string; queries: string[]; cities: string[] }> = [
  // ── Tier 1: Home Services (highest call-to-close rate) ──
  {
    niche: 'home_services',
    queries: ['plumber', 'HVAC contractor', 'electrician', 'roofing contractor'],
    cities: [
      'Houston TX', 'Dallas TX', 'San Antonio TX', 'Austin TX',
      'Miami FL', 'Tampa FL', 'Orlando FL', 'Jacksonville FL',
      'Atlanta GA', 'Charlotte NC', 'Phoenix AZ', 'Las Vegas NV',
      'Nashville TN', 'Denver CO', 'Minneapolis MN',
    ],
  },
  {
    niche: 'home_services',
    queries: ['locksmith', 'moving company', 'house painter', 'general contractor'],
    cities: [
      'Chicago IL', 'Los Angeles CA', 'New York NY', 'Philadelphia PA',
      'Seattle WA', 'Boston MA', 'Columbus OH', 'Indianapolis IN',
    ],
  },
  // ── Tier 2: Dental ──────────────────────────────────────
  {
    niche: 'dental',
    queries: ['dental office', 'dentist', 'cosmetic dentist', 'orthodontist'],
    cities: [
      'Los Angeles CA', 'San Diego CA', 'Atlanta GA', 'Phoenix AZ',
      'Houston TX', 'Dallas TX', 'Miami FL', 'Chicago IL',
      'New York NY', 'Seattle WA', 'Boston MA', 'Denver CO',
    ],
  },
  // ── Tier 3: Auto ────────────────────────────────────────
  {
    niche: 'auto',
    queries: ['auto repair shop', 'car mechanic', 'transmission repair', 'auto body shop'],
    cities: [
      'Houston TX', 'Dallas TX', 'Los Angeles CA', 'Phoenix AZ',
      'Atlanta GA', 'San Antonio TX', 'Chicago IL', 'Indianapolis IN',
    ],
  },
  // ── Tier 4: Law ─────────────────────────────────────────
  {
    niche: 'law',
    queries: ['personal injury lawyer', 'family law attorney', 'criminal defense lawyer', 'immigration attorney'],
    cities: [
      'New York NY', 'Los Angeles CA', 'Houston TX', 'Miami FL',
      'Chicago IL', 'Atlanta GA', 'Dallas TX', 'Philadelphia PA',
    ],
  },
  // ── Tier 5: Medical ─────────────────────────────────────
  {
    niche: 'medical',
    queries: ['urgent care clinic', 'family doctor', 'chiropractor', 'physical therapy'],
    cities: [
      'Houston TX', 'Los Angeles CA', 'Phoenix AZ', 'Atlanta GA',
      'Chicago IL', 'Dallas TX', 'Miami FL', 'Seattle WA',
    ],
  },
  // ── Tier 6: Salon & Beauty ──────────────────────────────
  {
    niche: 'salon',
    queries: ['hair salon', 'nail salon', 'barbershop', 'beauty spa'],
    cities: [
      'Los Angeles CA', 'Miami FL', 'New York NY', 'Atlanta GA',
      'Houston TX', 'Dallas TX', 'Chicago IL', 'Las Vegas NV',
    ],
  },
  // ── Tier 7: Veterinary ──────────────────────────────────
  {
    niche: 'veterinary',
    queries: ['veterinarian', 'animal hospital', 'pet clinic'],
    cities: [
      'Houston TX', 'Los Angeles CA', 'Chicago IL', 'Atlanta GA',
      'Seattle WA', 'Denver CO', 'Minneapolis MN', 'Austin TX',
    ],
  },
  // ── Tier 8: Restaurant ──────────────────────────────────
  {
    niche: 'restaurant',
    queries: ['restaurant', 'catering company', 'food truck'],
    cities: [
      'New York NY', 'Los Angeles CA', 'Miami FL', 'Chicago IL',
      'Las Vegas NV', 'Nashville TN', 'Houston TX', 'Atlanta GA',
    ],
  },
  // ── Tier 9: Fitness ────────────────────────────────────
  {
    niche: 'fitness',
    queries: ['gym', 'personal trainer', 'yoga studio', 'crossfit gym'],
    cities: [
      'Los Angeles CA', 'Miami FL', 'New York NY', 'Austin TX',
      'Denver CO', 'Seattle WA', 'San Diego CA', 'Chicago IL',
    ],
  },
  // ── Tier 10: Real Estate ────────────────────────────────
  {
    niche: 'real_estate',
    queries: ['real estate agent', 'property management company', 'real estate broker'],
    cities: [
      'Miami FL', 'Los Angeles CA', 'New York NY', 'Dallas TX',
      'Houston TX', 'Las Vegas NV', 'Phoenix AZ', 'Atlanta GA',
    ],
  },
  // ── Tier 11: Financial ──────────────────────────────────
  {
    niche: 'financial',
    queries: ['insurance agency', 'tax accountant', 'financial advisor', 'bookkeeper'],
    cities: [
      'New York NY', 'Chicago IL', 'Los Angeles CA', 'Houston TX',
      'Miami FL', 'Atlanta GA', 'Dallas TX', 'Boston MA',
    ],
  },
  // ── Tier 12: Childcare ──────────────────────────────────
  {
    niche: 'childcare',
    queries: ['daycare center', 'preschool', 'after school program'],
    cities: [
      'Houston TX', 'Atlanta GA', 'Charlotte NC', 'Columbus OH',
      'Indianapolis IN', 'Nashville TN', 'Austin TX', 'Dallas TX',
    ],
  },
  // ── Tier 13: Pet Services ───────────────────────────────
  {
    niche: 'pet',
    queries: ['dog grooming', 'dog training', 'pet boarding', 'dog daycare'],
    cities: [
      'Los Angeles CA', 'New York NY', 'Seattle WA', 'Denver CO',
      'Austin TX', 'Chicago IL', 'Atlanta GA', 'Boston MA',
    ],
  },
  // ── Tier 14: Hotel / Lodging ────────────────────────────
  {
    niche: 'hotel',
    queries: ['boutique hotel', 'bed and breakfast', 'motel'],
    cities: [
      'Las Vegas NV', 'Miami FL', 'New York NY', 'Los Angeles CA',
      'Nashville TN', 'New Orleans LA', 'Chicago IL', 'San Francisco CA',
    ],
  },
  // ── Tier 15: Photography / Creative ─────────────────────
  {
    niche: 'creative',
    queries: ['wedding photographer', 'event photographer', 'videographer'],
    cities: [
      'New York NY', 'Los Angeles CA', 'Miami FL', 'Chicago IL',
      'Atlanta GA', 'Houston TX', 'Nashville TN', 'Dallas TX',
    ],
  },
  // ── Tier 16: Cleaning Services ──────────────────────────
  {
    niche: 'home_services',
    queries: ['house cleaning service', 'commercial cleaning', 'carpet cleaning', 'window cleaning'],
    cities: [
      'New York NY', 'Los Angeles CA', 'Chicago IL', 'Houston TX',
      'Miami FL', 'Seattle WA', 'Boston MA', 'San Francisco CA',
    ],
  },
  // ── Tier 17: Florist / Events ───────────────────────────
  {
    niche: 'retail',
    queries: ['florist', 'event planner', 'wedding planner'],
    cities: [
      'New York NY', 'Los Angeles CA', 'Miami FL', 'Atlanta GA',
      'Chicago IL', 'Houston TX', 'Nashville TN', 'Dallas TX',
    ],
  },
  // ── Tier 18: Funeral ────────────────────────────────────
  {
    niche: 'funeral',
    queries: ['funeral home', 'cremation services'],
    cities: [
      'Houston TX', 'Los Angeles CA', 'Chicago IL', 'Philadelphia PA',
      'Atlanta GA', 'Dallas TX', 'Phoenix AZ', 'Indianapolis IN',
    ],
  },

  // ════════════════════════════════════════════════════════
  // FRANCE — French-language queries (Marie script)
  // ════════════════════════════════════════════════════════

  // ── FR Tier 1: Services à domicile ──────────────────────
  {
    niche: 'home_services',
    queries: ['plombier', 'électricien', 'chauffagiste', 'serrurier', 'couvreur', 'entreprise de déménagement'],
    cities: [
      'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice',
      'Nantes', 'Montpellier', 'Bordeaux', 'Lille', 'Strasbourg',
      'Grenoble', 'Rennes', 'Saint-Étienne', 'Toulon', 'Dijon',
    ],
  },
  // ── FR Tier 2: Dentaire ──────────────────────────────────
  {
    niche: 'dental',
    queries: ['cabinet dentaire', 'dentiste', 'orthodontiste', 'chirurgien dentiste'],
    cities: [
      'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice',
      'Nantes', 'Bordeaux', 'Lille', 'Montpellier', 'Rennes',
    ],
  },
  // ── FR Tier 3: Auto ──────────────────────────────────────
  {
    niche: 'auto',
    queries: ['garage automobile', 'mécanicien auto', 'carrosserie', 'centre auto'],
    cities: [
      'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux',
      'Nantes', 'Lille', 'Nice', 'Strasbourg', 'Montpellier',
    ],
  },
  // ── FR Tier 4: Médical / Para-médical ────────────────────
  {
    niche: 'medical',
    queries: ['cabinet médecin généraliste', 'kinésithérapeute', 'ostéopathe', 'centre médical'],
    cities: [
      'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice',
      'Nantes', 'Bordeaux', 'Lille', 'Rennes', 'Grenoble',
    ],
  },
  // ── FR Tier 5: Salon & Beauté ─────────────────────────────
  {
    niche: 'salon',
    queries: ['salon de coiffure', 'institut de beauté', 'barbier', 'spa'],
    cities: [
      'Paris', 'Lyon', 'Marseille', 'Nice', 'Bordeaux',
      'Toulouse', 'Nantes', 'Lille', 'Montpellier', 'Strasbourg',
    ],
  },
  // ── FR Tier 6: Vétérinaire ───────────────────────────────
  {
    niche: 'veterinary',
    queries: ['vétérinaire', 'clinique vétérinaire', 'cabinet vétérinaire'],
    cities: [
      'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nantes',
      'Bordeaux', 'Lille', 'Rennes', 'Nice', 'Grenoble',
    ],
  },
  // ── FR Tier 7: Juridique ─────────────────────────────────
  {
    niche: 'law',
    queries: ['avocat', 'cabinet d\'avocat', 'notaire', 'huissier'],
    cities: [
      'Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse',
      'Lille', 'Nantes', 'Strasbourg', 'Nice', 'Rennes',
    ],
  },
  // ── FR Tier 8: Restaurant ────────────────────────────────
  {
    niche: 'restaurant',
    queries: ['restaurant', 'traiteur', 'brasserie', 'pizzeria'],
    cities: [
      'Paris', 'Lyon', 'Marseille', 'Nice', 'Bordeaux',
      'Toulouse', 'Nantes', 'Strasbourg', 'Lille', 'Montpellier',
    ],
  },
  // ── FR Tier 9: Comptabilité / Finance ────────────────────
  {
    niche: 'financial',
    queries: ['expert-comptable', 'cabinet comptable', 'conseiller financier', 'courtier en assurance'],
    cities: [
      'Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse',
      'Nantes', 'Lille', 'Strasbourg', 'Nice', 'Rennes',
    ],
  },
  // ── FR Tier 10: Immobilier ───────────────────────────────
  {
    niche: 'real_estate',
    queries: ['agence immobilière', 'agent immobilier', 'promoteur immobilier'],
    cities: [
      'Paris', 'Lyon', 'Marseille', 'Nice', 'Bordeaux',
      'Toulouse', 'Nantes', 'Montpellier', 'Lille', 'Rennes',
    ],
  },

  // ════════════════════════════════════════════════════════
  // BELGIQUE — French-language queries (Marie script)
  // ════════════════════════════════════════════════════════

  // ── BE Tier 1: Services à domicile ──────────────────────
  {
    niche: 'home_services',
    queries: ['plombier', 'électricien', 'chauffagiste', 'serrurier', 'toiture', 'déménagement'],
    cities: [
      'Bruxelles', 'Liège', 'Charleroi', 'Namur', 'Mons',
      'La Louvière', 'Tournai',
    ],
  },
  // ── BE Tier 2: Dentaire ──────────────────────────────────
  {
    niche: 'dental',
    queries: ['dentiste', 'cabinet dentaire', 'orthodontiste'],
    cities: [
      'Bruxelles', 'Liège', 'Charleroi', 'Namur', 'Mons',
    ],
  },
  // ── BE Tier 3: Auto ──────────────────────────────────────
  {
    niche: 'auto',
    queries: ['garage auto', 'mécanicien', 'carrosserie'],
    cities: [
      'Bruxelles', 'Liège', 'Charleroi', 'Namur', 'Mons',
    ],
  },
  // ── BE Tier 4: Médical ───────────────────────────────────
  {
    niche: 'medical',
    queries: ['médecin généraliste', 'kinésithérapeute', 'ostéopathe'],
    cities: [
      'Bruxelles', 'Liège', 'Charleroi', 'Namur', 'Mons',
    ],
  },
  // ── BE Tier 5: Salon & Beauté ────────────────────────────
  {
    niche: 'salon',
    queries: ['coiffeur', 'salon de coiffure', 'institut de beauté'],
    cities: [
      'Bruxelles', 'Liège', 'Charleroi', 'Namur', 'Mons',
    ],
  },
  // ── BE Tier 6: Juridique ─────────────────────────────────
  {
    niche: 'law',
    queries: ['avocat', 'cabinet juridique', 'notaire'],
    cities: [
      'Bruxelles', 'Liège', 'Namur', 'Mons', 'Charleroi',
    ],
  },
  // ── BE Tier 7: Comptabilité ──────────────────────────────
  {
    niche: 'financial',
    queries: ['comptable', 'fiduciaire', 'expert-comptable', 'courtier assurance'],
    cities: [
      'Bruxelles', 'Liège', 'Charleroi', 'Namur', 'Mons',
    ],
  },
];

// ─── E.164 phone normalizer (country-aware) ───────────────
// The country comes from getCityMeta(); passing it is what lets a Belgian or
// French national-format number ("02 345 67 89", "01 23 45 67 89") normalize to
// +32/+33 instead of being wrongly prefixed with US +1.
const COUNTRY_CALLING_CODE: Record<string, string> = { BE: '32', FR: '33', US: '1' };

export function toE164(raw: string | null | undefined, country?: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const cc = country ? COUNTRY_CALLING_CODE[country.toUpperCase()] : undefined;

  // Already international: leading "+" or "00" prefix — trust the country code in it.
  const allDigits = s.replace(/\D/g, '');
  if (s.startsWith('+')) {
    return allDigits.length >= 8 && allDigits.length <= 15 ? `+${allDigits}` : null;
  }
  if (allDigits.startsWith('00')) {
    const intl = allDigits.slice(2);
    return intl.length >= 8 && intl.length <= 15 ? `+${intl}` : null;
  }

  let digits = allDigits;
  if (!digits) return null;

  if (country?.toUpperCase() === 'US') {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return null;
  }

  if (cc) {
    // BE/FR national format: strip a single national leading 0, prepend the code.
    if (digits.startsWith('0')) digits = digits.slice(1);
    return digits.length >= 8 && digits.length <= 12 ? `+${cc}${digits}` : null;
  }

  // Unknown country and no international prefix: only trust a long CC-bearing number,
  // never guess +1 on an ambiguous 10-digit national number.
  return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : null;
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

    const actorId = env.APIFY_ACTOR_ID;
    const keyPreview = env.APIFY_API_KEY.slice(0, 12) + '…';

    try {
      // Start actor run — retry up to 3× on 5xx with exponential backoff
      let startRes: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
          logger.info(`[Apify] Retry attempt ${attempt} for actor ${actorId}`);
        }
        try {
          startRes = await fetch(
            `${this.BASE_URL}/acts/${actorId}/runs?token=${env.APIFY_API_KEY}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.APIFY_API_KEY}`,
              },
              body: JSON.stringify({ ...input, maxCrawledPlacesPerSearch: 20 }),
              signal: AbortSignal.timeout(30000),
            }
          );
          if (startRes.status < 500) break; // don't retry 4xx or success
          const body = await startRes.text();
          logger.warn(`[Apify] HTTP ${startRes.status} on attempt ${attempt + 1}: ${body.slice(0, 200)}`);
          startRes = null; // mark as failed so we retry
        } catch (fetchErr) {
          logger.warn(`[Apify] Fetch error on attempt ${attempt + 1}: ${(fetchErr as Error).message}`);
          startRes = null;
        }
      }

      if (!startRes || !startRes.ok) {
        const body = startRes ? await startRes.text().catch(() => '') : '(no response)';
        logger.error(`[Apify] Failed to start actor ${actorId} (key: ${keyPreview}): HTTP ${startRes?.status ?? 0} — ${body.slice(0, 300)}`);
        // On 402 (billing), throw special error to abort entire batch — no point retrying
        if (startRes?.status === 402) {
          throw new Error('APIFY_BILLING_EXHAUSTED');
        }
        return [];
      }

      const startData = await startRes.json() as any;
      const runId: string = startData.data?.id;
      if (!runId) {
        logger.error(`[Apify] No run ID returned from actor ${actorId}. Response: ${JSON.stringify(startData)}`);
        return [];
      }

      // Poll until SUCCEEDED (max 5 min)
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));

        const statusRes = await fetch(
          `${this.BASE_URL}/actor-runs/${runId}?token=${env.APIFY_API_KEY}`,
          { headers: { 'Authorization': `Bearer ${env.APIFY_API_KEY}` } }
        );
        const statusData = await statusRes.json() as any;
        const status: string = statusData.data?.status;

        if (status === 'SUCCEEDED') {
          const datasetId: string = statusData.data?.defaultDatasetId;
          const itemsRes = await fetch(
            `${this.BASE_URL}/datasets/${datasetId}/items?format=json`,
            { headers: { 'Authorization': `Bearer ${env.APIFY_API_KEY}` } }
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
      logger.error(`[Apify] Actor run exception (actor: ${actorId}, key: ${keyPreview}): ${(err as Error).message}`);
      return [];
    }
  }

  /** Main daily scraping job — only runs if callable prospects are running low */
  async runDailyScraping(): Promise<number> {
    // Check how many callable prospects remain before spending Apify credits
    const callableCount = await prisma.prospect.count({
      where: {
        status: 'new',
        phone: { not: null },
        callAttempts: { lt: 3 },
        NOT: { phoneValidated: false, phoneValidatedAt: { not: null } }, // exclude invalid phones
      },
    });

    const MIN_CALLABLE = 50; // Only scrape when below this threshold
    if (callableCount >= MIN_CALLABLE) {
      logger.info(`[Apify] Skipping scrape — ${callableCount} callable prospects remaining (threshold: ${MIN_CALLABLE})`);
      return 0;
    }

    logger.info(`[Apify] Only ${callableCount} callable prospects left (< ${MIN_CALLABLE}) — starting scrape...`);
    let totalAdded = 0;

    for (const { niche, queries, cities } of SCRAPE_QUERIES) {
      for (const city of cities) {
        for (const query of queries) {
          try {
            const searchStr = `${query} ${city}`;
            logger.info(`[Apify] Scraping: "${searchStr}"`);

            const { country: cityCountry } = getCityMeta(city);
            const actorLang = cityCountry === 'US' ? 'en' : 'fr';
            const actorCountry = cityCountry.toLowerCase();

            const results = await this.runActor({
              searchStringsArray: [searchStr],
              language: actorLang,
              countryCode: actorCountry,
            });

            for (const item of results) {
              const phone = toE164(item.phone, cityCountry);
              if (!phone) continue;

              // Skip if phone already exists
              const existing = await prisma.prospect.findFirst({
                where: { phone },
              });
              if (existing) continue;

              // Derive city/state — US queries have "City ST" format; EU queries just "City"
              const [cityName, stateName] = (item.city && item.state)
                ? [item.city, item.state]
                : city.split(' ').reduce<[string, string]>((acc, part, i, arr) => {
                    if (i === arr.length - 1 && part.length === 2 && part === part.toUpperCase()) {
                      // Looks like a US state abbreviation (e.g. "TX")
                      acc[1] = part;
                    } else {
                      acc[0] = (acc[0] ? acc[0] + ' ' : '') + part;
                    }
                    return acc;
                  }, ['', '']);

              const resolvedCity = cityName || city;
              const { country: countryCode, timezone } = getCityMeta(resolvedCity);

              const priorityScore = prospectScoringService.computeScore({
                niche,
                googleRating: item.totalScore ?? null,
                reviewCount: item.reviewsCount ?? null,
                hasWebsite: !!item.website,
                state: stateName || null,
                city: resolvedCity,
                country: countryCode,
              });

              await prisma.prospect.create({
                data: {
                  businessName: item.title || 'Unknown',
                  businessType: niche,
                  niche,
                  phone,
                  address: item.address ?? null,
                  city: resolvedCity,
                  state: stateName || null,
                  country: countryCode,
                  website: item.website ?? null,
                  googleRating: item.totalScore ?? null,
                  googleReviewsCount: item.reviewsCount ?? null,
                  score: priorityScore,
                  priorityScore,
                  status: 'new',
                  eligibleForCall: true,
                  phoneValidated: false,
                  timezone,
                },
              });
              totalAdded++;
            }
          } catch (err: any) {
            if (err?.message === 'APIFY_BILLING_EXHAUSTED') {
              logger.error('[Apify] Billing exhausted — aborting all scraping. Recharge at https://console.apify.com/billing');
              return totalAdded;
            }
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
    const uniqueNiches = [...new Set(SCRAPE_QUERIES.map(n => n.niche))];
    const uniqueCities = [...new Set(SCRAPE_QUERIES.flatMap(n => n.cities))];
    await discordService.notifySystem(
      `🕷️ SCRAPING COMPLETE\n\nNew prospects: ${totalAdded}\nNiches: ${uniqueNiches.join(', ')}\nCities: ${uniqueCities.length} targeted`
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

  /**
   * On-demand targeted scrape — called from the admin campaign builder.
   * @param niches  Internal niche names (e.g. ['home_services', 'dental'])
   * @param cities  City names matching CITIES_COORDINATES keys (e.g. ['Paris', 'Houston TX'])
   * @param extraQueries  Optional extra keyword queries
   */
  async runCustomScrape(params: {
    niches: string[];
    cities: string[];
    extraQueries?: string[];
  }): Promise<{ added: number; skipped: number }> {
    if (!env.APIFY_API_KEY) {
      logger.warn('[Apify/Custom] APIFY_API_KEY not set');
      return { added: 0, skipped: 0 };
    }

    const NICHE_QUERIES: Record<string, string[]> = {
      home_services:  ['plombier', 'plumber', 'électricien', 'electrician', 'HVAC contractor', 'chauffagiste', 'serrurier', 'locksmith', 'couvreur', 'roofer'],
      dental:         ['dentiste', 'dentist', 'cabinet dentaire', 'orthodontiste', 'orthodontist'],
      auto:           ['garage automobile', 'auto repair shop', 'mécanicien auto', 'car mechanic', 'carrosserie', 'auto body'],
      medical:        ['médecin généraliste', 'family doctor', 'kinésithérapeute', 'chiropractor', 'ostéopathe', 'urgent care'],
      salon:          ['salon de coiffure', 'hair salon', 'institut de beauté', 'beauty salon', 'barbier', 'barbershop', 'nail salon'],
      veterinary:     ['vétérinaire', 'veterinarian', 'clinique vétérinaire', 'animal hospital'],
      law:            ['avocat', 'lawyer', 'attorney', 'cabinet d\'avocat', 'notaire'],
      restaurant:     ['restaurant', 'traiteur', 'catering', 'brasserie', 'pizzeria'],
      fitness:        ['salle de sport', 'gym', 'yoga studio', 'crossfit', 'personal trainer', 'coach sportif'],
      real_estate:    ['agence immobilière', 'real estate agent', 'agent immobilier', 'property management'],
      financial:      ['expert-comptable', 'tax accountant', 'comptable', 'insurance agency', 'courtier assurance'],
      childcare:      ['crèche', 'garderie', 'daycare', 'preschool', 'halte-garderie'],
      pet:            ['toilettage chien', 'dog grooming', 'pension chien', 'dog daycare', 'dog boarding'],
      hotel:          ['boutique hotel', 'hôtel', 'chambre d\'hôtes', 'bed and breakfast'],
      cleaning:       ['entreprise de nettoyage', 'house cleaning', 'cleaning service', 'nettoyage commercial'],
      funeral:        ['pompes funèbres', 'funeral home', 'cremation services'],
    };

    let added = 0;
    let skipped = 0;

    for (const niche of params.niches) {
      const baseQueries = NICHE_QUERIES[niche] ?? [niche];
      const queries = [...baseQueries, ...(params.extraQueries ?? [])];

      for (const city of params.cities) {
        const { country: countryCode, timezone } = getCityMeta(city);
        const actorLang = countryCode === 'US' ? 'en' : 'fr';
        const actorCountry = countryCode.toLowerCase();

        for (const query of queries.slice(0, 3)) { // max 3 queries per niche/city to control credits
          try {
            const searchStr = `${query} ${city}`;
            logger.info(`[Apify/Custom] Scraping: "${searchStr}"`);

            const results = await this.runActor({
              searchStringsArray: [searchStr],
              language: actorLang,
              countryCode: actorCountry,
            });

            for (const item of results) {
              const phone = toE164(item.phone, countryCode);
              if (!phone) { skipped++; continue; }

              const existing = await prisma.prospect.findFirst({ where: { phone } });
              if (existing) { skipped++; continue; }

              const resolvedCity = item.city || city;
              const priorityScore = prospectScoringService.computeScore({
                niche,
                googleRating: item.totalScore ?? null,
                reviewCount: item.reviewsCount ?? null,
                hasWebsite: !!item.website,
                city: resolvedCity,
                country: countryCode,
              });

              await prisma.prospect.create({
                data: {
                  businessName: item.title || 'Unknown',
                  businessType: niche,
                  niche,
                  phone,
                  address: item.address ?? null,
                  city: resolvedCity,
                  state: item.state ?? null,
                  country: countryCode,
                  website: item.website ?? null,
                  googleRating: item.totalScore ?? null,
                  googleReviewsCount: item.reviewsCount ?? null,
                  score: priorityScore,
                  priorityScore,
                  status: 'new',
                  eligibleForCall: true,
                  phoneValidated: false,
                  timezone,
                },
              });
              added++;
            }
          } catch (err: any) {
            if (err?.message === 'APIFY_BILLING_EXHAUSTED') {
              logger.error('[Apify/Custom] Billing exhausted — aborting');
              return { added, skipped };
            }
            logger.error(`[Apify/Custom] Error on "${query} ${city}":`, err);
          }
        }
      }
    }

    logger.info(`[Apify/Custom] Done: ${added} added, ${skipped} skipped`);
    await discordService.notifySystem(
      `🎯 CAMPAGNE PERSONNALISÉE\n\nNiches: ${params.niches.join(', ')}\nVilles: ${params.cities.join(', ')}\nAjoutés: ${added}`
    );

    return { added, skipped };
  }
}

export const apifyScrapingService = new ApifyScrapingService();
