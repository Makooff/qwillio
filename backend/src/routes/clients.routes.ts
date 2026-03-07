import { Router } from 'express';
import { clientsController } from '../controllers/clients.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/', (req, res) => clientsController.list(req, res));
router.get('/stats', (req, res) => clientsController.getStats(req, res));
router.get('/:id', (req, res) => clientsController.getById(req, res));
router.put('/:id', (req, res) => clientsController.update(req, res));

export default router;
