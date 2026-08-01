import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { llmStreamService } from '../llm-stream.service';
import { callSessionStore } from '../call-session.store';

/** Collects everything written to the SSE channel. */
function makeStream() {
  const chunks: string[] = [];
  let ended = false;
  return {
    chunks,
    get ended() {
      return ended;
    },
    handle: {
      write: (c: string) => chunks.push(c),
      end: () => {
        ended = true;
      },
    },
    /** Concatenated `delta.content` across all emitted chunks. */
    text(): string {
      return chunks
        .filter(c => c.startsWith('data: ') && !c.includes('[DONE]'))
        .map(c => {
          try {
            return JSON.parse(c.slice(6)).choices?.[0]?.delta?.content ?? '';
          } catch {
            return '';
          }
        })
        .join('');
    },
  };
}

const userTurn = (content: string) => ({ role: 'user' as const, content });
const systemTurn = { role: 'system' as const, content: 'You are Camille.' };

describe('llmStreamService.plan — routing policy', () => {
  it('answers a backchannel locally, with no model call', () => {
    const plan = llmStreamService.plan({ messages: [systemTurn, userTurn('hello'), userTurn('ok')] }, 'en');
    expect(plan.mode).toBe('local');
  });

  it('sends a business turn to the full model', () => {
    const plan = llmStreamService.plan({ messages: [systemTurn, userTurn('I want to book a table')] }, 'en');
    expect(plan.mode).toBe('proxy');
    expect(plan.model).not.toMatch(/mini/);
  });

  it('always uses the model when a tool result is in flight', () => {
    // "ok" alone would deflect, but a tool result has to be turned into speech.
    const plan = llmStreamService.plan(
      { messages: [systemTurn, userTurn('ok'), { role: 'tool', content: 'FREE at 10:00' }] },
      'en'
    );
    expect(plan.mode).toBe('proxy');
    expect(plan.model).not.toMatch(/mini/);
  });

  it('routes an unrecognised conversational turn to the cheap model', () => {
    const plan = llmStreamService.plan({ messages: [systemTurn, userTurn('is it raining there')] }, 'en');
    expect(plan.mode).toBe('proxy');
    expect(plan.model).toMatch(/mini/);
  });

  it('reads the last user turn, not the first', () => {
    const plan = llmStreamService.plan(
      { messages: [systemTurn, userTurn('hello'), { role: 'assistant', content: 'hi' }, userTurn('cancel my booking')] },
      'en'
    );
    expect(plan.mode).toBe('proxy');
    expect(plan.model).not.toMatch(/mini/);
  });
});

describe('llmStreamService.handle — local turns', () => {
  beforeEach(() => callSessionStore.reset());

  it('emits a well-formed SSE completion without touching the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const stream = makeStream();

    await llmStreamService.handle('client_1', null, 'en', { messages: [systemTurn, userTurn('goodbye')] }, stream.handle);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(stream.text()).not.toBe('');
    expect(stream.chunks.at(-1)).toBe('data: [DONE]\n\n');
    expect(stream.ended).toBe(true);
    fetchSpy.mockRestore();
  });

  it('stays silent on a backchannel — a human receptionist says nothing to "mhm"', async () => {
    const stream = makeStream();
    await llmStreamService.handle(
      'client_1',
      null,
      'en',
      { messages: [systemTurn, userTurn('hello'), userTurn('mhm')] },
      stream.handle
    );
    expect(stream.text()).toBe('');
    expect(stream.chunks.at(-1)).toBe('data: [DONE]\n\n');
  });

  it('counts the deflection against the live call', async () => {
    callSessionStore.start({ vapiCallId: 'call_1', clientId: 'client_1', callerNumber: null, language: 'en' });
    const stream = makeStream();

    await llmStreamService.handle(
      'client_1',
      'call_1',
      'en',
      { messages: [systemTurn, userTurn('hello'), userTurn('ok')] },
      stream.handle
    );

    expect(callSessionStore.get('call_1')!.deflectedTurns).toBe(1);
  });

  it('deflects in French too', async () => {
    const stream = makeStream();
    await llmStreamService.handle(
      'client_1',
      null,
      'fr',
      { messages: [systemTurn, userTurn('bonjour'), userTurn('d\'accord')] },
      stream.handle
    );
    expect(stream.ended).toBe(true);
    expect(stream.chunks.at(-1)).toBe('data: [DONE]\n\n');
  });
});

describe('llmStreamService.handle — proxied turns', () => {
  afterEach(() => vi.restoreAllMocks());

  function mockOpenAiStream(payloads: string[]) {
    const encoder = new TextEncoder();
    let i = 0;
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () =>
            i < payloads.length ? { done: false, value: encoder.encode(payloads[i++]) } : { done: true, value: undefined },
          releaseLock: () => {},
        }),
      },
    } as unknown as Response);
  }

  it('relays the upstream deltas through untouched', async () => {
    mockOpenAiStream(['data: {"choices":[{"delta":{"content":"Bien"}}]}\n\n', 'data: [DONE]\n\n']);
    const stream = makeStream();

    await llmStreamService.handle(
      'client_1',
      null,
      'fr',
      { messages: [systemTurn, userTurn('je voudrais reserver')] },
      stream.handle
    );

    expect(stream.chunks.join('')).toContain('"content":"Bien"');
    expect(stream.ended).toBe(true);
  });

  it('speaks a natural fallback when OpenAI errors, never a technical message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500, body: null } as unknown as Response);
    const stream = makeStream();

    await llmStreamService.handle(
      'client_1',
      null,
      'fr',
      { messages: [systemTurn, userTurn('je voudrais reserver')] },
      stream.handle
    );

    const spoken = stream.text();
    expect(spoken).not.toBe('');
    expect(spoken.toLowerCase()).not.toMatch(/erreur|error|500|openai|technique/);
    expect(stream.ended).toBe(true);
  });

  it('falls back when the upstream stream closes without a token', async () => {
    mockOpenAiStream([]);
    const stream = makeStream();

    await llmStreamService.handle(
      'client_1',
      null,
      'en',
      { messages: [systemTurn, userTurn('I want to cancel')] },
      stream.handle
    );

    expect(stream.text()).toMatch(/catch that/i);
  });

  it('falls back when the request itself throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    const stream = makeStream();

    await llmStreamService.handle(
      'client_1',
      null,
      'en',
      { messages: [systemTurn, userTurn('book me in')] },
      stream.handle
    );

    expect(stream.text()).not.toBe('');
    expect(stream.ended).toBe(true);
  });
});
