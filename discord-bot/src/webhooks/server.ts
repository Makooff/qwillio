import express from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import { channelManager, dashboardManager } from '../bot';
import { prisma } from '../database';
import { maskPhone, maskEmail } from '../utils/formatting';

const app = express();

// Raw body for signature verification
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());

// ═══════════════════════════════════════════════════
// VAPI Webhooks — Call events
// ═══════════════════════════════════════════════════
app.post('/webhooks/vapi', async (req, res) => {
  try {
    // Validate VAPI webhook signature
    if (config.vapiWebhookSecret) {
      const signature = req.headers['x-vapi-signature'] as string;
      if (signature) {
        const hmac = crypto.createHmac('sha256', config.vapiWebhookSecret);
        hmac.update(JSON.stringify(req.body));
        const expected = hmac.digest('hex');
        if (signature !== expected) {
          logger.warn('Invalid VAPI webhook signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }
    }

    const { message } = req.body;
    const eventType = message?.type || req.body.type;

    switch (eventType) {
      case 'call-started':
      case 'call.started': {
        const phone = message?.call?.customer?.number || 'unknown';
        const callId = message?.call?.id;
        if (channelManager) {
          await channelManager.postCallStarted({ phoneNumber: phone, vapiCallId: callId });
        }
        break;
      }

      case 'call-ended':
      case 'end-of-call-report': {
        const call = message?.call || message;
        const phone = call?.customer?.number || 'unknown';
        const duration = call?.duration || 0;
        const outcome = call?.endedReason || 'completed';
        const email = call?.analysis?.emailCollected;

        if (channelManager) {
          await channelManager.postCall({
            phoneNumber: phone,
            duration: Math.round(duration),
            outcome,
            emailCollected: email,
            hasRecording: !!call?.recordingUrl,
          });

          // Post lead notification if email captured
          if (email) {
            await channelManager.postLead({
              businessName: call?.analysis?.businessName,
              email,
              phone,
              niche: call?.analysis?.niche,
              callDuration: Math.round(duration),
            });
          }
        }

        // Trigger dashboard update
        if (dashboardManager) {
          await dashboardManager.triggerUpdate();
        }
        break;
      }

      case 'transfer': {
        const transfer = message?.transfer || message;
        if (channelManager) {
          await channelManager.postTransfer({
            niche: transfer?.niche,
            reason: transfer?.reason || 'transfer_requested',
            triggerPhrase: transfer?.triggerPhrase,
            status: transfer?.status || 'initiated',
          });
        }
        break;
      }
    }

    res.json({ ok: true });
  } catch (error) {
    logger.error('VAPI webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════
// Twilio Webhooks — SMS events
// ═══════════════════════════════════════════════════
app.post('/webhooks/twilio', async (req, res) => {
  try {
    const { MessageStatus, To, From, Body, SmsStatus } = req.body;

    if (Body && From) {
      // Inbound SMS
      if (channelManager) {
        await channelManager.postAlert({
          level: 'info',
          title: 'Inbound SMS',
          description: `From: ${maskPhone(From)}\nMessage received`,
        });
      }
    }

    if (MessageStatus === 'failed' || SmsStatus === 'failed') {
      if (channelManager) {
        await channelManager.postAlert({
          level: 'warning',
          title: 'SMS Delivery Failed',
          description: `To: ${maskPhone(To || '')}`,
        });
      }
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error('Twilio webhook error:', error);
    res.sendStatus(500);
  }
});

// ═══════════════════════════════════════════════════
// Stripe Webhooks — Payment events
// ═══════════════════════════════════════════════════
app.post('/webhooks/stripe', async (req, res) => {
  try {
    const event = JSON.parse(req.body.toString());

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (channelManager) {
          await channelManager.postBilling({
            type: 'payment',
            clientName: session.customer_details?.name || 'Unknown',
            amount: (session.amount_total || 0) / 100,
            details: `Payment completed via Stripe`,
          });
        }
        if (dashboardManager) {
          await dashboardManager.triggerUpdate();
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        if (channelManager) {
          await channelManager.postBilling({
            type: 'payment',
            clientName: invoice.customer_name || 'Unknown',
            amount: (invoice.amount_paid || 0) / 100,
            details: `Invoice ${invoice.number} paid`,
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (channelManager) {
          await channelManager.postBilling({
            type: 'failed',
            clientName: invoice.customer_name || 'Unknown',
            amount: (invoice.amount_due || 0) / 100,
            details: `Payment failed for invoice ${invoice.number}`,
          });
          await channelManager.postAlert({
            level: 'critical',
            title: 'Payment Failed',
            description: `Client: ${invoice.customer_name}\nAmount: $${(invoice.amount_due || 0) / 100}`,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        if (channelManager) {
          await channelManager.postBilling({
            type: 'cancelled',
            clientName: 'Client',
            details: `Subscription cancelled`,
          });
          await channelManager.postAlert({
            level: 'warning',
            title: 'Client Churned',
            description: `Subscription cancelled`,
          });
        }
        if (dashboardManager) {
          await dashboardManager.triggerUpdate();
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════
// Internal API — Called by backend to notify bot
// ═══════════════════════════════════════════════════
app.post('/internal/notify', async (req, res) => {
  try {
    const { channel, type, data } = req.body;

    if (channel === 'system' && channelManager) {
      await channelManager.postSystem(data.message, data.level || 'info');
    }
    if (channel === 'alert' && channelManager) {
      await channelManager.postAlert(data);
    }
    if (channel === 'billing' && channelManager) {
      await channelManager.postBilling(data);
    }

    // Always trigger dashboard update on any notification
    if (dashboardManager) {
      await dashboardManager.triggerUpdate();
    }

    res.json({ ok: true });
  } catch (error) {
    logger.error('Internal notify error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

export function startWebhookServer(): void {
  app.listen(config.webhookPort, () => {
    logger.info(`Webhook server listening on port ${config.webhookPort}`);
  });
}
