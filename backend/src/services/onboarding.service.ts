import { prisma } from '../config/database';
import { vapiClient } from '../config/vapi';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { emailService } from './email.service';
import { discordService } from './discord.service';

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000; // 2s, 4s, 8s exponential backoff

export class OnboardingService {

  // ═══════════════════════════════════════════════════════════
  // MAIN ONBOARDING - Called after payment or trial start
  // Uses shared phone number + retry logic
  // ═══════════════════════════════════════════════════════════
  async onboardClient(clientId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new Error(`Client not found: ${clientId}`);

    // Don't re-onboard if already completed
    if (client.onboardingStatus === 'completed') {
      logger.info(`Client ${client.businessName} already onboarded, skipping`);
      return;
    }

    const retryCount = (client.vapiConfig as any)?.retryCount || 0;

    try {
      await prisma.client.update({
        where: { id: clientId },
        data: { onboardingStatus: 'in_progress' },
      });

      logger.info(`Starting onboarding for ${client.businessName} (attempt ${retryCount + 1}/${MAX_RETRIES})...`);

      // ── STEP 1: Create VAPI assistant with retry ──
      const systemPrompt = this.generateClientSystemPrompt(client);

      // Build tools array — add transferCall if client has a transfer number
      const tools: any[] = [];
      if (client.transferNumber) {
        tools.push({
          type: 'transferCall',
          destinations: [{
            type: 'number',
            number: client.transferNumber,
            message: 'Of course — let me connect you with someone from the team right now. One moment please.',
          }],
        });
      }

      const assistantData: any = {
        name: `Receptionist - ${client.businessName}`,
        model: {
          provider: 'openai',
          model: env.VAPI_MODEL,
          temperature: 0.7,
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
        firstMessage: `Hello, thank you for calling ${client.businessName}. How can I help you today?`,
        serverUrl: `${env.API_BASE_URL}/api/webhooks/vapi/client/${client.id}`,
        endCallFunctionEnabled: true,
        recordingEnabled: true,
        backgroundSound: 'office',
        silenceTimeoutSeconds: env.VAPI_SILENCE_TIMEOUT,
        maxDurationSeconds: env.VAPI_MAX_DURATION,
        fillerInjectionEnabled: true,
        interruptionsEnabled: true,
        numWordsToInterruptAssistant: Math.round(env.VAPI_INTERRUPTION_THRESHOLD / 50),
      };

      // Only add tools if we have any
      if (tools.length > 0) {
        assistantData.tools = tools;
      }

      const assistant = await this.createAssistantWithRetry(assistantData);

      logger.info(`VAPI assistant created: ${assistant.id}`);

      // ── STEP 2: Use SHARED phone number (no purchase needed!) ──
      // All clients share the same VAPI number. Routing is done via
      // the assistant's serverUrl which contains the client ID.
      // This saves $1-2/mo per client on Twilio number fees.
      const sharedPhoneNumber = env.VAPI_PHONE_NUMBER;
      const sharedPhoneNumberId = env.VAPI_PHONE_NUMBER_ID;

      logger.info(`Using shared phone number: ${sharedPhoneNumber}`);

      // ── STEP 3: Verify assistant is reachable ──
      const isHealthy = await this.verifyAssistantHealth(assistant.id);
      if (!isHealthy) {
        logger.warn(`Assistant ${assistant.id} health check failed, proceeding anyway`);
      }

      // ── STEP 4: Update client record ──
      await prisma.client.update({
        where: { id: clientId },
        data: {
          vapiAssistantId: assistant.id,
          vapiPhoneNumber: sharedPhoneNumber,
          vapiConfig: {
            assistant_id: assistant.id,
            phone_number: sharedPhoneNumber,
            phone_number_id: sharedPhoneNumberId,
            webhook_url: `${env.API_BASE_URL}/api/webhooks/vapi/client/${client.id}`,
            healthy: isHealthy,
            onboarded_at: new Date().toISOString(),
          },
          onboardingStatus: 'completed',
          onboardingCompletedAt: new Date(),
        },
      });

      // ── STEP 5: Send welcome email ──
      await emailService.sendWelcomeEmail({
        to: client.contactEmail,
        contactName: client.contactName,
        businessName: client.businessName,
        planType: client.planType,
        vapiPhoneNumber: sharedPhoneNumber,
        dashboardUrl: `${env.FRONTEND_URL}/client-dashboard/${client.id}`,
      });

      // ── STEP 6: Discord notification ──
      const revenueLabel = client.isTrial
        ? `Trial (converts to $${client.monthlyFee}/mo)`
        : `MRR: $${client.monthlyFee} + Setup: $${client.setupFee}`;

      await discordService.notify(
        `🎉 ${client.isTrial ? 'FREE TRIAL ACTIVATED' : 'NEW PAYING CLIENT'}!\n\nClient: ${client.businessName}\nPackage: ${client.planType.toUpperCase()}\n${revenueLabel}\nAI Phone: ${sharedPhoneNumber}\nVAPI Assistant: ${assistant.id} ✅\nHealth Check: ${isHealthy ? '✅ Passed' : '⚠️ Skipped'}`
      );

      logger.info(`✅ Onboarding completed for ${client.businessName} in ${retryCount + 1} attempt(s)`);

    } catch (error) {
      const errorMsg = (error as Error).message;
      logger.error(`Onboarding failed for ${client.businessName} (attempt ${retryCount + 1}):`, error);

      // Track retry count for the CRON retry job
      const newRetryCount = retryCount + 1;
      const canRetry = newRetryCount < MAX_RETRIES;

      await prisma.client.update({
        where: { id: clientId },
        data: {
          onboardingStatus: canRetry ? 'retry_pending' : 'failed',
          vapiConfig: {
            ...(client.vapiConfig as any || {}),
            retryCount: newRetryCount,
            lastError: errorMsg,
            lastAttemptAt: new Date().toISOString(),
          },
        },
      });

      await discordService.notify(
        `❌ ONBOARDING ${canRetry ? 'FAILED (will retry)' : 'PERMANENTLY FAILED'}\n\nClient: ${client.businessName}\nAttempt: ${newRetryCount}/${MAX_RETRIES}\nError: ${errorMsg}${canRetry ? '\n\n🔄 Auto-retry in 5 minutes...' : '\n\n⛔ Manual intervention needed!'}`
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RETRY FAILED ONBOARDINGS - Called by CRON every 5 minutes
  // ═══════════════════════════════════════════════════════════
  async retryFailedOnboardings(): Promise<number> {
    const failedClients = await prisma.client.findMany({
      where: {
        onboardingStatus: 'retry_pending',
      },
      orderBy: { createdAt: 'asc' },
      take: 5, // Process max 5 at a time
    });

    if (failedClients.length === 0) return 0;

    logger.info(`🔄 Retrying onboarding for ${failedClients.length} client(s)...`);
    let retried = 0;

    for (const client of failedClients) {
      try {
        await this.onboardClient(client.id);
        retried++;
      } catch (err) {
        logger.error(`Retry failed for ${client.businessName}:`, err);
      }
      // Small delay between retries to avoid rate limiting
      await this.sleep(1000);
    }

    return retried;
  }

  // ═══════════════════════════════════════════════════════════
  // DEACTIVATE CLIENT - Trial expired or subscription canceled
  // ═══════════════════════════════════════════════════════════
  async deactivateClient(clientId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new Error(`Client not found: ${clientId}`);

    try {
      // 1. Delete VAPI assistant (stops receiving calls)
      // Note: We do NOT release the phone number since it's shared
      if (client.vapiAssistantId) {
        try {
          await vapiClient.deleteAssistant(client.vapiAssistantId);
          logger.info(`VAPI assistant deleted for ${client.businessName}`);
        } catch (err) {
          logger.warn(`Could not delete VAPI assistant ${client.vapiAssistantId}:`, err);
        }
      }

      // 2. Update client record (keep phone number field for reference)
      await prisma.client.update({
        where: { id: clientId },
        data: {
          vapiAssistantId: null,
          vapiConfig: {
            ...(client.vapiConfig as any || {}),
            deactivated_at: new Date().toISOString(),
            previous_assistant_id: client.vapiAssistantId,
          },
          onboardingStatus: 'deactivated',
        },
      });

      logger.info(`Client ${client.businessName} deactivated (assistant deleted, shared number preserved)`);
    } catch (error) {
      logger.error(`Deactivation failed for ${client.businessName}:`, error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE: Create assistant with exponential backoff retry
  // ═══════════════════════════════════════════════════════════
  private async createAssistantWithRetry(data: any, attempt = 1): Promise<any> {
    try {
      return await vapiClient.createAssistant(data);
    } catch (error) {
      if (attempt >= 3) {
        throw new Error(`VAPI createAssistant failed after ${attempt} attempts: ${(error as Error).message}`);
      }

      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1); // 2s, 4s, 8s
      logger.warn(`VAPI createAssistant attempt ${attempt} failed, retrying in ${delay}ms...`);
      await this.sleep(delay);

      return this.createAssistantWithRetry(data, attempt + 1);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE: Verify assistant responds after creation
  // ═══════════════════════════════════════════════════════════
  private async verifyAssistantHealth(assistantId: string): Promise<boolean> {
    try {
      // Simply fetch the assistant to confirm it exists and is accessible
      const assistant = await vapiClient.getAssistant(assistantId);
      return !!assistant && !!(assistant as any).id;
    } catch (error) {
      logger.warn(`Health check failed for assistant ${assistantId}:`, error);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE: Generate client-specific system prompt
  // Uses industry-specific knowledge for each business type
  // ═══════════════════════════════════════════════════════════
  private generateClientSystemPrompt(client: any): string {
    const multiLangSupport = client.planType === 'enterprise'
      ? '\n- You speak English, Spanish, French and Chinese. Adapt your language to match the caller.'
      : '';

    const proFeatures = ['pro', 'enterprise'].includes(client.planType)
      ? '\n- Qualify leads by asking about their needs and budget\n- Collect email addresses for follow-up'
      : '';

    // Get industry-specific knowledge
    const industryKnowledge = this.getIndustryKnowledge(client.businessType);

    // Build transfer instructions based on whether client has a transfer number
    const transferInstructions = client.transferNumber
      ? `
HUMAN TRANSFER — CRITICAL:
You have the ability to transfer calls to the business team. Use the transferCall tool when:
- The caller explicitly says "transfer me", "speak to someone", "real person", "manager", or any equivalent
- The caller says "I'm frustrated" or expresses strong frustration
- The caller has repeated the same question 3+ times and you cannot resolve it
- The caller's tone indicates high frustration (raised voice, silence after failed answers)

Before transferring, ALWAYS say: "Of course — let me connect you with someone from the team right now. One moment please."
Then use the transferCall tool to transfer to the designated number.

If the transfer fails or no one answers, say: "I'm sorry, the team is currently unavailable — but I'll make sure someone calls you back within the next hour. Can I confirm the best number to reach you?"
Then collect their callback number and end the call politely.

NEVER just drop the call silently during a transfer.`
      : `
TRANSFER REQUESTS:
If a caller asks to speak to a real person, says "transfer me", "manager", or expresses strong frustration:
- Apologize and offer to take a detailed message
- Say: "I completely understand. Let me take your name and number, and I'll make sure someone from the team calls you back as soon as possible."
- Collect their name, phone number, and brief description of what they need
- Mark the message as urgent`;

    return `You are the virtual receptionist for ${client.businessName}, a ${client.businessType} located in ${client.city || 'the United States'}.

YOUR ROLE:
- Warmly greet all callers
- Answer frequently asked questions about the business
- Take bookings and appointments
- Log messages for the team${proFeatures}${multiLangSupport}

BUSINESS INFORMATION:
- Name: ${client.businessName}
- Type: ${client.businessType}
- Phone: ${client.contactPhone || 'N/A'}
- Email: ${client.contactEmail}

${industryKnowledge}
${transferInstructions}

YOUR STYLE:
- Professional yet warm and friendly
- Positive and upbeat tone
- Short, clear sentences
- Polite and courteous at all times

BOOKING INSTRUCTIONS:
${this.getBookingInstructions(client.businessType)}

GENERAL INSTRUCTIONS:
1. For questions outside your knowledge: offer to take a message
2. For urgent matters: offer to transfer the call immediately
3. Always end with "Is there anything else I can help you with?"
4. If asked about pricing and you don't have specifics, say you'll have someone get back to them

IMPORTANT: You represent ${client.businessName} - be impeccable!`;
  }

  // ═══════════════════════════════════════════════════════════
  // INDUSTRY-SPECIFIC KNOWLEDGE BASE
  // Custom prompts for each business type
  // ═══════════════════════════════════════════════════════════
  private getIndustryKnowledge(businessType: string): string {
    const type = businessType.toLowerCase();

    // Restaurant / Food Service
    if (type.includes('restaurant') || type.includes('café') || type.includes('cafe') || type.includes('bistro') || type.includes('pizzeria') || type.includes('food') || type.includes('dining') || type.includes('bar') || type.includes('grill') || type.includes('sushi') || type.includes('bakery') || type.includes('boulangerie')) {
      return `INDUSTRY EXPERTISE - RESTAURANT/FOOD SERVICE:
- Know common questions: hours, menu options, specials, dietary accommodations (vegan, gluten-free, allergies)
- Handle reservation requests: date, time, party size, special occasions, seating preferences (indoor/outdoor/private room)
- Know about: catering, private events, takeout/delivery options, gift cards
- Be ready for: wait times, parking info, dress code, corkage fees
- Common upsells: mention specials, wine pairings, dessert menus, private dining`;
    }

    // Dental / Orthodontics
    if (type.includes('dental') || type.includes('dentist') || type.includes('orthodont') || type.includes('oral')) {
      return `INDUSTRY EXPERTISE - DENTAL PRACTICE:
- Know appointment types: cleaning, check-up, emergency, whitening, extraction, crown, filling, root canal, implant, Invisalign consultation
- Handle insurance questions: ask for insurance provider name, direct them to verify coverage
- Emergency protocols: tooth pain, broken tooth, knocked-out tooth → prioritize same-day appointment
- New patient intake: ask about referral source, insurance, any current dental concerns
- Common concerns: address dental anxiety with reassurance, mention sedation options if available
- Scheduling: suggest morning slots for complex procedures, ask about preferred day/time`;
    }

    // Medical / Doctor / Clinic
    if (type.includes('medical') || type.includes('doctor') || type.includes('clinic') || type.includes('physician') || type.includes('health') || type.includes('urgent care') || type.includes('pediatr')) {
      return `INDUSTRY EXPERTISE - MEDICAL PRACTICE:
- Know appointment types: annual physical, sick visit, follow-up, lab work, vaccination, consultation
- Triage basics: if caller describes chest pain, difficulty breathing, severe bleeding → advise calling 911 immediately
- Handle insurance: ask for insurance provider, group number; note that coverage verification will be done by office staff
- New patients: collect name, date of birth, insurance info, reason for visit, preferred appointment time
- Prescription refills: collect patient name, date of birth, medication name, pharmacy preference
- HIPAA awareness: never discuss patient details over the phone without identity verification`;
    }

    // Salon / Spa / Beauty
    if (type.includes('salon') || type.includes('spa') || type.includes('beauty') || type.includes('hair') || type.includes('barber') || type.includes('nail') || type.includes('aesthetic') || type.includes('massage') || type.includes('wax')) {
      return `INDUSTRY EXPERTISE - SALON/SPA/BEAUTY:
- Know service categories: haircut, color, highlights, balayage, blowout, extensions, keratin treatment
- Spa services: massage (Swedish, deep tissue, hot stone), facial, body wrap, manicure, pedicure, waxing
- Scheduling details: service duration matters (color takes 2-3 hours), ask about add-on services
- Stylist/therapist preferences: ask if they have a preferred stylist or are open to any available
- New clients: ask about hair type, desired style, any allergies to products
- Pricing: quote ranges if available, mention that consultations may be recommended for major changes
- Cancellation policy: mention 24-hour cancellation policy if applicable`;
    }

    // Law Firm / Legal
    if (type.includes('law') || type.includes('legal') || type.includes('attorney') || type.includes('avocat') || type.includes('lawyer')) {
      return `INDUSTRY EXPERTISE - LAW FIRM:
- Know practice areas: family law, personal injury, criminal defense, business law, estate planning, immigration, real estate
- Initial intake: collect name, brief description of legal issue, timeline urgency, how they heard about the firm
- Confidentiality: reassure callers that all conversations are confidential
- Consultation scheduling: mention if initial consultations are free or paid, typical duration (30-60 min)
- Urgency handling: arrests, restraining orders, imminent deadlines → mark as urgent for immediate callback
- Never give legal advice: always clarify that only an attorney can provide legal counsel
- Billing questions: direct to the billing department, don't discuss fees unless specifically instructed`;
    }

    // Real Estate
    if (type.includes('real estate') || type.includes('realty') || type.includes('property') || type.includes('immobilier')) {
      return `INDUSTRY EXPERTISE - REAL ESTATE:
- Know inquiry types: buying, selling, renting, property management, commercial leasing
- For buyers: ask about budget range, preferred areas, property type (house, condo, townhouse), bedrooms/bathrooms
- For sellers: ask about property address, timeline to sell, if they've had a recent appraisal
- Showing requests: collect date/time preferences, property address of interest
- Agent matching: ask if they're already working with an agent from the office
- Open houses: provide dates/times if available, encourage attendance
- Pre-approval: ask if buyers have mortgage pre-approval, suggest getting one if not`;
    }

    // Auto / Mechanic / Car Dealer
    if (type.includes('auto') || type.includes('car') || type.includes('mechanic') || type.includes('garage') || type.includes('dealer') || type.includes('vehicle') || type.includes('tire') || type.includes('body shop')) {
      return `INDUSTRY EXPERTISE - AUTOMOTIVE:
- Know service types: oil change, tire rotation, brake inspection, engine diagnostics, AC repair, transmission, alignment
- For repairs: ask about vehicle year/make/model, symptoms, warning lights, mileage
- Emergency: towing availability, roadside assistance info
- Estimates: offer to schedule a diagnostic appointment for accurate quotes
- For dealers: new vs used inventory inquiries, trade-in questions, test drive scheduling, financing options
- Scheduling: ask about drop-off vs wait, need for loaner vehicle
- Warranty: ask if vehicle is under manufacturer or extended warranty`;
    }

    // Fitness / Gym
    if (type.includes('gym') || type.includes('fitness') || type.includes('yoga') || type.includes('pilates') || type.includes('crossfit') || type.includes('martial') || type.includes('boxing') || type.includes('training')) {
      return `INDUSTRY EXPERTISE - FITNESS/GYM:
- Know offerings: membership plans, class schedules, personal training, group classes
- Trial/guest passes: offer free trial visit or day pass to new callers
- Membership inquiries: monthly vs annual pricing, family plans, student/senior discounts
- Class types: yoga, spin, HIIT, weight training, Zumba, boxing, swim
- Tour scheduling: invite prospects for a facility tour, suggest best times
- Cancellation/freeze: direct to membership services for account changes
- Hours: gym hours, peak hours, class schedule availability`;
    }

    // Plumbing / HVAC / Electrician / Home Services
    if (type.includes('plumb') || type.includes('hvac') || type.includes('electric') || type.includes('heating') || type.includes('cooling') || type.includes('roofing') || type.includes('contractor') || type.includes('handyman') || type.includes('cleaning') || type.includes('landscap') || type.includes('pest') || type.includes('locksmith')) {
      return `INDUSTRY EXPERTISE - HOME SERVICES:
- Emergency handling: water leaks, no heat/AC, electrical hazards, gas smell → mark as emergency dispatch
- Service requests: collect address, describe issue, preferred time window, access instructions
- Estimate requests: offer free estimates for larger jobs, mention diagnostic fees for service calls
- Insurance claims: ask if related to an insurance claim, collect claim number if applicable
- Scheduling: morning/afternoon windows, ask about someone being home for access
- Follow-up: ask about previous service history, any recurring issues
- Seasonal services: mention AC tune-ups (spring), furnace maintenance (fall), etc.`;
    }

    // Accounting / Financial
    if (type.includes('account') || type.includes('cpa') || type.includes('tax') || type.includes('bookkeep') || type.includes('financial') || type.includes('wealth') || type.includes('insurance')) {
      return `INDUSTRY EXPERTISE - ACCOUNTING/FINANCIAL:
- Know service types: tax preparation, bookkeeping, audit, payroll, business formation, financial planning
- Seasonal awareness: tax season (Jan-Apr) is busiest, extension deadlines (Oct 15)
- New client intake: individual vs business, approximate revenue/complexity, current tax situation
- Document gathering: mention what documents to bring to appointments
- Urgency: IRS notices, audit letters, missed deadlines → priority scheduling
- Confidentiality: reassure that all financial information is kept strictly confidential
- Pricing: hourly vs flat fee structures, mention that complexity determines pricing`;
    }

    // Veterinary / Pet
    if (type.includes('vet') || type.includes('animal') || type.includes('pet') || type.includes('veterinar')) {
      return `INDUSTRY EXPERTISE - VETERINARY/PET:
- Know appointment types: wellness check, vaccination, sick visit, surgery, dental cleaning, spay/neuter, emergency
- Emergency handling: difficulty breathing, poisoning, seizures, trauma → direct to emergency vet if after hours
- New patients: pet type, breed, age, weight, vaccination history, current medications
- Scheduling: ask about pet's condition (urgent vs routine), any fasting requirements before procedure
- Common concerns: address pet parent anxiety with empathy and reassurance
- Services: boarding, grooming, prescription refills, microchipping, pet food orders
- Medication refills: collect pet name, owner name, medication name`;
    }

    // Default - Generic business
    return `INDUSTRY EXPERTISE - GENERAL BUSINESS:
- Handle appointment scheduling: collect name, phone, email, preferred date/time, reason for visit
- Answer general inquiries: hours of operation, location, services offered, pricing ranges
- Customer complaints: listen empathetically, log details, promise callback from manager within 24 hours
- New customer onboarding: collect contact information, understand their needs, schedule consultation
- Follow-up requests: log request details and ensure callback within business hours`;
  }

  // ═══════════════════════════════════════════════════════════
  // BOOKING INSTRUCTIONS PER INDUSTRY
  // ═══════════════════════════════════════════════════════════
  private getBookingInstructions(businessType: string): string {
    const type = businessType.toLowerCase();

    if (type.includes('restaurant') || type.includes('café') || type.includes('cafe') || type.includes('food') || type.includes('dining') || type.includes('bar') || type.includes('bistro')) {
      return `1. For reservations: collect date, time, party size, name, phone number, any special requests (birthday, allergies, high chair)
2. Confirm availability for the requested time, suggest alternatives if fully booked
3. Mention any specials or events happening on that date
4. For large parties (8+): mention that a deposit or pre-fixed menu may be required`;
    }

    if (type.includes('dental') || type.includes('medical') || type.includes('doctor') || type.includes('clinic') || type.includes('health') || type.includes('vet')) {
      return `1. For appointments: collect patient/pet name, date of birth, reason for visit, insurance info, preferred date/time
2. Ask if they are a new or existing patient
3. For new patients: mention to arrive 15 minutes early for paperwork
4. For emergencies: assess urgency level, offer same-day appointment or redirect to emergency services
5. Mention any preparation needed (fasting, bringing records, etc.)`;
    }

    if (type.includes('salon') || type.includes('spa') || type.includes('beauty') || type.includes('hair') || type.includes('barber') || type.includes('nail')) {
      return `1. For appointments: collect name, service type, preferred stylist/therapist, date/time, phone number
2. Ask about service duration needs (e.g., color + cut = 2-3 hours)
3. For new clients: suggest a consultation for major changes (color transformation, extensions)
4. Mention any add-on services they might enjoy
5. Remind about cancellation policy (usually 24 hours notice)`;
    }

    if (type.includes('law') || type.includes('legal') || type.includes('attorney') || type.includes('lawyer')) {
      return `1. For consultations: collect name, phone, email, brief case description, urgency level
2. Ask about the legal area (family, personal injury, criminal, business, estate)
3. Mention if initial consultation is free or paid, and typical duration
4. For urgent matters: flag for immediate attorney callback
5. Never provide legal advice - schedule them with an attorney`;
    }

    if (type.includes('plumb') || type.includes('hvac') || type.includes('electric') || type.includes('contractor') || type.includes('handyman') || type.includes('cleaning') || type.includes('locksmith')) {
      return `1. For service calls: collect name, address, phone, describe the issue, urgency level, preferred time window
2. For emergencies (leaks, no heat, electrical hazards): mark as urgent for same-day dispatch
3. Ask about property type (house, apartment, commercial) and access instructions
4. Offer free estimates for larger projects
5. Ask if the issue is covered by home warranty or insurance`;
    }

    // Default booking instructions
    return `1. For appointments: collect name, phone number, email, preferred date/time, reason for visit
2. Ask if they are a new or returning customer
3. Confirm the appointment details before ending the call
4. Mention any preparation or documents they should bring
5. Ask if they have any special requirements or questions`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const onboardingService = new OnboardingService();
