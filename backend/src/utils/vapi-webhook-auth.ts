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

/**
 * Le jeton de CHEMIN du point de terminaison custom-LLM d'un client.
 *
 * Les événements serveur portent `x-vapi-secret` parce que le bloc `server`
 * de l'assistant le déclare (`webhookServer`). Le bloc `model` d'un custom-LLM
 * n'a pas d'en-têtes: ce que Vapi envoie sur CE chemin dépend d'un réglage
 * hors du dépôt, et le premier appel réel sur un assistant enregistré en
 * custom-LLM (13/09) a raccroché juste après l'accueil, ce qui est la forme
 * exacte d'un 401 sur le premier tour de modèle. Le secret voyage donc AUSSI
 * dans l'URL, dérivé par client, et l'URL n'est connue que de Vapi: même
 * confidentialité qu'un en-tête, sans dépendre d'un écran de tableau de bord.
 */
export function customLlmPathToken(clientId: string, secret: string = env.VAPI_WEBHOOK_SECRET): string | null {
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(`custom-llm:${clientId}`).digest('hex').slice(0, 32);
}

/** L'en-tête OU le jeton de chemin: les deux formes que Vapi peut porter. */
export function isCustomLlmAuthorized(req: Request, clientId: string, secret: string = env.VAPI_WEBHOOK_SECRET): boolean {
  // Sans secret configuré: la même règle que les webhooks (ouvert hors production).
  if (!secret) return env.NODE_ENV !== 'production';
  const header = req.headers['x-vapi-secret'];
  if (typeof header === 'string' && header.length === secret.length && crypto.timingSafeEqual(Buffer.from(header), Buffer.from(secret))) {
    return true;
  }
  const expected = customLlmPathToken(clientId, secret)!;
  const provided = (req.params as Record<string, string | undefined>)?.token;
  if (typeof provided !== 'string' || provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
