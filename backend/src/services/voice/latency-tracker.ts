/**
 * Per-stage latency measurement (chantier 1).
 *
 * `medianTurnLatencyMs` told us a turn was slow. It never told us which stage
 * was slow, which makes every tuning decision downstream a guess. This module
 * splits one turn into the three stages that can actually be acted on:
 *
 *   STT  caller stops speaking      → final transcript emitted
 *   LLM  request enters our handler → first delta written back
 *   TTS  last delta written         → assistant audio starts
 *
 * The stages are measured from events we genuinely observe, not derived from
 * each other, so a missing event yields a missing stage rather than a wrong
 * number. `total` is measured independently end-to-end: it is deliberately NOT
 * the sum of the three, because the gaps between them (Vapi's own scheduling,
 * network) are exactly what we want to see when the parts do not add up.
 *
 * The LLM stage only exists on the custom-LLM path. On Vapi's own OpenAI path
 * we never see the request, so that stage stays empty — which is itself a
 * reason to keep custom-LLM on.
 */

export type LatencyStage = 'stt' | 'llm' | 'tts' | 'total';

export interface StageStats {
  count: number;
  median: number;
  p95: number;
  max: number;
}

export type LatencyReport = Partial<Record<LatencyStage, StageStats>>;

/** Open measurements for one call, keyed by stage. */
interface TurnMarks {
  callerSpeechEndedAt: number | null;
  transcriptFinalAt: number | null;
  llmStartedAt: number | null;
  llmFirstDeltaAt: number | null;
  lastDeltaAt: number | null;
}

/**
 * A single call's latency samples. One instance per live call, owned by the
 * call session — nothing here touches I/O or shared state.
 */
export class CallLatencyTracker {
  private samples: Record<LatencyStage, number[]> = { stt: [], llm: [], tts: [], total: [] };
  private marks: TurnMarks = {
    callerSpeechEndedAt: null,
    transcriptFinalAt: null,
    llmStartedAt: null,
    llmFirstDeltaAt: null,
    lastDeltaAt: null,
  };
  /** Metrics Vapi reports itself, kept alongside ours for cross-checking. */
  private vendorMetrics: Record<string, unknown> | null = null;

  /** `speech-update` role=user status=stopped. Opens a turn. */
  markCallerSpeechEnd(at = Date.now()): void {
    // A new turn starts here: drop any half-finished marks from a turn that
    // never produced audio (caller interrupted themselves, call dropped).
    this.marks = {
      callerSpeechEndedAt: at,
      transcriptFinalAt: null,
      llmStartedAt: null,
      llmFirstDeltaAt: null,
      lastDeltaAt: null,
    };
  }

  /** Final transcript for the caller's turn. Closes the STT stage. */
  markTranscriptFinal(at = Date.now()): void {
    if (this.marks.callerSpeechEndedAt === null) return;
    this.marks.transcriptFinalAt = at;
    this.push('stt', at - this.marks.callerSpeechEndedAt);
  }

  /** Request entered the custom-LLM handler. */
  markLlmStart(at = Date.now()): void {
    this.marks.llmStartedAt = at;
  }

  /** First token written back to Vapi. Closes the LLM stage. */
  markLlmFirstDelta(at = Date.now()): void {
    if (this.marks.llmStartedAt === null || this.marks.llmFirstDeltaAt !== null) return;
    this.marks.llmFirstDeltaAt = at;
    this.push('llm', at - this.marks.llmStartedAt);
  }

  /** Last token of the completion — the moment TTS has everything it needs. */
  markLlmEnd(at = Date.now()): void {
    this.marks.lastDeltaAt = at;
  }

  /**
   * `speech-update` role=assistant status=started. Closes TTS and the turn.
   *
   * TTS is measured from the last delta rather than the first, because that is
   * when the synthesiser stops being blocked on text. Measuring from the first
   * delta would fold the model's generation time into the TTS number and blame
   * the wrong stage.
   */
  markAssistantSpeechStart(at = Date.now()): void {
    if (this.marks.lastDeltaAt !== null) {
      this.push('tts', at - this.marks.lastDeltaAt);
    }
    if (this.marks.callerSpeechEndedAt !== null) {
      this.push('total', at - this.marks.callerSpeechEndedAt);
      this.marks.callerSpeechEndedAt = null;
    }
  }

  /** `performanceMetrics` from the end-of-call report, when Vapi sends them. */
  attachVendorMetrics(metrics: Record<string, unknown> | null | undefined): void {
    if (metrics && typeof metrics === 'object') this.vendorMetrics = metrics;
  }

  private push(stage: LatencyStage, ms: number): void {
    // A negative or absurd delta means the events arrived out of order, which
    // Vapi does occasionally. Recording it would poison the percentiles.
    if (ms < 0 || ms > 60_000) return;
    this.samples[stage].push(ms);
  }

  report(): LatencyReport {
    const out: LatencyReport = {};
    for (const stage of ['stt', 'llm', 'tts', 'total'] as LatencyStage[]) {
      const stats = summarise(this.samples[stage]);
      if (stats) out[stage] = stats;
    }
    return out;
  }

  /** Full payload for persistence, ours plus the vendor's. */
  snapshot(): Record<string, unknown> {
    const report = this.report();
    return this.vendorMetrics ? { ...report, vendor: this.vendorMetrics } : report;
  }

  /**
   * One line for the log. Reads at a glance which stage owns a slow call,
   * which is the entire point of splitting them.
   */
  summaryLine(): string {
    const r = this.report();
    const part = (name: string, s?: StageStats) => (s ? `${name} ${s.median}ms (p95 ${s.p95})` : `${name} n/a`);
    return [part('STT', r.stt), part('LLM', r.llm), part('TTS', r.tts), part('total', r.total)].join(' | ');
  }
}

function summarise(values: number[]): StageStats | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1],
  };
}

/**
 * Nearest-rank percentile on an already-sorted array. With the handful of turns
 * in one call, interpolating between neighbours would invent precision the
 * sample size does not support.
 */
function percentile(sorted: number[], q: number): number {
  const rank = Math.ceil(q * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}
