import { logger } from '../../config/logger';

/**
 * In-process state for calls that are currently on the line (Phase 1.3).
 *
 * The old pipeline wrote to Postgres on every partial transcript event:
 *
 *     case 'transcript':
 *       await prisma.call.updateMany({ where: { vapiCallId }, data: { transcript } })
 *
 * At two to five transcript events per second per call, that is a database
 * round-trip inside the webhook's response path, on a Neon instance that may be
 * cold. It bought nothing — the full transcript arrives again in
 * `end-of-call-report` — and it was the single largest source of webhook
 * latency, which back-pressures the whole streaming channel.
 *
 * Live state now lives here and is flushed once, at the end of the call.
 * Losing this state on a process restart is acceptable: the end-of-call report
 * is authoritative and replays the entire transcript.
 */

export interface LeadCapture {
  name: string | null;
  email: string | null;
  reason: string;
  urgency: string;
}

export interface CallSession {
  vapiCallId: string;
  clientId: string;
  callerNumber: string | null;
  startedAt: number;
  language: 'fr' | 'en';
  /** Row id once the call has been persisted, for tools that link to it. */
  clientCallId: string | null;
  /** Rolling transcript, appended per final utterance. */
  transcript: string[];
  /** How many caller turns we have seen — drives first-turn intent rules. */
  callerTurns: number;
  /** Turns answered by the intent router without touching the LLM. */
  deflectedTurns: number;
  /** Times the caller cut the assistant off. High counts mean bad pacing. */
  bargeIns: number;
  toolCalls: Array<{ name: string; ms: number }>;
  lead: LeadCapture | null;
  /** AgentCrmActivity row created for the lead, linked to the call at the end. */
  leadActivityId: string | null;
  bookingId: string | null;
  /** ms between the caller's last word and the assistant's first audio. */
  turnLatencies: number[];
  lastCallerSpeechEndedAt: number | null;
}

/** A slot promised on a live call, so a parallel call cannot double-book it. */
interface SlotHold {
  clientId: string;
  day: string;
  time: string;
  expiresAt: number;
}

/** Calls never outlive VAPI_MAX_DURATION by much; sweep well past that. */
const SESSION_TTL_MS = 30 * 60 * 1000;
const SLOT_HOLD_TTL_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

class CallSessionStore {
  private sessions = new Map<string, CallSession>();
  private holds: SlotHold[] = [];
  private sweeper: NodeJS.Timeout | null = null;

  constructor() {
    this.startSweeper();
  }

  private startSweeper(): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    // Never hold the process open for a cache sweep.
    this.sweeper.unref?.();
  }

  /** Drop sessions and slot holds that outlived any plausible call. */
  private sweep(): void {
    const now = Date.now();
    let dropped = 0;
    for (const [id, session] of this.sessions) {
      if (now - session.startedAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
        dropped++;
      }
    }
    this.holds = this.holds.filter(h => h.expiresAt > now);
    if (dropped) logger.debug(`[CallSession] swept ${dropped} stale session(s)`);
  }

  start(input: {
    vapiCallId: string;
    clientId: string;
    callerNumber: string | null;
    language: 'fr' | 'en';
  }): CallSession {
    const session: CallSession = {
      vapiCallId: input.vapiCallId,
      clientId: input.clientId,
      callerNumber: input.callerNumber,
      startedAt: Date.now(),
      language: input.language,
      clientCallId: null,
      transcript: [],
      callerTurns: 0,
      deflectedTurns: 0,
      bargeIns: 0,
      toolCalls: [],
      lead: null,
      leadActivityId: null,
      bookingId: null,
      turnLatencies: [],
      lastCallerSpeechEndedAt: null,
    };
    this.sessions.set(input.vapiCallId, session);
    return session;
  }

  get(vapiCallId: string | null): CallSession | null {
    if (!vapiCallId) return null;
    return this.sessions.get(vapiCallId) ?? null;
  }

  /** Append one final utterance. No I/O — this runs on the hot path. */
  appendTranscript(vapiCallId: string | null, role: 'user' | 'assistant', text: string): void {
    const session = this.get(vapiCallId);
    if (!session || !text.trim()) return;
    session.transcript.push(`${role === 'user' ? 'Caller' : 'AI'}: ${text.trim()}`);
    if (role === 'user') {
      session.callerTurns++;
      session.lastCallerSpeechEndedAt = Date.now();
    } else if (session.lastCallerSpeechEndedAt) {
      session.turnLatencies.push(Date.now() - session.lastCallerSpeechEndedAt);
      session.lastCallerSpeechEndedAt = null;
    }
  }

  recordDeflection(vapiCallId: string | null): void {
    const session = this.get(vapiCallId);
    if (session) session.deflectedTurns++;
  }

  recordBargeIn(vapiCallId: string | null): void {
    const session = this.get(vapiCallId);
    if (session) session.bargeIns++;
  }

  recordToolCall(vapiCallId: string | null, name: string, ms: number): void {
    const session = this.get(vapiCallId);
    if (session) session.toolCalls.push({ name, ms });
  }

  recordLead(vapiCallId: string | null, lead: LeadCapture): void {
    const session = this.get(vapiCallId);
    if (session) session.lead = lead;
  }

  markLeadActivity(vapiCallId: string | null, activityId: string): void {
    const session = this.get(vapiCallId);
    if (session) session.leadActivityId = activityId;
  }

  markBooked(vapiCallId: string | null, bookingId: string): void {
    const session = this.get(vapiCallId);
    if (session) session.bookingId = bookingId;
  }

  attachClientCall(vapiCallId: string | null, clientCallId: string): void {
    const session = this.get(vapiCallId);
    if (session) session.clientCallId = clientCallId;
  }

  /** Full transcript as one string, for the end-of-call write. */
  transcriptText(vapiCallId: string | null): string {
    return this.get(vapiCallId)?.transcript.join('\n') ?? '';
  }

  /** Remove the session and hand back its final state for persistence. */
  end(vapiCallId: string): CallSession | null {
    const session = this.sessions.get(vapiCallId);
    if (session) this.sessions.delete(vapiCallId);
    return session ?? null;
  }

  // ── Slot holds ──────────────────────────────────────────────────────────

  /**
   * Reserve a slot for the duration of a call so two callers on the line at the
   * same time are not offered — and cannot both take — the same time. Expires
   * on its own; the booking row is what makes it permanent.
   */
  holdSlot(clientId: string, date: Date, time: string): void {
    this.holds.push({
      clientId,
      day: date.toISOString().slice(0, 10),
      time,
      expiresAt: Date.now() + SLOT_HOLD_TTL_MS,
    });
  }

  heldSlots(clientId: string, date: Date): string[] {
    const now = Date.now();
    const day = date.toISOString().slice(0, 10);
    return this.holds
      .filter(h => h.clientId === clientId && h.day === day && h.expiresAt > now)
      .map(h => h.time);
  }

  /** Observability: how many calls this process is currently handling. */
  liveCount(): number {
    return this.sessions.size;
  }

  /** Test seam. */
  reset(): void {
    this.sessions.clear();
    this.holds = [];
  }
}

export const callSessionStore = new CallSessionStore();
