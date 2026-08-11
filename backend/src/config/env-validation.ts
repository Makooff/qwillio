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
  VAPI_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  /** Soupape: laisse démarrer malgré les manques ci-dessous. Voir plus bas. */
  ALLOW_DEGRADED_BOOT?: string;
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

  /* ── Erreurs — sans ces deux clés, le produit ne rend AUCUN service ──
     Elles étaient de simples avertissements, et les deux pannes qu'elles
     provoquent sont muettes: sans VAPI_WEBHOOK_SECRET, tous les webhooks Vapi
     répondent 401 et pas un appel n'est traité; sans RESEND_API_KEY, l'email de
     vérification ne part pas et l'inscrit reste bloqué sur /verify-email pour
     toujours. Un serveur qui ne peut ni répondre au téléphone ni inscrire
     personne ne doit pas se déclarer prêt: il vaut mieux un démarrage refusé,
     visible dans Render, qu'une production silencieusement inutile. */
  const degradedAllowed = e.ALLOW_DEGRADED_BOOT === '1' || e.ALLOW_DEGRADED_BOOT === 'true';
  /* La soupape existe pour qu'un oubli ne puisse jamais immobiliser un déploiement
     d'urgence: poser ALLOW_DEGRADED_BOOT=1 dans Render fait redescendre ces deux
     points en avertissements. Sans elle, un correctif sans rapport deviendrait
     impossible à livrer un jour de panne. */
  const blocking = degradedAllowed ? warnings : errors;

  if (!e.VAPI_WEBHOOK_SECRET) {
    blocking.push(
      'VAPI_WEBHOOK_SECRET is missing in production — /api/webhooks/vapi would reject every ' +
        'event (401) and no call would ever be answered. Set the same secret here and in the ' +
        'VAPI dashboard webhook settings.',
    );
  }
  if (!e.RESEND_API_KEY) {
    blocking.push(
      'RESEND_API_KEY is missing in production — no verification or welcome email can be sent, ' +
        'so every new signup stays stuck on /verify-email.',
    );
  }

  // ── Warnings — money-critical features fail silently if unset ──
  const moneyCritical: Array<[string, string]> = [
    ['STRIPE_SECRET_KEY', e.STRIPE_SECRET_KEY],
    ['STRIPE_WEBHOOK_SECRET', e.STRIPE_WEBHOOK_SECRET],
    ['VAPI_PRIVATE_KEY', e.VAPI_PRIVATE_KEY],
  ];
  for (const [key, value] of moneyCritical) {
    if (!value) warnings.push(`${key} is empty — the related feature will silently fail in production.`);
  }

  return { errors, warnings };
}
