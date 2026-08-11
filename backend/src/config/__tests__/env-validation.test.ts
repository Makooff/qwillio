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
    VAPI_WEBHOOK_SECRET: 'vapi_whsec_x',
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
    const { errors, warnings } = validateEnv(baseEnv({ STRIPE_SECRET_KEY: '' }));
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes('STRIPE_SECRET_KEY'))).toBe(true);
  });

  it('does not enforce secret rules outside production', () => {
    const { errors } = validateEnv(baseEnv({ NODE_ENV: 'development', JWT_SECRET: 'change-me-in-production' }));
    expect(errors).toEqual([]);
  });

  /* Ces deux clés provoquent des pannes MUETTES et totales: aucun appel traité,
     aucune inscription possible. Un démarrage refusé se voit dans Render, une
     production silencieusement inutile ne se voit nulle part. */
  it('refuse de démarrer sans VAPI_WEBHOOK_SECRET en production', () => {
    const { errors } = validateEnv(baseEnv({ VAPI_WEBHOOK_SECRET: '' }));
    expect(errors.some((e) => e.includes('VAPI_WEBHOOK_SECRET'))).toBe(true);
  });

  it('refuse de démarrer sans RESEND_API_KEY en production', () => {
    const { errors } = validateEnv(baseEnv({ RESEND_API_KEY: '' }));
    expect(errors.some((e) => e.includes('RESEND_API_KEY'))).toBe(true);
  });

  it('ALLOW_DEGRADED_BOOT fait redescendre ces deux points en avertissements', () => {
    // La soupape: un oubli ne doit jamais immobiliser un déploiement d'urgence.
    const { errors, warnings } = validateEnv(
      baseEnv({ VAPI_WEBHOOK_SECRET: '', RESEND_API_KEY: '', ALLOW_DEGRADED_BOOT: '1' }),
    );
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes('VAPI_WEBHOOK_SECRET'))).toBe(true);
    expect(warnings.some((w) => w.includes('RESEND_API_KEY'))).toBe(true);
  });
});
