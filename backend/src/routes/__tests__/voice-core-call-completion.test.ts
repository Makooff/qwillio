import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

/**
 * Tests COMPORTEMENTAUX du cycle de vie du statut d'appel voice-core.
 *
 * Bug reproduit : un appel raccroché restait « en cours » sur le tableau de
 * bord tant que l'analyse GPT-4 (lente, pouvant échouer) n'avait pas créé la
 * fiche finale — et la fiche « en cours » pouvait même rester indéfiniment
 * quand le traitement mourait avant d'effacer le placeholder. La fermeture du
 * statut doit être DÉTERMINISTE : posée dès l'acceptation de la remontée de
 * fin, indépendamment de l'analyse.
 */

const magasin = vi.hoisted(() => ({
  getPendingCaptureForRoom: vi.fn(),
  linkCaptureToCall: vi.fn(),
  persistRoomCapture: vi.fn(),
  persistCapture: vi.fn(),
}));
vi.mock('../../services/voice/lead-capture-store.service', () => magasin);

const handleClientCallCompleted = vi.hoisted(() => vi.fn());
const resumeClientCallCompletion = vi.hoisted(() => vi.fn(async () => ({ rescuedLead: null })));
const remember = vi.hoisted(() => vi.fn());
vi.mock('../../services/client-call.service', () => ({
  clientCallService: { handleClientCallCompleted: (...a: unknown[]) => handleClientCallCompleted(...a), resumeClientCallCompletion },
}));
vi.mock('../../services/voice/caller-memory.service', () => ({
  callerMemoryService: { get: vi.fn(), remember: (...a: unknown[]) => remember(...a) },
}));

const prismaMock = vi.hoisted(() => ({
  clientCall: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
  callerMemory: { findUnique: vi.fn() },
  clientBooking: { findFirst: vi.fn() },
  agentCrmActivity: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
vi.mock('../../config/database', () => ({ prisma: prismaMock }));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/voice/realtime-context.service', () => ({
  realtimeContextService: { getClientProfile: vi.fn() },
  shouldRecord: vi.fn(() => false),
}));
vi.mock('../../services/voice/twilio-recording.service', () => ({
  twilioRecordingService: { delAppel: vi.fn(), demarrerEnregistrement: vi.fn() },
}));
vi.mock('../../services/voice/tool-runtime.service', () => ({
  toolRuntimeService: { syncBookingToCalendar: vi.fn(), sendBookingSms: vi.fn() },
}));
vi.mock('../../services/voice/live-transcript.store', () => ({
  liveTranscripts: { ouvrir: vi.fn(), ajouter: vi.fn(), terminer: vi.fn() },
}));
vi.mock('../../config/knowledge-presets', () => ({ knowledgePreset: vi.fn(() => ({})) }));
vi.mock('../../services/voice/portal-knowledge.service', () => ({ entreesDepuisVapiConfig: vi.fn(() => []) }));
vi.mock('../../services/voice/voice-core-metadata', () => ({ persistCompletedVoiceMetadata: vi.fn() }));
vi.mock('../../services/voice/learning-runtime-scope', () => ({ signRuntimeScope: vi.fn(() => 'scope') }));
vi.mock('../../services/lead-identity', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../services/lead-identity')>();
  return { normalizeLeadPhone: mod.normalizeLeadPhone };
});
vi.mock('../../services/voice/worker-calendar.service', () => ({ workerCalendarService: { takenSlots: vi.fn() } }));

async function buildApp() {
  const { default: router } = await import('../voice-core.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/voice-core', router);
  return app;
}

/* ── la boîte durable en mémoire, comme dans voice-core-leads.test.ts ────── */
let lignes: Array<{ id: string; clientId: string; type: string; dealId: string | null;
  status: string; performedAt: Date | null; provider?: string; createdAt: Date; content: any }>;

function correspond(ligne: any, where: any): boolean {
  return Object.entries(where).every(([cle, valeur]: [string, any]) => {
    if (cle === 'OR') return valeur.some((v: any) => correspond(ligne, v));
    if (cle === 'AND') return valeur.every((v: any) => correspond(ligne, v));
    const reel = ligne[cle];
    if (valeur === null || typeof valeur !== 'object') return reel === valeur;
    if ('equals' in valeur) return JSON.stringify(reel) === JSON.stringify(valeur.equals);
    if ('in' in valeur && !valeur.in.includes(reel)) return false;
    if ('lte' in valeur && (reel == null || reel > valeur.lte)) return false;
    if ('not' in valeur) return reel !== valeur.not;
    return true;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VOICE_CORE_API_KEY = 'test-key';
  handleClientCallCompleted.mockResolvedValue({ rescuedLead: null });
  remember.mockResolvedValue(undefined);
  magasin.getPendingCaptureForRoom.mockResolvedValue(null);
  prismaMock.clientCall.findUnique.mockResolvedValue(null);
  prismaMock.clientCall.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.clientCall.updateMany.mockResolvedValue({ count: 1 });

  lignes = [];
  prismaMock.$queryRaw.mockResolvedValue([{ acquired: 1 }]);
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb({
    agentCrmActivity: prismaMock.agentCrmActivity,
    $queryRaw: prismaMock.$queryRaw,
  }));
  prismaMock.agentCrmActivity.findFirst.mockImplementation(async ({ where }: any) =>
    structuredClone(lignes.find((l) => correspond(l, where)) ?? null));
  prismaMock.agentCrmActivity.findMany.mockImplementation(async ({ where, take }: any) =>
    structuredClone(lignes.filter((l) => correspond(l, where)).slice(0, take ?? lignes.length)));
  prismaMock.agentCrmActivity.create.mockImplementation(async ({ data }: any) => {
    const ligne = { id: `job-${lignes.length + 1}`, performedAt: null, createdAt: new Date(),
      ...structuredClone(data) };
    lignes.push(ligne);
    return structuredClone(ligne);
  });
  prismaMock.agentCrmActivity.updateMany.mockImplementation(async ({ where, data }: any) => {
    const sel = lignes.filter((l) => correspond(l, where));
    sel.forEach((l) => Object.assign(l, structuredClone(data)));
    return { count: sel.length };
  });
});

afterEach(() => { delete process.env.VOICE_CORE_API_KEY; });

describe('POST /api/voice-core/calls — fermeture déterministe du statut', () => {
  it('une remontée retardée garde la fin réelle pour la fiche et le cutoff mémoire', async () => {
    const app = await buildApp();
    const res = await request(app).post('/api/voice-core/calls').set('x-api-key', 'test-key')
      .send({ room: 'room-original-time', clientId: 'c1', transcript: 'APPELANT: allo',
        startedAt: '2026-10-21T17:19:11.147+02:00', durationSeconds: 364 });
    expect(res.status).toBe(202);
    const endedAt = new Date('2026-10-21T15:25:15.147Z');
    expect(prismaMock.clientCall.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ endedAt }),
    }));
    await vi.waitFor(() => expect(handleClientCallCompleted).toHaveBeenCalled());
    expect(handleClientCallCompleted.mock.calls[0][7]).toMatchObject({ completedAt: endedAt });
    await vi.waitFor(() => expect(remember).toHaveBeenCalled());
    expect(remember).toHaveBeenCalledWith(expect.objectContaining({ occurredAt: endedAt }));
  });
  it('ferme la fiche « en cours » AVANT l\'analyse, puis laisse le service créer la fiche', async () => {
    prismaMock.clientCall.findUnique.mockResolvedValue({ id: 'call-1', clientId: 'c1', status: 'in-progress' });

    /* L'analyse est bloquée : la fermeture doit quand même être écrite. */
    let ouvrir!: (v: unknown) => void;
    const porte = new Promise((r) => { ouvrir = r; });
    handleClientCallCompleted.mockImplementationOnce(() => porte);

    const app = await buildApp();
    const res = await request(app).post('/api/voice-core/calls').set('x-api-key', 'test-key')
      .send({ room: 'room-close', clientId: 'c1', transcript: 'APPELANT: allo', durationSeconds: 42 });

    expect(res.status).toBe(202);
    /* La fermeture précède l'analyse : elle est écrite dans la requête même,
       AVANT le 202, avec transcript et durée — la fiche ne disparaît jamais.
       Elle est écrite deux fois (la route, puis le traitement idempotent) :
       jamais un statut rouvert. */
    await vi.waitFor(() => expect(prismaMock.clientCall.updateMany).toHaveBeenCalled());
    expect(prismaMock.clientCall.updateMany).toHaveBeenCalledWith({
      where: { vapiCallId: 'room-close', clientId: 'c1', status: 'in-progress' },
      data: { status: 'ended', endedAt: expect.any(Date), durationSeconds: 42,
        transcript: 'APPELANT: allo' },
    });
    for (const call of prismaMock.clientCall.updateMany.mock.calls) {
      expect(call[0].data.status).toBe('ended');
    }
    /* L'ordre des invocations prouve la fermeture avant l'analyse (le service
       reste de toute façon bloqué sur sa porte jusqu'à `ouvrir`). */
    await vi.waitFor(() => expect(handleClientCallCompleted).toHaveBeenCalledTimes(1));
    const ordreFermeture = prismaMock.clientCall.updateMany.mock.invocationCallOrder[0];
    const ordreService = handleClientCallCompleted.mock.invocationCallOrder[0];
    expect(ordreFermeture).toBeLessThan(ordreService);
    ouvrir(null);
    await vi.waitFor(() => expect(lignes[0].status).toBe('completed'));
    /* AUCUNE suppression : le placeholder (même id) est converti en place par
       le service — l'ancien delete-then-create est le bug corrigé. */
    expect(prismaMock.clientCall.deleteMany).not.toHaveBeenCalled();
    /* ... et rien ne re-passe jamais la fiche « en cours ». */
    for (const call of prismaMock.clientCall.updateMany.mock.calls) {
      expect(call[0].data.status).not.toBe('in-progress');
    }
  });

  it('un placeholder déjà « ended » (fermeture posée puis essai perdu) N\'EST PAS un appel traité', async () => {
    prismaMock.clientCall.findUnique.mockResolvedValue({ id: 'call-2', clientId: 'c1', status: 'ended' });

    const app = await buildApp();
    const res = await request(app).post('/api/voice-core/calls').set('x-api-key', 'test-key')
      .send({ room: 'room-ended', clientId: 'c1', transcript: 'APPELANT: allo', durationSeconds: 12 });

    expect(res.status).toBe(202);
    await vi.waitFor(() => expect(handleClientCallCompleted).toHaveBeenCalledTimes(1));
    /* L'analyse tourne quand même : ni la garde de la route ni celle du service
       ne doivent confondre `ended` avec « fiche finale créée ». */
    expect(resumeClientCallCompletion).not.toHaveBeenCalled();
    /* Et le placeholder n'est JAMAIS supprimé : il est converti en place. */
    expect(prismaMock.clientCall.deleteMany).not.toHaveBeenCalled();
  });

  it('échec du traitement après fermeture : rien ne reste « en cours », la reprise complète sans double analyse', async () => {
    prismaMock.clientCall.findUnique.mockResolvedValue({ id: 'call-3', clientId: 'c1', status: 'in-progress' });
    handleClientCallCompleted.mockRejectedValueOnce(new Error('analyse indisponible'));

    const app = await buildApp();
    const res = await request(app).post('/api/voice-core/calls').set('x-api-key', 'test-key')
      .send({ room: 'room-retry', clientId: 'c1', transcript: 'APPELANT: allo', durationSeconds: 12 });
    expect(res.status).toBe(202);

    await vi.waitFor(() => expect(lignes[0].status).toBe('retry'));
    /* Les deux fermetures (route puis traitement, idempotentes) ont eu lieu
       AVANT l'échec, et aucune ne rouvre le statut. */
    expect(prismaMock.clientCall.updateMany.mock.calls.length).toBeGreaterThanOrEqual(2);
    for (const call of prismaMock.clientCall.updateMany.mock.calls) {
      expect(call[0].data).toMatchObject({ status: 'ended' });
    }

    /* Le rejeu HTTP pendant un `retry` répond « pending » (contrat existant) ;
       c'est le battement de reprise qui reprend la ligne. On le déclenche
       comme au bootstrap, sur un module frais. */
    lignes[0].status = 'pending';
    lignes[0].performedAt = null;
    prismaMock.clientCall.findUnique.mockResolvedValue(null);
    const res2 = await request(app).post('/api/voice-core/calls').set('x-api-key', 'test-key')
      .send({ room: 'room-retry', clientId: 'c1', transcript: 'APPELANT: allo', durationSeconds: 12 });
    expect(res2.status).toBe(202);

    vi.resetModules();
    const routes = await import('../voice-core.routes');
    (routes as unknown as { assurerRepriseInbox: () => void }).assurerRepriseInbox();
    await vi.waitFor(() => expect(lignes[0].status).toBe('completed'));
    expect(handleClientCallCompleted).toHaveBeenCalledTimes(2);
    for (const call of prismaMock.clientCall.updateMany.mock.calls) {
      expect(call[0].data.status).not.toBe('in-progress');
    }
  });

  it('double remontée pendant le traitement : 202 pending, une seule analyse, statut jamais rouvert', async () => {
    prismaMock.clientCall.findUnique.mockResolvedValue({ id: 'call-4', clientId: 'c1', status: 'in-progress' });
    let ouvrir!: (v: unknown) => void;
    const porte = new Promise((r) => { ouvrir = r; });
    handleClientCallCompleted.mockImplementationOnce(() => porte);

    const app = await buildApp();
    const res1 = await request(app).post('/api/voice-core/calls').set('x-api-key', 'test-key')
      .send({ room: 'room-twice', clientId: 'c1', durationSeconds: 5 });
    expect(res1.status).toBe(202);

    /* Route + traitement : la fermeture durable (route) et la fermeture
       idempotente (traitement) précèdent toute analyse. */
    await vi.waitFor(() => expect(prismaMock.clientCall.updateMany).toHaveBeenCalledTimes(2));

    const res2 = await request(app).post('/api/voice-core/calls').set('x-api-key', 'test-key')
      .send({ room: 'room-twice', clientId: 'c1', durationSeconds: 5 });
    expect(res2.status).toBe(202);
    expect(res2.body).toMatchObject({ room: 'room-twice', pending: true });

    ouvrir(null);
    await vi.waitFor(() => expect(lignes[0].status).toBe('completed'));
    expect(handleClientCallCompleted).toHaveBeenCalledTimes(1);
    /* Route + traitement idempotent : deux fermetures, jamais de réouverture. */
    expect(prismaMock.clientCall.updateMany).toHaveBeenCalledTimes(2);
    for (const call of prismaMock.clientCall.updateMany.mock.calls) {
      expect(call[0].data.status).toBe('ended');
    }
  });

  it('une panne de lecture de capture n\'empêche pas la fermeture du statut', async () => {
    prismaMock.clientCall.findUnique.mockResolvedValue({ id: 'call-5', clientId: 'c1', status: 'in-progress' });
    magasin.getPendingCaptureForRoom.mockRejectedValueOnce(new Error('capture illisible'));

    const app = await buildApp();
    const res = await request(app).post('/api/voice-core/calls').set('x-api-key', 'test-key')
      .send({ room: 'room-capture-down', clientId: 'c1', durationSeconds: 5 });
    expect(res.status).toBe(202);

    await vi.waitFor(() => expect(lignes[0].status).toBe('retry'));
    /* Fermée avant la panne ; effacée jamais (l'essai a échoué avant). */
    expect(prismaMock.clientCall.updateMany).toHaveBeenCalledWith({
      where: { vapiCallId: 'room-capture-down', clientId: 'c1', status: 'in-progress' },
      data: { status: 'ended', endedAt: expect.any(Date) },
    });
    expect(handleClientCallCompleted).not.toHaveBeenCalled();
  });
});

describe('pas de résurrection de statut par les routes du direct', () => {
  it('un /calls/start tardif ne re-passe jamais une fiche terminée « en cours »', async () => {
    const fiches: Array<Record<string, unknown>> = [
      { id: 'call-9', clientId: 'c1', vapiCallId: 'room-done', status: 'completed' },
    ];
    prismaMock.clientCall.upsert.mockImplementation(async ({ where, create, update }: any) => {
      const trouvee = fiches.find((f) => f.vapiCallId === where.vapiCallId);
      if (trouvee) Object.assign(trouvee, structuredClone(update));
      else fiches.push({ ...structuredClone(create) });
      return structuredClone(fiches.find((f) => f.vapiCallId === where.vapiCallId));
    });

    const app = await buildApp();
    const res = await request(app).post('/api/voice-core/calls/start').set('x-api-key', 'test-key')
      .send({ clientId: 'c1', room: 'room-done', caller: '+324****0000' });

    expect(res.status).toBe(201);
    expect(prismaMock.clientCall.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { vapiCallId: 'room-done', clientId: 'c1' },
    }));
    expect(fiches[0].status).toBe('completed');
  });

  it('une ligne de transcript tardive ne touche jamais la fiche d\'appel', async () => {
    const app = await buildApp();
    const res = await request(app).post('/api/voice-core/calls/transcript').set('x-api-key', 'test-key')
      .send({ room: 'room-done', role: 'user', text: 'allo ?' });

    expect(res.status).toBe(204);
    expect(prismaMock.clientCall.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.clientCall.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.clientCall.upsert).not.toHaveBeenCalled();
  });
});
