import { describe, it, expect } from 'vitest';
import { validateEnv } from '../env-validation';

// Minimal shape the validator inspects — keeps the test independent of the
// full env object so we can exercise prod vs dev branches deterministically.
function baseEnv(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(48),
    DATABASE_URL: 'postgres://user:pass@host/db',
    STRIPE_SECRET_KEY: 'sk_live_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
    VAPI_PRIVATE_KEY: 'vapi_x',
    RESEND_API_KEY: 're_x',
    ...overrides,
  } as any;
}

describe('validateEnv — production secret guards', () => {
  it('flags the default JWT_SECRET as a hard error in production', () => {
    const { errors } = validateEnv(baseEnv({ JWT_SECRET: 'change-me-in-production' }));
    expect(errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
  });

  it('flags a too-short JWT_SECRET as a hard error in production', () => {
    const { errors } = validateEnv(baseEnv({ JWT_SECRET: 'short' }));
    expect(errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
  });

  it('flags a missing DATABASE_URL as a hard error in production', () => {
    const { errors } = validateEnv(baseEnv({ DATABASE_URL: '' }));
    expect(errors.some((e) => e.includes('DATABASE_URL'))).toBe(true);
  });

  it('passes with a strong JWT_SECRET and all critical keys set', () => {
    const { errors } = validateEnv(baseEnv());
    expect(errors).toEqual([]);
  });

  it('warns (not errors) when money-critical keys are empty in production', () => {
    const { errors, warnings } = validateEnv(baseEnv({ STRIPE_SECRET_KEY: '', RESEND_API_KEY: '' }));
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes('STRIPE_SECRET_KEY'))).toBe(true);
    expect(warnings.some((w) => w.includes('RESEND_API_KEY'))).toBe(true);
  });

  it('does not enforce secret rules outside production', () => {
    const { errors } = validateEnv(baseEnv({ NODE_ENV: 'development', JWT_SECRET: 'change-me-in-production' }));
    expect(errors).toEqual([]);
  });
});
