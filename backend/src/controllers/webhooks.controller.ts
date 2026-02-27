import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { stripe } from '../config/stripe';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { stripeService } from '../services/stripe.service';
import { vapiService } from '../services/vapi.service';
import { clientCallService } from '../services/client-call.service';

export class WebhooksController {
  async stripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string;
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      logger.error(`Stripe webhook signature verification failed: ${err.message}`);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Log webhook
    await prisma.webhookLog.create({
      data: {
        source: 'stripe',
        eventType: event.type,
        payload: event.data.object as any,
        status: 'received',
      },
    });

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await stripeService.handleCheckoutCompleted(event.data.object);
          break;
        case 'invoice.paid':
          await stripeService.handleInvoicePaid(event.data.object);
          break;
        case 'invoice.payment_failed':
          await stripeService.handlePaymentFailed(event.data.object);
          break;
        default:
          logger.debug(`Unhandled Stripe event: ${event.type}`);
      }

      await prisma.webhookLog.updateMany({
        where: { eventType: event.type, status: 'received' },
        data: { status: 'processed', processedAt: new Date() },
      });
    } catch (error: any) {
      logger.error(`Error processing Stripe webhook: ${error.message}`);
      await prisma.webhookLog.updateMany({
        where: { eventType: event.type, status: 'received' },
        data: { status: 'failed', errorMessage: error.message },
      });
    }

    res.json({ received: true });
  }

  async vapiWebhook(req: Request, res: Response) {
    // Verify VAPI webhook secret if configured
    const vapiSecret = env.VAPI_WEBHOOK_SECRET;
    if (vapiSecret && vapiSecret !== 'your-vapi-webhook-secret') {
      const headerSecret = req.headers['x-vapi-secret'] as string;
      if (headerSecret !== vapiSecret) {
        logger.warn('VAPI webhook: invalid secret header');
        return res.status(401).json({ error: 'Invalid webhook secret' });
      }
    }

    const event = req.body;

    // Log webhook
    await prisma.webhookLog.create({
      data: {
        source: 'vapi',
        eventType: event.message?.type || event.type || 'unknown',
        payload: event,
        status: 'received',
      },
    });

    try {
      const messageType = event.message?.type || event.type;

      switch (messageType) {
        case 'end-of-call-report':
          const callId = event.message?.call?.id || event.call?.id;
          const transcript = event.message?.transcript || event.transcript || '';
          const duration = event.message?.call?.duration || event.call?.duration || 0;
          const recordingUrl = event.message?.recordingUrl || event.recordingUrl;

          if (callId) {
            await vapiService.handleCallCompleted(callId, transcript, duration, recordingUrl);
          }
          break;

        case 'status-update':
          logger.debug(`VAPI call status update: ${event.message?.status || event.status}`);
          break;

        case 'function-call':
          logger.debug('VAPI function call received');
          break;

        default:
          logger.debug(`Unhandled VAPI event: ${messageType}`);
      }
    } catch (error: any) {
      logger.error(`Error processing VAPI webhook: ${error.message}`);
    }

    res.json({ received: true });
  }

  async vapiClientWebhook(req: Request, res: Response) {
    const clientId = req.params.clientId;
    const event = req.body;

    await prisma.webhookLog.create({
      data: {
        source: 'vapi',
        eventType: `client_${event.message?.type || event.type || 'unknown'}`,
        payload: { clientId, ...event },
        status: 'received',
      },
    });

    const messageType = event.message?.type || event.type;

    // Handle client-specific VAPI events (incoming calls to client's AI)
    if (messageType === 'end-of-call-report') {
      const vapiCallId = event.message?.call?.id || event.call?.id;
      const transcript = event.message?.transcript || event.transcript || '';
      const duration = event.message?.call?.duration || event.call?.duration || 0;
      const recordingUrl = event.message?.recordingUrl || event.recordingUrl;
      const callerNumber = event.message?.call?.customer?.number || event.call?.customer?.number;

      if (vapiCallId) {
        try {
          // Full call analysis: transcript → GPT-4 → client call record + booking + lead detection
          await clientCallService.handleClientCallCompleted(
            clientId,
            vapiCallId,
            transcript,
            duration,
            callerNumber,
            recordingUrl,
          );
        } catch (error) {
          logger.error(`Error processing client call webhook for ${clientId}:`, error);
        }
      }
    }

    res.json({ received: true });
  }
}

export const webhooksController = new WebhooksController();
