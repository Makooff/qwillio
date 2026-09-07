import { describe, it, expect } from 'vitest';
import { CallLatencyTracker } from '../latency-tracker';

/** Drive one full turn with explicit timestamps, so the test is not timing-dependent. */
function playTurn(
  t: CallLatencyTracker,
  marks: { speechEnd: number; transcript?: number; llmStart?: number; firstDelta?: number; lastDelta?: number; audio?: number }
) {
  t.markCallerSpeechEnd(marks.speechEnd);
  if (marks.transcript !== undefined) t.markTranscriptFinal(marks.transcript);
  if (marks.llmStart !== undefined) t.markLlmStart(marks.llmStart);
  if (marks.firstDelta !== undefined) t.markLlmFirstDelta(marks.firstDelta);
  if (marks.lastDelta !== undefined) t.markLlmEnd(marks.lastDelta);
  if (marks.audio !== undefined) t.markAssistantSpeechStart(marks.audio);
}

describe('CallLatencyTracker — stage attribution', () => {
  it('splits one turn into STT, LLM and TTS', () => {
    const t = new CallLatencyTracker();
    playTurn(t, { speechEnd: 1000, transcript: 1150, llmStart: 1160, firstDelta: 1250, lastDelta: 1400, audio: 1475 });

    const r = t.report();
    expect(r.stt?.median).toBe(150);
    expect(r.llm?.median).toBe(90);
    expect(r.tts?.median).toBe(75);
  });

  it('measures total end-to-end, not as the sum of the stages', () => {
    const t = new CallLatencyTracker();
    // 100ms of unattributed gap between the stages — scheduling, network.
    playTurn(t, { speechEnd: 0, transcript: 100, llmStart: 200, firstDelta: 300, lastDelta: 400, audio: 500 });

    const r = t.report();
    expect(r.total?.median).toBe(500);
    // The parts do not add up to the whole, and that difference is the point.
    expect((r.stt!.median + r.llm!.median + r.tts!.median)).toBeLessThan(r.total!.median);
  });

  it('measures TTS from the last delta, so generation time is not blamed on it', () => {
    const t = new CallLatencyTracker();
    playTurn(t, { speechEnd: 0, transcript: 10, llmStart: 10, firstDelta: 50, lastDelta: 900, audio: 975 });
    // Measuring from the first delta would report 925ms of "TTS".
    expect(t.report().tts?.median).toBe(75);
  });
});

describe('CallLatencyTracker — clause streaming', () => {
  /**
   * The case the instrument used to erase. When streaming works, audio starts
   * before the completion ends, so there is no last delta yet to measure TTS
   * from — and the turn produced no number at all. The metric therefore
   * described only the turns where streaming had failed.
   */
  it('still measures a turn whose audio starts before the last token', () => {
    const t = new CallLatencyTracker();
    t.markCallerSpeechEnd(0);
    t.markTranscriptFinal(100);
    t.markLlmStart(100);
    t.markLlmFirstDelta(200);
    t.markAssistantSpeechStart(380); // first sound, generation still running
    t.markLlmEnd(900);               // completion finishes afterwards

    const r = t.report();
    expect(r.ttfa?.median).toBe(180);
    expect(r.total?.median).toBe(380);
    // TTS stays absent: there was no "text complete" moment to measure from.
    expect(r.tts).toBeUndefined();
  });

  it('counts the turns where the first sound beat the last token', () => {
    // LAT-5's acceptance criterion, stated as a count instead of an assertion.
    const t = new CallLatencyTracker();
    // Streamed: audio before markLlmEnd.
    t.markCallerSpeechEnd(0); t.markLlmStart(0); t.markLlmFirstDelta(50); t.markAssistantSpeechStart(200);
    // Buffered: the completion ended first.
    playTurn(t, { speechEnd: 1000, llmStart: 1000, firstDelta: 1050, lastDelta: 1400, audio: 1475 });

    expect(t.streamingSplit()).toEqual({ streamed: 1, buffered: 1 });
    expect(t.summaryLine()).toContain('clause-stream 1/2');
  });

  it('claims nothing about streaming on turns where it never saw the LLM', () => {
    /* Vapi's own OpenAI path: there is no last delta to miss, so calling the
       turn "streamed" would invent a result out of an absence. */
    const t = new CallLatencyTracker();
    playTurn(t, { speechEnd: 0, transcript: 120, audio: 400 });

    expect(t.streamingSplit()).toEqual({ streamed: 0, buffered: 0 });
    expect(t.snapshot().streaming).toBeUndefined();
    expect(t.summaryLine()).not.toContain('clause-stream');
  });

  it('measures TTFA even when the completion ended first', () => {
    // Both numbers exist on a buffered turn, and they measure different things.
    const t = new CallLatencyTracker();
    playTurn(t, { speechEnd: 0, transcript: 10, llmStart: 10, firstDelta: 50, lastDelta: 900, audio: 975 });

    expect(t.report().ttfa?.median).toBe(925);
    expect(t.report().tts?.median).toBe(75);
  });
});

describe('CallLatencyTracker — missing and out-of-order events', () => {
  it('reports a stage as absent rather than guessing it', () => {
    const t = new CallLatencyTracker();
    // No LLM marks at all: the Vapi-owned OpenAI path, where we never see the request.
    playTurn(t, { speechEnd: 0, transcript: 120, audio: 400 });

    const r = t.report();
    expect(r.stt).toBeDefined();
    expect(r.total).toBeDefined();
    expect(r.llm).toBeUndefined();
    expect(r.tts).toBeUndefined();
  });

  it('ignores a transcript that arrives with no open turn', () => {
    const t = new CallLatencyTracker();
    t.markTranscriptFinal(500);
    expect(t.report().stt).toBeUndefined();
  });

  it('drops a negative delta instead of poisoning the percentiles', () => {
    const t = new CallLatencyTracker();
    t.markCallerSpeechEnd(1000);
    t.markTranscriptFinal(900); // events out of order — Vapi does this occasionally
    expect(t.report().stt).toBeUndefined();
  });

  it('drops an absurdly large delta', () => {
    const t = new CallLatencyTracker();
    playTurn(t, { speechEnd: 0, transcript: 120_000 });
    expect(t.report().stt).toBeUndefined();
  });

  it('keeps only the first delta of a turn as the LLM close', () => {
    const t = new CallLatencyTracker();
    t.markCallerSpeechEnd(0);
    t.markLlmStart(0);
    t.markLlmFirstDelta(80);
    t.markLlmFirstDelta(300); // later deltas must not overwrite the measurement
    expect(t.report().llm?.median).toBe(80);
    expect(t.report().llm?.count).toBe(1);
  });

  it('abandons a turn that never produced audio when the next turn opens', () => {
    const t = new CallLatencyTracker();
    t.markCallerSpeechEnd(0);
    t.markTranscriptFinal(100);
    // Caller talks again before the assistant ever spoke.
    playTurn(t, { speechEnd: 1000, transcript: 1100, audio: 1400 });

    // Two STT samples, but only the completed turn yields a total.
    expect(t.report().stt?.count).toBe(2);
    expect(t.report().total?.count).toBe(1);
  });
});

describe('CallLatencyTracker — aggregation', () => {
  it('reports median, p95 and max across turns', () => {
    const t = new CallLatencyTracker();
    for (const stt of [100, 120, 140, 160, 900]) {
      t.markCallerSpeechEnd(0);
      t.markTranscriptFinal(stt);
    }
    const stats = t.report().stt!;
    expect(stats.count).toBe(5);
    expect(stats.median).toBe(140);
    expect(stats.max).toBe(900);
    // p95 on five samples is the worst one — no interpolation invented.
    expect(stats.p95).toBe(900);
  });

  it('keeps the vendor metrics alongside ours rather than replacing them', () => {
    const t = new CallLatencyTracker();
    playTurn(t, { speechEnd: 0, transcript: 100, audio: 300 });
    t.attachVendorMetrics({ modelLatencyAverage: 210 });

    const snap = t.snapshot();
    expect(snap.stt).toBeDefined();
    expect(snap.vendor).toEqual({ modelLatencyAverage: 210 });
  });

  it('ignores a vendor payload that is not an object', () => {
    const t = new CallLatencyTracker();
    t.attachVendorMetrics(null);
    expect(t.snapshot().vendor).toBeUndefined();
  });

  it('renders a one-line summary naming every stage', () => {
    const t = new CallLatencyTracker();
    playTurn(t, { speechEnd: 0, transcript: 150, llmStart: 150, firstDelta: 240, lastDelta: 300, audio: 375 });
    const line = t.summaryLine();
    expect(line).toContain('STT 150ms');
    expect(line).toContain('LLM 90ms');
    expect(line).toContain('TTS 75ms');
    expect(line).toContain('TTFA 135ms');
    expect(line).toContain('total 375ms');
  });

  it('says n/a for a stage it never observed, instead of zero', () => {
    // Zero would read as "instant"; n/a reads as "not measured", which is true.
    expect(new CallLatencyTracker().summaryLine()).toContain('STT n/a');
  });
});
