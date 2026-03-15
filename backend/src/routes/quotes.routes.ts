import { Router } from 'express';
import { quotesController } from '../controllers/quotes.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/', (req, res) => quotesController.list(req, res));
router.get('/:id', (req, res) => quotesController.getById(req, res));
router.post('/send', (req, res) => quotesController.sendManual(req, res));
router.get('/:id/contract-status', (req, res) => quotesController.getContractStatus(req, res));
router.post('/:id/resend-contract', (req, res) => quotesController.resendContract(req, res));

export default router;
