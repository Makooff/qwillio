import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminAnalyticsService } from '../services/admin-analytics.service';

const router = Router();

router.use(authMiddleware);

// GET /api/admin-analytics/costs?days=30
router.get('/costs', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = await adminAnalyticsService.getCosts(days);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch costs' });
  }
});

// GET /api/admin-analytics/retention
router.get('/retention', async (req: Request, res: Response) => {
  try {
    const data = await adminAnalyticsService.getRetention();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch retention data' });
  }
});

// GET /api/admin-analytics/followups
router.get('/followups', async (req: Request, res: Response) => {
  try {
    const data = await adminAnalyticsService.getFollowUps();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch follow-up data' });
  }
});

// GET /api/admin-analytics/phone-validation
router.get('/phone-validation', async (req: Request, res: Response) => {
  try {
    const data = await adminAnalyticsService.getPhoneValidation();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch phone validation data' });
  }
});

// GET /api/admin-analytics/cpa
router.get('/cpa', async (req: Request, res: Response) => {
  try {
    const data = await adminAnalyticsService.getCPA();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch CPA data' });
  }
});

// GET /api/admin-analytics/conversion-by-day
router.get('/conversion-by-day', async (req: Request, res: Response) => {
  try {
    const data = await adminAnalyticsService.getConversionByDay();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversion data' });
  }
});

// GET /api/admin-analytics/email-verification
router.get('/email-verification', async (req: Request, res: Response) => {
  try {
    const data = await adminAnalyticsService.getEmailVerification();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch email verification data' });
  }
});

// GET /api/admin-analytics/transfers?days=30
router.get('/transfers', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = await adminAnalyticsService.getTransfers(days);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transfer data' });
  }
});

export default router;
