import { prisma } from '../config/database';
import { vapiClient } from '../config/vapi';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { CallAnalysis, PACKAGES } from '../types';
import { recommendPackage, NICHE_PRIORITY_ORDER } from '../utils/helpers';
import { discordService } from './discord.service';
import { smsService } from './sms.service';
import { NICHE_SCRIPTS, DEFAULT_SCRIPT, getInstallmentAmount } from '../config/niche-scripts';
import { isHoliday, isWithinCallWindow, isPriorityDay, isBlackoutPeriod, getDayHourBonus, CALL_RATE_LIMIT_MS, MAX_CALL_ATTEMPTS } from '../config/scheduling';
import { INTERESTED_FOLLOWUP_SEQUENCE, CALLBACK_RETRY_DELAYS } from '../config/followup-sequence';
import { emailService } from './email.service';
import { normalizeEmail, isValidEmail } from '../utils/validators';
import { nicheLearningService } from './niche-learning.service';
import { emitEvent } from '../config/socket';

// Interest level thresholds — single source of truth
export const INTEREST_QUALIFIED = 7;  // >= 7 = qualified, auto-start free trial
export const INTEREST_INTERESTED = 4; // >= 4 = interested, send follow-up sequence

export class VapiService {
  async callNextProspect(): Promise<boolean> {
    // ── 1. Time checks (no DB queries, fast exit) ──────────
    const now = new Date();
    const usEastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hour = usEastern.getHours();
    const day = usEastern.getDay();

    if (!env.AUTOMATION_DAYS.includes(day) || hour < env.AUTOMATION_START_HOUR || hour >= env.AUTOMATION_END_HOUR) {
      logger.debug(`Outside US business hours (ET: ${hour}h, day ${day}), skipping call`);
      return false;
    }

    // Holiday check
    if (isHoliday(now, 'US')) {
      logger.info('Today is a holiday, skipping calls');
      return false;
    }

    // Blackout period: Never call Monday before 10am or Friday after 2pm (US Eastern)
    if (isBlackoutPeriod('America/New_York')) {
      logger.info('Blackout period (Mon before 10am or Fri after 2pm ET), skipping calls');
      return false;
    }

    // ── 2. Bot status check ────────────────────────────────
    const botStatus = await prisma.botStatus.findFirst();
    if (!botStatus || !botStatus.isActive) {
      logger.info('Bot is inactive, skipping call');
      return false;
    }

    // Check quota without incrementing yet
    if (botStatus.callsToday >= botStatus.callsQuotaDaily) {
      logger.info('Daily call quota reached');
      return false;
    }

    // Rate limit: 1 call per minute minimum
    if (botStatus.lastCall && (Date.now() - botStatus.lastCall.getTime()) < CALL_RATE_LIMIT_MS) {
      logger.debug('Rate limit: waiting 1 minute between calls');
      return false;
    }

    // ── 3. Find a prospect to call ─────────────────────────
    const candidates = await prisma.prospect.findMany({
      where: {
        status: 'new',
        phone: { not: null },
        callAttempts: { lt: MAX_CALL_ATTEMPTS },
        OR: [
          { lastCallDate: null },
          { lastCallDate: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
        ],
      },
      orderBy: { score: 'desc' },
      take: 50,
    });

    if (candidates.length === 0) {
      logger.info('No prospects available to call');
      return false;
    }

    // Filter by niche call window and sort by priority
    const priorityBonus = isPriorityDay() ? 2 : 0;
    const scoredCandidates = candidates
      .map(p => {
        const prospectTz = p.timezone || 'America/New_York';
        const script = NICHE_SCRIPTS[p.businessType] || DEFAULT_SCRIPT;
        const inWindow = isWithinCallWindow(prospectTz, script.callWindow.start, script.callWindow.end);
        const prospectTime = new Date(now.toLocaleString('en-US', { timeZone: prospectTz }));
        const prospectHour = prospectTime.getHours();
        const inBusinessHours = prospectHour >= 9 && prospectHour < 18;
        const nichePriority = NICHE_PRIORITY_ORDER[p.businessType] ?? 0;
        const dayHourBonus = getDayHourBonus(prospectTz);
        return {
          prospect: p,
          effectiveScore: p.score + nichePriority + priorityBonus + dayHourBonus + (inWindow ? 5 : 0) + (inBusinessHours ? 3 : -10) + (p.phoneValidated ? 1 : 0),
          inWindow,
          inBusinessHours,
        };
      })
      .filter(c => c.inBusinessHours)
      .sort((a, b) => b.effectiveScore - a.effectiveScore);

    const prospect = scoredCandidates.find(c => c.inWindow)?.prospect || scoredCandidates[0]?.prospect;

    if (!prospect) {
      logger.info('No prospects in business hours right now');
      return false;
    }

    // ── 4. NOW increment quota (we have a valid prospect) ──
    const updated = await prisma.botStatus.updateMany({
      where: {
        id: botStatus.id,
        callsToday: { lt: botStatus.callsQuotaDaily },
      },
      data: {
        callsToday: { increment: 1 },
        lastCall: new Date(),
      },
    });
    if (updated.count === 0) {
      logger.info('Daily call quota reached (atomic check)');
      return false;
    }

    logger.info(`Calling prospect: ${prospect.businessName} (score: ${prospect.score}/22, type: ${prospect.businessType}, tz: ${prospect.timezone})`);

    try {
      // Create call record
      const callRecord = await prisma.call.create({
        data: {
          prospectId: prospect.id,
          phoneNumber: prospect.phone!,
          direction: 'outbound',
          status: 'queued',
          startedAt: new Date(),
        },
      });

      // Notify Discord
      await discordService.notify(
        `📞 CALL IN PROGRESS\n\nProspect: ${prospect.businessName}\nIndustry: ${prospect.businessType}\nPhone: ${prospect.phone}\nScore: ${prospect.score}/22\nTimezone: ${prospect.timezone}\nAttempt: ${prospect.callAttempts + 1}/${MAX_CALL_ATTEMPTS}`
      );

      // Make VAPI call with niche-specific system prompt
      const nicheScript = NICHE_SCRIPTS[prospect.businessType] || DEFAULT_SCRIPT;
      const systemPrompt = await this.generateSalesPrompt(prospect);

      // Pick Ashley (EN) or Marie (FR) assistant based on prospect language
      const isFrench = prospect.country === 'FR' || prospect.country === 'BE' || prospect.country === 'CA';
      const assistantId = isFrench && env.VAPI_ASSISTANT_ID_FR ? env.VAPI_ASSISTANT_ID_FR : env.VAPI_ASSISTANT_ID;

      const vapiCall = await vapiClient.createCall({
        assistantId,
        phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: prospect.phone!,
          name: (prospect.businessName || '').slice(0, 40),
        },
        assistantOverrides: {
          model: {
            provider: 'openai',
            model: env.VAPI_MODEL,
            messages: [{ role: 'system', content: systemPrompt }],
          },
          voice: {
            provider: '11labs',
            voiceId: env.VAPI_VOICE_ID,
            model: 'eleven_turbo_v2_5',
            stability: env.VAPI_STABILITY,
            similarityBoost: env.VAPI_SIMILARITY_BOOST,
            style: env.VAPI_STYLE,
            useSpeakerBoost: true,
            optimizeStreamingLatency: env.VAPI_OPTIMIZE_LATENCY,
            fallbackPlan: {
              voices: [
                { provider: '11labs', voiceId: env.VAPI_VOICE_FALLBACK_1 },
                { provider: '11labs', voiceId: env.VAPI_VOICE_FALLBACK_2 },
              ],
            },
          },
          backgroundSound: 'office',
          silenceTimeoutSeconds: env.VAPI_SILENCE_TIMEOUT,
          maxDurationSeconds: env.VAPI_MAX_DURATION,
          responseDelaySeconds: 0.4,
          interruptionsEnabled: true,
          numWordsToInterruptAssistant: Math.round(env.VAPI_INTERRUPTION_THRESHOLD / 50),
          firstMessage: nicheScript.firstMessage
            ? nicheScript.firstMessage.replace('{businessName}', prospect.businessName)
            : `Hey! Hi, this is Ashley from Qwillio. Um, is this the owner of ${prospect.businessName}? I had a quick question for you.`,
        },
      }) as any;

      // Update call record with VAPI call ID
      await prisma.call.update({
        where: { id: callRecord.id },
        data: {
          vapiCallId: vapiCall.id,
          status: 'in-progress',
        },
      });

      // Update prospect
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: {
          status: 'contacted',
          lastCallDate: new Date(),
          callAttempts: { increment: 1 },
        },
      });

      // Bot status already updated atomically above (callsToday + lastCall)

      // Update daily analytics
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.analyticsDaily.upsert({
        where: { date: today },
        update: { callsMade: { increment: 1 } },
        create: { date: today, callsMade: 1 },
      });

      return true;
    } catch (error) {
      logger.error(`Error calling prospect ${prospect.businessName}:`, error);
      await discordService.notify(`❌ CALL ERROR: ${prospect.businessName} - ${(error as Error).message}`);

      // ── Rollback quota increment — VAPI call failed, shouldn't count ──
      try {
        await prisma.botStatus.updateMany({
          where: { id: botStatus.id },
          data: { callsToday: { decrement: 1 } },
        });
        logger.info(`Quota decremented after failed VAPI call for ${prospect.businessName}`);
      } catch (rollbackErr) {
        logger.error('Failed to rollback quota:', rollbackErr);
      }

      return false;
    }
  }

  async handleCallCompleted(vapiCallId: string, transcript: string, duration: number, recordingUrl?: string) {
    const call = await prisma.call.findUnique({
      where: { vapiCallId },
      include: { prospect: true },
    });

    if (!call || !call.prospect) {
      logger.error(`Call not found for VAPI call ID: ${vapiCallId}`);
      return;
    }

    // Analyze transcript with GPT-4
    const analysis = await this.analyzeTranscript(transcript, call.prospect);

    // Update call record
    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: 'completed',
        endedAt: new Date(),
        durationSeconds: duration,
        transcript,
        summary: analysis.summary,
        sentiment: analysis.interestLevel >= INTEREST_QUALIFIED ? 'positive' : analysis.interestLevel >= INTEREST_INTERESTED ? 'neutral' : 'negative',
        interestLevel: analysis.interestLevel,
        emailCollected: analysis.email,
        needsMentioned: analysis.painPoints,
        objections: analysis.objections,
        budgetMentioned: analysis.budgetAvailable,
        timelineMentioned: analysis.timeline,
        decisionMakerReached: analysis.decisionMaker,
        outcome: analysis.outcome as any,
        recommendedPackage: analysis.recommendedPackage as any,
        nextAction: analysis.nextAction,
        recordingUrl,
      },
    });

    // Update prospect based on analysis
    const newStatus = analysis.interestLevel >= INTEREST_QUALIFIED ? 'qualified' :
                      analysis.interestLevel >= INTEREST_INTERESTED ? 'interested' : 'contacted';

    // ═══ EMAIL VALIDATION & NORMALIZATION ═══
    let validatedEmail = call.prospect.email;
    if (analysis.email) {
      const normalized = normalizeEmail(analysis.email);
      if (isValidEmail(normalized)) {
        validatedEmail = normalized;
      } else {
        logger.warn(`Invalid email format extracted from call: "${analysis.email}" (normalized: "${normalized}") — keeping previous email`);
      }
    }

    await prisma.prospect.update({
      where: { id: call.prospect.id },
      data: {
        status: newStatus,
        email: validatedEmail,
        contactName: analysis.contactName || call.prospect.contactName,
        interestLevel: analysis.interestLevel,
        painPoints: analysis.painPoints,
        callDuration: duration,
        callTranscript: transcript,
        callSentiment: analysis.interestLevel >= INTEREST_QUALIFIED ? 'positive' : analysis.interestLevel >= INTEREST_INTERESTED ? 'neutral' : 'negative',
        nextAction: analysis.interestLevel >= INTEREST_QUALIFIED ? 'send_quote' :
                    analysis.interestLevel >= INTEREST_INTERESTED ? 'callback_7days' : 'callback_3months',
        nextActionDate: analysis.interestLevel >= INTEREST_QUALIFIED ? new Date() :
                        analysis.interestLevel >= INTEREST_INTERESTED ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) :
                        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });

    // Update analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.analyticsDaily.upsert({
      where: { date: today },
      update: {
        callsSuccessful: { increment: 1 },
        totalCallDuration: { increment: duration },
        prospectsContacted: { increment: 1 },
        prospectsQualified: { increment: analysis.interestLevel >= INTEREST_QUALIFIED ? 1 : 0 },
      },
      create: {
        date: today,
        callsSuccessful: 1,
        totalCallDuration: duration,
        prospectsContacted: 1,
        prospectsQualified: analysis.interestLevel >= INTEREST_QUALIFIED ? 1 : 0,
      },
    });

    // Detect setup fee objection
    const setupFeeObjection = analysis.objections.some(o =>
      /setup|installation|frais|expensive|cher|prix/i.test(o)
    );
    if (setupFeeObjection) {
      await prisma.call.update({
        where: { id: call.id },
        data: { setupFeeObjectionRaised: true },
      });
    }

    // If qualified -> send registration invite email (skip if email already bounced)
    if (analysis.interestLevel >= INTEREST_QUALIFIED && validatedEmail && !call.prospect.emailBounced) {
      logger.info(`Prospect ${call.prospect.businessName} qualified (interest: ${analysis.interestLevel}/10) - sending registration invite`);
      // Instead of quoteService.startFreeTrial, send registration link email
      const registrationUrl = `${env.FRONTEND_URL?.split(',')[0]}/register`;
      await emailService.sendRegistrationInvite({
        to: validatedEmail,
        contactName: call.prospect.contactName || call.prospect.businessName,
        businessName: call.prospect.businessName,
        registrationUrl,
        recommendedPlan: analysis.recommendedPackage || 'pro',
      });
      logger.info(`Registration invite sent to ${validatedEmail} for ${call.prospect.businessName}`);
    } else if (analysis.interestLevel >= INTEREST_QUALIFIED && call.prospect.emailBounced) {
      logger.warn(`Prospect ${call.prospect.businessName} qualified but email bounced — skipping free trial, waiting for SMS correction`);
    }

    // ═══ CONFIRMATION EMAIL + 24h VERIFICATION CHECK ═══
    // Send confirmation email to validate the collected address (bounce detection via Resend webhook)
    if (validatedEmail && analysis.interestLevel >= INTEREST_INTERESTED) {
      // Schedule confirmation email via reminder system (survives server restarts)
      await prisma.reminder.create({
        data: {
          targetType: 'prospect',
          targetId: call.prospect.id,
          reminderType: 'email_confirmation_30s',
          scheduledAt: new Date(Date.now() + 30_000), // 30 second delay
        },
      });

      // Schedule 24h email verification check — if not verified by then, send SMS fallback
      await prisma.reminder.create({
        data: {
          targetType: 'prospect',
          targetId: call.prospect.id,
          reminderType: 'email_verification_check',
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    // ═══ AUTOMATED FOLLOW-UP SEQUENCE ═══
    // SMS immediately after call (for interested/qualified)
    if (['qualified', 'interested', 'callback_later', 'voicemail', 'no-answer'].includes(analysis.outcome)) {
      try {
        await smsService.sendPostCallSMS(
          { phone: call.prospect.phone, businessName: call.prospect.businessName, contactName: call.prospect.contactName },
          analysis.outcome
        );
      } catch (e) {
        logger.warn('Post-call SMS failed:', e);
      }
    }

    // Schedule follow-up email sequence for interested/qualified prospects
    if (analysis.interestLevel >= INTEREST_INTERESTED) {
      await this.scheduleFollowUpSequence(call.prospect.id, call.id);
    }

    // Schedule callback retries for no_answer/voicemail — or mark as exhausted after max attempts
    if (['no-answer', 'voicemail'].includes(analysis.outcome)) {
      const currentAttempts = call.prospect.callAttempts || 1;
      if (currentAttempts >= MAX_CALL_ATTEMPTS) {
        // Max attempts reached → send exhausted SMS and mark prospect as exhausted
        logger.info(`Prospect ${call.prospect.businessName} exhausted after ${currentAttempts} attempts — sending final SMS`);
        try {
          await smsService.sendExhaustedSMS(
            { phone: call.prospect.phone, businessName: call.prospect.businessName, contactName: call.prospect.contactName }
          );
        } catch (e) {
          logger.warn('Exhausted SMS failed:', e);
        }
        await prisma.prospect.update({
          where: { id: call.prospect.id },
          data: { status: 'exhausted' },
        });
        await discordService.notify(
          `😴 PROSPECT EXHAUSTED\n\nProspect: ${call.prospect.businessName}\nAttempts: ${currentAttempts}/${MAX_CALL_ATTEMPTS}\nFinal SMS sent\nStatus: exhausted`
        );
      } else {
        // Still has retries left
        const attemptIndex = currentAttempts - 1;
        if (attemptIndex < CALLBACK_RETRY_DELAYS.length) {
          const delay = CALLBACK_RETRY_DELAYS[attemptIndex];
          await prisma.reminder.create({
            data: {
              targetType: 'prospect',
              targetId: call.prospect.id,
              reminderType: 'callback_retry',
              scheduledAt: new Date(Date.now() + delay),
            },
          });
          logger.info(`Scheduled callback retry for ${call.prospect.businessName} in ${delay / 3600000}h`);
        }
      }
    }

    // Discord notification
    const emoji = analysis.interestLevel >= INTEREST_QUALIFIED ? '✅' : analysis.interestLevel >= INTEREST_INTERESTED ? '🟡' : '❌';
    await discordService.notify(
      `${emoji} CALL COMPLETED\n\nProspect: ${call.prospect.businessName}\nInterest: ${analysis.interestLevel}/10\nPackage: ${analysis.recommendedPackage.toUpperCase()}\nEmail: ${validatedEmail || 'Not collected'}${analysis.email && validatedEmail !== analysis.email ? ` (raw: ${analysis.email})` : ''}\nAction: ${analysis.nextAction}${setupFeeObjection ? '\n⚠️ Setup fee objection raised' : ''}`
    );

    // ═══ REAL-TIME SOCKET EVENTS ═══
    // Emit call-completed for every finished call
    emitEvent('call-completed', {
      businessName: call.prospect.businessName,
      outcome: analysis.outcome,
      interestScore: analysis.interestLevel,
      duration,
      timestamp: new Date().toISOString(),
    });

    // Emit activity event for the live feed
    emitEvent('activity', {
      icon: emoji,
      message: `${call.prospect.businessName} — ${analysis.outcome} (${analysis.interestLevel}/10)`,
      businessName: call.prospect.businessName,
      interestScore: analysis.interestLevel,
      date: new Date().toISOString(),
    });

    // Hot lead alert when interest >= 7
    if (analysis.interestLevel >= INTEREST_QUALIFIED) {
      emitEvent('hot-lead', {
        businessName: call.prospect.businessName,
        score: analysis.interestLevel,
        city: call.prospect.city || 'Unknown',
        timestamp: new Date().toISOString(),
      });
    }

    // ═══ POST-CALL LEARNING ═══
    // If call didn't convert (interest < 7), extract niche-specific failure insights
    if (analysis.interestLevel < 7) {
      nicheLearningService.extractFailureInsights(call.id, analysis, call.prospect.businessType)
        .catch(err => logger.warn('Post-call learning extraction failed:', err));
    }
  }

  /**
   * Schedule the full follow-up email sequence after a call
   */
  private async scheduleFollowUpSequence(prospectId: string, callId: string): Promise<void> {
    const now = Date.now();
    for (const step of INTERESTED_FOLLOWUP_SEQUENCE) {
      if (step.type === 'sms') continue; // SMS sent immediately above
      await prisma.reminder.create({
        data: {
          targetType: 'prospect',
          targetId: prospectId,
          reminderType: step.reminderType,
          scheduledAt: new Date(now + step.delayMs),
        },
      });
    }
    logger.info(`Scheduled ${INTERESTED_FOLLOWUP_SEQUENCE.length - 1} follow-up emails for prospect ${prospectId}`);
  }

  private async analyzeTranscript(transcript: string, prospect: any): Promise<CallAnalysis> {
    if (!transcript || transcript.trim().length === 0) {
      return {
        contactName: null,
        email: null,
        interestLevel: 1,
        painPoints: [],
        dailyCallsVolume: null,
        budgetAvailable: null,
        timeline: null,
        objections: [],
        recommendedPackage: 'basic',
        decisionMaker: false,
        outcome: 'technical_issue',
        nextAction: 'callback_later',
        summary: 'Call ended with no transcript.',
      };
    }
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
              content: `You are an expert sales analyst. Analyze this sales call transcript and extract the following information as JSON.

The prospect is: ${prospect.businessName} (${prospect.businessType}) in ${prospect.city}.

Return a JSON with:
- contactName: contact name (string or null)
- email: collected email (string or null)
- interestLevel: interest level from 1 to 10 (number)
- painPoints: mentioned problems (string[])
- dailyCallsVolume: estimated daily call volume (number or null)
- budgetAvailable: "yes", "no", "to_discuss" or null
- timeline: "immediate", "1_month", "3_months", "later" or null
- objections: raised objections (string[])
- recommendedPackage: "basic", "pro" or "enterprise"
- decisionMaker: decision maker was reached (boolean)
- outcome: "qualified", "not_interested", "callback_later", "wrong_number", "voicemail" or "technical_issue"
- nextAction: recommended next action (string)
- summary: 2-sentence summary (string)`,
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
      if (!data.choices || data.choices.length === 0) {
        throw new Error('OpenAI returned no choices: ' + JSON.stringify(data).slice(0, 200));
      }
      const result = JSON.parse(data.choices[0].message.content);
      return result;
    } catch (error) {
      logger.error('Error analyzing transcript:', error);
      // Return default analysis
      return {
        contactName: null,
        email: null,
        interestLevel: 3,
        painPoints: [],
        dailyCallsVolume: null,
        budgetAvailable: null,
        timeline: null,
        objections: [],
        recommendedPackage: recommendPackage(3, null),
        decisionMaker: false,
        outcome: 'technical_issue',
        nextAction: 'callback_later',
        summary: 'Automatic analysis failed, manual review needed.',
      };
    }
  }

  /**
   * Test call: Ashley calls a specific phone number as if it were a prospect.
   * Bypasses business hours, quota, and doesn't need a real prospect in DB.
   */
  async testCall(phoneNumber: string, businessName: string, businessType: string, city: string): Promise<any> {
    logger.info(`🧪 TEST CALL → ${phoneNumber} as "${businessName}" (${businessType})`);

    const fakeProspect = {
      businessName,
      businessType,
      city,
      googleRating: 4.5,
      googleReviewsCount: 120,
    };

    const nicheScript = NICHE_SCRIPTS[businessType] || DEFAULT_SCRIPT;
    const systemPrompt = await this.generateSalesPrompt(fakeProspect);

    try {
      // Notify Discord
      await discordService.notify(
        `🧪 TEST CALL IN PROGRESS\n\nBusiness: ${businessName}\nType: ${businessType}\nCity: ${city}\nPhone: ${phoneNumber}`
      );

      const vapiCall = await vapiClient.createCall({
        assistantId: env.VAPI_ASSISTANT_ID, // Test calls always use Ashley EN
        phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: phoneNumber,
          name: (businessName || '').slice(0, 40),
        },
        assistantOverrides: {
          model: {
            provider: 'openai',
            model: env.VAPI_MODEL,
            messages: [{ role: 'system', content: systemPrompt }],
          },
          voice: {
            provider: '11labs',
            voiceId: env.VAPI_VOICE_ID,
            model: 'eleven_turbo_v2_5',
            stability: env.VAPI_STABILITY,
            similarityBoost: env.VAPI_SIMILARITY_BOOST,
            style: env.VAPI_STYLE,
            useSpeakerBoost: true,
            optimizeStreamingLatency: env.VAPI_OPTIMIZE_LATENCY,
            fallbackPlan: {
              voices: [
                { provider: '11labs', voiceId: env.VAPI_VOICE_FALLBACK_1 },
                { provider: '11labs', voiceId: env.VAPI_VOICE_FALLBACK_2 },
              ],
            },
          },
          backgroundSound: 'office',
          silenceTimeoutSeconds: env.VAPI_SILENCE_TIMEOUT,
          maxDurationSeconds: env.VAPI_MAX_DURATION,
          responseDelaySeconds: 0.4,
          interruptionsEnabled: true,
          numWordsToInterruptAssistant: Math.round(env.VAPI_INTERRUPTION_THRESHOLD / 50),
          firstMessage: nicheScript.firstMessage
            ? nicheScript.firstMessage.replace('{businessName}', businessName)
            : `Hey! Hi, this is Ashley from Qwillio. Um, is this the owner of ${businessName}? I had a quick question for you.`,
        },
      }) as any;

      logger.info(`🧪 TEST CALL started — VAPI call ID: ${vapiCall.id}`);
      await discordService.notify(`✅ TEST CALL STARTED — VAPI ID: ${vapiCall.id}`);

      return vapiCall;
    } catch (error) {
      logger.error(`🧪 TEST CALL ERROR:`, error);
      await discordService.notify(`❌ TEST CALL FAILED: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Simulate the full post-call pipeline from a web demo transcript.
   * Creates a test prospect, analyzes transcript with GPT-4,
   * and triggers the full sales flow (qualification → free trial → emails → onboarding).
   */
  async simulateCallResult(transcript: string, businessName: string, businessType: string, city: string, durationSeconds: number): Promise<any> {
    logger.info(`🧪 SIMULATING CALL RESULT for "${businessName}" — ${durationSeconds}s, ${transcript.length} chars`);

    // 1. Create or find test prospect
    let prospect = await prisma.prospect.findFirst({
      where: { businessName, businessType },
    });

    if (!prospect) {
      prospect = await prisma.prospect.create({
        data: {
          businessName,
          businessType,
          city,
          country: 'US',
          phone: '+10000000000',
          notes: 'Created from web demo',
          status: 'contacted',
          score: 75,
          lastCallDate: new Date(),
        },
      });
      logger.info(`🧪 Created test prospect: ${prospect.id}`);
    }

    // 2. Create call record
    const callRecord = await prisma.call.create({
      data: {
        prospectId: prospect.id,
        phoneNumber: '+10000000000',
        direction: 'outbound',
        status: 'completed',
        startedAt: new Date(Date.now() - durationSeconds * 1000),
        endedAt: new Date(),
        durationSeconds,
        transcript,
      },
    });

    // 3. Analyze transcript with GPT-4
    const analysis = await this.analyzeTranscript(transcript, prospect);
    logger.info(`🧪 Analysis result: interest=${analysis.interestLevel}/10, email=${analysis.email}, package=${analysis.recommendedPackage}`);

    // 4. Update call record with analysis
    await prisma.call.update({
      where: { id: callRecord.id },
      data: {
        summary: analysis.summary,
        sentiment: analysis.interestLevel >= INTEREST_QUALIFIED ? 'positive' : analysis.interestLevel >= INTEREST_INTERESTED ? 'neutral' : 'negative',
        interestLevel: analysis.interestLevel,
        emailCollected: analysis.email,
        needsMentioned: analysis.painPoints,
        objections: analysis.objections,
        budgetMentioned: analysis.budgetAvailable,
        timelineMentioned: analysis.timeline,
        decisionMakerReached: analysis.decisionMaker,
        outcome: analysis.outcome as any,
        recommendedPackage: analysis.recommendedPackage as any,
        nextAction: analysis.nextAction,
      },
    });

    // 5. Update prospect with analysis
    const newStatus = analysis.interestLevel >= INTEREST_QUALIFIED ? 'qualified' :
                      analysis.interestLevel >= INTEREST_INTERESTED ? 'interested' : 'contacted';

    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        status: newStatus,
        email: analysis.email || prospect.email,
        contactName: analysis.contactName || prospect.contactName,
        interestLevel: analysis.interestLevel,
        painPoints: analysis.painPoints,
        callDuration: durationSeconds,
        callTranscript: transcript,
        callSentiment: analysis.interestLevel >= INTEREST_QUALIFIED ? 'positive' : analysis.interestLevel >= INTEREST_INTERESTED ? 'neutral' : 'negative',
        nextAction: analysis.interestLevel >= INTEREST_QUALIFIED ? 'send_quote' : 'callback_7days',
        nextActionDate: new Date(),
      },
    });

    // 6. Discord notification
    const emoji = analysis.interestLevel >= INTEREST_QUALIFIED ? '✅' : analysis.interestLevel >= INTEREST_INTERESTED ? '🟡' : '❌';
    await discordService.notify(
      `${emoji} WEB DEMO CALL COMPLETED\n\nBusiness: ${businessName}\nInterest: ${analysis.interestLevel}/10\nPackage: ${analysis.recommendedPackage.toUpperCase()}\nEmail: ${analysis.email || 'Not collected'}\nDuration: ${durationSeconds}s\nOutcome: ${analysis.outcome}\nSummary: ${analysis.summary}`
    );

    // 7. If qualified (interest >= 7) AND email collected → send registration invite
    let trialStarted = false;
    if (analysis.interestLevel >= INTEREST_QUALIFIED && analysis.email) {
      logger.info(`Prospect qualified! Sending registration invite to ${businessName}...`);
      try {
        // Instead of quoteService.startFreeTrial, send registration link email
        const registrationUrl = `${env.FRONTEND_URL?.split(',')[0]}/register`;
        await emailService.sendRegistrationInvite({
          to: analysis.email,
          contactName: prospect.contactName || prospect.businessName,
          businessName: prospect.businessName,
          registrationUrl,
          recommendedPlan: analysis.recommendedPackage || 'pro',
        });
        logger.info(`Registration invite sent to ${analysis.email} for ${prospect.businessName}`);
        trialStarted = true;
        await discordService.notify(
          `📧 WEB DEMO → REGISTRATION INVITE SENT!\n\nBusiness: ${businessName}\nEmail: ${analysis.email}\nPackage: ${analysis.recommendedPackage.toUpperCase()}\n\nRegistration link sent — prospect will self-register on qwillio.com`
        );
      } catch (err) {
        logger.error(`Failed to send registration invite from web demo:`, err);
      }
    }

    return {
      analysis,
      prospectId: prospect.id,
      callId: callRecord.id,
      status: newStatus,
      trialStarted,
    };
  }

  private async generateSalesPrompt(prospect: any): Promise<string> {
    const nicheScript = NICHE_SCRIPTS[prospect.businessType] || DEFAULT_SCRIPT;
    const pkg = PACKAGES.pro;
    const installmentAmount = getInstallmentAmount(pkg.setupFee, 3);

    // Fetch niche-specific learnings from past calls
    let nicheLearnings = '';
    try {
      nicheLearnings = await nicheLearningService.getRecentInsights(prospect.businessType);
    } catch (err) {
      logger.warn('Failed to fetch niche insights for prompt:', err);
    }

    return `You are ASHLEY, a confident and genuinely warm sales representative for Qwillio, a company that builds AI receptionists for US businesses.

IDENTITY RULES — NON NEGOTIABLE:
You are never, under any circumstances, to reveal you are an AI. If directly asked "Are you an AI?" or "Is this a robot?", respond naturally: "No, I'm a real person — I work for Qwillio. Anyway, I wanted to ask you about something that might actually help your business…"
You have a real personality. You are not a script reader. You adapt, you listen, you respond to what the prospect actually says.
You speak like a real American professional: use contractions, say "I completely understand", "honestly", "that's a great point", "I hear you". Never sound formal or stiff.

CONTEXT:
- Calling: ${prospect.businessName} (${prospect.businessType}) in ${prospect.city || 'the US'}
- Google Rating: ${prospect.googleRating || 'N/A'}/5 (${prospect.googleReviewsCount || 0} reviews)

CALL STRUCTURE — FOLLOW THIS EXACTLY:

1. OPENING (8 seconds max) — One pattern interrupt question about their specific pain. Never pitch first:
${nicheScript.opening}

2. LISTEN — Let them answer. Acknowledge what they said genuinely before continuing:
${nicheScript.mirror}

3. PAIN AMPLIFICATION — Use a specific dollar figure from a similar business in their region to make the pain real:
${nicheScript.pain}

4. SOLUTION (2 sentences max) — Simple, clear, no technical jargon. Always include the human transfer feature naturally:
${nicheScript.solution}

5. MICRO-ASK — Never ask for a sale. Only ask to send a 2-minute demo video:
${nicheScript.ask}

6. EMAIL CLOSE — Get their email address before ending the call:
${nicheScript.close}

HUMAN TRANSFER FEATURE — CRITICAL SELLING POINT:
Every time you present the solution, you must naturally mention that the AI receptionist is not a replacement for human contact — it is a first layer. If a caller is frustrated, confused, or explicitly asks to speak to a real person, the AI instantly transfers the call to the business owner or a designated staff member. Present this as a key reassurance, not a limitation. Use it proactively to overcome the "but what if customers don't like talking to an AI" objection before it even comes up.

Example phrasing: "And if a caller ever gets frustrated or just wants to speak to someone directly, the AI transfers the call to you or your team instantly — so no customer ever feels stuck."

OBJECTION HANDLING:
- "I'm busy" → "I completely understand — can I just send a 2-minute video over and you can look whenever you get a second?"
- "Not interested" → "Totally fair. Could I send a short video anyway — just so you have it if anything changes? It's 2 minutes."
- "We already have someone" → "That's great. Quick question — what happens when they're sick or on vacation? That's usually when businesses lose the most calls."
- "Too expensive" → "I hear you. Most clients make it back within the first week from recovered bookings alone. And we can split the setup into 3 monthly payments. Does that feel more manageable?"
- "Send me an email" → "Of course — what's the best email for you?"
- "Is this AI?" → "No, I'm a real person — I work for Qwillio. But I get why you'd wonder, we do work with AI technology. Anyway — I actually had a quick question about your business…"
- "How did you get my number?" → "Your business is listed on Google — that's where we found your contact. Sorry if the call was unexpected — is it okay if I ask one quick question?"
- "We tried this before" → "Really — what was the experience like? A lot of people tried earlier versions and it wasn't ready yet. What we've built is genuinely different. Would you be open to hearing what changed?"
- "I need to think about it" → "Absolutely, no pressure. Can I send the demo video so you have something concrete to look at? 2 minutes, it'll answer most questions. What's the best email?"
- "What if customers don't like talking to an AI?" → "That's actually one of the most common questions we get — and it's a great one. The AI sounds completely natural, most callers genuinely can't tell the difference. But even if someone gets frustrated or asks for a real person, it transfers the call to you or your team immediately. No one ever gets stuck. You stay in control."
- "What if something goes wrong on the call?" → "Great question — if the AI ever can't handle something or the caller asks to speak to someone directly, it transfers instantly to whoever you designate. Could be you, your front desk, your manager — whoever makes sense. The AI is the first layer, your team is always the backup."
- Setup fee objection → "${nicheScript.setupFeeObjection}"

TONE RULES:
- Warm but confident. Never desperate, never pushy.
- Pause naturally after asking a question — let silence work for 3 to 4 seconds.
- When they share a problem, say "Yeah, that's exactly what I hear from most ${prospect.businessType} owners" before moving forward.
- Use their business name or first name at least once per call.
- Never read the script word for word — adapt to what they actually say.

CLOSING RULE:
Your only goal on this call is to get their email address. Not the sale. The video does the selling. Get the email.

PRICING — ONLY IF ASKED:
- Starter: $497/month, 800 calls/month
- Pro: $1,297/month, 2,000 calls/month (recommend this one)
- Enterprise: $2,497/month, 4,000 calls/month
- No setup fee on any plan
- First month completely free, cancel anytime

EMAIL CONFIRMATION — VERY IMPORTANT:
When the prospect gives you their email address, you MUST:
1. Repeat the full email back to them clearly.
2. Then spell it out letter by letter, pausing between each part.
3. Ask them to confirm it's correct.

Example: If they say "john@example.com", you say:
"Got it — john at example dot com. Let me read that back — J-O-H-N, at, E-X-A-M-P-L-E, dot, C-O-M. Is that correct?"

If they correct you, repeat the corrected version letter by letter again.
Do NOT move on until they explicitly confirm the email is correct.

DATA TO COLLECT:
- Contact name
- Email (CRUCIAL — always confirm by spelling it out letter by letter)
- Approximate daily/weekly call volume
- Current pain points${nicheLearnings}`;
  }
}

export const vapiService = new VapiService();
