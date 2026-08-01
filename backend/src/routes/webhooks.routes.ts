import { Router } from 'express';
import { webhooksController } from '../controllers/webhooks.controller';
import { voiceWebhookController } from '../controllers/voice-webhook.controller';
import { voiceLlmController } from '../controllers/voice-llm.controller';
import { validateTwilioSignature } from '../middleware/twilio.middleware';

const router = Router();

// Stripe webhook - needs raw body for signature verification
router.post('/stripe', (req, res) => webhooksController.stripeWebhook(req, res));

// VAPI outbound prospecting webhooks (Ashley calling prospects)
router.post('/vapi', (req, res) => webhooksController.vapiWebhook(req, res));

// VAPI inbound receptionist — real-time streaming orchestrator.
// `/tools/:clientId` is a separate path so the round-trip the caller is waiting
// on never queues behind transcript telemetry on the same route.
router.post('/vapi/client/:clientId', (req, res) => voiceWebhookController.clientEvent(req, res));
router.post('/vapi/tools/:clientId', (req, res) => voiceWebhookController.toolCall(req, res));
router.get('/vapi/health', (req, res) => voiceWebhookController.health(req, res));

// OpenAI-compatible SSE endpoint. Only reached when a client is on the
// custom-LLM path, which is what lets the intent router actually skip the model
// instead of merely counting the turns it could have skipped.
router.post('/vapi/llm/:clientId/chat/completions', (req, res) => voiceLlmController.chatCompletions(req, res));

// Twilio inbound SMS — handles prospect email corrections via SMS reply
router.post('/twilio/sms', validateTwilioSignature, (req, res) => webhooksController.twilioInboundSMS(req, res));

// Twilio voice/call status webhooks
router.post('/twilio/voice', validateTwilioSignature, (req, res) => webhooksController.twilioVoiceStatus(req, res));
router.post('/twilio/status', validateTwilioSignature, (req, res) => webhooksController.twilioVoiceStatus(req, res));

// Resend email bounce/delivery webhook — triggers SMS fallback on bounce
router.post('/resend/events', (req, res) => webhooksController.resendEmailEvent(req, res));

export default router;
