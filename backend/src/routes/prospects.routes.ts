import { Router, Response } from 'express';
import { prospectsController } from '../controllers/prospects.controller';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { prospectWorkbenchService, savedSearchService } from '../services/prospect-workbench.service';
import { logger } from '../config/logger';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// ─── Saved searches ───────────────────────────────────────
// Declared before `/:id`, otherwise "saved-searches" is swallowed as an id.

router.get('/saved-searches', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié' });
    res.json(await savedSearchService.list(req.userId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/saved-searches', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié' });
    const saved = await savedSearchService.save(req.userId, req.body?.name, req.body?.filters || {});
    if (!saved) return res.status(400).json({ error: 'name_required' });
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/saved-searches/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié' });
    const updated = await savedSearchService.setProgress(
      req.userId,
      String(req.params.id),
      req.body?.lastProspectId ? String(req.body.lastProspectId) : null,
    );
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/saved-searches/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié' });
    const gone = await savedSearchService.remove(req.userId, String(req.params.id));
    if (!gone) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Prospects ────────────────────────────────────────────

router.get('/', (req, res) => prospectsController.list(req, res));
router.get('/stats', (req, res) => prospectsController.getStats(req, res));
router.get('/:id', (req, res) => prospectsController.getById(req, res));
router.put('/:id', (req, res) => prospectsController.update(req, res));
router.patch('/:id/favorite', (req, res) => prospectsController.setFavorite(req, res));
router.delete('/:id', (req, res) => prospectsController.delete(req, res));

/** Everything worth reading before dialling. */
router.get('/:id/brief', async (req: AuthRequest, res: Response) => {
  try {
    const brief = await prospectWorkbenchService.brief(String(req.params.id));
    if (!brief) return res.status(404).json({ error: 'not_found' });
    res.json(brief);
  } catch (err: any) {
    logger.error('[prospects] brief failed', err);
    res.status(500).json({ error: err.message });
  }
});

/** The sales script for this business. Generated once, then read for free. */
router.post('/:id/script', async (req: AuthRequest, res: Response) => {
  try {
    const refresh = req.query.refresh === 'true';
    const result = await prospectWorkbenchService.script(String(req.params.id), refresh);
    if (!result) return res.status(404).json({ error: 'not_found' });
    res.json(result);
  } catch (err: any) {
    logger.error('[prospects] script failed', err);
    res.status(500).json({ error: err.message });
  }
});

/** The founder dialled this business himself. */
router.post('/:id/touch', async (req: AuthRequest, res: Response) => {
  try {
    const updated = await prospectWorkbenchService.markContacted(String(req.params.id));
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Prospect → customer, once the call went well. */
router.post('/:id/convert', async (req: AuthRequest, res: Response) => {
  try {
    const result = await prospectWorkbenchService.convert(String(req.params.id), req.body || {});
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, clientId: (result as any).clientId });
    }
    res.status(201).json({ success: true, clientId: result.client.id, client: result.client });
  } catch (err: any) {
    logger.error('[prospects] convert failed', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
