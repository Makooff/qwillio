import { Router, Request, Response } from 'express';
import { trialAbuseService } from '../services/trial-abuse.service';
import { logger } from '../config/logger';

const router = Router();

/**
 * POST /api/trial/check-signals
 * Check if a signup should be allowed based on abuse signals.
 */
router.post('/check-signals', async (req: Request, res: Response) => {
  try {
    const { email, phone, deviceFingerprint, ipAddress, cardFingerprint, ipCountry, phoneCountry, vpnDetected, formSubmitTime, honeypotFilled } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const clientIp = ipAddress || req.ip || req.headers['x-forwarded-for'] || '';

    const result = await trialAbuseService.checkSignals({
      email,
      phone,
      deviceFingerprint,
      ipAddress: clientIp as string,
      cardFingerprint,
      ipCountry,
      phoneCountry,
      vpnDetected,
      formSubmitTime,
      honeypotFilled,
    });

    res.json(result);
  } catch (error) {
    logger.error('Trial abuse check failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/trial/record-signals
 * Record signals after successful account creation.
 */
router.post('/record-signals', async (req: Request, res: Response) => {
  try {
    const { accountId, email, phone, deviceFingerprint, cardFingerprint, ipCountry, phoneCountry, vpnDetected } = req.body;

    if (!accountId || !email) {
      return res.status(400).json({ error: 'accountId and email are required' });
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '';

    await trialAbuseService.recordSignals(accountId, {
      email,
      phone,
      deviceFingerprint,
      ipAddress: ipAddress as string,
      cardFingerprint,
      ipCountry,
      phoneCountry,
      vpnDetected,
    });

    res.json({ ok: true });
  } catch (error) {
    logger.error('Trial signal recording failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/trial/admin/stats
 * Get abuse prevention stats for admin dashboard.
 */
router.get('/admin/stats', async (req: Request, res: Response) => {
  try {
    const stats = await trialAbuseService.getAbuseStats();
    res.json(stats);
  } catch (error) {
    logger.error('Admin stats failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/trial/admin/flagged
 * Get flagged signup attempts for admin review.
 */
router.get('/admin/flagged', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const data = await trialAbuseService.getFlaggedAttempts(page, limit);
    res.json(data);
  } catch (error) {
    logger.error('Admin flagged failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
