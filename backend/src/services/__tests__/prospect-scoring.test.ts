import { describe, it, expect } from 'vitest';
import { prospectScoringService } from '../prospect-scoring.service';

/**
 * Unit tests for the deterministic priority scoring (`computeScore`).
 * This is the gate that decides which prospects get called, so its
 * arithmetic must stay stable across refactors.
 */
describe('ProspectScoringService.computeScore', () => {
  it('gives the baseline eligibility bonus (+1) to an empty prospect', () => {
    expect(prospectScoringService.computeScore({})).toBe(1);
  });

  it('caps the total at 22 even for a maximally-attractive prospect', () => {
    const score = prospectScoringService.computeScore({
      niche: 'plumber',          // +8
      googleRating: 4.8,         // +3
      reviewCount: 120,          // +2 (>=50) +2 (>=30)
      hasWebsite: true,          // +2
      state: 'Île-de-France',    // +2
      country: 'FR',             // +2
      city: 'Paris',             // +1
    });                          // +1 baseline => 23 -> capped
    expect(score).toBe(22);
  });

  it('normalizes niche labels (case + spaces/hyphens) before lookup', () => {
    // "Home Services" -> "home_services" -> 8 pts, + baseline
    expect(prospectScoringService.computeScore({ niche: 'Home Services' })).toBe(9);
    expect(prospectScoringService.computeScore({ niche: 'Home-Services' })).toBe(9);
  });

  it('falls back to business-name matching when the niche is unknown', () => {
    const score = prospectScoringService.computeScore({
      niche: null,
      businessName: "Joe's Plumbing LLC", // matches "plumb" => +8
    });
    expect(score).toBe(9); // 8 + baseline
  });

  it('does not double-count niche points when niche is already known', () => {
    // Known niche scores via the map; the name fallback must NOT also fire.
    const score = prospectScoringService.computeScore({
      niche: 'plumber',
      businessName: 'Plumbing Plumbing Plumbing',
    });
    // 8 (niche) + 1 (baseline) = 9, not 16
    expect(score).toBe(9);
  });

  it('awards the high-priority country bonus only for FR/BE (US default gets none)', () => {
    const fr = prospectScoringService.computeScore({ country: 'FR' });
    const us = prospectScoringService.computeScore({ country: 'US' });
    const noCountry = prospectScoringService.computeScore({});
    expect(fr).toBe(3);       // +2 country +1 baseline
    expect(us).toBe(1);       // baseline only
    expect(noCountry).toBe(1); // defaults to US internally
  });

  it('rewards solo-operator heuristic (few reviews, decent rating)', () => {
    const score = prospectScoringService.computeScore({
      reviewCount: 10, // <20
      googleRating: 4.2, // >=4.0 and <4.5
    });
    // +1 (solo heuristic) + 1 baseline = 2
    expect(score).toBe(2);
  });

  it('always returns a value within the documented 0..22 range', () => {
    const inputs = [
      {},
      { niche: 'unknown_niche_xyz' },
      { googleRating: 5, reviewCount: 9999, hasWebsite: true, niche: 'roofing', country: 'BE', city: 'Bruxelles', state: 'Hainaut' },
      { businessName: '   ' },
    ];
    for (const input of inputs) {
      const score = prospectScoringService.computeScore(input);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(22);
    }
  });
});
