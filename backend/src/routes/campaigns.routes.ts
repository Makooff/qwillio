import { Router } from 'express';
import { campaignsController } from '../controllers/campaigns.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/', (req, res) => campaignsController.list(req, res));
router.post('/', (req, res) => campaignsController.create(req, res));
router.get('/:id', (req, res) => campaignsController.getById(req, res));
router.post('/:id/launch', (req, res) => campaignsController.launch(req, res));
router.delete('/:id', (req, res) => campaignsController.delete(req, res));

export default router;
