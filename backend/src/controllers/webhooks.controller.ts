import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { stripe } from '../config/stripe';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { stripeService } from '../services/stripe.service';
import { vapiService } from '../services/vapi.service';
import { clientCallService } from '../services/client-call.service';
import { smsService } from '../services/sms.service';
import { emailService } from '../services/email.service';
import { discordService } from '../services/discord.service';
import { extractEmailFromText, isValidEmail, normalizeEmail } from '../utils/validators';

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
    const clientId = req.params.clientId as string;
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

    // Handle transfer events
    if (messageType === 'transfer-destination-request' || messageType === 'transfer-update') {
      const vapiCallId = event.message?.call?.id || event.call?.id;
      const transferStatus = event.message?.status || event.status || 'initiated';
      try {
        await clientCallService.logTransfer(clientId, vapiCallId, transferStatus, event);
      } catch (error) {
        logger.error(`Error logging transfer for client ${clientId}:`, error);
      }
    }

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

  // ═══════════════════════════════════════════════════════════
  // TWILIO INBOUND SMS — Prospect replies with corrected email
  // ═══════════════════════════════════════════════════════════
  async twilioInboundSMS(req: Request, res: Response) {
    const { From: from, Body: body } = req.body;
    logger.info(`Inbound SMS from ${from}: ${body}`);

    // Find prospect by phone number
    const phone = from?.replace(/\s/g, '');
    if (!phone || phone.length < 10) {
      logger.warn(`Inbound SMS with invalid phone: ${from}`);
      res.type('text/xml').send('<Response></Response>');
      return;
    }
    const prospect = await prisma.prospect.findFirst({
      where: { phone: { contains: phone.slice(-10) } },
      orderBy: { updatedAt: 'desc' },
    });

    if (!prospect) {
      logger.warn(`Inbound SMS from unknown number: ${from}`);
      res.type('text/xml').send('<Response></Response>');
      return;
    }

    // Handle SMS opt-out keywords (STOP, UNSUBSCRIBE, CANCEL, QUIT, END)
    const optOutKeywords = ['stop', 'unsubscribe', 'cancel', 'quit', 'end', 'arret', 'arreter'];
    const bodyTrimmed = (body || '').trim().toLowerCase();
    if (optOutKeywords.includes(bodyTrimmed)) {
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { smsOptedOut: true, smsOptedOutAt: new Date() },
      });
      logger.info(`SMS opt-out recorded for ${prospect.businessName} (${from})`);
      await discordService.notify(`🚫 SMS OPT-OUT\n\nProspect: ${prospect.businessName}\nPhone: ${from}\nKeyword: "${bodyTrimmed}"`);
      // Twilio handles the STOP response automatically at carrier level
      res.type('text/xml').send('<Response></Response>');
      return;
    }

    // Handle opt-in (START, YES, UNSTOP)
    const optInKeywords = ['start', 'yes', 'unstop'];
    if (optInKeywords.includes(bodyTrimmed)) {
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { smsOptedOut: false, smsOptedOutAt: null },
      });
      logger.info(`SMS opt-in recorded for ${prospect.businessName} (${from})`);
      res.type('text/xml').send('<Response></Response>');
      return;
    }

    // Try to extract email from the SMS body
    const extractedEmail = extractEmailFromText(body || '');

    if (extractedEmail && isValidEmail(extractedEmail)) {
      const normalized = normalizeEmail(extractedEmail);

      // Update prospect with corrected email
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: {
          email: normalized,
          emailBounced: false,
          emailVerified: false,
          emailSmsReplyRaw: body,
        },
      });

      // Send confirmation email to the new address
      try {
        const result = await emailService.sendEmailConfirmation({
          to: normalized,
          contactName: prospect.contactName || prospect.businessName,
          businessName: prospect.businessName,
          prospectId: prospect.id,
        });

        if (result.success) {
          await prisma.prospect.update({
            where: { id: prospect.id },
            data: { emailConfirmationId: result.emailId || null },
          });
        }
      } catch (e) {
        logger.error('Failed to send confirmation to corrected email:', e);
      }

      // Cancel any pending email-related reminders for this prospect (stale email)
      await prisma.reminder.updateMany({
        where: {
          targetId: prospect.id,
          status: 'pending',
          reminderType: { in: ['email_video', 'email_reminder_24h', 'email_dashboard_48h', 'email_verification_check'] },
        },
        data: { status: 'canceled', result: 'Email corrected via SMS — re-scheduling' },
      });

      // Re-schedule follow-up emails with the corrected address
      const now = Date.now();
      await prisma.reminder.create({
        data: {
          targetType: 'prospect',
          targetId: prospect.id,
          reminderType: 'email_video',
          scheduledAt: new Date(now + 5 * 60 * 1000), // T+5min
        },
      });
      await prisma.reminder.create({
        data: {
          targetType: 'prospect',
          targetId: prospect.id,
          reminderType: 'email_verification_check',
          scheduledAt: new Date(now + 24 * 60 * 60 * 1000), // T+24h
        },
      });

      // Reply via SMS to confirm we got it
      await smsService.sendSMS(phone, `Got it! I just sent the demo video to ${normalized}. Check your inbox (and spam just in case). — Ashley from Qwillio`);

      await discordService.notify(
        `📧 EMAIL CORRECTED VIA SMS\n\nProspect: ${prospect.businessName}\nOld: ${prospect.email}\nNew: ${normalized}\nSMS: "${body}"\nConfirmation email sent + follow-ups re-scheduled`
      );

      logger.info(`Email updated for ${prospect.businessName}: ${prospect.email} → ${normalized}`);
    } else {
      // No email found in the reply — log it for manual review
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { emailSmsReplyRaw: body },
      });

      logger.info(`Inbound SMS from ${prospect.businessName} but no email extracted: "${body}"`);
    }

    // Return empty TwiML response
    res.type('text/xml').send('<Response></Response>');
  }

  // ═══════════════════════════════════════════════════════════
  // RESEND EMAIL EVENTS — Handle bounces and delivery status
  // ═══════════════════════════════════════════════════════════
  async resendEmailEvent(req: Request, res: Response) {
    const event = req.body;
    const eventType = event.type;
    const email = event.data?.to?.[0] || event.data?.email;

    logger.info(`Resend event: ${eventType} for ${email}`);

    if (!email) {
      res.json({ received: true });
      return;
    }

    // Find prospect by email
    const prospect = await prisma.prospect.findFirst({
      where: { email },
      orderBy: { updatedAt: 'desc' },
    });

    if (!prospect) {
      res.json({ received: true });
      return;
    }

    if (eventType === 'email.bounced') {
      // Mark email as bounced
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: {
          emailBounced: true,
          emailBouncedAt: new Date(),
        },
      });

      // Send SMS fallback asking for correct email
      if (prospect.phone && !prospect.emailSmsFollowupSent) {
        try {
          await smsService.sendEmailFallbackSMS(
            { phone: prospect.phone, businessName: prospect.businessName, contactName: prospect.contactName },
            'bounce'
          );
          await prisma.prospect.update({
            where: { id: prospect.id },
            data: { emailSmsFollowupSent: true },
          });
        } catch (e) {
          logger.warn('Email bounce SMS fallback failed:', e);
        }
      }

      await discordService.notify(
        `⚠️ EMAIL BOUNCED\n\nProspect: ${prospect.businessName}\nEmail: ${email}\nSMS fallback ${prospect.phone ? 'sent' : 'N/A (no phone)'}`
      );
    } else if (eventType === 'email.delivered') {
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      });
      logger.info(`Email verified (delivered) for ${prospect.businessName}: ${email}`);
    }

    res.json({ received: true });
  }
}

export const webhooksController = new WebhooksController();
