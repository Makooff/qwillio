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
import { detectLanguage } from '../config/vapi-templates';
import { storeError } from '../utils/error-store';
import { closerAgentService } from '../services/closer-agent.service';
import { callSessionStore } from '../services/voice/call-session.store';
import { inboundRoutingService } from '../services/voice/inbound-routing.service';
import { realtimeOrchestratorService } from '../services/voice/realtime-orchestrator.service';
import { isVapiWebhookAuthorized } from '../utils/vapi-webhook-auth';

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
        case 'invoice.paid': {
          const invoiceObj = event.data.object as { subscription?: string; customer?: string };
          await stripeService.handleInvoicePaid(invoiceObj);

          // Backpropagate reward to all agent actions for the paying prospect
          setImmediate(async () => {
            try {
              // Find prospect linked via Client.stripeCustomerId → Client.prospectId
              const stripeCustomerId = invoiceObj.customer;
              let prospectId: string | null = null;

              if (stripeCustomerId) {
                const client = await prisma.client.findFirst({
                  where: { stripeCustomerId },
                  select: { prospectId: true },
                });
                prospectId = client?.prospectId ?? null;
              }

              if (prospectId) {
                const { agentMemoryService } = await import('../services/agent-memory.service');
                const actions = await prisma.agentAction.findMany({
                  where: { prospectId, outcome: null },
                });
                await Promise.all(
                  actions.map(a => agentMemoryService.updateOutcome(a.id, 'converted', 1.0))
                );
                logger.info(`[Stripe] Backpropagated reward to ${actions.length} agent actions for prospect ${prospectId}`);
              }
            } catch (err) {
              logger.error('[Stripe] Reward backpropagation failed:', err);
            }
          });
          break;
        }
        case 'invoice.payment_failed':
          await stripeService.handlePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.created':
          await stripeService.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await stripeService.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await stripeService.handleSubscriptionDeleted(event.data.object);
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
      storeError(error.message, error.stack || '', '/api/webhooks/stripe');
      await prisma.webhookLog.updateMany({
        where: { eventType: event.type, status: 'received' },
        data: { status: 'failed', errorMessage: error.message },
      });
    }

    res.json({ received: true });
  }

  async vapiWebhook(req: Request, res: Response) {
    if (!isVapiWebhookAuthorized(req)) {
      logger.warn('VAPI webhook: unauthorized (missing or invalid x-vapi-secret)');
      return res.status(401).json({ error: 'Invalid webhook secret' });
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

      // `assistant-request` on the SHARED number.
      //
      // The Vapi number carries one Server URL, so an inbound call lands here
      // rather than on the per-tenant receptionist route. The tenant is
      // resolved from the dialed number and the real receptionist is built by
      // the same code a per-tenant call would use — this is a routing hop, not
      // a second implementation.
      if (messageType === 'assistant-request') {
        const dialed = event.message?.call?.phoneNumber?.number
          ?? event.message?.phoneNumber?.number
          ?? event.call?.phoneNumber?.number;

        /* L'origine d'un RENVOI, si elle voyage avec l'appel. Voir
           `divertedNumber`: c'est ce qui déciderait si un client peut garder son
           numéro et le renvoyer vers une ligne partagée, au lieu d'en acheter
           un (et d'en faire valider l'adresse) chacun. */
        const diverted = inboundRoutingService.divertedNumber(event);

        /* Tracé À CHAQUE appel entrant, et pas seulement en cas d'échec.
           La forme exacte du webhook n'a pas pu être vérifiée sur pièces (la
           documentation Vapi est inaccessible depuis le poste de build), et
           aucun appel entrant réel n'a encore eu lieu: cette ligne est ce qui
           rendra la réponse certaine au PREMIER appel, sans avoir à rejouer
           quoi que ce soit. */
        logger.info(`[Voice] inbound composé=${dialed ?? '?'} renvoyé-de=${diverted ?? 'aucun'}`);

        const routed = await inboundRoutingService.resolveClient(dialed, diverted);
        if (routed.kind !== 'resolved') {
          return res.json({ assistant: inboundRoutingService.unroutableAssistant() });
        }

        const assistant = await realtimeOrchestratorService.buildAssistantForCall(routed.clientId, event);
        if (!assistant) {
          return res.json({ assistant: inboundRoutingService.unroutableAssistant() });
        }
        logger.info(`[Voice] inbound routed to ${routed.businessName} (par ${routed.via === 'diversion' ? 'origine de renvoi' : 'numéro composé'})`);
        return res.json({ assistant });
      }

      switch (messageType) {
        case 'end-of-call-report': {
          const callId = event.message?.call?.id || event.call?.id;
          // Vapi's report is authoritative; the buffer only covers the case
          // where the report arrives without a transcript.
          const buffered = callId ? callSessionStore.end(callId)?.transcript.join('\n') ?? '' : '';
          const transcript = event.message?.transcript || event.transcript || buffered;
          const duration = event.message?.call?.duration || event.call?.duration || 0;
          const recordingUrl = event.message?.recordingUrl || event.recordingUrl;
          const endedReason = event.message?.endedReason || event.endedReason || '';

          // Voicemail detected by VAPI AMD — short-circuit, no need to analyze empty transcript
          if (callId && (endedReason === 'voicemail' || endedReason === 'customer-did-not-answer' || endedReason === 'twilio-failed-to-connect-call')) {
            logger.info(`📼 Call ${callId} ended: ${endedReason} — marking as voicemail/no-answer, will retry later`);
            await prisma.call.updateMany({
              where: { vapiCallId: callId },
              data: {
                status: 'completed',
                endedAt: new Date(),
                durationSeconds: duration,
                outcome: endedReason === 'voicemail' ? 'voicemail' : 'no-answer',
                recordingUrl: recordingUrl || undefined,
              },
            });
            break;
          }

          if (callId) {
            await vapiService.handleCallCompleted(callId, transcript, duration, recordingUrl);
          }
          break;
        }

        case 'call-started':
        case 'status-update':
          if (event.message?.status === 'in-progress' || messageType === 'call-started') {
            const startCallId = event.message?.call?.id || event.call?.id;
            const phoneNumber = event.message?.call?.customer?.number || event.call?.customer?.number || '';
            if (startCallId) {
              // Live state for the transcript buffer. Outbound prospecting has
              // no client tenant, so the session is keyed on the call alone.
              callSessionStore.start({
                vapiCallId: startCallId,
                clientId: 'outbound',
                callerNumber: phoneNumber || null,
                language: 'en',
              });
              await prisma.call.upsert({
                where: { vapiCallId: startCallId },
                update: { status: 'in-progress', startedAt: new Date() },
                create: {
                  vapiCallId: startCallId,
                  phoneNumber: phoneNumber,
                  status: 'in-progress',
                  startedAt: new Date(),
                  direction: 'outbound',
                },
              });
            }
          } else {
            logger.debug(`VAPI call status update: ${event.message?.status || event.status}`);
          }
          break;

        case 'transcript': {
          // Buffered in memory, never written per utterance. The old handler
          // ran a `call.updateMany` on every partial transcript — several
          // database round-trips per second, inside the webhook response path,
          // to store a value that `end-of-call-report` sends again in full.
          const tCallId = event.message?.call?.id || event.call?.id;
          const partialTranscript = event.message?.transcript || event.transcript || '';
          const isFinal = (event.message?.transcriptType ?? 'final') === 'final';
          if (tCallId && partialTranscript && isFinal) {
            const role = event.message?.role === 'assistant' ? 'assistant' : 'user';
            callSessionStore.appendTranscript(tCallId, role, partialTranscript);
          }
          break;
        }

        case 'function-call': {
          const functionName = event.message?.functionCall?.name || event.functionCall?.name;
          const functionParams = event.message?.functionCall?.parameters || event.functionCall?.parameters;
          logger.info(`VAPI function call: ${functionName}`, functionParams);

          if (functionName === 'captureLeadInfo' || functionName === 'capture_lead') {
            const fCallId = event.message?.call?.id || event.call?.id;
            if (fCallId && functionParams) {
              await prisma.call.updateMany({
                where: { vapiCallId: fCallId },
                data: {
                  emailCollected: functionParams.email || null,
                  leadCaptured: true,
                },
              });
            }
          } else if (functionName === 'bookAppointment' || functionName === 'book_appointment') {
            const bCallId = event.message?.call?.id || event.call?.id;
            logger.info(`Booking request from call ${bCallId}`, functionParams);
          }
          break;
        }

        default:
          logger.debug(`Unhandled VAPI event: ${messageType}`);
      }
    } catch (error: any) {
      logger.error(`Error processing VAPI webhook: ${error.message}`);
      storeError(error.message, error.stack || '', '/api/webhooks/vapi');
    }

    res.json({ received: true });
  }

  // NOTE: the inbound client receptionist webhook moved to
  // controllers/voice-webhook.controller.ts. It is a streaming orchestrator
  // now, not a request/response handler — see routes/webhooks.routes.ts.

  // ═══════════════════════════════════════════════════════════
  // TWILIO VOICE/CALL STATUS — CallStatus callback
  // ═══════════════════════════════════════════════════════════
  async twilioVoiceStatus(req: Request, res: Response) {
    const { CallSid, CallStatus, CallDuration, To } = req.body;
    logger.info(`Twilio CallStatus: ${CallSid} → ${CallStatus}`);

    if (CallSid && CallStatus) {
      const outcomeMap: Record<string, string> = {
        completed: 'completed',
        'no-answer': 'no_answer',
        busy: 'busy',
        failed: 'failed',
        canceled: 'canceled',
      };

      // Update call record if exists
      const call = await prisma.call.findFirst({ where: { phoneNumber: To } });
      if (call) {
        await prisma.call.update({
          where: { id: call.id },
          data: {
            outcome: outcomeMap[CallStatus] || CallStatus,
            durationSeconds: CallDuration ? parseInt(CallDuration) : undefined,
            status: CallStatus === 'completed' ? 'completed' : CallStatus,
          },
        });
      }
    }

    res.type('text/xml').send('<Response></Response>');
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
          lang: detectLanguage(prospect.phone || ''),
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
      // No email found in reply — store raw + let AI closer respond
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { emailSmsReplyRaw: body },
      });

      logger.info(`Inbound SMS from ${prospect.businessName}: "${body}" — routing to closer agent`);

      // AI closer responds in background (non-blocking)
      closerAgentService.handleInboundReply({
        prospectId: prospect.id,
        fromPhone: phone,
        message: body,
      }).catch(err => logger.error('[Webhook] Closer agent reply failed:', err));
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
