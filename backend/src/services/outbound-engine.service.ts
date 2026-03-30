/**
 * Outbound Calling Engine — Parts 2, 3, 4 of the prospecting spec
 * Features:
 *   - Day/time window enforcement (Tue-Thu full, Mon/Fri limited)
 *   - Call attempt logic (3 max, voicemail on 3rd only)
 *   - Local presence dialing (area-code matched Twilio number)
 *   - Interest scoring (1-10) + hot lead detection
 *   - A/B script variant selection
 */
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { discordService } from './discord.service';
import { abTestingService } from './ab-testing.service';
import { isHoliday } from '../config/scheduling';

// ─── US Federal holidays (YYYY-MM-DD) ────────────────────
const CALL_WINDOWS_BY_DAY: Record<number, Array<[number, number]>> = {
  1: [[10, 11.5]],                       // Monday: 10:00–11:30
  2: [[9, 11.5], [14, 17]],             // Tuesday: 9–11:30, 2–5
  3: [[9, 11.5], [14, 17]],             // Wednesday: 9–11:30, 2–5
  4: [[9, 11.5], [14, 16]],             // Thursday: 9–11:30, 2–4
  5: [[10, 11.5]],                       // Friday: 10:00–11:30
};

// ─── Ashley scripts (EN) ─────────────────────────────────
const ASHLEY_SCRIPTS: Record<string, Record<'A' | 'B', string>> = {
  home_services: {
    A: `Hi, this is Ashley — quick question, when you're out on a job and your phone rings, what usually happens to that call?
[Listen]
Yeah exactly — and every one of those missed calls is a job going straight to your competitor. We fix that. Qwillio gives you an AI receptionist that answers every single call, books the job, and captures the customer info — 24/7, even when you're under a sink at 2pm. First month's completely free. Takes 48 hours to set up. Want me to show you how it works for {{business_name}}?`,
    B: `Hi, is this {{business_name}}? Great — I'll be quick. I'm Ashley from Qwillio. We work with plumbers and HVAC guys in {{city}} to make sure they never miss a customer call again. Right now, how are you handling calls when you're on a job?
[Listen]
So you're losing leads every single day. Here's what we do — your calls get answered by an AI receptionist that sounds completely human, books the appointment, gets their info. You see it all in a dashboard. First month free, no setup fee. Can I show you in 10 minutes how it'd work for your business?`,
  },
  dental: {
    A: `Hi, this is Ashley calling for {{business_name}}. Quick question — when your front desk is with a patient, what happens to calls coming in?
[Listen]
Right, so you're losing new patient inquiries every day to voicemail. We solve that. Qwillio gives your practice an AI receptionist that answers every call, answers insurance questions, and books appointments directly — 24/7. Your staff stays focused on patients. First month completely free. Want to see how it works?`,
    B: `Hi, I'm Ashley from Qwillio. Quick question for the office manager — when you're with a patient and the phone rings, who picks it up?
[Listen]
That's the gap we close. Our AI receptionist handles every overflow call, answers common insurance questions, books appointments. First month's on us. Can I walk you through it in 5 minutes?`,
  },
};

// ─── Marie scripts (FR) ──────────────────────────────────
const MARIE_SCRIPTS: Record<string, Record<'A' | 'B', string>> = {
  home_services: {
    A: `Allô, bonjour — c'est Marie de Qwillio. Question rapide — quand vous êtes sur un chantier et votre téléphone sonne, ça se passe comment ?
[Écouter]
Ouais, exactement — et chaque appel manqué c'est un client qui part chez le voisin. Nous on règle ça. Qwillio vous donne une réceptionniste IA qui répond à chaque appel, prend les infos, fixe le rendez-vous — 24h/24. Premier mois offert, zéro frais de setup. Je peux vous montrer comment ça marche pour {{business_name}} ?`,
    B: `Bonjour, c'est Marie de Qwillio. Je suis rapide — vous êtes {{business_name}} à {{city}} ? Parfait. On aide les artisans à ne plus jamais manquer un appel client. Comment vous gérez les appels quand vous êtes en intervention ?
[Écouter]
Exactement — notre réceptionniste IA répond, prend les coordonnées, fixe le rendez-vous. Tout s'affiche dans votre tableau de bord. Premier mois gratuit. Je vous montre en 10 minutes ?`,
  },
  dental: {
    A: `Bonjour, c'est Marie de Qwillio. Quand votre secrétaire est avec un patient, qu'est-ce qui se passe avec les appels entrants ?
[Écouter]
Du coup vous perdez des nouveaux patients tous les jours sur messagerie. Notre IA répond à chaque appel, répond aux questions sur les assurances, prend les rendez-vous — directement dans votre agenda. Premier mois gratuit. Vous voulez voir comment ça fonctionne ?`,
    B: `Bonjour, Marie de Qwillio. Question rapide — combien d'appels votre cabinet manque-t-il par semaine quand la secrétaire est occupée ?
[Écouter]
Voilà — notre réceptionniste IA comble ce manque. Chaque appel est répondu, chaque rendez-vous est pris. Pas de frais de setup, premier mois offert. On regarde ensemble en 5 minutes ?`,
  },
};

// ─── Objection handlers ───────────────────────────────────
const OBJECTION_HANDLERS: Record<string, string> = {
  voicemail:      "Voicemail loses 80% of callers — they hang up and call your competitor. Ashley books them instead.",
  receptionist:   "Perfect — Ashley handles overflow and after-hours. Your receptionist focuses on patients in front of her.",
  cost:           "First month is completely free. After that, $497 flat — less than one missed job per month.",
  think_about_it: "Totally fair. Can I send you a quick demo? 2-minute audio clip, no commitment.",
  send_email:     "Of course — what's the best email? I'll send it in the next 5 minutes with a demo clip.",
};

// ─── Area-code → Twilio number map ───────────────────────
const AREA_CODE_MAP: Record<string, string> = {
  '212': '+12125550000', // NY — populated from local_presence_numbers table
  '310': '+13105550000', // LA
  '312': '+13125550000', // Chicago
  '713': '+17135550000', // Houston
  '602': '+16025550000', // Phoenix
  '214': '+12145550000', // Dallas
  '512': '+15125550000', // Austin
  '404': '+14045550000', // Atlanta
  '305': '+13055550000', // Miami
  '615': '+16155550000', // Nashville
  '206': '+12065550000', // Seattle
  '617': '+16175550000', // Boston
  '415': '+14155550000', // SF
  '303': '+13035550000', // Denver
  '702': '+17025550000', // Las Vegas
  '619': '+16195550000', // San Diego
  '504': '+15045550000', // New Orleans
  '210': '+12105550000', // San Antonio
  '215': '+12155550000', // Philadelphia
  '408': '+14085550000', // San Jose
};

// ─── Retry delays ─────────────────────────────────────────
const RETRY_DELAY_HOURS: Record<number, number> = {
  1: 48,
  2: 72,
};

export class OutboundEngineService {
  /** Check if current UTC time is within any allowed window for the given prospect timezone */
  private isWithinCallWindow(timezone: string): boolean {
    const now = new Date();
    const localStr = now.toLocaleString('en-US', { timeZone: timezone, hour12: false });
    const localDate = new Date(localStr);
    const day = localDate.getDay();   // 0=Sun, 1=Mon ... 6=Sat
    const hour = localDate.getHours() + localDate.getMinutes() / 60;

    const windows = CALL_WINDOWS_BY_DAY[day];
    if (!windows) return false;
    return windows.some(([start, end]) => hour >= start && hour < end);
  }

  /** Pick the Twilio number that best matches the prospect's area code */
  private async getLocalPresenceNumber(prospectPhone: string): Promise<string> {
    const areaCode = prospectPhone.replace(/\D/g, '').slice(1, 4); // +1AAANNNNNNN → AAA

    // Check DB first
    const dbNumber = await prisma.localPresenceNumber.findFirst({
      where: { areaCode, active: true },
    });
    if (dbNumber) return dbNumber.phoneNumber;

    // Fall back to static map
    if (AREA_CODE_MAP[areaCode]) return AREA_CODE_MAP[areaCode];

    // Geographic fallback — use default VAPI number
    return env.VAPI_PHONE_NUMBER;
  }

  /** Build personalized script from template */
  private buildScript(
    niche: string,
    language: 'en' | 'fr',
    variant: 'A' | 'B',
    businessName: string,
    city: string,
  ): string {
    const scriptMap = language === 'fr' ? MARIE_SCRIPTS : ASHLEY_SCRIPTS;
    const nicheKey = niche.replace(/-/g, '_');
    const scripts = scriptMap[nicheKey] ?? scriptMap['home_services'];
    const template = scripts[variant] ?? scripts['A'];

    return template
      .replace(/\{\{business_name\}\}/g, businessName)
      .replace(/\{\{city\}\}/g, city)
      .replace(/\{\{niche\}\}/g, niche);
  }

  /** Compute real-time interest score from call data (1-10) */
  computeInterestScore(data: {
    durationSeconds: number;
    prospectAskedQuestion: boolean;
    pricingDiscussed: boolean;
    requestedInfo: boolean;
    agreedToDemo: boolean;
  }): number {
    let score = 0;
    if (data.durationSeconds > 60)    score += 2;
    if (data.prospectAskedQuestion)   score += 2;
    if (data.pricingDiscussed)        score += 2;
    if (data.requestedInfo)           score += 2;
    if (data.agreedToDemo)            score += 2;
    return Math.max(1, Math.min(10, score));
  }

  /** Main calling loop: pick next eligible prospect and initiate call */
  async callNextProspect(): Promise<boolean> {
    // Check Federal US holidays
    if (isHoliday(new Date(), 'US')) {
      logger.info('[OutboundEngine] Holiday, skipping call');
      return false;
    }

    // Check bot quota
    const botStatus = await prisma.botStatus.findFirst();
    if (!botStatus?.isActive) return false;

    const updated = await prisma.botStatus.updateMany({
      where: { id: botStatus.id, callsToday: { lt: botStatus.callsQuotaDaily } },
      data: { callsToday: { increment: 1 }, lastCall: new Date() },
    });
    if (updated.count === 0) {
      logger.info('[OutboundEngine] Daily quota reached');
      return false;
    }

    const now = new Date();

    // Find highest-priority eligible prospect
    const prospect = await prisma.prospect.findFirst({
      where: {
        status: 'new',
        phone: { not: null },
        eligibleForCall: true,
        isMobile: false,
        priorityScore: { gte: env.MIN_PRIORITY_SCORE },
        callAttempts: { lt: 3 },
        OR: [
          { nextCallAt: null },
          { nextCallAt: { lte: now } },
        ],
        // Not called today
        lastCallDate: {
          not: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
        },
      },
      orderBy: { priorityScore: 'desc' },
    });

    if (!prospect || !prospect.phone) {
      logger.info('[OutboundEngine] No eligible prospects found');
      return false;
    }

    // Check call window for prospect timezone
    const tz = prospect.timezone ?? 'America/Chicago';
    if (!this.isWithinCallWindow(tz)) {
      logger.debug(`[OutboundEngine] Outside call window for ${prospect.businessName} (${tz})`);
      return false;
    }

    const attemptNumber = prospect.callAttempts + 1;
    const niche = prospect.niche ?? prospect.businessType ?? 'home_services';
    const language = (prospect.country === 'FR' || prospect.city?.toLowerCase().includes('quebec'))
      ? 'fr'
      : 'en';

    // Select A/B variant
    const variant = await abTestingService.pickVariant(niche, language);
    const script = this.buildScript(niche, language as 'en' | 'fr', variant, prospect.businessName, prospect.city ?? '');

    const localNumber = await this.getLocalPresenceNumber(prospect.phone);

    logger.info(`[OutboundEngine] Calling ${prospect.businessName} (attempt ${attemptNumber}, variant ${variant}, score ${prospect.priorityScore})`);

    try {
      // Trigger VAPI call with local presence number + personalized script
      const callRes = await fetch(`${env.VAPI_BASE_URL}/call/phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.VAPI_PRIVATE_KEY}`,
        },
        body: JSON.stringify({
          phoneNumberId: await this.resolveVapiPhoneId(localNumber),
          customer: { number: prospect.phone },
          assistantId: env.VAPI_ASSISTANT_ID,
          assistantOverrides: {
            firstMessage: script.split('\n')[0],
            instructions: script,
            maxDurationSeconds: 300,
          },
          metadata: {
            prospectId: prospect.id,
            attemptNumber,
            scriptVariant: variant,
            niche,
            language,
          },
        }),
      });

      if (!callRes.ok) {
        const errText = await callRes.text();
        logger.error(`[OutboundEngine] VAPI call failed for ${prospect.businessName}:`, errText);
        await discordService.notifyAlerts(`⚠️ VAPI call failed: ${prospect.businessName}\n${errText}`);
        return false;
      }

      const callData = await callRes.json() as any;
      const vapiCallId: string = callData.id ?? '';

      // Record call in DB
      await prisma.call.create({
        data: {
          prospectId: prospect.id,
          vapiCallId,
          phoneNumber: prospect.phone,
          direction: 'outbound',
          status: 'in-progress',
          startedAt: new Date(),
          niche,
          language,
          scriptVariant: variant,
          twilioNumberUsed: localNumber,
        },
      });

      // Update prospect
      const nextCallAt = this.computeNextCallAt(attemptNumber);
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: {
          callAttempts: { increment: 1 },
          lastCallDate: new Date(),
          status: 'contacted',
          nextCallAt,
          scriptVariantUsed: variant,
        },
      });

      // Track A/B call
      await abTestingService.recordCall(niche, language, variant);

      // Update bot status
      await prisma.botStatus.update({
        where: { id: botStatus.id },
        data: { lastCall: new Date() },
      });

      return true;
    } catch (err) {
      logger.error('[OutboundEngine] Call error:', err);
      await discordService.notifyAlerts(`❌ OutboundEngine error: ${(err as Error).message}`);
      return false;
    }
  }

  /** Resolve VAPI phone number ID from phone number string */
  private async resolveVapiPhoneId(phoneNumber: string): Promise<string> {
    // If we have no local presence logic configured, use default
    if (phoneNumber === env.VAPI_PHONE_NUMBER || !phoneNumber) {
      return env.VAPI_PHONE_NUMBER_ID;
    }

    // Try to find the VAPI phone number ID from DB
    const lpn = await prisma.localPresenceNumber.findFirst({
      where: { phoneNumber, active: true },
    });

    return lpn?.twilioSid ?? env.VAPI_PHONE_NUMBER_ID;
  }

  /** Compute next call attempt time */
  private computeNextCallAt(attemptJustMade: number): Date | null {
    const hours = RETRY_DELAY_HOURS[attemptJustMade];
    if (!hours) return null;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  /** Process a completed call (called from webhook or manual trigger) */
  async processCompletedCall(vapiCallId: string, outcomeData: {
    duration: number;
    outcome: string;
    transcript?: string;
    interestScore?: number;
    detectionResult?: 'answered' | 'voicemail' | 'no_answer' | 'rejected';
    prospectAskedQuestion?: boolean;
    pricingDiscussed?: boolean;
    requestedInfo?: boolean;
    agreedToDemo?: boolean;
  }): Promise<void> {
    const call = await prisma.call.findUnique({ where: { vapiCallId } });
    if (!call) return;

    const interestScore = outcomeData.interestScore ?? this.computeInterestScore({
      durationSeconds: outcomeData.duration,
      prospectAskedQuestion: outcomeData.prospectAskedQuestion ?? false,
      pricingDiscussed: outcomeData.pricingDiscussed ?? false,
      requestedInfo: outcomeData.requestedInfo ?? false,
      agreedToDemo: outcomeData.agreedToDemo ?? false,
    });

    await prisma.call.update({
      where: { vapiCallId },
      data: {
        status: 'completed',
        endedAt: new Date(),
        durationSeconds: outcomeData.duration,
        outcome: outcomeData.outcome,
        transcript: outcomeData.transcript,
        interestScore,
        detectionResult: outcomeData.detectionResult,
        leadCaptured: interestScore >= 6,
      },
    });

    if (!call.prospectId) return;

    const prospect = await prisma.prospect.findUnique({ where: { id: call.prospectId } });
    if (!prospect) return;

    // Hot lead detection
    if (interestScore >= 8) {
      await prisma.prospect.update({
        where: { id: call.prospectId },
        data: { status: 'interested', interestLevel: interestScore },
      });

      await discordService.notifyLeads(
        `🔥 HOT LEAD — Score ${interestScore}/10\n` +
        `Business: ${prospect.businessName}\nNiche: ${prospect.niche ?? prospect.businessType}\n` +
        `City: ${prospect.city}\nPhone: ${prospect.phone}\n` +
        `Action: Call back within 5 minutes`
      );
    } else if (interestScore >= 5) {
      await prisma.prospect.update({
        where: { id: call.prospectId },
        data: { status: 'interested', interestLevel: interestScore },
      });
    }

    // Discord #qwillio-calls log
    if (outcomeData.detectionResult === 'answered') {
      await discordService.notifyCalls(
        `📞 CALL CONNECTED\n` +
        `Business: ${prospect.businessName} | Niche: ${prospect.niche ?? prospect.businessType} | City: ${prospect.city}\n` +
        `Duration: ${outcomeData.duration}s | Score: ${interestScore}/10 | Drop-off: ${call.scriptDropOffPoint ?? 'N/A'}`
      );
    }

    // Track A/B result
    if (call.niche && call.language && call.scriptVariant && interestScore >= 5) {
      await abTestingService.recordConversion(call.niche, call.language, call.scriptVariant as 'A' | 'B');
    }

    // Mark exhausted after 3 failed attempts with no answer
    if (
      prospect.callAttempts >= 3 &&
      outcomeData.detectionResult !== 'answered'
    ) {
      await prisma.prospect.update({
        where: { id: call.prospectId },
        data: { status: 'exhausted', eligibleForCall: false },
      });
    }

    // Mark rejected — never call again
    if (outcomeData.outcome === 'rejected' || outcomeData.detectionResult === 'rejected') {
      await prisma.prospect.update({
        where: { id: call.prospectId },
        data: { status: 'rejected', eligibleForCall: false },
      });
    }
  }

  /** Seed local presence numbers table from static map */
  async seedLocalPresenceNumbers(): Promise<void> {
    const areaCodeStateMap: Record<string, [string, string]> = {
      '212': ['NY', 'New York'],    '310': ['CA', 'Los Angeles'],
      '312': ['IL', 'Chicago'],     '713': ['TX', 'Houston'],
      '602': ['AZ', 'Phoenix'],     '214': ['TX', 'Dallas'],
      '512': ['TX', 'Austin'],      '404': ['GA', 'Atlanta'],
      '305': ['FL', 'Miami'],       '615': ['TN', 'Nashville'],
      '206': ['WA', 'Seattle'],     '617': ['MA', 'Boston'],
      '415': ['CA', 'San Francisco'],'303': ['CO', 'Denver'],
      '702': ['NV', 'Las Vegas'],   '619': ['CA', 'San Diego'],
      '504': ['LA', 'New Orleans'], '210': ['TX', 'San Antonio'],
      '215': ['PA', 'Philadelphia'],'408': ['CA', 'San Jose'],
    };

    for (const [areaCode, phone] of Object.entries(AREA_CODE_MAP)) {
      if (phone.includes('5550000')) continue; // skip placeholder numbers
      const [, cityName] = areaCodeStateMap[areaCode] ?? ['', ''];
      await prisma.localPresenceNumber.upsert({
        where: { phoneNumber: phone },
        update: {},
        create: { areaCode, phoneNumber: phone, city: cityName, active: true },
      });
    }
  }
}

export const outboundEngineService = new OutboundEngineService();
