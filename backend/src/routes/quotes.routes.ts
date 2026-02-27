import { Router } from 'express';
import { quotesController } from '../controllers/quotes.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', (req, res) => quotesController.list(req, res));
router.get('/:id', (req, res) => quotesController.getById(req, res));
router.post('/send', (req, res) => quotesController.sendManual(req, res));

export default router;
