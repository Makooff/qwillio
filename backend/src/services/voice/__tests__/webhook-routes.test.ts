import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

/**
 * Wiring test for the streaming webhook surface.
 *
 * The orchestrator and the end-of-call pipeline are stubbed: what is under test
 * is that each Vapi event type reaches the right handler, that the events the
 * caller is waiting on answer inline, and that the ones they are not waiting on
 * return before their work runs.
 */

const buildAssistantForCall = vi.fn();
const handleToolCalls = vi.fn();
const handleTranscript = vi.fn();
const handleSpeechUpdate = vi.fn();
const handleStatusUpdate = vi.fn();
const finalizeCall = vi.fn();
const persistMetrics = vi.fn();
const handleClientCallCompleted = vi.fn();

vi.mock('../../voice/realtime-orchestrator.service', () => ({
  realtimeOrchestratorService: {
    buildAssistantForCall: (...a: unknown[]) => buildAssistantForCall(...a),
    handleToolCalls: (...a: unknown[]) => handleToolCalls(...a),
    handleTranscript: (...a: unknown[]) => handleTranscript(...a),
    handleSpeechUpdate: (...a: unknown[]) => handleSpeechUpdate(...a),
    handleStatusUpdate: (...a: unknown[]) => handleStatusUpdate(...a),
    finalizeCall: (...a: unknown[]) => finalizeCall(...a),
    persistMetrics: (...a: unknown[]) => persistMetrics(...a),
  },
}));

vi.mock('../../client-call.service', () => ({
  clientCallService: {
    handleClientCallCompleted: (...a: unknown[]) => handleClientCallCompleted(...a),
    logTransfer: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../config/database', () => ({
  prisma: { webhookLog: { create: vi.fn().mockResolvedValue({}) } },
}));

/**
 * `env` is a snapshot taken at import time, so flipping process.env mid-test
 * would not reach the controller. Mocking it keeps the auth path testable
 * without re-importing the module graph (which would re-run env validation).
 */
const envState = vi.hoisted(() => ({
  NODE_ENV: 'development',
  VAPI_WEBHOOK_SECRET: '',
  REDIS_URL: '',
  VOICE_ENDPOINTING_MS: 150,
  VOICE_START_WAIT_SECONDS: 0.12,
  VOICE_BARGE_IN_BACKOFF_SECONDS: 1,
}));

vi.mock('../../../config/env', () => ({ env: envState }));

async function buildApp() {
  const { voiceWebhookController } = await import('../../../controllers/voice-webhook.controller');
  const app = express();
  app.use(express.json());
  app.post('/vapi/client/:clientId', (req, res) => voiceWebhookController.clientEvent(req, res));
  app.post('/vapi/tools/:clientId', (req, res) => voiceWebhookController.toolCall(req, res));
  app.get('/vapi/health', (req, res) => voiceWebhookController.health(req, res));
  return app;
}

const call = { id: 'call_1', customer: { number: '+33600000000' } };

/** Let the fire-and-forget continuations settle before asserting on them. */
const flush = () => new Promise(resolve => setImmediate(resolve));

describe('voice webhook routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.NODE_ENV = 'development';
    envState.VAPI_WEBHOOK_SECRET = '';
  });

  it('answers assistant-request inline with the built assistant', async () => {
    buildAssistantForCall.mockResolvedValue({ name: 'Receptionist - Le Comptoir' });
    const res = await request(await buildApp())
      .post('/vapi/client/client_1')
      .send({ message: { type: 'assistant-request', call } });

    expect(res.status).toBe(200);
    expect(res.body.assistant.name).toBe('Receptionist - Le Comptoir');
    expect(buildAssistantForCall).toHaveBeenCalledWith('client_1', expect.anything());
  });

  it('404s an assistant-request for an unknown client rather than serving a default agent', async () => {
    buildAssistantForCall.mockResolvedValue(null);
    const res = await request(await buildApp())
      .post('/vapi/client/ghost')
      .send({ message: { type: 'assistant-request', call } });
    expect(res.status).toBe(404);
  });

  it('returns tool results inline — the caller is waiting on these', async () => {
    handleToolCalls.mockResolvedValue([{ toolCallId: 't1', result: 'FREE at 14:00' }]);
    const res = await request(await buildApp())
      .post('/vapi/tools/client_1')
      .send({ message: { type: 'tool-calls', call, toolCalls: [] } });

    expect(res.status).toBe(200);
    expect(res.body.results[0].result).toBe('FREE at 14:00');
  });

  it('answers a failed tool call with 200 and no results, so the model keeps talking', async () => {
    handleToolCalls.mockRejectedValue(new Error('calendar down'));
    const res = await request(await buildApp())
      .post('/vapi/tools/client_1')
      .send({ message: { type: 'tool-calls', call } });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('acknowledges a transcript without touching the database', async () => {
    const { prisma } = await import('../../../config/database');
    const res = await request(await buildApp())
      .post('/vapi/client/client_1')
      .send({ message: { type: 'transcript', role: 'user', transcript: 'bonjour', call } });

    expect(res.status).toBe(200);
    expect(handleTranscript).toHaveBeenCalled();
    await flush();
    // Hot-path events are not even logged — that write was the old bottleneck.
    expect(prisma.webhookLog.create).not.toHaveBeenCalled();
  });

  it('routes speech-update to the barge-in counter', async () => {
    await request(await buildApp())
      .post('/vapi/client/client_1')
      .send({ message: { type: 'speech-update', role: 'user', status: 'started', call } });
    expect(handleSpeechUpdate).toHaveBeenCalled();
  });

  it('replies to status-update before doing the work', async () => {
    let resolveStatus: () => void = () => {};
    handleStatusUpdate.mockReturnValue(new Promise<void>(r => { resolveStatus = r; }));

    const res = await request(await buildApp())
      .post('/vapi/client/client_1')
      .send({ message: { type: 'status-update', status: 'in-progress', call } });

    // Responded while the handler is still pending — that is the whole point.
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    resolveStatus();
  });

  it('runs the end-of-call analysis after acknowledging', async () => {
    finalizeCall.mockResolvedValue({
      transcript: 'Caller: bonjour',
      durationSeconds: 42,
      callerNumber: '+33600000000',
      metrics: { callerTurns: 3 },
    });

    const res = await request(await buildApp())
      .post('/vapi/client/client_1')
      .send({ message: { type: 'end-of-call-report', call, transcript: 'Caller: bonjour' } });

    expect(res.status).toBe(200);
    await flush();
    await flush();
    expect(handleClientCallCompleted).toHaveBeenCalled();
  });

  it('skips transcript analysis for a voicemail — no GPT spend on an empty call', async () => {
    finalizeCall.mockResolvedValue({ transcript: '', durationSeconds: 6, callerNumber: null, metrics: null });

    await request(await buildApp())
      .post('/vapi/client/client_1')
      .send({ message: { type: 'end-of-call-report', call, endedReason: 'voicemail' } });

    await flush();
    await flush();
    expect(handleClientCallCompleted).not.toHaveBeenCalled();
  });

  it('fails closed in production when no webhook secret is configured', async () => {
    envState.NODE_ENV = 'production';
    const res = await request(await buildApp())
      .post('/vapi/client/client_1')
      .send({ message: { type: 'transcript', call } });
    expect(res.status).toBe(401);
  });

  it('rejects a wrong shared secret and accepts the right one', async () => {
    envState.VAPI_WEBHOOK_SECRET = 'super-secret-value';
    const app = await buildApp();

    const wrong = await request(app)
      .post('/vapi/client/client_1')
      .set('x-vapi-secret', 'wrong-secret-value')
      .send({ message: { type: 'transcript', call } });
    expect(wrong.status).toBe(401);

    const right = await request(app)
      .post('/vapi/client/client_1')
      .set('x-vapi-secret', 'super-secret-value')
      .send({ message: { type: 'transcript', call } });
    expect(right.status).toBe(200);
  });

  it('rejects a tool call with no secret in production', async () => {
    envState.NODE_ENV = 'production';
    const res = await request(await buildApp())
      .post('/vapi/tools/client_1')
      .send({ message: { type: 'tool-calls', call } });
    expect(res.status).toBe(401);
  });

  it('exposes the voice health probe', async () => {
    const res = await request(await buildApp()).get('/vapi/health');
    expect(res.status).toBe(200);
    expect(typeof res.body.liveCalls).toBe('number');
  });

  it('acknowledges an unknown event type instead of erroring', async () => {
    const res = await request(await buildApp())
      .post('/vapi/client/client_1')
      .send({ message: { type: 'something-new', call } });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
