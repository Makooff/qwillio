import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { googleCalendarService } from '../google-calendar.service';
import { realtimeContextService, type ClientVoiceProfile } from './realtime-context.service';
import { isKnownTool } from './voice-tools';
import { callSessionStore } from './call-session.store';
import { callerMemoryService } from './caller-memory.service';
import { businessMemoryService } from './business-memory.service';
import { availabilitySpeculator } from './availability-speculator';

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

    const booking = await prisma.clientBooking.create({
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

  private async syncBookingToCalendar(clientId: string, bookingId: string): Promise<void> {
    try {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { googleCalendarRefreshToken: true, googleCalendarId: true },
      });
      if (!client?.googleCalendarRefreshToken) return;
      const accessToken = await googleCalendarService.getAccessTokenFromRefresh(client.googleCalendarRefreshToken);
      await googleCalendarService.createEventFromBooking(bookingId, accessToken, client.googleCalendarId || 'primary');
    } catch (error) {
      // The booking exists either way; a failed sync is a reconciliation job,
      // not a caller-facing failure.
      logger.warn(`[VoiceTools] Calendar sync failed for booking ${bookingId}: ${(error as Error).message}`);
    }
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

    callSessionStore.recordLead(vapiCallId, lead);

    const phone = session?.callerNumber ?? null;

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
          contact: { name: lead.name, email: lead.email, phone },
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
    return businessMemoryService.formatForSpeech(hits, profile.language);
  }
}

export const toolRuntimeService = new ToolRuntimeService();
