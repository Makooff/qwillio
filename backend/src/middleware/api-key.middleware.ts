import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { hashApiKey } from '../utils/api-key-hash';

/**
 * Authentification de l'API publique par clé.
 *
 * « Accès API complet » était vendu sur le forfait Enterprise alors qu'aucune
 * route ne lisait de clé: il n'existait tout simplement pas d'API. Ce
 * middleware ouvre la porte, et la garde:
 *
 *   - la clé voyage dans `X-API-Key` ou dans `Authorization: Bearer`. Les deux
 *     conventions circulent, en refuser une n'apporte rien;
 *   - une clé expirée vaut une clé inconnue. Même réponse, même délai, aucune
 *     indication de laquelle des deux, sinon on renseigne l'attaquant;
 *   - le client est résolu depuis le propriétaire de la clé, et l'accès est
 *     réservé au forfait Enterprise, qui est celui qui l'annonce.
 *
 * Le modèle `ApiKey` existait déjà (il sert aux agences): rien de nouveau en
 * base. Réserve connue, à traiter à part: la clé y est stockée en clair. Ce
 * middleware ne l'aggrave pas mais ne la corrige pas non plus, une bascule vers
 * un condensat demande une migration et une rotation des clés existantes.
 */

export interface ApiKeyRequest extends Request {
  apiClientId?: string;
  apiPermissions?: string[];
}

/** Le forfait qui donne droit à l'API, tel qu'annoncé sur la page tarifs. */
const API_PLANS = ['enterprise'];

function extractKey(req: Request): string | null {
  const header = req.header('x-api-key');
  if (header) return header.trim();
  const auth = req.header('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return null;
}

/**
 * Retrouve une clé par son condensat, avec repli sur la colonne en clair.
 *
 * Le repli existe uniquement pour la fenêtre de bascule: la migration a
 * rempli `key_hash` pour toutes les lignes existantes, mais une ligne écrite
 * par une instance qui n'aurait pas encore redémarré n'en aurait pas. Quand le
 * repli sert, il **rattrape la ligne au vol**, de sorte que la fenêtre se
 * referme d'elle-même au lieu de dépendre d'un cron.
 */
export async function findApiKeyRecord(key: string) {
  const byHash = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
    select: { id: true, userId: true, permissions: true, expiresAt: true },
  });
  if (byHash) return byHash;

  const legacy = await prisma.apiKey.findUnique({
    where: { key },
    select: { id: true, userId: true, permissions: true, expiresAt: true },
  });
  if (legacy) {
    // Non bloquant: authentifier ne doit pas échouer parce que le rattrapage
    // a échoué (course entre deux instances sur le même index unique).
    prisma.apiKey
      .update({ where: { id: legacy.id }, data: { keyHash: hashApiKey(key) } })
      .catch(() => {});
  }
  return legacy;
}

export async function apiKeyAuth(req: ApiKeyRequest, res: Response, next: NextFunction) {
  const key = extractKey(req);
  if (!key) {
    return res.status(401).json({ error: 'missing_api_key', message: 'Provide your key in the X-API-Key header.' });
  }

  try {
    const record = await findApiKeyRecord(key);

    /* Clé inconnue et clé expirée renvoient la MÊME réponse: distinguer les
       deux dirait à qui essaie des clés au hasard laquelle a existé. */
    if (!record || (record.expiresAt && record.expiresAt < new Date())) {
      return res.status(401).json({ error: 'invalid_api_key' });
    }

    const client = await prisma.client.findUnique({
      where: { userId: record.userId },
      select: { id: true, planType: true, subscriptionStatus: true },
    });

    if (!client) {
      return res.status(403).json({ error: 'no_client', message: 'This key is not attached to a Qwillio account.' });
    }
    if (!API_PLANS.includes((client.planType || '').toLowerCase())) {
      return res.status(403).json({
        error: 'plan_required',
        message: 'The API is available on the Enterprise plan.',
      });
    }
    if (['cancelled', 'canceled'].includes((client.subscriptionStatus || '').toLowerCase())) {
      return res.status(403).json({ error: 'subscription_inactive' });
    }

    // Trace d'usage, jamais bloquante: une écriture lente ne retarde pas la réponse.
    prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

    req.apiClientId = client.id;
    req.apiPermissions = record.permissions;
    next();
  } catch (error) {
    logger.error('[API] échec de vérification de la clé:', error);
    res.status(500).json({ error: 'auth_failed' });
  }
}

/** Réservé aux clés qui portent la permission demandée. */
export function requirePermission(permission: string) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    if (!req.apiPermissions?.includes(permission)) {
      return res.status(403).json({ error: 'insufficient_permission', required: permission });
    }
    next();
  };
}
