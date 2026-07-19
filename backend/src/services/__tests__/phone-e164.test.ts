import { describe, it, expect } from 'vitest';
import { toE164 } from '../apify-scraping.service';

describe('toE164 — country-aware E.164 normalization', () => {
  it('normalizes Belgian national landline to +32 (not +1)', () => {
    expect(toE164('02 345 67 89', 'BE')).toBe('+3223456789');
  });

  it('normalizes Belgian mobile to +32', () => {
    expect(toE164('0470 12 34 56', 'BE')).toBe('+32470123456');
  });

  it('normalizes French national landline to +33 (not +1)', () => {
    expect(toE164('01 23 45 67 89', 'FR')).toBe('+33123456789');
  });

  it('normalizes French mobile to +33', () => {
    expect(toE164('06 12 34 56 78', 'FR')).toBe('+33612345678');
  });

  it('keeps an already-international +33 number', () => {
    expect(toE164('+33 1 23 45 67 89', 'FR')).toBe('+33123456789');
  });

  it('handles a 00 international prefix', () => {
    expect(toE164('0032 470 12 34 56', 'BE')).toBe('+32470123456');
  });

  it('still handles US 10-digit numbers when country is US', () => {
    expect(toE164('(415) 555-0132', 'US')).toBe('+14155550132');
  });

  it('does NOT guess +1 on an ambiguous national number with unknown country', () => {
    expect(toE164('01 23 45 67 89')).toBeNull();
  });

  it('returns null for empty/garbage input', () => {
    expect(toE164('', 'FR')).toBeNull();
    expect(toE164(null, 'BE')).toBeNull();
    expect(toE164('abc', 'FR')).toBeNull();
  });
});
