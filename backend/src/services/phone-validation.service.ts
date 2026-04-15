import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';

interface PhoneValidationResult {
  valid: boolean;
  type: string | null; // mobile, landline, voip
  confidence: number;  // 0.0 - 1.0
  source: string;      // twilio_lookup
}

export class PhoneValidationService {
  private twilioClient: any = null;

  private getTwilioClient() {
    if (!this.twilioClient && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      try {
        const twilio = require('twilio');
        this.twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
      } catch (e) {
        logger.warn('Twilio SDK not available, phone validation disabled');
      }
    }
    return this.twilioClient;
  }

  /**
   * Validate a phone number using Twilio Lookup API
   */
  async validatePhone(phoneNumber: string): Promise<PhoneValidationResult> {
    const client = this.getTwilioClient();
    if (!client) {
      return { valid: false, type: null, confidence: 0, source: 'unavailable' };
    }

    try {
      const lookup = await client.lookups.v2.phoneNumbers(phoneNumber).fetch({
        fields: 'line_type_intelligence',
      });

      const lineType = lookup.lineTypeIntelligence?.type || null;
      const valid = lookup.valid !== false;

      // Confidence based on line type
      let confidence = 0.5;
      if (lineType === 'mobile') confidence = 0.95;
      else if (lineType === 'landline') confidence = 0.9;
      else if (lineType === 'fixedVoip') confidence = 0.8;
      else if (lineType === 'voip') confidence = 0.6;
      else if (lineType === 'nonFixedVoip') confidence = 0.4;

      return {
        valid,
        type: lineType,
        confidence: valid ? confidence : 0,
        source: 'twilio_lookup',
      };
    } catch (error: any) {
      if (error.code === 20404) {
        // Phone number not found
        return { valid: false, type: null, confidence: 0, source: 'twilio_lookup' };
      }
      logger.error(`Twilio Lookup error for ${phoneNumber}:`, error.message);
      return { valid: false, type: null, confidence: 0, source: 'twilio_error' };
    }
  }

  /**
   * Validate unvalidated prospects in batches
   */
  async validateBatch(batchSize: number = 10): Promise<number> {
    const prospects = await prisma.prospect.findMany({
      where: {
        phone: { not: null },
        phoneValidatedAt: null,  // Only pick never-validated prospects (not re-check already-invalid ones)
        status: { in: ['new', 'contacted'] },
      },
      orderBy: { score: 'desc' },
      take: batchSize,
    });

    if (prospects.length === 0) return 0;

    let validated = 0;

    for (const prospect of prospects) {
      if (!prospect.phone) continue;

      try {
        const result = await this.validatePhone(prospect.phone);

        await prisma.prospect.update({
          where: { id: prospect.id },
          data: {
            phoneValidated: result.valid,
            phoneValidationSource: result.source,
            phoneNumberConfidence: result.confidence,
            phoneValidatedAt: new Date(),
            // Recalculate score with validation bonus
            score: result.valid ? Math.min(prospect.score + 1, 22) : prospect.score,
          },
        });

        validated++;
        logger.info(`Phone validated: ${prospect.businessName} → ${result.valid ? 'VALID' : 'INVALID'} (${result.type}, confidence: ${result.confidence})`);

        // Update daily analytics
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await prisma.analyticsDaily.upsert({
          where: { date: today },
          update: {
            phonesValidated: { increment: 1 },
            costTwilioLookup: { increment: 0.005 }, // ~$0.005 per lookup
          },
          create: {
            date: today,
            phonesValidated: 1,
            costTwilioLookup: 0.005,
          },
        });

        // Small delay between lookups to respect rate limits
        await new Promise(r => setTimeout(r, 200));
      } catch (error) {
        logger.error(`Failed to validate phone for ${prospect.businessName}:`, error);
      }
    }

    return validated;
  }
}

export const phoneValidationService = new PhoneValidationService();
