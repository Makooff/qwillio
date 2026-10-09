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

import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { requireAutofixToken } from './autofix.routes';

const router = Router();

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
  res.json({ patterns });
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
