/**
 * Prospect Priority Scoring System — 0 to 22 points
 * Only prospects with score >= MIN_PRIORITY_SCORE (default 10) are called.
 * Also includes predictive scoring derived from AgentAction conversion data.
 */
import { env } from '../config/env';

// ─── High-search-volume cities (bonus +1 pt) ─────────────
const HIGH_VOLUME_CITIES = new Set([
  // US
  'Houston', 'Dallas', 'Los Angeles', 'Miami', 'Atlanta',
  'Phoenix', 'San Antonio', 'San Diego', 'Orlando', 'Tampa',
  'Austin', 'Charlotte', 'Nashville', 'Las Vegas', 'Denver',
  'Minneapolis', 'Seattle', 'Boston', 'Chicago', 'New York',
  'Philadelphia', 'Jacksonville', 'Fort Worth', 'Columbus', 'Indianapolis',
  // France
  'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice',
  'Nantes', 'Montpellier', 'Bordeaux', 'Lille', 'Strasbourg',
  // Belgique
  'Bruxelles', 'Liège', 'Charleroi', 'Namur', 'Mons',
]);

// ─── Niche point map (max 8pts) ──────────────────────────
// Ranked by: call-to-close rate × avg deal value × inbound call dependency
const NICHE_POINTS: Record<string, number> = {
  // 8pts — Highest inbound dependency, strong urgency, solo operators
  home_services: 8,
  plumber: 8,
  hvac: 8,
  electrician: 8,
  roofing: 8,
  locksmith: 8,
  // 7pts — High-value recurring, appointment-driven
  dental: 7,
  dentist: 7,
  orthodontist: 7,
  // 6pts — Strong phone dependency, recurring revenue
  auto: 6,
  auto_garage: 6,
  garage: 6,
  car_repair: 6,
  veterinary: 6,
  vet: 6,
  // 5pts — Moderate phone volume, consistent conversion
  medical: 5,
  urgent_care: 5,
  chiropractor: 5,
  physical_therapy: 5,
  hair_salon: 5,
  salon: 5,
  beauty: 5,
  barbershop: 5,
  law: 5,
  law_firm: 5,
  lawyer: 5,
  attorney: 5,
  // 4pts — Phone still relevant but more online booking
  financial: 4,
  accounting: 4,
  insurance: 4,
  real_estate: 4,
  fitness: 4,
  gym: 4,
  yoga: 4,
  childcare: 4,
  daycare: 4,
  pet: 4,
  // 3pts — Seasonal or lower urgency
  restaurant: 3,
  catering: 3,
  creative: 3,
  photographer: 3,
  florist: 3,
  retail: 3,
  cleaning: 3,
  travel: 3,
  // 2pts — Low call dependency or very competitive
  hotel: 2,
  boutique_hotel: 2,
  funeral: 2,
};

// States / regions with highest small-business density (+2 pts)
const HIGH_PRIORITY_STATES = new Set([
  // US states
  'TX', 'FL', 'GA', 'NC', 'TN', 'AZ', 'NV', 'CO',
  'Texas', 'Florida', 'Georgia', 'North Carolina', 'Tennessee',
  'Arizona', 'Nevada', 'Colorado',
  // France — regions with highest SME density
  'Île-de-France', 'Auvergne-Rhône-Alpes', 'Provence-Alpes-Côte d\'Azur',
  'Occitanie', 'Nouvelle-Aquitaine', 'Hauts-de-France',
  // Belgique — provinces francophones
  'Hainaut', 'Liège', 'Namur', 'Brabant wallon', 'Luxembourg',
  'Bruxelles-Capitale',
]);

// Countries where all prospects get +2 pts (high-priority markets)
const HIGH_PRIORITY_COUNTRIES = new Set(['FR', 'BE']);

interface ScoreInput {
  niche?: string | null;
  googleRating?: number | null;
  reviewCount?: number | null;
  hasWebsite?: boolean;
  state?: string | null;
  city?: string | null;
  country?: string | null;
  businessName?: string | null;
}

// ─── Predictive scoring cache ────────────────────────────
interface WeightCache {
  weights: Record<string, number>;
  builtAt: number; // epoch ms
}

// Minimum AgentAction rows before predictive scoring kicks in
const MIN_AGENT_ACTIONS = 30;
// Cache TTL: 24h in ms
const WEIGHT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function binReviewCount(count: number): string {
  if (count <= 20) return 'reviews_0_20';
  if (count <= 100) return 'reviews_21_100';
  return 'reviews_100plus';
}

function binRating(rating: number): string {
  if (rating < 4) return 'rating_lt4';
  if (rating < 4.5) return 'rating_4_45';
  return 'rating_45plus';
}

export class ProspectScoringService {
  private _weightCache: WeightCache | null = null;

  computeScore(input: ScoreInput): number {
    let score = 0;

    // ─── Business signals (max 10pts) ─────────────────────
    if (input.googleRating != null && input.googleRating >= 4.5) score += 3;
    if (input.reviewCount != null && input.reviewCount >= 50) score += 2;
    if (input.hasWebsite) score += 2;
    // Busy hours pattern: approximate via high review count (popular = busy)
    if (input.reviewCount != null && input.reviewCount >= 30) score += 2;
    // Solo operator: heuristic — businesses with few reviews but decent rating
    if (
      input.reviewCount != null && input.reviewCount < 20 &&
      input.googleRating != null && input.googleRating >= 4.0
    ) score += 1;

    // ─── Niche signals (max 8pts) ─────────────────────────
    const niche = (input.niche ?? '').toLowerCase().replace(/[\s-]/g, '_');
    const nicheScore = NICHE_POINTS[niche] ?? 0;
    score += nicheScore;

    // If niche itself is zero, try matching by business name
    if (nicheScore === 0 && input.businessName) {
      const name = input.businessName.toLowerCase();
      if (name.includes('plumb')) score += 8;
      else if (name.includes('hvac') || name.includes('heat') || name.includes('cool') || name.includes('air cond')) score += 8;
      else if (name.includes('electric')) score += 8;
      else if (name.includes('roof')) score += 8;
      else if (name.includes('locksmith')) score += 8;
      else if (name.includes('dent') || name.includes('ortho')) score += 7;
      else if (name.includes('garage') || name.includes('auto repair') || name.includes('mechanic')) score += 6;
      else if (name.includes('vet') || name.includes('animal') || name.includes('pet clinic')) score += 6;
      else if (name.includes('chiro') || name.includes('physical therapy') || name.includes('urgent care')) score += 5;
      else if (name.includes('salon') || name.includes('hair') || name.includes('beauty') || name.includes('barber')) score += 5;
      else if (name.includes('law') || name.includes('attorney') || name.includes('legal')) score += 5;
      else if (name.includes('gym') || name.includes('fitness') || name.includes('yoga') || name.includes('crossfit')) score += 4;
      else if (name.includes('daycare') || name.includes('preschool') || name.includes('child care')) score += 4;
      else if (name.includes('insur') || name.includes('accountant') || name.includes('tax') || name.includes('cpa')) score += 4;
      else if (name.includes('real estate') || name.includes('realty') || name.includes('realtor')) score += 4;
    }

    // ─── Geo signals (max 4pts) ───────────────────────────
    const state = (input.state ?? '').trim();
    if (HIGH_PRIORITY_STATES.has(state)) score += 2;

    const country = (input.country ?? 'US').trim().toUpperCase();
    if (HIGH_PRIORITY_COUNTRIES.has(country)) score += 2;

    const city = (input.city ?? '').split(',')[0].trim();
    if (HIGH_VOLUME_CITIES.has(city)) score += 1;

    // Default eligibility bonus (+1)
    score += 1;

    return Math.min(score, 22);
  }

  /**
   * Build lift-based predictive weights from the last 500 AgentAction rows
   * that have a conversion or rejection outcome. Cached for 24h in memory.
   */
  async buildPredictiveWeights(): Promise<Record<string, number>> {
    const now = Date.now();
    if (this._weightCache && now - this._weightCache.builtAt < WEIGHT_CACHE_TTL_MS) {
      return this._weightCache.weights;
    }

    const { prisma } = await import('../config/database');

    const actions = await prisma.agentAction.findMany({
      where: { outcome: { in: ['converted', 'rejected'] } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { outcome: true, features: true, niche: true },
    });

    const converted = actions.filter(a => a.outcome === 'converted');
    const rejected = actions.filter(a => a.outcome === 'rejected');
    const totalConverted = converted.length;
    const totalRejected = rejected.length;

    if (totalConverted === 0 || totalRejected === 0) {
      this._weightCache = { weights: {}, builtAt: now };
      return {};
    }

    // Feature extraction from action record
    const extractFeatures = (action: { niche: string | null; features: unknown }): string[] => {
      const keys: string[] = [];
      if (action.niche) keys.push(`niche:${action.niche.toLowerCase()}`);

      const f = action.features as Record<string, unknown> | null;
      if (!f || typeof f !== 'object') return keys;

      if (typeof f['city'] === 'string') keys.push(`city:${f['city'].toLowerCase()}`);
      if (typeof f['country'] === 'string') keys.push(`country:${f['country'].toUpperCase()}`);
      if (typeof f['hasWebsite'] === 'boolean') keys.push(`hasWebsite:${f['hasWebsite']}`);

      const rc = typeof f['reviewCount'] === 'number' ? f['reviewCount'] : null;
      if (rc !== null) keys.push(binReviewCount(rc));

      const rt = typeof f['rating'] === 'number' ? f['rating'] : null;
      if (rt !== null) keys.push(binRating(rt));

      if (typeof f['callAttempts'] === 'number') keys.push(`callAttempts:${f['callAttempts']}`);

      return keys;
    };

    // Count occurrences per feature in each group
    const countMap = (group: typeof actions): Map<string, number> => {
      const map = new Map<string, number>();
      for (const action of group) {
        for (const key of extractFeatures(action)) {
          map.set(key, (map.get(key) ?? 0) + 1);
        }
      }
      return map;
    };

    const convertedCounts = countMap(converted);
    const rejectedCounts = countMap(rejected);

    const weights: Record<string, number> = {};
    for (const [key, cCount] of convertedCounts.entries()) {
      const rCount = rejectedCounts.get(key) ?? 0;
      const convRate = cCount / totalConverted;
      const rejRate = rCount > 0 ? rCount / totalRejected : 0.001;
      const lift = convRate / rejRate;
      if (lift > 1.5) {
        weights[key] = lift;
      }
    }

    this._weightCache = { weights, builtAt: now };
    return weights;
  }

  /**
   * Compute a 0-100 predictive score for a prospect based on AgentAction lift weights.
   */
  async computePredictiveScore(prospect: {
    niche?: string | null;
    city?: string | null;
    country?: string;
    googleRating?: number | null;
    googleReviewsCount?: number | null;
    website?: string | null;
    callAttempts?: number;
  }): Promise<number> {
    const weights = await this.buildPredictiveWeights();
    if (Object.keys(weights).length === 0) return 50;

    const featureKeys: string[] = [];
    if (prospect.niche) featureKeys.push(`niche:${prospect.niche.toLowerCase()}`);
    if (prospect.city) featureKeys.push(`city:${prospect.city.toLowerCase()}`);
    if (prospect.country) featureKeys.push(`country:${prospect.country.toUpperCase()}`);
    featureKeys.push(`hasWebsite:${!!prospect.website}`);
    if (prospect.googleReviewsCount != null) featureKeys.push(binReviewCount(prospect.googleReviewsCount));
    if (prospect.googleRating != null) featureKeys.push(binRating(prospect.googleRating));
    if (prospect.callAttempts != null) featureKeys.push(`callAttempts:${prospect.callAttempts}`);

    let total = 0;
    let matched = 0;
    for (const key of featureKeys) {
      if (weights[key] !== undefined) {
        total += weights[key];
        matched++;
      }
    }

    if (matched === 0) return 50;

    // Normalize: lift of 1.5 → ~50, lift of 3+ → ~100
    const avgLift = total / matched;
    const normalized = Math.min(100, Math.round(((avgLift - 1) / 2) * 100));
    return Math.max(0, normalized);
  }

  /** Re-score a batch of prospects that have score=0 */
  async rescoreUnscored(limit = 500): Promise<number> {
    const { prisma } = await import('../config/database');
    const prospects = await prisma.prospect.findMany({
      where: { priorityScore: 0 },
      take: limit,
      select: {
        id: true,
        niche: true,
        businessType: true,
        googleRating: true,
        googleReviewsCount: true,
        website: true,
        state: true,
        city: true,
        country: true,
        businessName: true,
      },
    });

    let updated = 0;
    for (const p of prospects) {
      const newScore = this.computeScore({
        niche: p.niche ?? p.businessType,
        googleRating: p.googleRating,
        reviewCount: p.googleReviewsCount,
        hasWebsite: !!p.website,
        state: p.state,
        city: p.city,
        country: p.country,
        businessName: p.businessName,
      });

      if (newScore > 0) {
        await prisma.prospect.update({
          where: { id: p.id },
          data: { priorityScore: newScore, score: newScore },
        });
        updated++;
      }
    }

    return updated;
  }
}

export const prospectScoringService = new ProspectScoringService();
