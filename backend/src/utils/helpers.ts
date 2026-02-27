import { ProspectScoreFactors } from '../types';

// ═══════════════════════════════════════════════════════════
// 22-POINT PRIORITY SCORING SYSTEM
// ═══════════════════════════════════════════════════════════
// Niche (0-5) + Country (0-3) + Rating (0-4) + Reviews (0-3)
// + Website (0-2) + Phone (0-2) + Phone Validated (0-1) + Size Bonus (0-2) = 22 max
// ═══════════════════════════════════════════════════════════

const NICHE_SCORES: Record<string, number> = {
  dental: 5, medical: 5,
  law: 4,
  salon: 3,
  restaurant: 3,
  hotel: 2,
  auto: 2,
  service: 1,
  ecommerce: 1,
  other: 1,
};

const COUNTRY_SCORES: Record<string, number> = {
  US: 3,
  BE: 3,
  FR: 2,
  CA: 2,
  UK: 2,
};

export const NICHE_PRIORITY_ORDER: Record<string, number> = {
  dental: 6, medical: 6,
  law: 5,
  salon: 4,
  restaurant: 3,
  hotel: 2,
  auto: 1,
  service: 0,
  other: 0,
};

export function calculateProspectScore(factors: ProspectScoreFactors): number {
  let score = 0;

  // Niche (0-5)
  score += NICHE_SCORES[factors.businessType] ?? 1;

  // Country (0-3)
  score += COUNTRY_SCORES[factors.country || 'US'] ?? 1;

  // Google Rating (0-4)
  if (factors.rating) {
    if (factors.rating >= 4.5) score += 4;
    else if (factors.rating >= 4.0) score += 3;
    else if (factors.rating >= 3.5) score += 2;
    else score += 1;
  }

  // Reviews (0-3)
  if (factors.reviewsCount) {
    if (factors.reviewsCount >= 100) score += 3;
    else if (factors.reviewsCount >= 50) score += 2;
    else if (factors.reviewsCount >= 10) score += 1;
  }

  // Website (0-2)
  if (factors.hasWebsite) score += 2;

  // Phone (0-2)
  if (factors.hasPhone) score += 2;

  // Phone Validated bonus (0-1)
  if (factors.phoneValidated) score += 1;

  // Business Size Bonus (0-2) — estimated from reviews + rating combo
  if (factors.reviewsCount && factors.rating) {
    if (factors.reviewsCount >= 50 && factors.rating >= 4.0) score += 2;
    else if (factors.reviewsCount >= 20 && factors.rating >= 3.5) score += 1;
  }

  return Math.min(score, 22);
}

export function recommendPackage(interestLevel: number, dailyCallVolume: number | null): string {
  if (dailyCallVolume && dailyCallVolume >= 50) return 'enterprise';
  if (dailyCallVolume && dailyCallVolume >= 20) return 'pro';
  if (interestLevel >= 8) return 'pro';
  return 'basic';
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function isWithinBusinessHours(startHour: number, endHour: number, days: number[]): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  return days.includes(day) && hour >= startHour && hour < endHour;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
