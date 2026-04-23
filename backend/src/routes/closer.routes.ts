import { Router } from 'express';
import { authMiddleware, closerMiddleware } from '../middleware/auth.middleware';
import * as closerCtrl from '../controllers/closer.controller';

const router = Router();

router.use(authMiddleware);
router.use(closerMiddleware);

router.get('/stats',                            closerCtrl.getStats);
router.get('/prospects',                        closerCtrl.listProspects);
router.get('/prospects/:id',                    closerCtrl.getProspect);
router.post('/prospects/:id/claim',             closerCtrl.claimProspect);
router.post('/prospects/:id/release',           closerCtrl.releaseProspect);
router.put('/prospects/:id',                    closerCtrl.updateProspect);
router.post('/prospects/:id/followup',          closerCtrl.scheduleFollowUp);

router.get('/followups',                        closerCtrl.listFollowUps);
router.delete('/followups/:id',                 closerCtrl.cancelFollowUp);

export default router;
