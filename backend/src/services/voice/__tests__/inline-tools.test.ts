import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { llmStreamService } from '../llm-stream.service';
import { callSessionStore } from '../call-session.store';
import { toolRuntimeService } from '../tool-runtime.service';
import { env } from '../../../config/env';

/**
 * EXÉCUTER L'OUTIL DANS NOTRE FLUX, SANS ALLER-RETOUR PAR VAPI (25/09/2026).
 *
 * Sur custom-LLM, le modèle qui demande l'outil c'est nous, et celui qui
 * l'exécute aussi: Vapi ne fait que porter l'aller-retour entre nos deux
 * moitiés. Mesuré sur un appel réel: 2014 ms par outil comptés en plus de
 * notre exécution, dont 1273 ms entre notre émission et l'arrivée de la
 * requête chez nous, pour 0 ms d'overhead de notre côté.
 *
 * Ce que ces cas tiennent, dans l'ordre d'importance: que le chemin ÉTEINT ne
 * change rien, que la phrase d'attente parte avant l'outil, et qu'on ne
 * s'enchaîne pas sur nous-mêmes.
 */

function makeStream() {
  const chunks: string[] = [];
  let ended = false;
  return {
    chunks,
    get ended() { return ended; },
    handle: { write: (c: string) => chunks.push(c), end: () => { ended = true; } },
    text(): string {
      return chunks
        .filter(c => c.startsWith('data: ') && !c.includes('[DONE]'))
        .map(c => { try { return JSON.parse(c.slice(6)).choices?.[0]?.delta?.content ?? ''; } catch { return ''; } })
        .join('');
    },
  };
}

/** Une réponse OpenAI par appel, dans l'ordre. */
function mockOpenAi(...turns: string[][]) {
  const encoder = new TextEncoder();
  let turn = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    const payloads = turns[Math.min(turn++, turns.length - 1)];
    let i = 0;
    return {
      ok: true, status: 200,
      body: {
        getReader: () => ({
          read: async () => (i < payloads.length ? { done: false, value: encoder.encode(payloads[i++]) } : { done: true, value: undefined }),
          releaseLock: () => {},
        }),
      },
    } as unknown as Response;
  });
}

const toolChunk = (name: string, args = '{}') =>
  `data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: 'assistant', content: null, tool_calls: [{ index: 0, id: 'call_x', type: 'function', function: { name, arguments: args } }] }, finish_reason: null }] })}\n\n`;
const textChunk = (content: string) =>
  `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`;
const DONE = 'data: [DONE]\n\n';

const systemTurn = { role: 'system' as const, content: 'Tu es Marc.' };
const userTurn = (content: string) => ({ role: 'user' as const, content });
const business = () => ({ messages: [systemTurn, userTurn('je voudrais un rendez-vous jeudi matin')] });

let execute: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  callSessionStore.reset();
  execute = vi.spyOn(toolRuntimeService, 'execute').mockResolvedValue({
    toolCallId: 'call_x',
    result: 'LIBRE le jeudi 24 septembre a 09:00.',
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  (env as Record<string, unknown>).VOICE_INLINE_TOOLS = false;
});

describe('éteint, le chemin ne change RIEN', () => {
  it('l\'appel d\'outil part chez Vapi, intact, et rien n\'est exécuté ici', async () => {
    /* C'est la garantie qui permet de livrer: tant que le drapeau est à faux,
       toute la flotte dédiée se comporte exactement comme avant. */
    (env as Record<string, unknown>).VOICE_INLINE_TOOLS = false;
    mockOpenAi([toolChunk('checkAvailability', '{"date":"2026-09-24"}'), DONE]);
    const stream = makeStream();

    await llmStreamService.handle('c1', null, 'fr', business(), stream.handle);

    expect(stream.chunks.join('')).toContain('"name":"checkAvailability"');
    expect(execute).not.toHaveBeenCalled();
    expect(stream.ended).toBe(true);
  });
});

describe('allumé, l\'outil tourne ici', () => {
  beforeEach(() => { (env as Record<string, unknown>).VOICE_INLINE_TOOLS = true; });

  it('exécute l\'outil et Vapi ne voit JAMAIS passer d\'appel d\'outil', async () => {
    mockOpenAi(
      [toolChunk('checkAvailability', '{"date":"2026-09-24"}'), DONE],
      [textChunk('Je vous propose jeudi a neuf heures.'), DONE],
    );
    const stream = makeStream();

    await llmStreamService.handle('c1', null, 'fr', business(), stream.handle);

    expect(execute).toHaveBeenCalledTimes(1);
    expect((execute.mock.calls[0] as unknown[])[2]).toMatchObject({
      name: 'checkAvailability',
      args: { date: '2026-09-24' },
    });
    /* L'aller-retour supprimé se lit ici: aucune tranche d'appel d'outil ne
       sort vers Vapi, donc Vapi n'a rien à nous redemander. */
    expect(stream.chunks.join('')).not.toContain('tool_calls');
    expect(stream.text()).toContain('jeudi a neuf heures');
  });

  it('la phrase d\'attente part AVANT que l\'outil ne tourne', async () => {
    /* Sans elle l'appelant entend un blanc de deux à quatre secondes: c'est
       Vapi qui la disait, au vu de l'appel d'outil qu'il ne voit plus passer.
       On aurait fabriqué le mode d'échec le plus cher en optimisant la
       latence. */
    let fillerAtExecution = '';
    const stream = makeStream();
    execute.mockImplementation(async () => {
      fillerAtExecution = stream.text();
      return { toolCallId: 'call_x', result: 'LIBRE.' };
    });
    mockOpenAi([toolChunk('checkAvailability'), DONE], [textChunk('Voila.'), DONE]);

    await llmStreamService.handle('c1', null, 'fr', business(), stream.handle);

    expect(fillerAtExecution.trim().length).toBeGreaterThan(0);
  });

  it('le résultat est rendu au modèle pour qu\'il le DISE', async () => {
    const fetchSpy = mockOpenAi([toolChunk('lookupBooking'), DONE], [textChunk('Vous avez rendez-vous jeudi.'), DONE]);
    execute.mockResolvedValue({ toolCallId: 'call_x', result: 'RESERVATION: jeudi 24 septembre.' });

    await llmStreamService.handle('c1', null, 'fr', business(), makeStream().handle);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const init = (fetchSpy.mock.calls[1] as unknown[])[1] as { body: string };
    const second = JSON.parse(init.body);
    const roles = (second.messages as Array<{ role: string }>).map(m => m.role);
    expect(roles).toContain('tool');
    expect(JSON.stringify(second.messages)).toContain('RESERVATION: jeudi 24 septembre.');
  });

  it('un outil qui agit sur l\'APPEL repart chez Vapi', async () => {
    /* `transferCall` et `endCall` ne sont pas dans `KNOWN_TOOLS`: les exécuter
       ici ne voudrait rien dire, ils agissent sur l'appel lui-même. */
    mockOpenAi([toolChunk('transferCall'), DONE]);
    const stream = makeStream();

    await llmStreamService.handle('c1', null, 'fr', business(), stream.handle);

    expect(execute).not.toHaveBeenCalled();
    expect(stream.chunks.join('')).toContain('"name":"transferCall"');
  });

  it('du texte déjà parti interdit de retenir la suite', async () => {
    /* Si une tranche de texte est sortie, l'appelant l'entend déjà: retenir la
       suite couperait sa phrase en deux. On rend la main à Vapi. */
    mockOpenAi([textChunk('Alors, '), toolChunk('checkAvailability'), DONE]);
    const stream = makeStream();

    await llmStreamService.handle('c1', null, 'fr', business(), stream.handle);

    expect(execute).not.toHaveBeenCalled();
    expect(stream.chunks.join('')).toContain('"name":"checkAvailability"');
  });

  it('PAS de récursion: un second appel d\'outil repart chez Vapi', async () => {
    /* Enchaîner ferait tenir la ligne pendant N tours de modèle sans qu'aucun
       son ne parte. Un seul étage, puis on redevient le chemin d'avant. */
    mockOpenAi([toolChunk('checkAvailability'), DONE], [toolChunk('bookAppointment'), DONE]);
    const stream = makeStream();

    await llmStreamService.handle('c1', null, 'fr', business(), stream.handle);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(stream.chunks.join('')).toContain('"name":"bookAppointment"');
  });
});
