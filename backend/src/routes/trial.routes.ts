import { Router, Request, Response } from 'express';
import { trialAbuseService } from '../services/trial-abuse.service';
import { contractService } from '../services/contract.service';
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
 * GET /api/trial/contract/:planType
 * Get contract HTML for a specific plan.
 */
router.get('/contract/:planType', async (req: Request, res: Response) => {
  try {
    const planType = req.params.planType as string;
    const { clientName, clientEmail, clientBusinessName } = req.query;

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    const plans: Record<string, { monthly: number; setup: number }> = {
      starter: { monthly: 497, setup: 0 },
      pro: { monthly: 1297, setup: 0 },
      enterprise: { monthly: 2497, setup: 0 },
    };

    const plan = plans[planType];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const html = contractService.generateContractHTML({
      clientName: (clientName as string) || 'Client',
      clientEmail: (clientEmail as string) || '',
      clientBusinessName: (clientBusinessName as string) || '',
      planType: planType as any,
      monthlyFee: plan.monthly,
      setupFee: plan.setup,
      trialEndDate: trialEndDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      ipAddress: '',
      userAgent: '',
    });

    res.json({ html, contractVersion: '1.0' });
  } catch (error) {
    logger.error('Contract generation failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/trial/accept-contract
 * Record contract acceptance and generate PDF.
 */
router.post('/accept-contract', async (req: Request, res: Response) => {
  try {
    const { clientId, userId, planType, clientName, clientEmail, clientBusinessName, clientAddress } = req.body;

    if (!planType) {
      return res.status(400).json({ error: 'planType is required' });
    }

    const plans: Record<string, { monthly: number; setup: number }> = {
      starter: { monthly: 497, setup: 0 },
      pro: { monthly: 1297, setup: 0 },
      enterprise: { monthly: 2497, setup: 0 },
    };

    const plan = plans[planType];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    const ipAddress = (req.ip || req.headers['x-forwarded-for'] || '') as string;
    const userAgent = req.headers['user-agent'] || '';

    // Generate PDF
    const pdfBuffer = await contractService.generateContract({
      clientName: clientName || 'Client',
      clientEmail: clientEmail || '',
      clientBusinessName: clientBusinessName || '',
      clientAddress,
      planType: planType as any,
      monthlyFee: plan.monthly,
      setupFee: plan.setup,
      trialEndDate: trialEndDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      ipAddress,
      userAgent,
    });

    // Record acceptance
    await contractService.recordAcceptance({
      clientId,
      userId,
      planType,
      ipAddress,
      userAgent,
    });

    // Return PDF as base64 for storage/email
    res.json({
      ok: true,
      contractPdf: pdfBuffer.toString('base64'),
      contractVersion: '1.0',
    });
  } catch (error) {
    logger.error('Contract acceptance failed:', error);
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
