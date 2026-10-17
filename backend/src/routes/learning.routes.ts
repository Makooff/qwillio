/**
 * Learning routes — ce que le synthétiseur local vient chercher.
 *
 *   GET  /api/learning/patterns?status=signal   — les patterns qui attendent une règle (jeton)
 *   POST /api/learning/patterns/:id/status      — proposed | rejected | merged (jeton)
 *
 * Même jeton que l'autofix (`requireAutofixToken`) : c'est le même acteur —
 * une tâche planifiée sur la machine du propriétaire — et le même principe :
 * la liste est lisible par la machine, la décision d'appliquer reste humaine.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createLearningObservationsService, ObservationRequestError } from '../services/voice/learning-observations.service';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { requireAutofixToken } from './autofix.routes';
import { learningScopeFromFingerprint, withLearningScopes } from '../config/receptionist-industry-rules';

const router = Router();
const observations = createLearningObservationsService(prisma);

/** Independent owner-operated read capability, never accepted by write handlers. */
export function requireLearningReadToken(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  const legacy = process.env.LEARNING_READ_TOKEN === undefined;
  const expected = (legacy ? process.env.AUTOFIX_TOKEN : process.env.LEARNING_READ_TOKEN)?.trim();
  if (!expected) {
    res.status(503).json({ error: 'read_key_unavailable' });
    return;
  }
  const token = (req.header(legacy ? 'X-Autofix-Token' : 'X-Learning-Read-Token') ?? '').trim();
  const digest = (value: string) => createHash('sha256').update(value).digest();
  const matches = timingSafeEqual(digest(token), digest(expected));
  if (!token || !matches) {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }
  next();
}
function readFailure(error: unknown, res: Response): void {
  if (error instanceof ObservationRequestError) {
    res.status(error.status).json({ error: error.code });
  } else {
    logger.error('[learning] read failed');
    res.status(500).json({ error: 'learning_read_failed' });
  }
}
router.get('/clients', requireLearningReadToken, async (req: Request, res: Response) => {
  try {
    res.json(await observations.listClients({ cursor: req.query.cursor, limit: req.query.limit }));
  } catch (error) { readFailure(error, res); }
});
router.get('/observations', requireLearningReadToken, async (req: Request, res: Response) => {
  try {
    res.json(await observations.listObservations({ clientId: req.query.clientId, cursor: req.query.cursor, limit: req.query.limit }));
  } catch (error) { readFailure(error, res); }
});
router.get('/observations/:callRef', requireLearningReadToken, async (req: Request, res: Response) => {
  try {
    res.json(await observations.getObservation(String(req.params.callRef), req.query.clientId));
  } catch (error) { readFailure(error, res); }
});

const VALID_STATUSES = new Set(['observing', 'signal', 'proposed', 'rejected', 'merged']);

router.get('/patterns', requireAutofixToken, async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  if (status && !VALID_STATUSES.has(status)) {
    res.status(400).json({ error: `status inconnu — attendu parmi ${[...VALID_STATUSES].join(', ')}` });
    return;
  }
  const patterns = await prisma.learningPattern.findMany({
    where: status ? { status } : {},
    orderBy: [{ callCount: 'desc' }, { lastSeenAt: 'desc' }],
    take: 100,
  });
  const ids=[...new Set(patterns.filter(p=>!learningScopeFromFingerprint(p.fingerprint).scoped)
    .flatMap(p=>p.clientIds))];
  const clients=ids.length ? await prisma.client.findMany({
    where:{id:{in:ids}},select:{id:true,businessType:true},
  }):[];
  res.json({ patterns:withLearningScopes(patterns,clients) });
});

router.post('/patterns/:id/status', requireAutofixToken, async (req: Request, res: Response) => {
  const { status, proposalUrl } = req.body ?? {};
  if (!['proposed', 'rejected', 'merged'].includes(status)) {
    res.status(400).json({ error: 'status attendu: proposed | rejected | merged' });
    return;
  }
  try {
    const pattern = await prisma.learningPattern.update({
      where: { id: String(req.params.id) },
      data: {
        status,
        ...(typeof proposalUrl === 'string' && proposalUrl ? { proposalUrl: proposalUrl.slice(0, 500) } : {}),
      },
    });
    logger.info(`[learning] pattern ${pattern.fingerprint} → ${status}${proposalUrl ? ` (${proposalUrl})` : ''}`);
    res.json({ pattern });
  } catch {
    res.status(404).json({ error: 'pattern introuvable' });
  }
});

export default router;
