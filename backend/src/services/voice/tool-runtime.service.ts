import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { googleCalendarService } from '../google-calendar.service';
import { realtimeContextService, type ClientVoiceProfile } from './realtime-context.service';
import { isKnownTool } from './voice-tools';
import { callSessionStore } from './call-session.store';
import { callerMemoryService } from './caller-memory.service';
import { businessMemoryService } from './business-memory.service';
import { knowledgeGapService } from './knowledge-gap.service';
import { availabilitySpeculator } from './availability-speculator';
import { parseSpokenPhone } from '../../utils/phone-spoken';
import { phoneWords } from '../../utils/text-for-speech';
import { normaliseAddress } from '../../utils/be-communes';

/**
 * Tool runtime (Phase 4).
 *
 * Executes the function calls the model emits mid-conversation and returns a
 * result the model can read aloud. Three rules govern everything here:
 *
 *  1. **Bounded.** Every external call is raced against a timeout shorter than
 *     Vapi's own tool timeout, so a hung Google API degrades into "let me take
 *     your details instead" rather than dead air.
 *  2. **Short results.** The result string is replayed into the model's context
 *     on every subsequent turn. A verbose JSON blob is paid for repeatedly, so
 *     results are trimmed to what the agent must actually say.
 *  3. **Never throws.** A rejected promise inside a call becomes a spoken
 *     apology, not a 500 on the webhook.
 */

export interface ToolCallInput {
  toolCallId: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolCallResult {
  toolCallId: string;
  result: string;
}

/** Hard ceiling on any single external call inside a tool. */
const EXTERNAL_TIMEOUT_MS = 2_500;
/** Slots we offer in one breath — more than three is unlistenable on a phone. */
const MAX_SPOKEN_SLOTS = 3;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/** Parse "2026-08-14" (or an ISO datetime) into a Date, rejecting nonsense. */
function parseDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? `${raw.trim()}T12:00:00Z` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Ce que l'agent doit FAIRE quand le numéro dicté ne tient pas debout.
 *
 * Formulé comme un geste et pas comme un diagnostic: « relis chiffre par
 * chiffre et redemande » se joue, « numéro invalide » se commente. La
 * relecture est aussi la seule chose qui lève une ambiguïté que la machine ne
 * voit pas (un mobile belge et un fixe français peuvent avoir la même suite).
 */
function retryPhone(lang: string, heard: string): string {
  /* Les chiffres ENTENDUS sont rendus à l'agent en toutes lettres, et c'est le
     cœur du geste: relire un numéro faux est précisément ce qui permet à
     l'appelant de repérer LEQUEL de ses chiffres a été mal compris. Lui
     demander de tout redicter à l'aveugle recommence la même erreur.
     En toutes lettres, parce qu'une suite de chiffres bruts envoyée au
     synthétiseur se prononce d'une façon qu'on ne contrôle pas (BEL-12). */
  const spelled = heard ? phoneWords(heard) : '';
  const readBack = {
    fr: spelled ? ` J'ai entendu: ${spelled}.` : '',
    en: spelled ? ` What I heard: ${spelled}.` : '',
    nl: spelled ? ` Wat ik hoorde: ${spelled}.` : '',
  };

  const base: Record<string, string> = {
    fr: 'NUMÉRO NON RECONNU. Le reste de la fiche est noté.' + readBack.fr
      + ' Relis-le à l\'appelant chiffre par chiffre, demande-lui de corriger, '
      + 'puis rappelle captureLead avec le numéro corrigé.',
    en: 'PHONE NOT RECOGNISED. The rest of the lead is saved.' + readBack.en
      + ' Read it back digit by digit, ask the caller to correct it, '
      + 'then call captureLead again with the corrected number.',
    nl: 'NUMMER NIET HERKEND. De rest van de fiche is genoteerd.' + readBack.nl
      + ' Lees het cijfer voor cijfer terug, vraag de beller om te corrigeren, '
      + 'en roep captureLead opnieuw aan met het juiste nummer.',
  };
  return base[lang] ?? base.en;
}

/**
 * Le repli clavier, au DEUXIÈME échec (BEL-4).
 *
 * Redemander une troisième dictée après deux échecs, c'est refaire ce qui
 * vient de rater deux fois: si le transcripteur n'entend pas ce numéro, il ne
 * l'entendra pas mieux au troisième essai — accent, ligne bruyante, chiffres
 * collés, la cause ne bouge pas. Les touches, elles, ne passent pas par la
 * reconnaissance vocale du tout: c'est le seul canal du téléphone qui ne se
 * trompe jamais, et c'est ce qui sauve l'appel au lieu de le faire abandonner.
 *
 * La phrase dit à l'appelant de terminer par dièse, et c'est utile aux deux
 * bouts: lui sait quand il a fini, et la saisie part sans attendre le délai.
 */
function keypadFallback(lang: string, heard: string): string {
  const spelled = heard ? phoneWords(heard) : '';
  const readBack = {
    fr: spelled ? ` J'ai entendu: ${spelled}.` : '',
    en: spelled ? ` What I heard: ${spelled}.` : '',
    nl: spelled ? ` Wat ik hoorde: ${spelled}.` : '',
  };
  const base: Record<string, string> = {
    fr: 'DEUXIÈME ÉCHEC SUR LE NUMÉRO. Le reste de la fiche est noté.' + readBack.fr
      + ' Ne le fais PAS redicter une troisième fois. Excuse-toi brièvement de la ligne, '
      + 'et demande-lui de composer son numéro sur le clavier du téléphone, puis dièse. '
      + 'Les chiffres tapés te reviendront comme un message: rappelle alors captureLead avec eux.',
    en: 'SECOND FAILURE ON THE PHONE NUMBER. The rest of the lead is saved.' + readBack.en
      + ' Do NOT ask them to say it a third time. Apologise briefly for the line, '
      + 'and ask them to key the number in on their phone keypad, then hash. '
      + 'The typed digits come back to you as a message: call captureLead again with them.',
    nl: 'TWEEDE MISLUKKING OP HET NUMMER. De rest van de fiche is genoteerd.' + readBack.nl
      + ' Vraag het GEEN derde keer. Verontschuldig je kort voor de lijn, '
      + 'en vraag om het nummer op het toetsenbord in te tikken, gevolgd door hekje. '
      + 'De ingetikte cijfers komen als bericht terug: roep captureLead dan opnieuw aan.',
  };
  return base[lang] ?? base.en;
}

/** "14:30" → 870 minutes. Returns null on anything that is not a 24h clock. */
function parseTimeToMinutes(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const PART_OF_DAY_WINDOWS: Record<string, [number, number]> = {
  morning: [0, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [17 * 60, 24 * 60],
  any: [0, 24 * 60],
};

class ToolRuntimeService {
  /**
   * Execute one tool call. `clientId` comes from the webhook path, never from
   * the model's arguments — a prompt-injected transcript must not be able to
   * make the agent read another tenant's calendar.
   */
  async execute(clientId: string, vapiCallId: string | null, call: ToolCallInput): Promise<ToolCallResult> {
    const started = Date.now();

    if (!isKnownTool(call.name)) {
      logger.warn(`[VoiceTools] Unknown tool requested: ${call.name}`);
      return { toolCallId: call.toolCallId, result: 'That action is not available on this line.' };
    }

    const profile = await realtimeContextService.getClientProfile(clientId);
    if (!profile) {
      return { toolCallId: call.toolCallId, result: 'I could not reach the booking system right now.' };
    }

    try {
      let result: string;
      switch (call.name) {
        case 'checkAvailability':
          result = await this.checkAvailability(profile, call.args);
          break;
        case 'bookAppointment':
          result = await this.bookAppointment(profile, vapiCallId, call.args);
          break;
        case 'lookupBooking':
          result = await this.lookupBooking(profile, vapiCallId, call.args);
          break;
        case 'captureLead':
          result = await this.captureLead(profile, vapiCallId, call.args);
          break;
        case 'lookupKnowledge':
          result = await this.lookupKnowledge(profile, call.args);
          break;
        default:
          result = 'That action is not available on this line.';
      }

      const elapsed = Date.now() - started;
      callSessionStore.recordToolCall(vapiCallId, call.name, elapsed);
      logger.info(`[VoiceTools] ${call.name} for ${profile.businessName} in ${elapsed}ms`);
      return { toolCallId: call.toolCallId, result };
    } catch (error) {
      const message = (error as Error).message;
      logger.error(`[VoiceTools] ${call.name} failed for client ${clientId}: ${message}`);
      callSessionStore.recordToolCall(vapiCallId, `${call.name}:error`, Date.now() - started);
      return {
        toolCallId: call.toolCallId,
        result: this.degradedMessage(profile, call.name),
      };
    }
  }

  /**
   * What the agent says when a tool fails. Always an actionable fallback — the
   * caller must never be told "an error occurred", they must be offered the
   * next best thing.
   */
  private degradedMessage(profile: ClientVoiceProfile, tool: string): string {
    const fr = profile.language === 'fr';
    if (tool === 'checkAvailability' || tool === 'bookAppointment') {
      return fr
        ? 'AGENDA INDISPONIBLE: dis au correspondant que tu ne peux pas confirmer le creneau maintenant, propose de noter ses coordonnees pour un rappel rapide, puis appelle captureLead.'
        : 'CALENDAR UNAVAILABLE: tell the caller you cannot confirm a slot right now, offer to take their details for a quick call back, then call captureLead.';
    }
    return fr
      ? 'ACTION ECHOUEE: continue la conversation normalement sans mentionner de probleme technique.'
      : 'ACTION FAILED: continue the conversation normally without mentioning a technical problem.';
  }

  // ── checkAvailability ───────────────────────────────────────────────────

  private async checkAvailability(profile: ClientVoiceProfile, args: Record<string, any>): Promise<string> {
    const date = parseDate(args.date);
    if (!date) {
      return profile.language === 'fr'
        ? 'DATE INVALIDE: demande au correspondant de preciser le jour souhaite.'
        : 'INVALID DATE: ask the caller which day they would like.';
    }

    // Single read path, shared with the speculator: a day already pre-loaded
    // from the transcript is served from cache and costs nothing here.
    const slots = await withTimeout(
      availabilitySpeculator.freeSlots(profile.clientId, date),
      EXTERNAL_TIMEOUT_MS,
      'freeBusy',
    );

    const [windowStart, windowEnd] = PART_OF_DAY_WINDOWS[String(args.partOfDay || 'any')] ?? PART_OF_DAY_WINDOWS.any;
    const filtered = slots.filter(slot => {
      const minutes = parseTimeToMinutes(slot);
      return minutes !== null && minutes >= windowStart && minutes < windowEnd;
    });

    // Also exclude slots already promised on another live call today: two
    // simultaneous callers must not both be offered 14:00.
    const held = callSessionStore.heldSlots(profile.clientId, date);
    const free = filtered.filter(slot => !held.includes(slot));

    if (free.length === 0) {
      const fallback = slots.filter(s => !held.includes(s)).slice(0, MAX_SPOKEN_SLOTS);
      if (fallback.length === 0) {
        return profile.language === 'fr'
          ? `AUCUN CRENEAU le ${args.date}. Propose un autre jour.`
          : `NO SLOTS on ${args.date}. Offer another day.`;
      }
      return profile.language === 'fr'
        ? `RIEN sur la plage demandee le ${args.date}, mais libre a: ${fallback.join(', ')}. Propose ces horaires.`
        : `NOTHING in the requested window on ${args.date}, but free at: ${fallback.join(', ')}. Offer these instead.`;
    }

    const spoken = free.slice(0, MAX_SPOKEN_SLOTS);
    return profile.language === 'fr'
      ? `LIBRE le ${args.date} a: ${spoken.join(', ')}. Propose au maximum ces horaires, un par un.`
      : `FREE on ${args.date} at: ${spoken.join(', ')}. Offer these times, one at a time.`;
  }

  // ── bookAppointment ─────────────────────────────────────────────────────

  private async bookAppointment(
    profile: ClientVoiceProfile,
    vapiCallId: string | null,
    args: Record<string, any>,
  ): Promise<string> {
    const date = parseDate(args.date);
    const minutes = parseTimeToMinutes(args.time);
    const customerName = typeof args.customerName === 'string' ? args.customerName.trim() : '';

    if (!date || minutes === null || !customerName) {
      return profile.language === 'fr'
        ? 'INFOS MANQUANTES: il faut le nom, la date et l\'heure exacte avant de reserver.'
        : 'MISSING INFO: you need the name, the date and the exact time before booking.';
    }

    const session = callSessionStore.get(vapiCallId);
    const clientCallId = session?.clientCallId ?? null;

    let booking;
    try {
      booking = await prisma.clientBooking.create({
        data: {
          clientId: profile.clientId,
          clientCallId,
          customerName,
          customerPhone: session?.callerNumber ?? null,
          customerEmail: typeof args.customerEmail === 'string' ? args.customerEmail : null,
          bookingDate: date,
          bookingTime: args.time,
          serviceType: typeof args.serviceType === 'string' ? args.serviceType : null,
          partySize: Number.isFinite(args.partySize) ? Number(args.partySize) : null,
          specialRequests: typeof args.specialRequests === 'string' ? args.specialRequests : null,
          status: 'confirmed',
          notes: 'Booked live during the call by the AI receptionist',
        },
      });
    } catch (error) {
      /* P2002 = l'index unique partiel a parlé: quelqu'un d'autre a pris ce
         créneau entre la vérification de disponibilité et cette écriture. Les
         « holds » en mémoire ne couvrent qu'un processus, donc ce cas est réel
         dès qu'il y a deux appels simultanés ou deux instances.
         L'agent doit proposer autre chose, pas annoncer une réservation qui
         n'existe pas. */
      if ((error as { code?: string }).code === 'P2002') {
        logger.info(`[VoiceTools] créneau déjà pris (${profile.clientId}, ${args.date} ${args.time})`);
        return profile.language === 'fr'
          ? "CRENEAU DEJA PRIS: quelqu'un vient de reserver cet horaire. Excuse-toi brievement et propose un autre creneau."
          : 'SLOT TAKEN: someone just booked that time. Apologise briefly and offer another slot.';
      }
      throw error;
    }

    callSessionStore.holdSlot(profile.clientId, date, String(args.time));
    callSessionStore.markBooked(vapiCallId, booking.id);

    // Calendar write is deliberately NOT awaited: the caller already has their
    // confirmation, and the booking row is the source of truth. A slow Google
    // API must not hold the line open.
    void this.syncBookingToCalendar(profile.clientId, booking.id);

    return profile.language === 'fr'
      ? `RESERVE: ${customerName}, le ${args.date} a ${args.time}. Confirme a voix haute et demande s'il faut autre chose.`
      : `BOOKED: ${customerName}, ${args.date} at ${args.time}. Confirm it out loud and ask if they need anything else.`;
  }

  /**
   * Écrit le rendez-vous au calendrier, et — c'est ce qui manquait — laisse une
   * trace de l'issue.
   *
   * L'échec n'est toujours pas remonté à l'appelant: sa réservation existe, la
   * ligne en base fait foi. Mais il n'est plus perdu non plus. Le compteur de
   * tentatives et l'horodatage de succès sont ce qui permet au job de
   * réconciliation (`bot-loop`) de reprendre les seules lignes qui le méritent.
   */
  async syncBookingToCalendar(clientId: string, bookingId: string): Promise<boolean> {
    try {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { googleCalendarRefreshToken: true, googleCalendarId: true },
      });
      if (!client?.googleCalendarRefreshToken) {
        /* Pas de calendrier lié: il n'y a rien à synchroniser, et ce n'est pas
           un échec. On marque la ligne comme réglée, sinon le job la
           reprendrait indéfiniment. */
        await this.markCalendarSynced(bookingId);
        return true;
      }
      const accessToken = await googleCalendarService.getAccessTokenFromRefresh(client.googleCalendarRefreshToken);
      await googleCalendarService.createEventFromBooking(bookingId, accessToken, client.googleCalendarId || 'primary');
      await this.markCalendarSynced(bookingId);
      return true;
    } catch (error) {
      logger.warn(`[VoiceTools] Calendar sync failed for booking ${bookingId}: ${(error as Error).message}`);
      await prisma.clientBooking
        .update({ where: { id: bookingId }, data: { calendarSyncAttempts: { increment: 1 } } })
        .catch(() => { /* la trace ne doit pas masquer l'erreur d'origine */ });
      return false;
    }
  }

  private async markCalendarSynced(bookingId: string): Promise<void> {
    await prisma.clientBooking
      .update({ where: { id: bookingId }, data: { calendarSyncedAt: new Date() } })
      .catch(() => { /* best-effort */ });
  }

  // ── lookupBooking ───────────────────────────────────────────────────────

  private async lookupBooking(
    profile: ClientVoiceProfile,
    vapiCallId: string | null,
    args: Record<string, any>,
  ): Promise<string> {
    const session = callSessionStore.get(vapiCallId);
    const name = typeof args.customerName === 'string' ? args.customerName.trim() : '';

    const booking = await prisma.clientBooking.findFirst({
      where: {
        clientId: profile.clientId,
        status: 'confirmed',
        bookingDate: { gte: new Date() },
        ...(session?.callerNumber
          ? { OR: [{ customerPhone: session.callerNumber }, ...(name ? [{ customerName: { contains: name, mode: 'insensitive' as const } }] : [])] }
          : name
            ? { customerName: { contains: name, mode: 'insensitive' as const } }
            : {}),
      },
      orderBy: { bookingDate: 'asc' },
      select: { customerName: true, bookingDate: true, bookingTime: true, serviceType: true },
    });

    if (!booking) {
      return profile.language === 'fr'
        ? 'AUCUNE RESERVATION trouvee pour ce correspondant. Demande sous quel nom elle a ete prise.'
        : 'NO BOOKING found for this caller. Ask which name it was booked under.';
    }

    const day = booking.bookingDate.toISOString().slice(0, 10);
    return profile.language === 'fr'
      ? `RESERVATION: ${booking.customerName}, le ${day}${booking.bookingTime ? ` a ${booking.bookingTime}` : ''}${booking.serviceType ? ` (${booking.serviceType})` : ''}.`
      : `BOOKING: ${booking.customerName}, ${day}${booking.bookingTime ? ` at ${booking.bookingTime}` : ''}${booking.serviceType ? ` (${booking.serviceType})` : ''}.`;
  }

  // ── captureLead ─────────────────────────────────────────────────────────

  /**
   * Record the caller and why they rang.
   *
   * This writes to durable storage during the call, not at the end of it, for
   * two reasons: a call that drops mid-sentence still leaves a followable lead,
   * and the sales follow-up can start the second the line clears rather than
   * waiting on the transcript-analysis pass.
   *
   * Three destinations, each with a distinct job:
   *  - `AgentCrmActivity` (status `pending`) — the durable record and the
   *    payload the external CRM sync drains.
   *  - `CallerMemory` — so a callback thirty seconds later already knows them.
   *  - the live session — so the end-of-call rollup can link the lead to the
   *    `ClientCall` row once it exists.
   */
  private async captureLead(
    profile: ClientVoiceProfile,
    vapiCallId: string | null,
    args: Record<string, any>,
  ): Promise<string> {
    const session = callSessionStore.get(vapiCallId);
    const lead = {
      name: typeof args.name === 'string' ? args.name.trim() || null : null,
      email: typeof args.email === 'string' ? args.email.trim() || null : null,
      reason: typeof args.reason === 'string' ? args.reason.trim() : '',
      urgency: ['low', 'normal', 'high'].includes(args.urgency) ? String(args.urgency) : 'normal',
    };

    /* L'adresse, avec sa commune ramenée à UNE forme (BEL-6).
       Ixelles et Elsene sont le même endroit et deux noms également
       officiels. Sans cette normalisation, deux appelants qui donnent la même
       adresse produisent deux lignes différentes dans le CRM, le client croit
       à deux clients, et il rappelle pour demander où il doit aller.
       La langue retenue est celle du CLIENT, pas de l'appelant: c'est lui qui
       relit la fiche. */
    const address = typeof args.address === 'string' && args.address.trim()
      ? normaliseAddress(args.address.trim(), profile.language)
      : null;

    callSessionStore.recordLead(vapiCallId, lead);

    /* Le numéro DICTÉ, validé avant d'être cru (BEL-3).
       Sur une séquence structurée, un transcripteur est juste une fois sur
       deux: enregistrer sans contrôle produit un rappel sur un chiffre faux,
       c'est-à-dire un lead perdu que personne ne voit jamais.
       Le pays de l'appelant vient de sa propre ligne quand elle est connue: il
       tranche l'ambiguïté réelle entre un mobile belge et un fixe français du
       Sud-Est, que le numéro seul ne permet pas de lever. */
    const dictated =
      typeof args.phone === 'string' && args.phone.trim()
        ? parseSpokenPhone(args.phone, { country: profile.country, callerNumber: session?.callerNumber ?? null })
        : null;

    if (dictated && !dictated.ok && dictated.reason === 'invalid') {
      /* Le LEAD est enregistré quand même, sans le numéro: refuser toute la
         fiche pour un chiffre douteux perdrait le nom, le motif et l'urgence
         que l'appelant vient de donner. Seul le numéro est écarté, et le
         modèle sait qu'il doit le redemander. */
      logger.info(
        `[VoiceTools] numéro dicté refusé pour ${profile.businessName}: ` +
          `${dictated.digits.length} chiffre(s) ne formant aucun numéro belge ni français`,
      );
    }

    /* Un numéro donné de vive voix l'emporte sur l'identifiant d'appelant: si
       l'appelant en dicte un autre, c'est là qu'il veut être rappelé. */
    const phone = (dictated?.ok ? dictated.e164 : null) ?? session?.callerNumber ?? null;

    // Durable first, and awaited: the whole point is that this survives the
    // call. It is one indexed insert, well inside the tool budget.
    const activity = await prisma.agentCrmActivity.create({
      data: {
        clientId: profile.clientId,
        type: 'lead_capture',
        status: 'pending',
        content: {
          source: 'ai_receptionist',
          vapiCallId,
          capturedAt: new Date().toISOString(),
          contact: { name: lead.name, email: lead.email, phone, address },
          reason: lead.reason,
          urgency: lead.urgency,
          language: profile.language,
          businessName: profile.businessName,
        },
      },
      select: { id: true },
    });
    callSessionStore.markLeadActivity(vapiCallId, activity.id);

    // Memory is an enhancement, so it must not be able to fail the tool.
    void callerMemoryService
      .remember({
        clientId: profile.clientId,
        callerNumber: phone,
        name: lead.name,
        email: lead.email,
        summary: lead.reason || null,
        outcome: 'lead',
      })
      .catch(err => logger.warn(`[VoiceTools] caller memory write failed: ${err.message}`));

    if (dictated && !dictated.ok && dictated.reason === 'invalid') {
      /* La consigne nomme le geste attendu, elle ne décrit pas l'erreur: un
         modèle à qui l'on dit « invalide » s'excuse, un modèle à qui l'on dit
         « relis chiffre par chiffre et redemande » le fait.
         Au deuxième échec, le geste change de nature: on quitte la voix. */
      const failures = callSessionStore.recordPhoneCaptureFailure(vapiCallId);
      return failures >= 2
        ? keypadFallback(profile.language, dictated.digits)
        : retryPhone(profile.language, dictated.digits);
    }

    return profile.language === 'fr' ? 'NOTE. Continue la conversation.' : 'NOTED. Continue the conversation.';
  }

  // ── lookupKnowledge ─────────────────────────────────────────────────────

  /**
   * Answer from the client's knowledge base. Only the highest-priority entries
   * live in the prompt; this reaches the rest without paying for them on every
   * model turn.
   */
  private async lookupKnowledge(profile: ClientVoiceProfile, args: Record<string, any>): Promise<string> {
    const query = typeof args.question === 'string' ? args.question : '';
    const hits = await businessMemoryService.search(profile.clientId, query);

    /* Une recherche vide est la seule occasion d'apprendre.
       L'agent promet déjà de « faire remonter la question » — c'est la phrase
       que `formatForSpeech` lui souffle. Elle n'était tenue nulle part: la
       question mourait ici, et l'appelant suivant reposait la même. Elle est
       maintenant consignée, dans SES mots, qui sont les seuls dont on dispose:
       ni le gérant ni nous n'aurions su l'écrire d'avance.
       Sans `await`: le correspondant attend cette réponse, et une écriture en
       base n'a rien à faire dans son tour de parole. */
    if (hits.length === 0 && query.trim()) {
      void knowledgeGapService.record({
        clientId: profile.clientId,
        question: query,
        language: profile.language,
        source: 'lookup',
      });
    }

    return businessMemoryService.formatForSpeech(hits, profile.language);
  }
}

export const toolRuntimeService = new ToolRuntimeService();
