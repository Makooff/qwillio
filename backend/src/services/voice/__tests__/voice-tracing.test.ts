import { describe, it, expect, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import { AddressInfo } from 'net';
import { parseHeaders, voiceTracing } from '../voice-tracing';
import { CallLatencyTracker } from '../latency-tracker';

/**
 * TST-7 — un span par étage et par tour, EXPORTABLE.
 *
 * Le critère porte sur l'export, donc le test exporte pour de vrai: un
 * collecteur OTLP/HTTP local reçoit ce que le SDK envoie, et les assertions
 * portent sur la charge reçue, pas sur nos propres objets. Un test qui se
 * contenterait d'espionner `startSpan` prouverait que nous appelons une
 * bibliothèque, pas qu'un collecteur voit quelque chose — et c'est exactement
 * la différence qui fait qu'une instrumentation existe sans rien montrer.
 */

interface ReceivedSpan {
  name: string;
  spanId: string;
  parentSpanId?: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Array<{ key: string; value: Record<string, unknown> }>;
}

const collected: ReceivedSpan[] = [];
let collector: Server | null = null;

async function startCollector(): Promise<string> {
  collector = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c as Buffer));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        for (const rs of body.resourceSpans ?? []) {
          for (const ss of rs.scopeSpans ?? []) {
            for (const span of ss.spans ?? []) collected.push(span);
          }
        }
      } catch {
        /* une charge illisible fera simplement échouer les assertions */
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise<void>(resolve => collector!.listen(0, '127.0.0.1', resolve));
  const { port } = collector!.address() as AddressInfo;
  return `http://127.0.0.1:${port}/v1/traces`;
}

function attr(span: ReceivedSpan, key: string): unknown {
  const found = span.attributes.find(a => a.key === key);
  if (!found) return undefined;
  return Object.values(found.value)[0];
}

/** Un tour complet, joué sur le vrai tracker plutôt que fabriqué à la main. */
function playTurn(tracker: CallLatencyTracker, base: number) {
  tracker.markCallerSpeechEnd(base);
  tracker.markTranscriptFinal(base + 120);
  tracker.markLlmStart(base + 130);
  tracker.markLlmFirstDelta(base + 400);
  return tracker.markAssistantSpeechStart(base + 700);
}

describe('voice-tracing — export OTLP', () => {
  afterAll(async () => {
    await voiceTracing.shutdown();
    await new Promise<void>(resolve => collector?.close(() => resolve()));
  });

  it('exporte un span racine, un span par tour et un span par étage mesuré', async () => {
    const endpoint = await startCollector();
    await voiceTracing.init({ endpoint, serviceName: 'qwillio-test' });
    expect(voiceTracing.isEnabled()).toBe(true);

    const base = Date.now();
    voiceTracing.startCall({ vapiCallId: 'call-1', clientId: 'client-1', language: 'fr', at: base });

    const tracker = new CallLatencyTracker();
    const trace = playTurn(tracker, base);
    voiceTracing.recordTurn('call-1', trace, { model: 'gpt-4o-mini', tokens: { input: 800, cached: 600, output: 40 } });
    voiceTracing.recordTool('call-1', { name: 'checkAvailability', startedAt: base + 200, endedAt: base + 340, ok: true });
    voiceTracing.endCall('call-1', { at: base + 9000, endedReason: 'customer-ended-call' });

    await voiceTracing.flush();

    const names = collected.map(s => s.name);
    expect(names).toContain('qwillio.voice.call');
    expect(names).toContain('qwillio.voice.turn');
    expect(names).toContain('qwillio.voice.stt');
    expect(names).toContain('chat');
    expect(names).toContain('qwillio.voice.ttfa');
    expect(names).toContain('qwillio.voice.turn.total');
    expect(names).toContain('execute_tool checkAvailability');
  });

  it('rattache les étages au tour, et le tour à l\'appel', () => {
    const call = collected.find(s => s.name === 'qwillio.voice.call')!;
    const turn = collected.find(s => s.name === 'qwillio.voice.turn')!;
    const stt = collected.find(s => s.name === 'qwillio.voice.stt')!;
    expect(turn.parentSpanId).toBe(call.spanId);
    expect(stt.parentSpanId).toBe(turn.spanId);
  });

  it('date les spans sur les marques du tracker, pas sur l\'heure de création', () => {
    const stt = collected.find(s => s.name === 'qwillio.voice.stt')!;
    const durationMs = (Number(stt.endTimeUnixNano) - Number(stt.startTimeUnixNano)) / 1e6;
    /* Le span est créé bien après coup: si la durée est la bonne, c'est que
       les horodatages explicites ont été suivis. */
    expect(Math.round(durationMs)).toBe(120);
  });

  it('porte la convention GenAI sur l\'étage LLM, et le préfixe maison ailleurs', () => {
    const llm = collected.find(s => s.name === 'chat')!;
    expect(attr(llm, 'gen_ai.operation.name')).toBe('chat');
    expect(attr(llm, 'gen_ai.request.model')).toBe('gpt-4o-mini');
    expect(Number(attr(llm, 'gen_ai.usage.input_tokens'))).toBe(800);
    expect(Number(attr(llm, 'qwillio.voice.tokens.cached'))).toBe(600);

    const stt = collected.find(s => s.name === 'qwillio.voice.stt')!;
    expect(attr(stt, 'qwillio.voice.stage')).toBe('stt');
    /* Aucun attribut `gen_ai.*` hors de l'étage que la convention couvre: c'est
       ce qui rendra la bascule mécanique quand une convention voix sortira. */
    expect(stt.attributes.every(a => !a.key.startsWith('gen_ai.'))).toBe(true);
  });

  it('marque l\'outil sous la convention GenAI', () => {
    const tool = collected.find(s => s.name === 'execute_tool checkAvailability')!;
    expect(attr(tool, 'gen_ai.operation.name')).toBe('execute_tool');
    expect(attr(tool, 'gen_ai.tool.name')).toBe('checkAvailability');
  });

  it('ne verse AUCUN transcript ni numéro d\'appelant dans les attributs', () => {
    /* Une trace part chez un tiers. Le jour où quelqu'un ajoutera « juste le
       dernier énoncé, pour déboguer », ce test tombera. */
    const forbidden = ['transcript', 'utterance', 'text', 'content', 'message', 'caller_number', 'phone', 'prompt'];
    for (const span of collected) {
      for (const a of span.attributes) {
        for (const word of forbidden) {
          expect(a.key.toLowerCase()).not.toContain(word);
        }
      }
    }
  });

  it('numérote les tours et compte les tours sur le span racine', async () => {
    const base = Date.now();
    voiceTracing.startCall({ vapiCallId: 'call-2', clientId: 'client-1', language: 'nl', at: base });
    const tracker = new CallLatencyTracker();
    voiceTracing.recordTurn('call-2', playTurn(tracker, base));
    voiceTracing.recordTurn('call-2', playTurn(tracker, base + 2000));
    voiceTracing.endCall('call-2', { at: base + 5000 });
    await voiceTracing.flush();

    const turns = collected.filter(s => s.name === 'qwillio.voice.turn' && attr(s, 'qwillio.voice.call_id') === 'call-2');
    expect(turns.map(t => Number(attr(t, 'qwillio.voice.turn.index'))).sort()).toEqual([1, 2]);
    const call = collected.find(s => s.name === 'qwillio.voice.call' && attr(s, 'qwillio.voice.call_id') === 'call-2')!;
    expect(Number(attr(call, 'qwillio.voice.turns'))).toBe(2);
  });

  it('un `flush` ne ferme pas l\'exportateur, seul `shutdown` le fait', () => {
    /* Le test précédent a flushé deux fois et a quand même reçu ses spans:
       si `flush` fermait, ils seraient partis dans le vide. */
    expect(voiceTracing.isEnabled()).toBe(true);
  });

  it('ignore un tour sans mesure plutôt que d\'écrire un span vide', async () => {
    const before = collected.length;
    voiceTracing.recordTurn('call-2', null);
    await voiceTracing.flush();
    expect(collected.length).toBe(before);
  });
});

describe('parseHeaders', () => {
  it('lit la forme `a=b,c=d` de la spécification', () => {
    expect(parseHeaders('x-api-key=abc,x-tenant=qwillio')).toEqual({ 'x-api-key': 'abc', 'x-tenant': 'qwillio' });
  });

  it('garde les `=` de la valeur, un jeton base64 en contient', () => {
    expect(parseHeaders('authorization=Basic dXNlcjpwYQ==')).toEqual({ authorization: 'Basic dXNlcjpwYQ==' });
  });

  it('ne rend rien sur une entrée vide ou malformée', () => {
    expect(parseHeaders('')).toEqual({});
    expect(parseHeaders(undefined)).toEqual({});
    expect(parseHeaders('=orphelin,sansegal')).toEqual({});
  });
});
