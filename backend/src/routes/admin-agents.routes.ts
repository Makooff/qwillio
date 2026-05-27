import { Router } from 'express';
import { adminAgentsController } from '../controllers/admin-agents.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/', (req, res) => adminAgentsController.list(req, res));
router.get('/:agentType', (req, res) => adminAgentsController.detail(req, res));
router.get('/:agentType/prompts', (req, res) => adminAgentsController.getPrompts(req, res));
router.put('/:agentType/prompts', (req, res) => adminAgentsController.updatePrompts(req, res));
router.get('/:agentType/activity', (req, res) => adminAgentsController.activity(req, res));
router.get('/:agentType/metrics', (req, res) => adminAgentsController.metrics(req, res));
router.post('/:agentType/run', (req, res) => adminAgentsController.run(req, res));

export default router;
