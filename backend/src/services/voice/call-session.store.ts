import { logger } from '../../config/logger';
import { CallLatencyTracker } from './latency-tracker';
import type { VoiceLanguage } from './speech-plans';
import type { CallerMood } from './caller-mood';

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
  language: VoiceLanguage;
  /** Row id once the call has been persisted, for tools that link to it. */
  clientCallId: string | null;
  /**
   * Le moteur RÉELLEMENT retenu pour cet appel, décidé par `buildSpeech`.
   *
   * C'est une donnée de facturation, pas un réglage: le temps réel se vend au
   * supplément, et une voix clonée force le classique même quand le client a
   * choisi le temps réel. Facturer le réglage surfacturerait donc tout client
   * ayant enregistré sa voix. `null` tant que l'assistant n'est pas construit.
   */
  speechToSpeech: boolean | null;
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
  /** Per-stage timings (STT / LLM / TTS), owned by the call. */
  latency: CallLatencyTracker;
  /** When the assistant started its current utterance, null when silent. */
  assistantSpeakingSince: number | null;
  /** Interruptions that cut a substantive utterance, not a backchannel. */
  hardBargeIns: number;
  /** Live read on how the caller sounds — drives register, never permissions. */
  mood: CallerMood;
  /** Token accounting, so the prompt cache is verified rather than assumed. */
  tokens: { input: number; cached: number; output: number };
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
/**
 * An assistant utterance shorter than this was a backchannel, not a sentence.
 * Cutting one off is not an interruption worth counting or apologising for.
 */
const MIN_UTTERANCE_FOR_HARD_BARGE_IN_MS = 900;

class CallSessionStore {
  private sessions = new Map<string, CallSession>();
  private holds: SlotHold[] = [];
  /** Pics de concurrence depuis le démarrage. Voir `concurrency()`. */
  private peakLive = 0;
  private peakPerClient = new Map<string, number>();
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
    language: VoiceLanguage;
  }): CallSession {
    const session: CallSession = {
      vapiCallId: input.vapiCallId,
      clientId: input.clientId,
      callerNumber: input.callerNumber,
      startedAt: Date.now(),
      language: input.language,
      clientCallId: null,
      speechToSpeech: null,
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
      latency: new CallLatencyTracker(),
      assistantSpeakingSince: null,
      hardBargeIns: 0,
      mood: 'neutral',
      tokens: { input: 0, cached: 0, output: 0 },
    };
    this.sessions.set(input.vapiCallId, session);
    this.notePeak(input.clientId);
    return session;
  }

  /**
   * Consigne le moteur retenu, une fois l'assistant construit.
   *
   * Séparé de `start()` parce que la session s'ouvre AVANT que le modèle et la
   * voix soient choisis: c'est `buildSpeech` qui tranche, quelques lignes plus
   * bas, et lui seul connaît l'effet de la voix clonée.
   */
  setSpeechToSpeech(vapiCallId: string | null, speechToSpeech: boolean): void {
    const session = this.get(vapiCallId);
    if (session) session.speechToSpeech = speechToSpeech;
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

  /** Stage marks. No-ops on an unknown call, so callers need no guard. */
  markLatency(
    vapiCallId: string | null,
    mark: 'callerSpeechEnd' | 'transcriptFinal' | 'llmStart' | 'llmFirstDelta' | 'llmEnd' | 'assistantSpeechStart',
  ): void {
    const session = this.get(vapiCallId);
    if (!session) return;
    switch (mark) {
      case 'callerSpeechEnd':
        return session.latency.markCallerSpeechEnd();
      case 'transcriptFinal':
        return session.latency.markTranscriptFinal();
      case 'llmStart':
        return session.latency.markLlmStart();
      case 'llmFirstDelta':
        return session.latency.markLlmFirstDelta();
      case 'llmEnd':
        return session.latency.markLlmEnd();
      case 'assistantSpeechStart':
        return session.latency.markAssistantSpeechStart();
    }
  }

  setMood(vapiCallId: string | null, mood: CallerMood): void {
    const session = this.get(vapiCallId);
    if (session) session.mood = mood;
  }

  recordTokens(vapiCallId: string | null, usage: { input: number; cached: number; output: number }): void {
    const session = this.get(vapiCallId);
    if (!session) return;
    session.tokens.input += usage.input;
    session.tokens.cached += usage.cached;
    session.tokens.output += usage.output;
  }

  recordDeflection(vapiCallId: string | null): void {
    const session = this.get(vapiCallId);
    if (session) session.deflectedTurns++;
  }

  assistantStartedSpeaking(vapiCallId: string | null, at = Date.now()): void {
    const session = this.get(vapiCallId);
    if (session) session.assistantSpeakingSince = at;
  }

  assistantStoppedSpeaking(vapiCallId: string | null): void {
    const session = this.get(vapiCallId);
    if (session) session.assistantSpeakingSince = null;
  }

  /**
   * Record an interruption and report whether it was a HARD one.
   *
   * Now that the assistant emits backchannels while the caller talks, a naive
   * counter would log a barge-in every time the caller keeps going after an
   * "mm-hmm" — which is not an interruption at all, it is the backchannel
   * working. Anything shorter than the floor is treated as such.
   *
   * The same distinction drives the recovery line: apologising for cutting the
   * caller off only makes sense when the assistant was genuinely mid-sentence.
   */
  recordBargeIn(vapiCallId: string | null, at = Date.now()): boolean {
    const session = this.get(vapiCallId);
    if (!session) return false;
    session.bargeIns++;

    const speakingFor = session.assistantSpeakingSince === null ? 0 : at - session.assistantSpeakingSince;
    const isHard = speakingFor >= MIN_UTTERANCE_FOR_HARD_BARGE_IN_MS;
    if (isHard) session.hardBargeIns++;
    session.assistantSpeakingSince = null;
    return isHard;
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

  /**
   * Combien d'appels sont EN CE MOMENT sur la ligne de ce client.
   *
   * Rien n'oblige un client à n'avoir qu'un appel à la fois: l'assistant est
   * reconstruit à chaque `assistant-request`, donc deux appelants simultanés
   * obtiennent deux assistants et deux sessions. Ce compteur ne LIMITE donc
   * rien, il MESURE.
   *
   * Il existe parce que la promesse vendue est « la ligne ne sonne jamais
   * occupé », et que cette promesse était jusqu'ici invérifiable: le seul vrai
   * plafond est la concurrence du compte Vapi, il est partagé par toute la
   * flotte, et le jour où il sera atteint c'est un appelant qui l'apprendra en
   * premier. Compter est ce qui permet d'alerter avant.
   */
  liveCountFor(clientId: string): number {
    let n = 0;
    for (const session of this.sessions.values()) {
      if (session.clientId === clientId) n++;
    }
    return n;
  }

  /**
   * Le pic observé depuis le démarrage, global et par client.
   *
   * Le compteur instantané ne sert à rien pour dimensionner: il vaut zéro la
   * plupart du temps, et personne ne regarde l'écran à l'instant précis où deux
   * appels se croisent. C'est le PIC qui dit s'il faut relever le plafond du
   * compte, et il ne coûte que deux entiers.
   *
   * Remis à zéro au redémarrage, volontairement: c'est une mesure
   * d'exploitation, pas une donnée. La persister demanderait une écriture sur
   * le chemin critique de l'appel, ce qui est exactement ce que ce magasin a
   * été créé pour éviter.
   */
  /** Relève les pics. Appelé à l'ouverture d'une session, jamais ailleurs. */
  private notePeak(clientId: string): void {
    const live = this.sessions.size;
    if (live > this.peakLive) this.peakLive = live;
    const forClient = this.liveCountFor(clientId);
    if (forClient > (this.peakPerClient.get(clientId) ?? 0)) {
      this.peakPerClient.set(clientId, forClient);
    }
  }

  /**
   * L'état de la concurrence SANS identifier personne.
   *
   * C'est la seule forme publiable: le point de santé `/api/webhooks/vapi/health`
   * vit sur le routeur des webhooks, qui n'a pas d'authentification, et y écrire
   * des identifiants de clients les publierait à qui interroge l'URL. Les
   * chiffres, eux, ne disent rien de personne et répondent à la seule question
   * posée là: est-ce que la flotte approche du plafond.
   */
  concurrencySummary(): { live: number; peakLive: number; busiestLive: number } {
    const full = this.concurrency();
    return {
      live: full.live,
      peakLive: full.peakLive,
      busiestLive: full.busiest?.live ?? 0,
    };
  }

  /**
   * L'état de la concurrence, client par client. **Réservé à l'administration.**
   *
   * `busiest` plutôt que la liste entière: un tableau de bord qui afficherait
   * une ligne par client vivant deviendrait illisible dès la dixième vente, et
   * la seule question posée ici est « qui est le plus proche du plafond ».
   */
  concurrency(): {
    live: number;
    peakLive: number;
    busiest: { clientId: string; live: number } | null;
    peakPerClient: Array<{ clientId: string; peak: number }>;
  } {
    const perClient = new Map<string, number>();
    for (const session of this.sessions.values()) {
      perClient.set(session.clientId, (perClient.get(session.clientId) ?? 0) + 1);
    }
    let busiest: { clientId: string; live: number } | null = null;
    for (const [clientId, live] of perClient) {
      if (!busiest || live > busiest.live) busiest = { clientId, live };
    }
    return {
      live: this.sessions.size,
      peakLive: this.peakLive,
      busiest,
      peakPerClient: [...this.peakPerClient]
        .map(([clientId, peak]) => ({ clientId, peak }))
        .sort((a, b) => b.peak - a.peak)
        .slice(0, 10),
    };
  }

  /** Test seam. */
  reset(): void {
    this.sessions.clear();
    this.holds = [];
    this.peakLive = 0;
    this.peakPerClient.clear();
  }
}

export const callSessionStore = new CallSessionStore();
