import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { discordService } from './discord.service';
import { smsService } from './sms.service';
import { callNotificationService } from './call-notification.service';
import { googleCalendarService } from './google-calendar.service';
import { spamDetectionService } from './spam-detection.service';

export class ClientCallService {

  // ═══════════════════════════════════════════════════════════
  // HANDLE INCOMING CALL COMPLETED - Processes end-of-call report
  // from VAPI for a client's AI receptionist
  // ═══════════════════════════════════════════════════════════
  async handleClientCallCompleted(
    clientId: string,
    vapiCallId: string,
    transcript: string,
    duration: number,
    callerNumber?: string,
    recordingUrl?: string,
    /* Le moteur réellement utilisé, décidé à la construction de l'assistant.
       `undefined` reste `null` en base: un mode inventé serait un mode
       facturé. */
    voiceMode?: string | null,
  ) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      logger.error(`Client not found for call processing: ${clientId}`);
      return;
    }

    // Spam shield (all plans): score the call before we spend anything else on
    // it. Runs before the insert so repeat-frequency counts only prior calls.
    const spam = await spamDetectionService.classifyInboundCall({
      clientId,
      callerNumber,
      transcript,
      durationSeconds: duration,
    });

    // A spam call skips the GPT-4 transcript analysis entirely (cost saver).
    // A real call gets the full treatment as before.
    const analysis = spam.isSpam
      ? this.emptyAnalysis()
      : await this.analyzeClientCallTranscript(transcript, client);

    // Create client call record
    const clientCall = await prisma.clientCall.create({
      data: {
        clientId,
        vapiCallId,
        callerNumber: callerNumber || null,
        callerName: analysis.callerName || null,
        direction: 'inbound',
        startedAt: new Date(Date.now() - duration * 1000),
        endedAt: new Date(),
        durationSeconds: duration,
        status: 'completed',
        voiceMode: voiceMode ?? null,
        transcript,
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        outcome: spam.isSpam ? 'spam' : analysis.outcome,
        recordingUrl,
        emailCollected: analysis.emailCollected || null,
        nameCollected: analysis.callerName || null,
        phoneCollected: callerNumber || null,
        bookingRequested: analysis.bookingRequested,
        bookingDate: analysis.bookingDate ? new Date(analysis.bookingDate) : null,
        bookingDetails: analysis.bookingDetails || null,
        isLead: analysis.isLead,
        leadScore: analysis.leadScore,
        isSpam: spam.isSpam,
        spamScore: spam.score,
        spamReasons: spam.reasons,
        tags: spam.isSpam ? ['spam', ...spam.reasons] : (analysis.tags || []),
      },
    });

    // Spam call: no booking, no SMS, no lead follow-up. Record the hit so the
    // number can be auto-blocklisted, notify, and stop here.
    if (spam.isSpam) {
      await spamDetectionService.registerSpamHit(clientId, callerNumber, spam.reasons);
      logger.info(
        `🛡️ Spam call blocked for ${client.businessName}: ${callerNumber || 'unknown'} (score ${spam.score}, ${spam.reasons.join(',')})`,
      );
      discordService
        .notify(
          `🛡️ SPAM CALL — ${client.businessName}\nFrom: ${callerNumber || 'unknown'}\nScore: ${spam.score}/100\nReasons: ${spam.reasons.join(', ')}`,
        )
        .catch(() => {});
      // Spam is NOT counted as a real call: it does not touch totalCallsMade or
      // lastCallDate, so it never eats into the client's quota. "Spam doesn't
      // count against you" is a selling point of the shield.
      return clientCall;
    }

    // ── CRM: l'appel devient un contact et une ligne de son historique ──
    //
    // Le CRM existait, cloisonné par client, avec ses routes et son écran, et
    // RIEN ne le remplissait: `createOrMerge` n'avait aucun appelant. Un client
    // ouvrait ses contacts et trouvait une page vide, quel que soit le nombre
    // d'appels reçus. C'est ici que le lien manquait, et nulle part ailleurs:
    // c'est le seul endroit du dépôt où une ligne `clientCall` est créée.
    //
    // Après le court-circuit spam, volontairement: un robot qui appelle ne doit
    // pas se retrouver dans le carnet d'adresses du client.
    //
    // Best-effort et isolé: un CRM qui échoue ne doit pas faire perdre l'appel,
    // sa réservation ni sa notification, qui sont le produit.
    try {
      const { crmDedupService } = await import('./crm-dedup.service');
      const contactId = await crmDedupService.createOrMerge(clientId, {
        // `name` est obligatoire côté schéma, et l'IA ne récupère pas toujours
        // un prénom. Le numéro fait un bien meilleur repli qu'un rejet: le
        // client reconnaît son appelant, et corrigera le nom lui-même.
        name: analysis.callerName || callerNumber || 'Appelant inconnu',
        // Sans prénom, ce qui remplit `name` est le numéro, et rapprocher deux
        // numéros par ressemblance de texte fusionnerait des appelants
        // différents. Le numéro et l'email restent des critères, eux.
        matchByName: !!analysis.callerName,
        email: analysis.emailCollected || undefined,
        phone: callerNumber || undefined,
        // Le métier du client, pas celui de l'appelant: c'est ce que la colonne
        // porte déjà pour les contacts créés à la main.
        niche: client.businessType || undefined,
        leadScore: analysis.isLead ? analysis.leadScore : undefined,
        tags: analysis.tags || [],
        notes: analysis.summary || undefined,
      });

      await prisma.activity.create({
        data: {
          clientId,
          contactId,
          type: 'call',
          description: analysis.summary || null,
          // Ce qui relie la fiche contact à l'appel dont elle vient: sans lui,
          // l'historique dirait « appel » sans pouvoir en montrer un seul.
          callId: clientCall.id,
        },
      });
    } catch (error: any) {
      logger.warn(`[CRM] Contact non enregistré pour l'appel ${clientCall.id}: ${error.message}`);
    }

    // If booking was made, create booking record
    /* Le rendez-vous a-t-il ÉTÉ FIXÉ. `bookingRequested` dit seulement que
       l'appelant en a demandé un; c'est la création de la réservation qui dit
       s'il en repart avec. La notification a besoin des deux pour distinguer
       une bonne nouvelle d'un rappel à passer dans l'heure. */
    let bookingConfirmed = false;
    if (analysis.bookingRequested && analysis.bookingDate) {
      try {
        const booking = await prisma.clientBooking.create({
          data: {
            clientId,
            clientCallId: clientCall.id,
            customerName: analysis.callerName || 'Unknown',
            customerPhone: callerNumber || null,
            customerEmail: analysis.emailCollected || null,
            bookingDate: new Date(analysis.bookingDate),
            bookingTime: analysis.bookingTime || null,
            serviceType: analysis.serviceType || null,
            partySize: analysis.partySize || null,
            specialRequests: analysis.specialRequests || null,
            status: 'confirmed',
          },
        });
        logger.info(`Booking created for ${client.businessName}: ${analysis.callerName} on ${analysis.bookingDate}`);

        // Send booking confirmation SMS (fire-and-forget)
        if (callerNumber) {
          smsService.sendBookingConfirmationSMS({
            customerPhone: callerNumber,
            customerName: analysis.callerName || 'there',
            businessName: client.businessName,
            bookingDate: analysis.bookingDate,
            bookingTime: analysis.bookingTime || null,
            serviceType: analysis.serviceType || null,
          }).then(sent => {
            if (sent) {
              prisma.clientBooking.update({
                where: { id: booking.id },
                data: { smsConfirmationSent: true },
              }).catch(() => {});
            }
          }).catch(err => logger.error('Booking confirmation SMS failed:', err));
        }
        /* Posé DÈS que la réservation existe, avant les envois annexes: un
           SMS de paiement ou une synchronisation d'agenda qui échoue ne rend
           pas le rendez-vous inexistant. */
        bookingConfirmed = true;

        // Auto-send payment SMS after booking
        try {
          const { agentPaymentsService } = await import('./agent-payments.service');
          await agentPaymentsService.sendPaymentLinkAfterBooking(clientId, {
            customerName: analysis.callerName || callerNumber || 'Customer',
            customerPhone: callerNumber,
            serviceType: analysis.bookingDetails || undefined,
          });
        } catch (err) {
          logger.warn('Failed to send post-booking payment SMS:', err);
        }

        // Sync to Google Calendar if client has connected their account (fire-and-forget)
        if (client.googleCalendarRefreshToken) {
          this.syncBookingToCalendar(booking.id, client.googleCalendarRefreshToken, client.googleCalendarId || 'primary')
            .catch(err => logger.error('Google Calendar sync failed:', err));
        }
      } catch (err) {
        logger.error('Failed to create booking record:', err);
      }
    }

    /* Prévenir le propriétaire, tout de suite. Jamais attendu: la fin d'appel
       n'a pas à dépendre de Twilio ni de Resend. Le spam est déjà sorti plus
       haut, il ne réveille donc personne. */
    void callNotificationService
      .notify(client, {
        id: clientCall.id,
        callerNumber: clientCall.callerNumber,
        callerName: clientCall.callerName,
        summary: clientCall.summary,
        outcome: clientCall.outcome,
        sentiment: clientCall.sentiment,
        durationSeconds: clientCall.durationSeconds,
        isSpam: clientCall.isSpam,
        isLead: clientCall.isLead,
        bookingRequested: clientCall.bookingRequested,
        bookingConfirmed,
      })
      .catch(err => logger.warn('[CallNotify] notification échouée:', err));

    // Update client total calls
    await prisma.client.update({
      where: { id: clientId },
      data: {
        totalCallsMade: { increment: 1 },
        lastCallDate: new Date(),
      },
    });

    // Check minute quota (per-minute billing). Spam is excluded — it never
    // counts against the quota. The quota-alert cron owns the deduped 80/95/100
    // customer emails; this is only an internal Discord heads-up at 90%.
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const usageAgg = await prisma.clientCall.aggregate({
      where: { clientId, isSpam: false, startedAt: { gte: startOfMonth } },
      _sum: { durationSeconds: true },
    });
    const minutesUsed = Math.round((usageAgg._sum.durationSeconds ?? 0) / 60);

    if (client.monthlyMinutesQuota && minutesUsed >= client.monthlyMinutesQuota * 0.9) {
      await discordService.notify(
        `⚠️ QUOTA WARNING\n\nClient: ${client.businessName}\nMinutes this month: ${minutesUsed}/${client.monthlyMinutesQuota}\n${minutesUsed >= client.monthlyMinutesQuota ? '🔴 QUOTA REACHED!' : '🟡 90% of quota used'}`
      );
    }

    logger.info(`Client call processed: ${client.businessName} | ${analysis.sentiment} | Lead: ${analysis.isLead} | Booking: ${analysis.bookingRequested}`);
  }

  // Neutral analysis used for spam calls, which skip the GPT-4 pass entirely.
  private emptyAnalysis(): ClientCallAnalysis {
    return {
      callerName: null,
      emailCollected: null,
      sentiment: 'neutral',
      outcome: 'spam',
      summary: 'Call flagged as spam by the inbound shield; analysis skipped.',
      bookingRequested: false,
      bookingDate: null,
      bookingTime: null,
      bookingDetails: null,
      serviceType: null,
      partySize: null,
      specialRequests: null,
      isLead: false,
      leadScore: 0,
      tags: [],
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ANALYZE CLIENT CALL TRANSCRIPT - GPT-4 analysis
  // ═══════════════════════════════════════════════════════════
  private async analyzeClientCallTranscript(transcript: string, client: any): Promise<ClientCallAnalysis> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert call analyst. Analyze this incoming customer call transcript for ${client.businessName} (${client.businessType}).

Return a JSON object with:
- callerName: caller's name if mentioned (string or null)
- emailCollected: email if the caller provided one (string or null)
- sentiment: "positive", "neutral", or "negative"
- outcome: "booking_made", "info_provided", "message_taken", "transferred", "complaint", "missed", or "other"
- summary: 2-sentence summary of the call (string)
- bookingRequested: did the caller want to book/make an appointment? (boolean)
- bookingDate: if booking was made, the date (ISO string or null)
- bookingTime: if booking was made, the time (string like "14:00" or null)
- serviceType: type of service requested (string or null)
- partySize: number of people if mentioned (number or null)
- specialRequests: any special requests mentioned (string or null)
- isLead: is this person a potential customer/qualified lead? (boolean)
- leadScore: lead quality score 1-10 (number)
- tags: relevant tags like ["new_customer", "complaint", "urgent", "vip", "repeat_customer"] (string[])`,
            },
            {
              role: 'user',
              content: `Transcript:\n${transcript}`,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await response.json() as any;
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      logger.error('Error analyzing client call transcript:', error);
      return {
        callerName: null,
        emailCollected: null,
        sentiment: 'neutral',
        outcome: 'other',
        summary: 'Automatic analysis failed, manual review needed.',
        bookingRequested: false,
        bookingDate: null,
        bookingTime: null,
        bookingDetails: null,
        serviceType: null,
        partySize: null,
        specialRequests: null,
        isLead: false,
        leadScore: 3,
        tags: [],
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // LOG TRANSFER - Records call transfer events
  // ═══════════════════════════════════════════════════════════
  async logTransfer(clientId: string, vapiCallId: string | undefined, status: string, event: any) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      logger.error(`Client not found for transfer log: ${clientId}`);
      return;
    }

    const transferNumber = client.transferNumber || 'unknown';
    const reason = event.message?.reason || event.reason || 'explicit_request';
    const triggerPhrase = event.message?.triggerPhrase || event.triggerPhrase || null;

    // Map VAPI status to our transfer status
    let transferStatus = 'initiated';
    if (status === 'completed' || status === 'transferred') {
      transferStatus = 'completed';
    } else if (status === 'failed' || status === 'error') {
      transferStatus = 'failed';
    }

    const transfer = await prisma.callTransfer.create({
      data: {
        clientId,
        vapiCallId: vapiCallId || null,
        transferNumber,
        reason,
        triggerPhrase,
        preTransferMessage: 'Of course — let me connect you with someone from the team right now. One moment please.',
        transferStatus,
        failedReason: transferStatus === 'failed' ? (event.message?.error || 'No answer') : null,
        callbackRequested: transferStatus === 'failed',
        callbackPriority: transferStatus === 'failed' ? 'high' : 'normal',
      },
    });

    // Discord notification for transfers
    const emoji = transferStatus === 'completed' ? '🔄' : transferStatus === 'failed' ? '❌' : '📞';
    await discordService.notify(
      `${emoji} CALL TRANSFER ${transferStatus.toUpperCase()}\n\nClient: ${client.businessName}\nTransfer to: ${transferNumber}\nReason: ${reason}\nVAPI Call: ${vapiCallId || 'N/A'}${transferStatus === 'failed' ? '\n⚠️ Callback requested (high priority)' : ''}`
    );

    logger.info(`Transfer logged for ${client.businessName}: ${transferStatus} → ${transferNumber}`);
    return transfer;
  }

  // ═══════════════════════════════════════════════════════════
  // CREATE CALLBACK REQUEST - For failed transfers
  // ═══════════════════════════════════════════════════════════
  async createCallbackRequest(clientId: string, callerNumber: string, vapiCallId?: string) {
    const transfer = await prisma.callTransfer.create({
      data: {
        clientId,
        vapiCallId: vapiCallId || null,
        transferNumber: 'callback_requested',
        reason: 'explicit_request',
        transferStatus: 'failed',
        failedReason: 'No answer on designated number',
        callbackRequested: true,
        callbackNumber: callerNumber,
        callbackPriority: 'high',
      },
    });

    logger.info(`Callback request created for client ${clientId}, caller: ${callerNumber}`);
    return transfer;
  }

  /**
   * Exchange Google refresh token for access token and sync booking to calendar
   */
  private async syncBookingToCalendar(bookingId: string, refreshToken: string, calendarId: string) {
    const { GOOGLE_CLIENT_ID } = process.env;
    const { GOOGLE_CLIENT_SECRET } = process.env;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      logger.warn('Google OAuth not configured, skipping calendar sync');
      return;
    }

    // Exchange refresh token for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      logger.error('Failed to refresh Google access token');
      return;
    }

    const tokenData = await tokenResponse.json() as any;
    await googleCalendarService.createEventFromBooking(bookingId, tokenData.access_token, calendarId);
    logger.info(`Booking ${bookingId} synced to Google Calendar`);
  }
}

interface ClientCallAnalysis {
  callerName: string | null;
  emailCollected: string | null;
  sentiment: string;
  outcome: string;
  summary: string;
  bookingRequested: boolean;
  bookingDate: string | null;
  bookingTime: string | null;
  bookingDetails: string | null;
  serviceType: string | null;
  partySize: number | null;
  specialRequests: string | null;
  isLead: boolean;
  leadScore: number;
  tags: string[];
}

export const clientCallService = new ClientCallService();
