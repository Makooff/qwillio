import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * Le portier du pont `voice-core`.
 *
 * POURQUOI PAS `apiKeyAuth`. La clé publique existante identifie UN CLIENT —
 * elle résout le compte depuis le propriétaire de la clé et exige le forfait
 * Enterprise. `voice-core` fait l'inverse : c'est un service interne, il
 * n'appartient à aucun client, et il doit pouvoir lire le profil de N'IMPORTE
 * lequel à partir du numéro appelé. Lui donner une clé client reviendrait à
 * créer un compte fantôme avec accès à tous les autres — précisément ce qu'on
 * ne veut pas d'une clé qui vit dans les variables d'environnement d'un
 * worker.
 *
 * Donc : un secret partagé, un seul, qui n'ouvre QUE ces deux routes.
 *
 * FERMÉ PAR DÉFAUT, et c'est le point important. Sans `VOICE_CORE_API_KEY`,
 * les routes répondent 503 et rien n'est lisible. Le contraire — ouvrir quand
 * la variable manque — est la faute classique : elle ne se voit jamais en
 * développement, où la variable est toujours là, et elle expose le profil de
 * tous les clients le jour d'un déploiement où elle manque.
 */

function egalesEnTempsConstant(a: string, b: string): boolean {
  /* On compare les CONDENSATS, pas les chaînes : `timingSafeEqual` exige deux
     tampons de même longueur, et lui passer les clés brutes ferait fuiter la
     longueur du secret par la levée d'exception. */
  const x = crypto.createHash('sha256').update(a).digest();
  const y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

export function voiceCoreAuth(req: Request, res: Response, next: NextFunction) {
  const attendue = (process.env.VOICE_CORE_API_KEY || '').trim();
  if (!attendue) {
    logger.warn('[voice-core] VOICE_CORE_API_KEY absente — le pont reste fermé');
    return res.status(503).json({
      error: 'voice_core_disabled',
      message: 'VOICE_CORE_API_KEY is not configured on this server.',
    });
  }

  const fournie = (req.header('x-api-key') || '').trim();
  if (!fournie || !egalesEnTempsConstant(fournie, attendue)) {
    return res.status(401).json({ error: 'invalid_api_key' });
  }
  next();
}
