import { describe, it, expect } from 'vitest';
import { twoProportionZTest } from '../statistics';

/**
 * One-sided two-proportion z-test: is variant (B) significantly BETTER than
 * baseline (A)? Used to gate script-mutation promotion so noise on small
 * samples can't lock a change into the live sales script.
 */
describe('twoProportionZTest', () => {
  it('flags a clear, well-powered improvement as significant', () => {
    // 10% -> 20% over 100 calls each. Textbook z ≈ 1.98, one-sided p ≈ 0.024.
    const r = twoProportionZTest(10, 100, 20, 100);
    expect(r.zScore).toBeGreaterThan(1.9);
    expect(r.zScore).toBeLessThan(2.1);
    expect(r.pValue).toBeLessThan(0.05);
    expect(r.significant).toBe(true);
  });

  it('does not flag identical proportions', () => {
    const r = twoProportionZTest(20, 100, 20, 100);
    expect(r.zScore).toBeCloseTo(0, 5);
    expect(r.pValue).toBeCloseTo(0.5, 2);
    expect(r.significant).toBe(false);
  });

  it('does not flag a tiny-sample "improvement" (noise)', () => {
    // 1/3 -> 2/3 looks big but is statistically meaningless.
    const r = twoProportionZTest(1, 3, 2, 3);
    expect(r.pValue).toBeGreaterThan(0.05);
    expect(r.significant).toBe(false);
  });

  it('never flags a worse variant as significant (one-sided)', () => {
    const r = twoProportionZTest(30, 100, 10, 100);
    expect(r.zScore).toBeLessThan(0);
    expect(r.significant).toBe(false);
  });

  it('is safe with empty samples', () => {
    expect(twoProportionZTest(0, 0, 5, 50)).toMatchObject({ significant: false });
    expect(twoProportionZTest(5, 50, 0, 0)).toMatchObject({ significant: false });
  });

  it('handles the degenerate all-zero / all-one case without NaN', () => {
    const zero = twoProportionZTest(0, 50, 0, 50);
    expect(Number.isNaN(zero.zScore)).toBe(false);
    expect(zero.significant).toBe(false);
  });

  it('respects a stricter alpha', () => {
    // borderline case significant at 0.05 but not at 0.01
    const lenient = twoProportionZTest(10, 100, 20, 100, 0.05);
    const strict = twoProportionZTest(10, 100, 20, 100, 0.01);
    expect(lenient.significant).toBe(true);
    expect(strict.significant).toBe(false);
  });
});
