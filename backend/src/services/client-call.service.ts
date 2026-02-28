import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { discordService } from './discord.service';

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
  ) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      logger.error(`Client not found for call processing: ${clientId}`);
      return;
    }

    // Analyze the call transcript with GPT-4
    const analysis = await this.analyzeClientCallTranscript(transcript, client);

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
        transcript,
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        outcome: analysis.outcome,
        recordingUrl,
        emailCollected: analysis.emailCollected || null,
        nameCollected: analysis.callerName || null,
        phoneCollected: callerNumber || null,
        bookingRequested: analysis.bookingRequested,
        bookingDate: analysis.bookingDate ? new Date(analysis.bookingDate) : null,
        bookingDetails: analysis.bookingDetails || null,
        isLead: analysis.isLead,
        leadScore: analysis.leadScore,
        tags: analysis.tags || [],
      },
    });

    // If booking was made, create booking record
    if (analysis.bookingRequested && analysis.bookingDate) {
      try {
        await prisma.clientBooking.create({
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
      } catch (err) {
        logger.error('Failed to create booking record:', err);
      }
    }

    // Update client total calls
    await prisma.client.update({
      where: { id: clientId },
      data: {
        totalCallsMade: { increment: 1 },
        lastCallDate: new Date(),
      },
    });

    // Check call quota
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthlyCallCount = await prisma.clientCall.count({
      where: { clientId, createdAt: { gte: startOfMonth } },
    });

    if (client.monthlyCallsQuota && monthlyCallCount >= client.monthlyCallsQuota * 0.9) {
      await discordService.notify(
        `⚠️ QUOTA WARNING\n\nClient: ${client.businessName}\nCalls this month: ${monthlyCallCount}/${client.monthlyCallsQuota}\n${monthlyCallCount >= client.monthlyCallsQuota ? '🔴 QUOTA REACHED!' : '🟡 90% of quota used'}`
      );
    }

    logger.info(`Client call processed: ${client.businessName} | ${analysis.sentiment} | Lead: ${analysis.isLead} | Booking: ${analysis.bookingRequested}`);
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
          model: 'gpt-4-turbo',
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
