/**
 * Lightweight statistics helpers (no external deps).
 */

export interface ZTestResult {
  /** Test statistic. Positive = variant better than baseline. */
  zScore: number;
  /** One-sided p-value: probability the variant looks this good by chance. */
  pValue: number;
  /** True only when the variant is significantly better (pValue < alpha). */
  significant: boolean;
}

/** Error function — Abramowitz & Stegun 7.1.26 (max error ~1.5e-7). */
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax));
  return sign * y;
}

/** Standard normal cumulative distribution function. */
function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * One-sided two-proportion z-test asking: is B (variant) significantly BETTER
 * than A (baseline)? Uses the pooled-variance form.
 *
 * Returns `significant: true` only when the variant beats the baseline at the
 * given alpha — so an inconclusive or worse result is never treated as a win.
 */
export function twoProportionZTest(
  successesA: number,
  nA: number,
  successesB: number,
  nB: number,
  alpha = 0.05,
): ZTestResult {
  if (nA <= 0 || nB <= 0) {
    return { zScore: 0, pValue: 1, significant: false };
  }

  const pA = successesA / nA;
  const pB = successesB / nB;
  const pooled = (successesA + successesB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));

  // No variance (all conversions or none on both sides) -> no detectable effect.
  if (se === 0) {
    return { zScore: 0, pValue: 1, significant: false };
  }

  const zScore = (pB - pA) / se;
  const pValue = 1 - normalCdf(zScore);

  return { zScore, pValue, significant: pValue < alpha && zScore > 0 };
}
