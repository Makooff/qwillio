// @ts-nocheck
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { smsService } from './sms.service';
import { getAgentName } from '../config/vapi-templates';

/**
 * Voicemail Detection & Handling
 * - Attempts 1-2: detect voicemail → hang up immediately
 * - Attempt 3: leave short message (15s)
 * - Post-voicemail SMS drip on attempt 3 only, sent 2h after
 */

const VOICEMAIL_MESSAGES = {
  en: (businessName: string) =>
    `Hi, this is Ashley calling on behalf of ${businessName}. We tried reaching you a few times. Please call us back at your convenience or visit our website. Thank you!`,
  fr: (businessName: string) =>
    `Bonjour, c'est Marie de ${businessName}. On a essayé de vous joindre. Rappelez-nous quand vous pouvez ou visitez notre site. Merci, bonne journée !`,
};

const POST_VOICEMAIL_SMS = {
  en: (businessName: string) =>
    `Hi! Ashley from ${businessName} here. We tried calling but got your voicemail. Would love to chat about how we can help your business. Reply YES to schedule a quick call!`,
  fr: (businessName: string) =>
    `Bonjour ! Marie de ${businessName}. On vous a laissé un message vocal. On aimerait discuter de comment on peut vous aider. Répondez OUI pour planifier un appel !`,
};

export class VoicemailDetectionService {
  /**
   * Determine action based on attempt number
   */
  getVoicemailAction(attemptNumber: number): 'hangup' | 'leave_message' {
    if (attemptNumber <= 2) return 'hangup';
    return 'leave_message';
  }

  /**
   * Get voicemail message for attempt 3
   */
  getVoicemailMessage(language: 'en' | 'fr', businessName: string): string {
    return VOICEMAIL_MESSAGES[language](businessName);
  }

  /**
   * Schedule post-voicemail SMS drip (2h after voicemail on attempt 3 only)
   */
  async schedulePostVoicemailSms(params: {
    prospectId: string;
    phone: string;
    language: 'en' | 'fr';
    businessName: string;
    attemptNumber: number;
  }): Promise<void> {
    // Only on attempt 3
    if (params.attemptNumber !== 3) return;

    const message = POST_VOICEMAIL_SMS[params.language](params.businessName);

    // Schedule for 2 hours from now
    const sendAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    try {
      // Store scheduled SMS
      await prisma.scheduledSms.create({
        data: {
          prospectId: params.prospectId,
          phone: params.phone,
          message,
          sendAt,
          status: 'pending',
          type: 'post_voicemail',
        },
      });

      logger.info(`Post-voicemail SMS scheduled for ${params.phone} at ${sendAt.toISOString()}`);
    } catch (error) {
      // If scheduledSms table doesn't exist yet, just send directly after delay
      logger.warn('scheduledSms table not available, will send via timeout');
      setTimeout(async () => {
        try {
          await smsService.sendSMS(params.phone, message);
          logger.info(`Post-voicemail SMS sent to ${params.phone}`);
        } catch (err) {
          logger.error(`Failed to send post-voicemail SMS to ${params.phone}:`, err);
        }
      }, 2 * 60 * 60 * 1000);
    }
  }
}

export const voicemailDetectionService = new VoicemailDetectionService();

/**
 * Call Quality Scoring (1-10)
 * Based on: duration, lead captured, transfer requested, sentiment, appointment booked
 */
export function calculateCallQualityScore(call: {
  duration?: number | null;
  leadEmail?: string | null;
  leadName?: string | null;
  transferRequested?: boolean | null;
  interestScore?: number | null;
  appointmentBooked?: boolean | null;
}): number {
  let score = 0;

  // Duration (max 3 points)
  const duration = call.duration || 0;
  if (duration > 120) score += 3;
  else if (duration > 60) score += 2;
  else if (duration > 30) score += 1;

  // Lead captured (2 points)
  if (call.leadEmail || call.leadName) score += 2;

  // Transfer requested (2 points)
  if (call.transferRequested) score += 2;

  // Positive sentiment / interest (2 points)
  const interest = call.interestScore || 0;
  if (interest >= 7) score += 2;
  else if (interest >= 4) score += 1;

  // Appointment booked (1 point)
  if (call.appointmentBooked) score += 1;

  return Math.min(score, 10);
}
