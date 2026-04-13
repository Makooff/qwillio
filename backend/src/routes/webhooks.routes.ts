import { Router } from 'express';
import { webhooksController } from '../controllers/webhooks.controller';

const router = Router();

// Stripe webhook - needs raw body for signature verification
router.post('/stripe', (req, res) => webhooksController.stripeWebhook(req, res));

// VAPI webhooks
router.post('/vapi', (req, res) => webhooksController.vapiWebhook(req, res));
router.post('/vapi/client/:clientId', (req, res) => webhooksController.vapiClientWebhook(req, res));

// Twilio inbound SMS — handles prospect email corrections via SMS reply
router.post('/twilio/sms', (req, res) => webhooksController.twilioInboundSMS(req, res));

// Twilio voice/call status webhooks
router.post('/twilio/voice', (req, res) => webhooksController.twilioVoiceStatus(req, res));
router.post('/twilio/status', (req, res) => webhooksController.twilioVoiceStatus(req, res));

// Resend email bounce/delivery webhook — triggers SMS fallback on bounce
router.post('/resend/events', (req, res) => webhooksController.resendEmailEvent(req, res));

// DocuSign Connect webhook — contract signed/declined
router.post('/docusign', (req, res) => webhooksController.docusignWebhook(req, res));

export default router;
