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
import { callIntelligenceService } from './call-intelligence.service';
import { emitEvent } from '../config/socket';

// Interest level thresholds — single source of truth
export const INTEREST_QUALIFIED = 7;  // >= 7 = qualified, auto-start free trial
export const INTEREST_INTERESTED = 4; // >= 4 = interested, send follow-up sequence

// ── VAPI daily limit circuit breaker ──
// When VAPI returns "Daily Outbound Call Limit" (their own cap on free-tier numbers),
// pause all outbound calls until next day's reset (00:00 UTC) to avoid spam and wasted API calls.
let vapiDailyLimitResumeAt: Date | null = null;
let vapiDailyLimitNotified = false;

function isVapiDailyLimitError(err: unknown): boolean {
  const msg = (err as Error)?.message || '';
  return msg.includes('Daily Outbound Call Limit') || msg.includes('Numbers Bought On Vapi Have A Daily');
}

function setVapiDailyLimitPause(): void {
  // Resume at next 00:00 UTC (VAPI resets daily at midnight UTC)
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 5, 0, 0); // 00:05 UTC tomorrow (5 min buffer)
  vapiDailyLimitResumeAt = tomorrow;
}

function isVapiDailyLimitActive(): boolean {
  if (!vapiDailyLimitResumeAt) return false;
  if (Date.now() >= vapiDailyLimitResumeAt.getTime()) {
    // Reset — we're past the pause window
    vapiDailyLimitResumeAt = null;
    vapiDailyLimitNotified = false;
    return false;
  }
  return true;
}

export class VapiService {
  async callNextProspect(): Promise<boolean> {
    // ── 0. VAPI daily limit circuit breaker ─────────────────
    if (isVapiDailyLimitActive()) {
      const resumeIn = Math.round((vapiDailyLimitResumeAt!.getTime() - Date.now()) / 60000);
      logger.debug(`VAPI daily call limit hit — paused, resumes in ${resumeIn} min`);
      return false;
    }

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
        // Skip prospects whose phone was validated as invalid
        NOT: {
          phoneValidated: false,
          phoneValidatedAt: { not: null },
        },
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

    // Validate E.164 format before calling (VAPI requires +country_code)
    let phoneE164 = prospect.phone!.trim();
    if (!phoneE164.startsWith('+')) {
      // Assume US number if no country code
      phoneE164 = phoneE164.replace(/\D/g, ''); // strip non-digits
      if (phoneE164.length === 10) phoneE164 = `+1${phoneE164}`;
      else if (phoneE164.length === 11 && phoneE164.startsWith('1')) phoneE164 = `+${phoneE164}`;
      else {
        logger.warn(`Skipping prospect ${prospect.businessName}: phone "${prospect.phone}" is not valid E.164 format`);
        // Mark as invalid to avoid retrying
        await prisma.prospect.update({ where: { id: prospect.id }, data: { phoneValidated: false, phoneValidatedAt: new Date() } });
        // Rollback quota
        await prisma.botStatus.updateMany({ where: { id: botStatus.id }, data: { callsToday: { decrement: 1 } } });
        return false;
      }
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
          number: phoneE164,
          name: (prospect.businessName || 'Business').substring(0, 40),
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
            speed: 1.12, // slightly faster, more confident delivery
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
          responseDelaySeconds: 0.2, // was 0.4 — faster turn-taking
          interruptionsEnabled: true,
          numWordsToInterruptAssistant: Math.round(env.VAPI_INTERRUPTION_THRESHOLD / 50),
          firstMessage: nicheScript.firstMessage
            ? nicheScript.firstMessage.replace('{businessName}', prospect.businessName)
            : `Hi, this is Ashley from Qwillio — are you the owner of ${prospect.businessName}?`,
          // ── Voicemail / answering machine detection ──
          // Twilio AMD detects machine on pickup (up to 6s). If detected, VAPI
          // invokes endCallFunction automatically — no minutes wasted, no message left.
          voicemailDetection: {
            provider: 'twilio',
            enabled: true,
            machineDetectionTimeout: 6,
            machineDetectionSpeechThreshold: 2400,
            machineDetectionSpeechEndThreshold: 1200,
            machineDetectionSilenceTimeout: 5000,
          },
          endCallFunctionEnabled: true,
          endCallMessage: '', // don't leave a message on voicemail
          // Fallback: if Twilio AMD misses it, Ashley's system prompt instructs
          // her to call the endCall function if she hears common voicemail greetings.
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
      // ── Detect VAPI daily call limit — trigger circuit breaker ──
      if (isVapiDailyLimitError(error)) {
        setVapiDailyLimitPause();
        const resumeAt = vapiDailyLimitResumeAt!.toISOString();
        logger.warn(`⚠️ VAPI daily outbound limit hit — pausing calls until ${resumeAt}`);
        if (!vapiDailyLimitNotified) {
          vapiDailyLimitNotified = true;
          await discordService.notify(
            `⏸️ **VAPI daily limit reached** — calls paused until ${resumeAt} UTC.\n` +
            `Import a Twilio number in VAPI dashboard to remove this limit.`
          );
        }
      } else {
        logger.error(`Error calling prospect ${prospect.businessName}:`, error);
        await discordService.notify(`❌ CALL ERROR: ${prospect.businessName} - ${(error as Error).message}`);
      }

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

    // ═══ DEEP CALL INTELLIGENCE ANALYSIS ═══
    // Ultra-intelligent analysis: sentiment timeline, objection tracking, micro-fix recommendations
    callIntelligenceService.analyzeCallDeep(call.id)
      .catch(err => logger.warn('Deep call intelligence analysis failed:', err));
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
          model: 'gpt-4o',
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
      if (!data.choices?.[0]?.message?.content) {
        logger.error('OpenAI API returned no choices:', JSON.stringify(data.error || data).substring(0, 300));
        throw new Error(`OpenAI API error: ${data.error?.message || 'no choices returned'}`);
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
            speed: 1.12, // slightly faster, more confident delivery
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
          responseDelaySeconds: 0.2, // was 0.4 — faster turn-taking
          interruptionsEnabled: true,
          numWordsToInterruptAssistant: Math.round(env.VAPI_INTERRUPTION_THRESHOLD / 50),
          firstMessage: nicheScript.firstMessage
            ? nicheScript.firstMessage.replace('{businessName}', businessName)
            : `Hi, this is Ashley from Qwillio — are you the owner of ${businessName}?`,
          voicemailDetection: {
            provider: 'twilio',
            enabled: true,
            machineDetectionTimeout: 6,
            machineDetectionSpeechThreshold: 2400,
            machineDetectionSpeechEndThreshold: 1200,
            machineDetectionSilenceTimeout: 5000,
          },
          endCallFunctionEnabled: true,
          endCallMessage: '',
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

    return `You are ASHLEY, a confident, direct sales rep for Qwillio — AI receptionists for US businesses.

SPEECH STYLE — CRITICAL:
- Speak FAST and CONCISE. Never drag.
- ZERO filler words: no "um", "uh", "eh", "ehh", "like", "you know", "sort of", "kind of", "basically", "honestly", "actually", "so yeah".
- NO long preambles: never say "sorry to catch you out of the blue", "real quick", "super quick", "I promise I'll be brief".
- Short sentences. Crisp. Get to the point in 8 seconds.
- Use contractions naturally (I'm, you're, we've).

IDENTITY — NON NEGOTIABLE:
Never reveal you're an AI. If asked directly: "No, I'm a real person with Qwillio. Anyway — I had a quick question about your business."
You adapt, listen, respond to what they actually say. Not a script reader.

VOICEMAIL / ANSWERING MACHINE DETECTION — CRITICAL:
If the first thing you hear is ANY of these patterns, you are on a voicemail. Immediately call the endCall function. Do NOT leave a message. Do NOT say anything.
- "You have reached the voicemail of..."
- "Please leave a message after the beep/tone"
- "I'm not available right now"
- "I can't come to the phone"
- "Thank you for calling [business]. Our office is currently closed..."
- "Press 1 to..." / "For [x], press [number]..." (IVR menu)
- A long uninterrupted pre-recorded greeting (more than 10 seconds without human interaction)
- Beep sound without prior conversation
- Silence for more than 4 seconds right after your opening
If in doubt, wait for a genuine human response. A real person will respond within 2-3 seconds with something like "Hello?", "Yes?", "Speaking", or by identifying themselves or the business.

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

OBJECTION HANDLING (keep responses SHORT):
- "I'm busy" → "Got it — can I send a 2-minute video and you watch whenever?"
- "Not interested" → "No worries. Can I send a 2-minute video so you have it if anything changes?"
- "We already have someone" → "Sure — what happens when they're sick or on vacation? That's when most businesses lose calls."
- "Too expensive" → "Most clients make it back in the first week. We can split setup into 3 payments. Better?"
- "Send me an email" → "Perfect — what's the best email?"
- "Is this AI?" → "No, I'm a real person with Qwillio. Anyway — quick question about your business?"
- "How did you get my number?" → "You're listed on Google — that's where we found you. Can I ask one quick question?"
- "We tried this before" → "What was the experience? A lot of earlier versions weren't ready. Ours is different — want to hear what changed?"
- "I need to think about it" → "No pressure. Can I send the 2-minute demo so you have something concrete? What's your email?"
- "What if customers don't like AI?" → "Most callers can't tell. And if anyone wants a human, it transfers to you instantly. You stay in control."
- "What if something goes wrong?" → "It transfers to whoever you designate — you, front desk, manager. AI is the first layer, your team is the backup."
- Setup fee → "${nicheScript.setupFeeObjection}"

TONE RULES:
- Confident and fast. Never pushy, never slow.
- Short pause after a question (1 to 2 seconds max) — not 4.
- Use their business name once per call, not more.
- Adapt to what they actually say — don't repeat the script verbatim.

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
