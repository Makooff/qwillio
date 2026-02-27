import { prisma } from '../config/database';
import { vapiClient } from '../config/vapi';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { CallAnalysis, PACKAGES } from '../types';
import { recommendPackage, NICHE_PRIORITY_ORDER } from '../utils/helpers';
import { quoteService } from './quote.service';
import { discordService } from './discord.service';
import { smsService } from './sms.service';
import { NICHE_SCRIPTS, DEFAULT_SCRIPT, getInstallmentAmount } from '../config/niche-scripts';
import { isHoliday, isWithinCallWindow, isPriorityDay, CALL_RATE_LIMIT_MS } from '../config/scheduling';
import { INTERESTED_FOLLOWUP_SEQUENCE, CALLBACK_RETRY_DELAYS } from '../config/followup-sequence';

export class VapiService {
  async callNextProspect(): Promise<boolean> {
    // Check if within business hours
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    if (!env.AUTOMATION_DAYS.includes(day) || hour < env.AUTOMATION_START_HOUR || hour >= env.AUTOMATION_END_HOUR) {
      logger.debug('Outside business hours, skipping call');
      return false;
    }

    // Check daily quota
    const botStatus = await prisma.botStatus.findFirst();
    if (!botStatus || !botStatus.isActive) {
      logger.info('Bot is inactive, skipping call');
      return false;
    }
    if (botStatus.callsToday >= botStatus.callsQuotaDaily) {
      logger.info('Daily call quota reached');
      return false;
    }

    // Rate limit: 1 call per minute minimum
    if (botStatus.lastCall && (Date.now() - botStatus.lastCall.getTime()) < CALL_RATE_LIMIT_MS) {
      logger.debug('Rate limit: waiting 1 minute between calls');
      return false;
    }

    // Holiday check
    if (isHoliday(now, 'US')) {
      logger.info('Today is a holiday, skipping calls');
      return false;
    }

    // Select best prospect to call with smart scheduling
    const candidates = await prisma.prospect.findMany({
      where: {
        status: 'new',
        phone: { not: null },
        callAttempts: { lt: 3 }, // Max 3 attempts
        OR: [
          { lastCallDate: null },
          { lastCallDate: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
        ],
      },
      orderBy: { score: 'desc' },
      take: 50, // Get top 50 candidates, then filter by niche window
    });

    if (candidates.length === 0) {
      logger.info('No prospects available to call');
      return false;
    }

    // Filter by niche call window and sort by priority
    const priorityBonus = isPriorityDay() ? 2 : 0;
    const scoredCandidates = candidates
      .map(p => {
        const script = NICHE_SCRIPTS[p.businessType] || DEFAULT_SCRIPT;
        const inWindow = isWithinCallWindow(p.timezone, script.callWindow.start, script.callWindow.end);
        const nichePriority = NICHE_PRIORITY_ORDER[p.businessType] ?? 0;
        return {
          prospect: p,
          effectiveScore: p.score + nichePriority + priorityBonus + (inWindow ? 5 : 0) + (p.phoneValidated ? 1 : 0),
          inWindow,
        };
      })
      .sort((a, b) => b.effectiveScore - a.effectiveScore);

    // Prefer prospects in their niche window, but fall back to any if none available
    const prospect = scoredCandidates.find(c => c.inWindow)?.prospect || scoredCandidates[0]?.prospect;

    if (!prospect) {
      logger.info('No prospects available to call');
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
        `📞 CALL IN PROGRESS\n\nProspect: ${prospect.businessName}\nIndustry: ${prospect.businessType}\nPhone: ${prospect.phone}\nScore: ${prospect.score}/22\nTimezone: ${prospect.timezone}\nAttempt: ${prospect.callAttempts + 1}/3`
      );

      // Make VAPI call with niche-specific system prompt
      const nicheScript = NICHE_SCRIPTS[prospect.businessType] || DEFAULT_SCRIPT;
      const systemPrompt = this.generateSalesPrompt(prospect);

      const vapiCall = await vapiClient.createCall({
        assistantId: env.VAPI_ASSISTANT_ID,
        phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: prospect.phone!,
          name: prospect.businessName,
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
          fillerInjectionEnabled: true,
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

      // Update bot status
      await prisma.botStatus.update({
        where: { id: botStatus.id },
        data: {
          callsToday: { increment: 1 },
          lastCall: new Date(),
        },
      });

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
        sentiment: analysis.interestLevel >= 7 ? 'positive' : analysis.interestLevel >= 4 ? 'neutral' : 'negative',
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
    const newStatus = analysis.interestLevel >= 7 ? 'qualified' :
                      analysis.interestLevel >= 4 ? 'interested' : 'contacted';

    await prisma.prospect.update({
      where: { id: call.prospect.id },
      data: {
        status: newStatus,
        email: analysis.email || call.prospect.email,
        contactName: analysis.contactName || call.prospect.contactName,
        interestLevel: analysis.interestLevel,
        painPoints: analysis.painPoints,
        callDuration: duration,
        callTranscript: transcript,
        callSentiment: analysis.interestLevel >= 7 ? 'positive' : analysis.interestLevel >= 4 ? 'neutral' : 'negative',
        nextAction: analysis.interestLevel >= 7 ? 'send_quote' :
                    analysis.interestLevel >= 4 ? 'callback_7days' : 'callback_3months',
        nextActionDate: analysis.interestLevel >= 7 ? new Date() :
                        analysis.interestLevel >= 4 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) :
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
        prospectsQualified: { increment: analysis.interestLevel >= 7 ? 1 : 0 },
      },
      create: {
        date: today,
        callsSuccessful: 1,
        totalCallDuration: duration,
        prospectsContacted: 1,
        prospectsQualified: analysis.interestLevel >= 7 ? 1 : 0,
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

    // If qualified -> automatically start free trial
    if (analysis.interestLevel >= 7 && analysis.email) {
      logger.info(`Prospect ${call.prospect.businessName} qualified (interest: ${analysis.interestLevel}/10) - starting free trial`);
      await quoteService.startFreeTrial(call.prospect.id, analysis.recommendedPackage, analysis.email);
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
    if (analysis.interestLevel >= 4) {
      await this.scheduleFollowUpSequence(call.prospect.id, call.id);
    }

    // Schedule callback retries for no_answer/voicemail
    if (['no-answer', 'voicemail'].includes(analysis.outcome)) {
      const attemptIndex = (call.prospect.callAttempts || 1) - 1;
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

    // Discord notification
    const emoji = analysis.interestLevel >= 7 ? '✅' : analysis.interestLevel >= 4 ? '🟡' : '❌';
    await discordService.notify(
      `${emoji} CALL COMPLETED\n\nProspect: ${call.prospect.businessName}\nInterest: ${analysis.interestLevel}/10\nPackage: ${analysis.recommendedPackage.toUpperCase()}\nEmail: ${analysis.email || 'Not collected'}\nAction: ${analysis.nextAction}${setupFeeObjection ? '\n⚠️ Setup fee objection raised' : ''}`
    );
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
    const systemPrompt = this.generateSalesPrompt(fakeProspect);

    try {
      // Notify Discord
      await discordService.notify(
        `🧪 TEST CALL IN PROGRESS\n\nBusiness: ${businessName}\nType: ${businessType}\nCity: ${city}\nPhone: ${phoneNumber}`
      );

      const vapiCall = await vapiClient.createCall({
        assistantId: env.VAPI_ASSISTANT_ID,
        phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: phoneNumber,
          name: businessName,
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
          fillerInjectionEnabled: true,
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
        sentiment: analysis.interestLevel >= 7 ? 'positive' : analysis.interestLevel >= 4 ? 'neutral' : 'negative',
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
    const newStatus = analysis.interestLevel >= 7 ? 'qualified' :
                      analysis.interestLevel >= 4 ? 'interested' : 'contacted';

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
        callSentiment: analysis.interestLevel >= 7 ? 'positive' : analysis.interestLevel >= 4 ? 'neutral' : 'negative',
        nextAction: analysis.interestLevel >= 7 ? 'send_quote' : 'callback_7days',
        nextActionDate: new Date(),
      },
    });

    // 6. Discord notification
    const emoji = analysis.interestLevel >= 7 ? '✅' : analysis.interestLevel >= 4 ? '🟡' : '❌';
    await discordService.notify(
      `${emoji} WEB DEMO CALL COMPLETED\n\nBusiness: ${businessName}\nInterest: ${analysis.interestLevel}/10\nPackage: ${analysis.recommendedPackage.toUpperCase()}\nEmail: ${analysis.email || 'Not collected'}\nDuration: ${durationSeconds}s\nOutcome: ${analysis.outcome}\nSummary: ${analysis.summary}`
    );

    // 7. If qualified (interest >= 7) AND email collected → start full pipeline
    let trialStarted = false;
    if (analysis.interestLevel >= 7 && analysis.email) {
      logger.info(`🧪 Prospect qualified! Starting free trial for ${businessName}...`);
      try {
        await quoteService.startFreeTrial(prospect.id, analysis.recommendedPackage, analysis.email);
        trialStarted = true;
        await discordService.notify(
          `🎁 WEB DEMO → FREE TRIAL AUTO-STARTED!\n\nBusiness: ${businessName}\nEmail: ${analysis.email}\nPackage: ${analysis.recommendedPackage.toUpperCase()}\n\nEmails sent:\n✅ Trial welcome email\n✅ Onboarding form email\n✅ Dashboard access link`
        );
      } catch (err) {
        logger.error(`🧪 Failed to start trial from web demo:`, err);
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

  private generateSalesPrompt(prospect: any): string {
    const nicheScript = NICHE_SCRIPTS[prospect.businessType] || DEFAULT_SCRIPT;
    const pkg = PACKAGES.pro;
    const installmentAmount = getInstallmentAmount(pkg.setupFee, 3);

    // Build niche-specific pain points section
    const painPointsList = nicheScript.painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n');

    // Build niche-specific objection handlers
    const objectionHandling = Object.entries(nicheScript.objectionHandlers)
      .map(([key, response]) => {
        const filled = response.replace('{installmentAmount}', `$${installmentAmount}`);
        return `- "${key.replace(/_/g, ' ')}" -> "${filled}"`;
      })
      .join('\n');

    // Fill in dynamic opener
    const opener = nicheScript.opener
      .replace('{businessName}', prospect.businessName)
      .replace('{rating}', prospect.googleRating || 'great')
      .replace('{city}', prospect.city || '')
      .replace('{sector}', prospect.sector || prospect.businessType);

    return `You are Ashley, Senior Sales Consultant at Qwillio.

IDENTITY:
- Name: Ashley
- Company: Qwillio
- Personality: Warm, energetic, a bit cheeky, genuinely enthusiastic about helping small businesses
- Tone: Like calling a friend who happens to sell an amazing product. Casual, real, human.

SPEAKING STYLE — THIS IS CRITICAL FOR REALISM:
- You sound like a REAL person on a phone call, not a polished AI.
- Use natural fillers occasionally: "so...", "honestly", "look", "I mean", "you know what", "actually"
- Sometimes start sentences with "So" or "Look" or "Honestly"
- Use contractions always: "it's", "we'll", "that's", "you're", "don't", "can't", "won't"
- Occasionally self-correct or rephrase mid-sentence, like a real person: "It's — well actually it's more like a virtual receptionist"
- React genuinely to what the prospect says: "Oh really?", "That's tough", "Yeah I totally get that", "Ha, fair enough"
- Laugh lightly when appropriate (say "haha" or "ha")
- Show genuine empathy: "Ugh, that's the worst", "I hear you"
- NEVER sound scripted. Vary your sentence structure. Mix short punchy lines with slightly longer ones.
- Sometimes pause naturally with "..." or "hmm" before giving a thoughtful answer

CONTEXT:
- Calling: ${prospect.businessName} (${prospect.businessType}) in ${prospect.city}
- Google Rating: ${prospect.googleRating || 'N/A'}/5 (${prospect.googleReviewsCount || 0} reviews)

YOUR OPENING LINE (use this as inspiration, adapt naturally):
${opener}

INDUSTRY-SPECIFIC PAIN POINTS TO EXPLORE:
${painPointsList}

RESPONSE STYLE:
- Be concise. Keep most answers under 2-3 sentences.
- Have a natural back-and-forth conversation. Don't monologue.
- Only explain packages when asked or after clear interest.
- Do NOT dump all info at once. Tease and build curiosity.

WHAT QWILLIO DOES (explain simply):
An AI receptionist that answers your phone 24/7. It picks up every call, books appointments, answers common questions, and sends you a summary. Your customers always reach someone, even at 2am or when you're busy.

THE OFFER — FREE 30-DAY TRIAL:
- 30 days completely free. No credit card. No commitment.
- We set it up in 48 hours. You test it with real customers.
- After 30 days: you choose a plan or we stop everything. Zero charge.

PRICING — EXPLAIN CLEARLY WHEN ASKED:
There are 3 packages. All come after the free trial.

1. STARTER — $199/month (one-time setup: $699)
   - AI receptionist available 24/7
   - Automatic appointment booking
   - Answers FAQs about your business
   - Call summaries sent to you by email
   - Up to 200 calls/month included

2. PRO — $349/month (one-time setup: $999) — Most popular
   - Everything in Starter, plus:
   - Lead qualification (the AI scores each caller)
   - Real-time analytics dashboard
   - Smart call routing to the right person
   - Email & SMS follow-ups after each call
   - Up to 500 calls/month included

3. ENTERPRISE — $499/month (one-time setup: $1,499)
   - Everything in Pro, plus:
   - Multilingual support (English, Spanish, French, etc.)
   - CRM & Google Calendar integration
   - Priority support with dedicated account manager
   - Weekly AI optimization of your assistant
   - Up to 1,000 calls/month included

SETUP FEE INSTALLMENT OPTION:
If the prospect says the setup fee is too high, offer to split it over 3 months:
- Starter: $233/month for 3 months instead of $699 upfront
- Pro: $333/month for 3 months instead of $999 upfront
- Enterprise: $500/month for 3 months instead of $1,499 upfront
Say something like: "We can totally split the setup over 3 months if that's easier. So for Pro it'd be just three thirty-three a month for the setup, plus the monthly fee."

When explaining pricing, say it naturally like: "So after your free trial, Starter is one ninety-nine a month with a one-time setup of six ninety-nine. Most clients go with Pro at three forty-nine a month — setup is nine ninety-nine — because you get the analytics and lead scoring. Enterprise is four ninety-nine a month, fourteen ninety-nine setup, for the full package with a thousand calls and multilingual."

CALL FLOW:
1. Greet and confirm you're speaking with owner/manager
2. Use your industry-specific opening line above
3. Explore their pain points using the industry-specific list
4. Propose the free trial
5. If they ask about pricing, explain the 3 packages clearly
6. If they object to setup fee, offer the 3-month installment
7. Collect their email to send the activation link
8. Close positively

NICHE-SPECIFIC OBJECTION HANDLING:
${objectionHandling}

GENERAL OBJECTION HANDLING:
- "We have a receptionist" -> "Perfect, try it alongside them for nights, weekends, and overflow. Totally free for 30 days."
- "Need to think" -> "Of course! The trial is free with zero commitment. You can test it and decide after."
- "Is AI reliable?" -> "Honestly, the best way to know is to try it free for 30 days with your real customers."
- "No time for setup" -> "We handle everything. It's ready in 48 hours, you don't lift a finger."
- "What happens after the trial?" -> Explain the 3 packages with pricing clearly.

CLOSING STRATEGY:
${nicheScript.closingStrategy}

RULES:
- SHORT sentences. Mostly under 15 words, but vary the length naturally.
- Sound like a real human on a real phone call. Imperfect is better than polished.
- Answer questions immediately, don't dodge.
- When they ask about price, give real numbers. Don't be vague.
- Always mention the free trial as the main hook.
- Recommend Pro for most businesses.
- Keep the whole call under 5 minutes.
- Use "um", "so", "like", "honestly" sparingly but regularly — like a real person would.
- NEVER say anything that sounds like a marketing brochure or scripted pitch.

EMAIL CONFIRMATION — VERY IMPORTANT:
When the prospect gives you their email address, you MUST:
1. Repeat the full email back to them clearly.
2. Then spell it out letter by letter, pausing between each part.
3. Ask them to confirm it's correct.

Example: If they say "john@vivipizza.com", you say:
"Got it — john at vivi pizza dot com. Let me spell that back to make sure: J-O-H-N, at, V-I-V-I-P-I-Z-Z-A, dot, C-O-M. Is that correct?"

If the email has numbers or unusual characters, be extra careful to spell each part.
If they correct you, repeat the corrected version letter by letter again.
Do NOT move on until they explicitly confirm the email is correct.

DATA TO COLLECT:
- Contact name
- Email (CRUCIAL — always confirm by spelling it out letter by letter)
- Approximate daily/weekly call volume
- Current pain points`;
  }
}

export const vapiService = new VapiService();
