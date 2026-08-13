import crypto from 'crypto';
import type { Request } from 'express';
import { env } from '../config/env';

/**
 * Verify the shared secret on inbound VAPI webhooks.
 *
 * When VAPI_WEBHOOK_SECRET is set, the `x-vapi-secret` header must match it
 * (constant-time compare, so the check does not leak the secret byte by byte).
 * When it is NOT set we fail CLOSED in production: an unconfigured secret must
 * never leave the endpoint open to spoofed call events. In development we stay
 * permissive so local testing without the secret still works.
 *
 * Une seule implémentation pour les trois surfaces (webhook outbound, webhook
 * réceptionniste, endpoint custom-LLM): trois copies identiques avaient déjà
 * divergé une fois par le simple passage du temps, et une vérification de
 * secret qui diverge est une vérification qui finit par manquer quelque part.
 */
export function isVapiWebhookAuthorized(req: Request): boolean {
  const expected = env.VAPI_WEBHOOK_SECRET;
  if (!expected) {
    return env.NODE_ENV !== 'production';
  }
  const provided = req.headers['x-vapi-secret'];
  if (typeof provided !== 'string' || provided.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
