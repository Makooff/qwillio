import { Router, Request, Response } from 'express';
import { prospectsController } from '../controllers/prospects.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { outboundEngineService } from '../services/outbound-engine.service';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/', (req, res) => prospectsController.list(req, res));
router.get('/stats', (req, res) => prospectsController.getStats(req, res));
router.get('/:id', (req, res) => prospectsController.getById(req, res));
router.put('/:id', (req, res) => prospectsController.update(req, res));
router.delete('/:id', (req, res) => prospectsController.delete(req, res));

// POST /api/prospects/:id/call — trigger immediate VAPI call for a specific prospect
router.post('/:id/call', async (req: Request, res: Response) => {
  try {
    const prospect = await prisma.prospect.findUnique({ where: { id: req.params.id } });
    if (!prospect) {
      res.status(404).json({ error: 'Prospect not found' });
      return;
    }
    if (!prospect.phone) {
      res.status(400).json({ error: 'Prospect has no phone number' });
      return;
    }
    logger.info(`[API] Manual call triggered for prospect ${prospect.id} (${prospect.businessName})`);
    const called = await outboundEngineService.callNextProspect();
    res.json({ success: true, called, message: called ? 'Call initiated' : 'No eligible prospect or quota reached' });
  } catch (err: any) {
    logger.error('[API] Manual prospect call error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
