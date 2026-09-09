import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { llmStreamService, parseUsageChunk } from '../llm-stream.service';
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

/**
 * LEG-3, deuxième moitié: la demande reconnue doit ABOUTIR.
 *
 * Le routeur peut bien classer « je voudrais parler à un conseiller », si le
 * tour repart chez le modèle le transfert redevient une décision de modèle,
 * c'est-à-dire ce que cette ligne existe pour supprimer.
 */
/**
 * REL-3: le silence est le mode d'échec le plus fréquent et le plus
 * dommageable d'un appel, et personne ne le surveille activement.
 *
 * Trois secondes sans un son s'entendent comme une ligne coupée. Le test bloque
 * donc le modèle pour de bon, et vérifie qu'une phrase part AVANT.
 */
describe('llmStreamService — un modèle qui ne répond pas', () => {
  it('parle avant trois secondes plutôt que de laisser le silence', async () => {
    vi.useFakeTimers();
    const started = Date.now();

    // Un modèle qui ne rendra jamais la main: seul l'abandon peut sauver le
    // tour, et c'est exactement ce qu'on veut voir arriver.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          (init as RequestInit)?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }) as Promise<Response>,
    );

    const stream = makeStream();
    const handling = llmStreamService.handle(
      'client_1',
      null,
      'fr',
      { messages: [systemTurn, userTurn('je voudrais un rendez-vous la semaine prochaine')] },
      stream.handle,
    );

    /* On avance JUSTE en dessous de la barre des trois secondes: si la phrase
       est déjà partie à ce moment-là, le critère est tenu, et l'assertion ne
       dépend d'aucune mesure de durée réelle. */
    await vi.advanceTimersByTimeAsync(2_900);
    await handling;

    expect(Date.now() - started).toBeLessThan(3_000);
    expect(stream.text()).toMatch(/répéter/i);
    expect(stream.ended).toBe(true);
    vi.useRealTimers();
  });

  it('répond en néerlandais à un appelant flamand', async () => {
    // Sans cette ligne, il s'entend répondre en anglais au moment précis où
    // quelque chose vient de mal se passer.
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    const stream = makeStream();
    await llmStreamService.handle(
      'client_1',
      null,
      'nl',
      { messages: [systemTurn, userTurn('ik wil graag een afspraak maken volgende week')] },
      stream.handle,
    );
    expect(stream.text()).toMatch(/herhalen/i);
  });
});

/**
 * TUR-8. `recoveryLine` était écrite et testée mais appelée de nulle part.
 * Ce bloc teste le bout de la chaîne: ce que le MODÈLE reçoit vraiment.
 */
describe('llmStreamService — reprendre après avoir été coupé', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    callSessionStore.reset();
  });

  function mockOpenAi() {
    const encoder = new TextEncoder();
    const payloads = ['data: {"choices":[{"delta":{"content":"Oui"}}]}\n\n', 'data: [DONE]\n\n'];
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

  /** Les messages réellement envoyés à OpenAI sur le dernier appel. */
  function sentMessages(spy: ReturnType<typeof mockOpenAi>): Array<{ role: string; content: string }> {
    const body = (spy.mock.calls.at(-1)?.[1] as { body: string }).body;
    return JSON.parse(body).messages;
  }

  async function turn(vapiCallId: string) {
    const stream = makeStream();
    await llmStreamService.handle(
      'client_1',
      vapiCallId,
      'fr',
      { messages: [systemTurn, userTurn('je voudrais reserver mardi')] },
      stream.handle,
    );
  }

  it('demande au modèle d\'ouvrir par une excuse, sans reprendre la phrase coupée', async () => {
    const spy = mockOpenAi();
    callSessionStore.start({ vapiCallId: 'c1', clientId: 'cl1', callerNumber: null, language: 'fr' });
    const now = Date.now();
    callSessionStore.assistantStartedSpeaking('c1', now - 3000);
    callSessionStore.recordBargeIn('c1', now);

    await turn('c1');

    const last = sentMessages(spy).at(-1)!;
    // En message système de QUEUE: le long préfixe doit rester identique d'un
    // tour à l'autre, sinon le cache de préfixe ne mord plus.
    expect(last.role).toBe('system');
    expect(last.content).toMatch(/coupé au milieu/i);
    expect(last.content).toMatch(/ne reprends pas la phrase interrompue/i);
  });

  it('n\'ajoute rien quand le tour précédent n\'a pas été cassé', async () => {
    const spy = mockOpenAi();
    callSessionStore.start({ vapiCallId: 'c2', clientId: 'cl1', callerNumber: null, language: 'fr' });

    await turn('c2');

    for (const m of sentMessages(spy)) expect(m.content).not.toMatch(/coupé au milieu/i);
  });

  it('ne s\'excuse qu\'une fois de la même coupure', async () => {
    const spy = mockOpenAi();
    callSessionStore.start({ vapiCallId: 'c3', clientId: 'cl1', callerNumber: null, language: 'fr' });
    const now = Date.now();
    callSessionStore.assistantStartedSpeaking('c3', now - 3000);
    callSessionStore.recordBargeIn('c3', now);

    await turn('c3');
    await turn('c3');

    for (const m of sentMessages(spy)) expect(m.content).not.toMatch(/coupé au milieu/i);
  });
});

describe('llmStreamService — transfert demandé explicitement', () => {
  const transferTool = { type: 'function', function: { name: 'transferCall' } };

  it("appelle l'outil de transfert au lieu du modèle", () => {
    const plan = llmStreamService.plan(
      { messages: [systemTurn, userTurn('je voudrais parler a un conseiller')], tools: [transferTool] },
      'fr',
    );
    expect(plan.mode).toBe('transfer');
    expect(plan.tool).toBe('transferCall');
  });

  it("émet un appel d'outil bien formé, sans texte parlé", async () => {
    const stream = makeStream();
    await llmStreamService.handle(
      'client_1',
      null,
      'fr',
      { messages: [systemTurn, userTurn('conseiller')], tools: [transferTool] },
      stream.handle,
    );

    const calls = stream.chunks
      .filter(c => c.startsWith('data: ') && !c.includes('[DONE]'))
      .flatMap(c => JSON.parse(c.slice(6)).choices?.[0]?.delta?.tool_calls ?? []);

    expect(calls).toHaveLength(1);
    expect(calls[0].function.name).toBe('transferCall');
    // Sans argument: la destination vient du plan de transfert de l'assistant.
    // En inventer une ici ferait composer un numéro absent de la fiche client.
    expect(calls[0].function.arguments).toBe('{}');
    // Le flux se termine sur `tool_calls`, sinon Vapi attend un texte qui ne
    // viendra jamais.
    expect(stream.chunks.some(c => c.includes('"finish_reason":"tool_calls"'))).toBe(true);
    expect(stream.text()).toBe('');
    expect(stream.ended).toBe(true);
  });

  /**
   * Un client sans numéro de transfert n'a pas cet outil: `voice-tools` le
   * retire, notamment quand le numéro boucle vers la réceptionniste. Appeler un
   * outil non déclaré laisserait l'appelant dans le silence juste après qu'il a
   * demandé un humain.
   */
  it('rend la main au modèle quand aucun outil de transfert n\'est déclaré', () => {
    const plan = llmStreamService.plan(
      { messages: [systemTurn, userTurn('je voudrais parler a un conseiller')], tools: [] },
      'fr',
    );
    expect(plan.mode).toBe('proxy');
    expect(plan.tool).toBeNull();
  });

  it("ne détourne pas un tour qui attend un résultat d'outil", () => {
    const plan = llmStreamService.plan(
      {
        messages: [systemTurn, userTurn('parler a quelqu un'), { role: 'tool', content: 'FREE 10:00' }],
        tools: [transferTool],
      },
      'fr',
    );
    expect(plan.mode).toBe('proxy');
  });
});

describe('parseUsageChunk — the prompt cache must be verified, not assumed', () => {
  it('returns null for an ordinary delta chunk', () => {
    expect(parseUsageChunk('data: {"choices":[{"delta":{"content":"Bien"}}]}\n\n')).toBeNull();
  });

  it('returns null for the terminator', () => {
    expect(parseUsageChunk('data: [DONE]\n\n')).toBeNull();
  });

  it('extracts prompt, cached and completion counts', () => {
    const chunk =
      'data: {"choices":[],"usage":{"prompt_tokens":1500,"completion_tokens":40,"prompt_tokens_details":{"cached_tokens":1408}}}\n\n';
    expect(parseUsageChunk(chunk)).toEqual({ input: 1500, cached: 1408, output: 40 });
  });

  it('reports zero cached rather than null when the cache missed', () => {
    // A miss is a real measurement; treating it as "no data" would hide it.
    const chunk = 'data: {"choices":[],"usage":{"prompt_tokens":1500,"completion_tokens":40}}\n\n';
    expect(parseUsageChunk(chunk)).toEqual({ input: 1500, cached: 0, output: 40 });
  });

  it('survives a malformed chunk instead of throwing mid-stream', () => {
    expect(parseUsageChunk('data: {"usage":{broken\n\n')).toBeNull();
  });
});
