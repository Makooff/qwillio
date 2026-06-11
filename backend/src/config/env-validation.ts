/**
 * Boot-time environment validation.
 *
 * Pure function (no side effects) so it is unit-testable. `env.ts` calls it on
 * import and crashes the process when a production deploy is missing a secret
 * that would otherwise fail silently or, worse, leave auth tokens forgeable.
 */

interface EnvLike {
  NODE_ENV: string;
  JWT_SECRET: string;
  DATABASE_URL: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  VAPI_PRIVATE_KEY: string;
  RESEND_API_KEY: string;
}

const DEFAULT_JWT_SECRET = 'change-me-in-production';

export function validateEnv(e: EnvLike): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = e.NODE_ENV === 'production';

  if (!isProd) return { errors, warnings };

  // ── Hard errors — refuse to boot ──────────────────────────────
  if (!e.JWT_SECRET || e.JWT_SECRET === DEFAULT_JWT_SECRET || e.JWT_SECRET.length < 32) {
    errors.push(
      'JWT_SECRET is missing, the public default, or shorter than 32 chars in production. ' +
        'Auth tokens would be forgeable — set a strong random JWT_SECRET on the host.',
    );
  }
  if (!e.DATABASE_URL) {
    errors.push('DATABASE_URL is not set in production.');
  }

  // ── Warnings — money-critical features fail silently if unset ──
  const moneyCritical: Array<[string, string]> = [
    ['STRIPE_SECRET_KEY', e.STRIPE_SECRET_KEY],
    ['STRIPE_WEBHOOK_SECRET', e.STRIPE_WEBHOOK_SECRET],
    ['VAPI_PRIVATE_KEY', e.VAPI_PRIVATE_KEY],
    ['RESEND_API_KEY', e.RESEND_API_KEY],
  ];
  for (const [key, value] of moneyCritical) {
    if (!value) warnings.push(`${key} is empty — the related feature will silently fail in production.`);
  }

  return { errors, warnings };
}
