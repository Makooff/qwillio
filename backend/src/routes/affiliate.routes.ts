import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { affiliateService } from '../services/affiliate.service';
import { logger } from '../config/logger';

const router = Router();

/**
 * GET /api/affiliate/resolve/:code
 * Public. Lets the landing page confirm a referral link is real before storing
 * it, and show whose link it is. Returns nothing identifying beyond the code.
 */
router.get('/resolve/:code', async (req, res: Response) => {
  try {
    const affiliate = await affiliateService.findByCode(String(req.params.code || ''));
    if (!affiliate || affiliate.status !== 'active') {
      return res.status(404).json({ valid: false });
    }
    res.json({ valid: true, code: affiliate.code });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/affiliate/enroll
 * Turns the signed-in user into an affiliate and hands back their link.
 * Idempotent: calling it twice returns the same code.
 */
router.post('/enroll', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié' });

    const payoutEmail = typeof req.body?.payoutEmail === 'string' ? req.body.payoutEmail.trim() : undefined;
    const affiliate = await affiliateService.enroll(req.userId, payoutEmail);

    res.json({
      code: affiliate.code,
      commissionPct: affiliate.commissionPct,
      status: affiliate.status,
    });
  } catch (error: any) {
    logger.error('[affiliate] enroll failed', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/affiliate/me
 * The affiliate's own referrals and commissions.
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié' });

    const summary = await affiliateService.summary(req.userId);
    if (!summary) return res.status(404).json({ error: 'not_an_affiliate' });

    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/affiliate/me
 * Only the payout email is self-editable; the code and the rate are not.
 */
router.put('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié' });

    const affiliate = await prisma.affiliate.findUnique({ where: { userId: req.userId } });
    if (!affiliate) return res.status(404).json({ error: 'not_an_affiliate' });

    const payoutEmail = typeof req.body?.payoutEmail === 'string' ? req.body.payoutEmail.trim() : null;
    const updated = await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { payoutEmail },
    });

    res.json({ payoutEmail: updated.payoutEmail });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
