import { prisma } from '../config/database';
import { vapiClient } from '../config/vapi';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { emailService } from './email.service';
import { discordService } from './discord.service';
import { resolveCharacter } from '../config/voice-characters';
import { getPersonaPrompt, PERSONALITY_PROMPTS } from '../config/personalities';
import { buildRealtimePlans, buildVoice } from './voice/speech-plans';
import { realtimeContextService } from './voice/realtime-context.service';
import { greetingAudioService } from './voice/greeting-audio.service';
import { toE164 } from '../utils/phone';
import { resolveNiche } from '../config/niches';
import { knowledgePreset } from '../config/knowledge-presets';
import { allocateInboundNumber } from './voice/phone-allocation.service';
import { clientPortalUrl } from '../utils/urls';

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
      const cfg = (client.vapiConfig as any) || {};
      const character = resolveCharacter({
        characterId: cfg.characterId,
        isFrench: this.isFrenchClient(client),
        country: client.country,
      });

      // Build tools array — add transferCall if client has a transfer number
      const isFrClient = this.isFrenchClient(client);
      const tools: any[] = [];
      if (client.transferNumber) {
        tools.push({
          type: 'transferCall',
          destinations: [{
            type: 'number',
            number: client.transferNumber,
            message: isFrClient
              ? 'Bien sûr, je vous mets en relation avec quelqu\'un de l\'équipe tout de suite. Un instant, s\'il vous plaît.'
              : 'Of course, let me connect you with someone from the team right now. One moment please.',
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
        // Voice, transcriber and the start/stop speaking plans all come from
        // the real-time module so an onboarded assistant is born with the same
        // barge-in and endpointing tuning the orchestrator applies per call.
        voice: buildVoice({
          voiceId: character.voiceId,
          stability: character.stability,
          similarityBoost: character.similarityBoost,
          style: character.style,
        }),
        firstMessage: this.generateFirstMessage(client, isFrClient),
        ...buildRealtimePlans(client?.agentLanguage === 'nl' ? 'nl' : isFrClient ? 'fr' : 'en'),
        serverUrl: `${env.API_BASE_URL}/api/webhooks/vapi/client/${client.id}`,
        endCallFunctionEnabled: true,
        // Même règle que le runtime: refuser la notice, c'est refuser
        // l'enregistrement — jamais un enregistrement silencieux.
        recordingEnabled: ((client?.vapiConfig as any)?.disableRecordingNotice !== true),
        backgroundSound: env.VOICE_BACKGROUND_SOUND,
      };

      // Only add tools if we have any
      if (tools.length > 0) {
        assistantData.tools = tools;
      }

      const assistant = await this.createAssistantWithRetry(assistantData);

      logger.info(`VAPI assistant created: ${assistant.id}`);

      /* ── ÉTAPE 2: réserver la ligne entrante ──
         Le numéro n'est plus recopié aveuglément dans chaque client. Il l'était,
         au motif que le routage passerait par l'URL de webhook de l'assistant:
         vrai en SORTANT, faux en ENTRANT, où le numéro composé est la seule
         chose qui dise quelle entreprise a été appelée. Deux clients sur la même
         ligne rendaient donc les DEUX injoignables.
         Un client qui n'obtient rien n'a pas de ligne entrante, et c'est dit
         fort: c'est un numéro à acheter, pas une panne à découvrir par un
         appelant. Le reste de son installation (assistant, portail, sortant)
         fonctionne. */
      const allocation = await allocateInboundNumber(clientId);
      let sharedPhoneNumber = allocation.kind === 'allocated' ? allocation.number : null;
      let sharedPhoneNumberId = allocation.kind === 'allocated' ? allocation.numberId : null;

      /* Ligne partagée indisponible: tentative d'ACHAT automatique, derrière
         PHONE_AUTO_PROVISION=1 (off par défaut — un achat est une dépense,
         voir phone-provisioning.service). En échec ou flag off, on retombe
         sur le chemin existant: alerte + achat manuel. */
      if (allocation.kind === 'none') {
        const { autoProvisionNumber } = await import('./voice/phone-provisioning.service');
        const bought = await autoProvisionNumber(clientId, assistant.id);
        if (bought) {
          sharedPhoneNumber = bought.number;
          sharedPhoneNumberId = bought.numberId;
          await discordService.notify(
            `📞 NUMÉRO PROVISIONNÉ AUTOMATIQUEMENT\n\nClient: ${client.businessName}\nNuméro: ${bought.number}`,
          );
        }
      }

      /* Ce que le client A vraiment au bout du compte: la ligne attribuee, ou
         celle qu'un exploitant a deja posee a la main sur sa fiche. C'est cette
         valeur-la qui part dans l'email et dans l'alerte. */
      const effectivePhoneNumber = sharedPhoneNumber ?? client.vapiPhoneNumber ?? null;

      if (sharedPhoneNumber) {
        logger.info(`Ligne entrante attribuée: ${sharedPhoneNumber}`);
      } else if (allocation.kind === 'none') {
        const why =
          allocation.reason === 'already_taken'
            ? `la ligne ${env.VAPI_PHONE_NUMBER} appartient déjà à « ${allocation.heldBy} »`
            : 'aucun numéro VAPI_PHONE_NUMBER n\'est configuré';
        logger.error(`[Onboarding] ${client.businessName} reste sans ligne entrante: ${why}`);
        await discordService.notify(
          `⚠️ PAS DE LIGNE ENTRANTE\n\nClient: ${client.businessName}\nRaison: ${why}\n` +
            'Acheter un numéro et le poser sur la fiche client, sinon ce client ne recevra aucun appel.',
        );
      }

      // ── STEP 3: Verify assistant is reachable (retry once before proceeding) ──
      let isHealthy = await this.verifyAssistantHealth(assistant.id);
      if (!isHealthy) {
        logger.warn(`Assistant ${assistant.id} health check failed, retrying in 3s...`);
        await this.sleep(3000);
        isHealthy = await this.verifyAssistantHealth(assistant.id);
        if (!isHealthy) {
          logger.warn(`Assistant ${assistant.id} health check failed twice — proceeding but flagging`);
          await discordService.notify(
            `⚠️ HEALTH CHECK FAILED\n\nClient: ${client.businessName}\nAssistant: ${assistant.id}\nProceeding with onboarding but assistant may not respond to calls`
          );
        }
      }

      // ── STEP 4: Update client record ──
      await prisma.client.update({
        where: { id: clientId },
        data: {
          vapiAssistantId: assistant.id,
          /* Sans attribution, on ne TOUCHE PAS au champ. L'alerte Discord
             ci-dessus demande a l'exploitant d'acheter un numero et de le poser
             sur la fiche; ecrire `null` ici l'effacerait au premier passage du
             cron de reprise, et le client redeviendrait injoignable sans
             qu'aucune trace ne le dise. */
          ...(sharedPhoneNumber ? { vapiPhoneNumber: sharedPhoneNumber } : {}),
          vapiConfig: {
            assistant_id: assistant.id,
            phone_number: effectivePhoneNumber,
            phone_number_id: sharedPhoneNumberId ?? (client.vapiConfig as any)?.phone_number_id ?? null,
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
        // Sans ligne attribuée, on ne promet pas un numéro à appeler.
        vapiPhoneNumber: effectivePhoneNumber ?? '',
        dashboardUrl: clientPortalUrl(client.id, client.dashboardToken),
        lang: this.isFrenchClient(client) ? 'fr' : 'en',
      });

      // ── STEP 6: Discord notification ──
      const revenueLabel = client.isTrial
        ? `Trial (converts to $${client.monthlyFee}/mo)`
        : `MRR: $${client.monthlyFee} + Setup: $${client.setupFee}`;

      await discordService.notify(
        `🎉 ${client.isTrial ? 'FREE TRIAL ACTIVATED' : 'NEW PAYING CLIENT'}!\n\nClient: ${client.businessName}\nPackage: ${client.planType.toUpperCase()}\n${revenueLabel}\nAI Phone: ${effectivePhoneNumber ?? 'AUCUNE LIGNE'}\nVAPI Assistant: ${assistant.id} ✅\nHealth Check: ${isHealthy ? '✅ Passed' : '⚠️ Skipped'}`
      );

      // Pre-synthesise the greetings so the very first caller already skips the
      // TTS wait on the opening line.
      void this.regenerateGreetings(clientId);

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
        // Alert Discord after final retry failure
        await discordService.notifyErrors(`🚨 VAPI CREATION FAILED 3x\n\nAction required: manual VAPI setup\nError: ${(error as Error).message}`);
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
  // A client is treated as French-speaking if its agentLanguage is 'fr' or its
  // country is a francophone jurisdiction where GDPR consent phrasing must
  // be delivered in French to be legally meaningful.
  private isFrenchClient(client: any): boolean {
    if (client?.agentLanguage === 'fr') return true;
    const country = (client?.country || '').toUpperCase();
    return ['FR', 'BE', 'LU', 'MC', 'CH'].includes(country);
  }

  // Assemble the assistant's opening line so that:
  //  1. Callers hear a natural greeting in their language.
  //  2. The AI disclosure (AI Act art. 50) and the GDPR recording notice are
  //     delivered at the start of the call.
  //  3. vapiConfig.disableRecordingNotice no longer suppresses the notice while
  //     recording continues: it now disables recording itself (see the
  //     `recordingEnabled` line above), so the notice disappears only when
  //     there is nothing to announce. The AI disclosure is never optional.
  private generateFirstMessage(client: any, isFrClient: boolean): string {
    const cfg = (client?.vapiConfig as any) || {};
    const businessName = client?.businessName || (isFrClient ? 'notre entreprise' : 'our business');
    const agentName = client?.agentName || (isFrClient ? 'Camille' : 'Ashley');
    const recordingDisabled = cfg.disableRecordingNotice === true;
    const noticeFr = 'Cet appel est enregistré.';
    /* Plus de « training purposes »: le site promet que les données ne servent
       pas à entraîner un modèle externe sans accord, et l'annonce disait le
       contraire à l'appelant lui-même. La version française n'en parlait déjà
       pas. */
    const noticeEn = 'This call is recorded.';
    const noticeNl = 'Dit gesprek wordt opgenomen.';

    // Le néerlandais est un opt-in explicite (agentLanguage), jamais déduit du
    // pays: la Belgique reste francophone par défaut.
    if (client?.agentLanguage === 'nl') {
      const greeting = `Goeiedag, bedankt om ${businessName} te bellen. Ik ben ${agentName}, uw AI-assistent.`;
      const notice = recordingDisabled ? '' : ` ${noticeNl}`;
      return `${greeting}${notice} Waarmee kan ik u helpen?`;
    }

    if (isFrClient) {
      const greeting = `Bonjour, merci d'appeler ${businessName}. Je suis ${agentName}, votre assistant IA.`;
      const notice = recordingDisabled ? '' : ` ${noticeFr}`;
      return `${greeting}${notice} Comment puis-je vous aider ?`;
    }

    const greeting = `Hello, thank you for calling ${businessName}. This is ${agentName}, your AI assistant.`;
    const notice = recordingDisabled ? '' : ` ${noticeEn}`;
    return `${greeting}${notice} How can I help you today?`;
  }

  private generateClientSystemPrompt(client: any): string {
    const multiLangSupport = client.planType === 'enterprise'
      ? '\n- You speak English, Spanish, French and Chinese. Adapt your language to match the caller.'
      : '';

    const proFeatures = ['pro', 'enterprise'].includes(client.planType)
      ? '\n- Qualify leads by asking about their needs and budget\n- Collect email addresses for follow-up'
      : '';

    // Get industry-specific knowledge
    const industryKnowledge = this.getIndustryKnowledge(client.businessType);

    // Per-client knowledge stored in vapiConfig JSON
    // - items  : [{ category, name, price }]
    // - hours  : { monday: { open, from, to }, ... }
    // - faq    : free text
    // - specialNotes : free text
    const cfg = (client.vapiConfig as any) || {};
    const clientKnowledgeBlocks: string[] = [];

    // Items grouped by category → readable bullet list
    if (Array.isArray(cfg.items) && cfg.items.length) {
      const byCat: Record<string, string[]> = {};
      for (const it of cfg.items) {
        if (!it || !it.name) continue;
        const cat = (it.category || 'autre').toString();
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push(`- ${it.name}${it.price ? ` — ${it.price}` : ''}`);
      }
      const catLabels: Record<string, string> = {
        service:    'SERVICES',
        menu:       'MENU',
        tarif:      'PRICES',
        produit:    'PRODUCTS',
        prestation: 'OFFERINGS',
        autre:      'OTHER',
      };
      const blocks = Object.entries(byCat).map(([cat, lines]) =>
        `${catLabels[cat] || cat.toUpperCase()}:\n${lines.join('\n')}`
      );
      if (blocks.length) clientKnowledgeBlocks.push(blocks.join('\n\n'));
    }

    // Weekly schedule → "Monday: 9:00–18:00 · Sunday: Closed"
    if (cfg.hours && typeof cfg.hours === 'object') {
      const dayLabel: Record<string, string> = {
        monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
        thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
      };
      const order = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      const lines = order
        .filter(d => cfg.hours[d])
        .map(d => {
          const h = cfg.hours[d];
          if (!h.open) return `- ${dayLabel[d]}: Closed`;
          return `- ${dayLabel[d]}: ${h.from || ''}–${h.to || ''}`;
        });
      if (lines.length) clientKnowledgeBlocks.push(`BUSINESS HOURS:\n${lines.join('\n')}`);
    }

    if (cfg.faq) clientKnowledgeBlocks.push(`FAQ (answer these with the given answers):\n${cfg.faq}`);

    // Les champs nommés du métier (mutuelles acceptées, protocole d'urgence,
    // politique d'annulation…). Sans ce bloc ils seraient saisis, stockés, et
    // jamais dits: c'est le seul endroit qui les fait exister pour l'agent.
    // Le libellé vient du preset du métier, pas de l'identifiant brut, sinon le
    // modèle lirait « emergencyProtocol » et devrait le deviner.
    if (cfg.knowledge && typeof cfg.knowledge === 'object') {
      const preset = knowledgePreset(client.businessType);
      const labels = new Map(preset.fields.map(f => [f.id, f.label]));
      const lines = Object.entries(cfg.knowledge as Record<string, string>)
        .filter(([, v]) => typeof v === 'string' && v.trim())
        .map(([id, v]) => `- ${labels.get(id) || id}: ${v}`);
      if (lines.length) clientKnowledgeBlocks.push(`BUSINESS DETAILS:\n${lines.join('\n')}`);
    }

    const clientKnowledge = clientKnowledgeBlocks.length
      ? '\n' + clientKnowledgeBlocks.join('\n\n') + '\n'
      : '';

    // Personality (character/preset + free-text refinement) — affects voice style.
    // Precedence: explicit personalityPreset override, else the selected
    // character's persona, else warm. Tone presets live in config/personalities.
    const character = resolveCharacter({
      characterId: cfg.characterId,
      isFrench: this.isFrenchClient(client),
      country: client.country,
    });
    const personaKey = (cfg.personalityPreset && PERSONALITY_PROMPTS[cfg.personalityPreset as keyof typeof PERSONALITY_PROMPTS])
      ? cfg.personalityPreset
      : character.personaKey;
    const personaPreset = getPersonaPrompt(personaKey);
    const personaNotes = cfg.personalityNotes || cfg.specialNotes || '';
    const personaBlock =
      `PERSONALITY AND TONE:\n- ${personaPreset}` +
      (personaNotes ? `\n\nADDITIONAL CUSTOMIZATION (must follow):\n${personaNotes}` : '');

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

${industryKnowledge}${clientKnowledge}
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
4. If asked about pricing: answer precisely from MENU / PRICES above when available; otherwise say you'll have someone get back to them

IMPORTANT: You represent ${client.businessName} - be impeccable!`;
  }

  // ═══════════════════════════════════════════════════════════
  // INDUSTRY-SPECIFIC KNOWLEDGE BASE
  // Custom prompts for each business type
  // ═══════════════════════════════════════════════════════════
  private getIndustryKnowledge(businessType: string): string {
    const niche = resolveNiche(businessType);

    // Restaurant / Food Service
    if (niche === 'restaurant') {
      return `INDUSTRY EXPERTISE - RESTAURANT/FOOD SERVICE:
- Know common questions: hours, menu options, specials, dietary accommodations (vegan, gluten-free, allergies)
- Handle reservation requests: date, time, party size, special occasions, seating preferences (indoor/outdoor/private room)
- Know about: catering, private events, takeout/delivery options, gift cards
- Be ready for: wait times, parking info, dress code, corkage fees
- Common upsells: mention specials, wine pairings, dessert menus, private dining`;
    }

    // Dental / Orthodontics
    if (niche === 'dental') {
      return `INDUSTRY EXPERTISE - DENTAL PRACTICE:
- Know appointment types: cleaning, check-up, emergency, whitening, extraction, crown, filling, root canal, implant, Invisalign consultation
- Handle insurance questions: ask for insurance provider name, direct them to verify coverage
- Emergency protocols: tooth pain, broken tooth, knocked-out tooth → prioritize same-day appointment
- New patient intake: ask about referral source, insurance, any current dental concerns
- Common concerns: address dental anxiety with reassurance, mention sedation options if available
- Scheduling: suggest morning slots for complex procedures, ask about preferred day/time`;
    }

    // Medical / Doctor / Clinic
    if (niche === 'medical') {
      return `INDUSTRY EXPERTISE - MEDICAL PRACTICE:
- Know appointment types: annual physical, sick visit, follow-up, lab work, vaccination, consultation
- Triage basics: if caller describes chest pain, difficulty breathing, severe bleeding → advise calling 911 immediately
- Handle insurance: ask for insurance provider, group number; note that coverage verification will be done by office staff
- New patients: collect name, date of birth, insurance info, reason for visit, preferred appointment time
- Prescription refills: collect patient name, date of birth, medication name, pharmacy preference
- HIPAA awareness: never discuss patient details over the phone without identity verification`;
    }

    // Salon / Spa / Beauty
    if (niche === 'salon') {
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
    if (niche === 'law') {
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
    if (niche === 'real_estate') {
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
    if (niche === 'auto') {
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
    if (niche === 'fitness') {
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
    if (niche === 'home_services') {
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
    if (niche === 'financial') {
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
    if (niche === 'veterinary') {
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
    const niche = resolveNiche(businessType);

    if (niche === 'restaurant') {
      return `1. For reservations: collect date, time, party size, name, phone number, any special requests (birthday, allergies, high chair)
2. Confirm availability for the requested time, suggest alternatives if fully booked
3. Mention any specials or events happening on that date
4. For large parties (8+): mention that a deposit or pre-fixed menu may be required`;
    }

    if (niche === 'dental' || niche === 'medical' || niche === 'veterinary') {
      return `1. For appointments: collect patient/pet name, date of birth, reason for visit, insurance info, preferred date/time
2. Ask if they are a new or existing patient
3. For new patients: mention to arrive 15 minutes early for paperwork
4. For emergencies: assess urgency level, offer same-day appointment or redirect to emergency services
5. Mention any preparation needed (fasting, bringing records, etc.)`;
    }

    if (niche === 'salon') {
      return `1. For appointments: collect name, service type, preferred stylist/therapist, date/time, phone number
2. Ask about service duration needs (e.g., color + cut = 2-3 hours)
3. For new clients: suggest a consultation for major changes (color transformation, extensions)
4. Mention any add-on services they might enjoy
5. Remind about cancellation policy (usually 24 hours notice)`;
    }

    if (niche === 'law') {
      return `1. For consultations: collect name, phone, email, brief case description, urgency level
2. Ask about the legal area (family, personal injury, criminal, business, estate)
3. Mention if initial consultation is free or paid, and typical duration
4. For urgent matters: flag for immediate attorney callback
5. Never provide legal advice - schedule them with an attorney`;
    }

    if (niche === 'home_services') {
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

  // ═══════════════════════════════════════════════════════════
  // SYNC VAPI ASSISTANT — Called when client updates settings
  // Reads current client record and pushes updated config to VAPI
  // ═══════════════════════════════════════════════════════════
  async syncVapiAssistant(clientId: string): Promise<void> {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || !client.vapiAssistantId) {
      logger.warn(`syncVapiAssistant: no assistant found for client ${clientId}`);
      return;
    }

    const systemPrompt = this.generateClientSystemPrompt(client);
    const cfg = (client.vapiConfig as any) || {};
    const character = resolveCharacter({
      characterId: cfg.characterId,
      isFrench: this.isFrenchClient(client),
      country: client.country,
    });

    const updatedConfig: any = {
      name: `${client.agentName || 'Receptionist'} — ${client.businessName}`,
      model: {
        provider: 'openai',
        model: env.VAPI_MODEL,
        temperature: 0.7,
        messages: [{ role: 'system', content: systemPrompt }],
      },
      // Keep the voice in sync when the client switches character.
      voice: buildVoice({
        voiceId: character.voiceId,
        stability: character.stability,
        similarityBoost: character.similarityBoost,
        style: character.style,
      }),
      firstMessage: this.generateFirstMessage(client, this.isFrenchClient(client)),
      ...buildRealtimePlans(this.isFrenchClient(client) ? 'fr' : 'en'),
      serverUrl: `${env.API_BASE_URL}/api/webhooks/vapi/client/${client.id}`,
    };

    // Update transfer destinations if transferNumber changed. E.164 or nothing:
    // Vapi rejects the whole assistant on a number typed as "06 12 34 56 78",
    // so one mistyped settings field used to take down every call for that
    // client, transfer or not.
    const forwarding = toE164(client.transferNumber, client.country);
    if (client.transferNumber && !forwarding) {
      logger.warn(`syncVapiAssistant: transferNumber "${client.transferNumber}" is not a valid number for ${client.country || 'FR'} — transfer disabled for client ${client.id}`);
    }
    if (forwarding) {
      updatedConfig.forwardingPhoneNumber = forwarding;
    }

    try {
      await vapiClient.updateAssistant(client.vapiAssistantId, updatedConfig);
      // The next call must not be greeted by the cached previous persona, nor
      // by pre-synthesised audio introducing the agent under the old name.
      await realtimeContextService.invalidateClient(client.id);
      await greetingAudioService.invalidate(client.id);
      void this.regenerateGreetings(client.id);
      logger.info(`VAPI assistant ${client.vapiAssistantId} synced for ${client.businessName}`);
    } catch (error) {
      logger.error(`Failed to update VAPI assistant ${client.vapiAssistantId}:`, error);
      throw error;
    }
  }

  /**
   * Rebuild the pre-synthesised greetings after a config change. Fire-and-
   * forget: a client whose greetings are not yet generated simply falls back to
   * live synthesis on the next call, which is what happens today anyway.
   */
  private async regenerateGreetings(clientId: string): Promise<void> {
    try {
      const profile = await realtimeContextService.getClientProfile(clientId);
      if (profile) await greetingAudioService.generate(profile);
    } catch (error) {
      logger.warn(`Greeting regeneration failed for ${clientId}:`, error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const onboardingService = new OnboardingService();
