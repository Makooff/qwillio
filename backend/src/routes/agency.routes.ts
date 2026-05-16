import { Router } from 'express';
import { agencyService } from '../services/agency.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

// Create agency
router.post('/', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const agency = await agencyService.createAgency(req.userId, req.body);
    const stats = await agencyService.getAgencyStats(agency.id);
    res.json({ success: true, data: stats });
  } catch (err: unknown) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Erreur' });
  }
});

// Get my agency with stats
router.get('/me', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const agency = await agencyService.getAgencyByOwner(req.userId);
    if (!agency) {
      res.json({ success: true, data: null });
      return;
    }
    const stats = await agencyService.getAgencyStats(agency.id);
    res.json({ success: true, data: stats });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Add client to agency
router.post('/clients', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const agency = await agencyService.getAgencyByOwner(req.userId);
    if (!agency) {
      res.status(404).json({ success: false, error: 'Agency not found' });
      return;
    }
    const ac = await agencyService.addClientToAgency(agency.id, req.body.clientId);
    res.json({ success: true, data: ac });
  } catch (err: unknown) {
    res.status(400).json({ success: false, error: String(err) });
  }
});

// List API keys
router.get('/api-keys', async (req: AuthRequest, res) => {
  if (!req.userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const keys = await agencyService.listApiKeys(req.userId);
  res.json({ success: true, data: keys });
});

// Create API key
router.post('/api-keys', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const key = await agencyService.createApiKey(req.userId, req.body.name, req.body.permissions);
    res.json({ success: true, data: key });
  } catch (err: unknown) {
    res.status(400).json({ success: false, error: String(err) });
  }
});

// Revoke API key
router.delete('/api-keys/:id', async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  await agencyService.revokeApiKey(req.params.id as string, userId);
  res.json({ success: true });
});

export default router;
