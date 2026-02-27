import { Router } from 'express';
import { prospectsController } from '../controllers/prospects.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', (req, res) => prospectsController.list(req, res));
router.get('/stats', (req, res) => prospectsController.getStats(req, res));
router.get('/:id', (req, res) => prospectsController.getById(req, res));
router.put('/:id', (req, res) => prospectsController.update(req, res));
router.delete('/:id', (req, res) => prospectsController.delete(req, res));

export default router;
