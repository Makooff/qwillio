import { Router } from 'express';
import { webhooksController } from '../controllers/webhooks.controller';

const router = Router();

// Stripe webhook - needs raw body for signature verification
router.post('/stripe', (req, res) => webhooksController.stripeWebhook(req, res));

// VAPI webhooks
router.post('/vapi', (req, res) => webhooksController.vapiWebhook(req, res));
router.post('/vapi/client/:clientId', (req, res) => webhooksController.vapiClientWebhook(req, res));

export default router;
