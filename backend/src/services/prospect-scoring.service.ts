/**
 * Prospect Priority Scoring System — 0 to 22 points
 * Only prospects with score >= MIN_PRIORITY_SCORE (default 10) are called.
 */
import { env } from '../config/env';

// ─── High-search-volume cities ────────────────────────────
const HIGH_VOLUME_CITIES = new Set([
  'Houston', 'Dallas', 'Los Angeles', 'Miami', 'Atlanta',
  'Phoenix', 'San Antonio', 'San Diego', 'Orlando', 'Tampa',
]);

// ─── Niche point map (max 8pts) ──────────────────────────
const NICHE_POINTS: Record<string, number> = {
  home_services: 8,
  plumber: 8,
  hvac: 8,
  electrician: 8,
  dental: 7,
  dentist: 7,
  auto_garage: 6,
  garage: 6,
  hair_salon: 5,
  salon: 5,
  law_firm: 5,
  lawyer: 5,
  attorney: 5,
  restaurant: 4,
  hotel: 3,
  boutique_hotel: 3,
};

const HIGH_PRIORITY_STATES = new Set(['TX', 'FL', 'Texas', 'Florida']);

interface ScoreInput {
  niche?: string | null;
  googleRating?: number | null;
  reviewCount?: number | null;
  hasWebsite?: boolean;
  state?: string | null;
  city?: string | null;
  businessName?: string | null;
}

export class ProspectScoringService {
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
      else if (name.includes('hvac') || name.includes('heat') || name.includes('cool') || name.includes('air')) score += 8;
      else if (name.includes('electric')) score += 8;
      else if (name.includes('dent')) score += 7;
      else if (name.includes('garage') || name.includes('auto')) score += 6;
      else if (name.includes('salon') || name.includes('hair') || name.includes('beauty')) score += 5;
      else if (name.includes('law') || name.includes('attorney') || name.includes('legal')) score += 5;
    }

    // ─── Timing signals (max 4pts) ────────────────────────
    const state = (input.state ?? '').trim();
    if (HIGH_PRIORITY_STATES.has(state)) score += 2;

    const city = (input.city ?? '').split(',')[0].trim();
    if (HIGH_VOLUME_CITIES.has(city)) score += 1;

    // Business age: skip (not available from Maps scraping), give +1 as default for eligible
    score += 1;

    return Math.min(score, 22);
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
