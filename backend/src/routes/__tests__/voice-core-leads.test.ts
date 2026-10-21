import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

/**
 * Tests COMPORTEMENTAUX du pont voice-core pour la capture de lead durable.
 *
 * On monte le VRAI routeur express avec ses middlewares, en remplaçant
 * uniquement la frontière externe (Prisma, les services de
 * d'appel). `lead-capture-store` est mocké : son contrat (idempotence par
 * room, fusion, liaison à la fiche) est couvert par ses propres tests
 * unitaires — ici on vérifie que les routes L'UTILISENT et transmettent
 * les bons faits.
 */

const magasin = vi.hoisted(() => ({
  persistRoomCapture: vi.fn(),
  persistCapture: vi.fn(),
  getPendingCaptureForRoom: vi.fn(),
  linkCaptureToCall: vi.fn(),
}));

vi.mock('../../services/voice/lead-capture-store.service', () => magasin);

const handleClientCallCompleted = vi.hoisted(() => vi.fn());
const resumeClientCallCompletion = vi.hoisted(() => vi.fn(async () => ({ rescuedLead: null })));
const getClientProfile = vi.hoisted(() => vi.fn());
const remember = vi.hoisted(() => vi.fn());
vi.mock('../../services/client-call.service', () => ({
  clientCallService: { handleClientCallCompleted: (...a: unknown[]) => handleClientCallCompleted(...a), resumeClientCallCompletion },
}));

const prismaMock = vi.hoisted(() => ({
  clientCall: { findUnique: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
  callerMemory: { findUnique: vi.fn() },
  clientBooking: { findFirst: vi.fn() },
  /* Frontière de la boîte durable (voice-completion-inbox) : implémentée en
     mémoire dans le describe /calls. */
  agentCrmActivity: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
vi.mock('../../config/database', () => ({ prisma: prismaMock }));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/voice/realtime-context.service', () => ({
  realtimeContextService: { getClientProfile: (...a: unknown[]) => getClientProfile(...a) },
  shouldRecord: vi.fn(() => false),
}));
vi.mock('../../services/voice/twilio-recording.service', () => ({
  twilioRecordingService: { delAppel: vi.fn(), demarrerEnregistrement: vi.fn() },
}));
vi.mock('../../services/voice/tool-runtime.service', () => ({
  toolRuntimeService: { syncBookingToCalendar: vi.fn(), sendBookingSms: vi.fn() },
}));
vi.mock('../../services/voice/caller-memory.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/voice/caller-memory.service')>();
  return { callerMemoryService: {
    get: original.callerMemoryService.get.bind(original.callerMemoryService),
    remember: (...a: unknown[]) => remember(...a),
  } };
});
vi.mock('../../services/voice/live-transcript.store', () => ({
  liveTranscripts: { ouvrir: vi.fn(), ajouter: vi.fn(), terminer: vi.fn() },
}));
vi.mock('../../config/knowledge-presets', () => ({ knowledgePreset: vi.fn(() => ({})) }));
vi.mock('../../services/voice/portal-knowledge.service', () => ({
  entreesDepuisVapiConfig: vi.fn(() => []),
}));
vi.mock('../../services/voice/voice-core-metadata', () => ({
  persistCompletedVoiceMetadata: vi.fn(),
}));
vi.mock('../../services/voice/learning-runtime-scope', () => ({
  signRuntimeScope: vi.fn(() => 'scope'),
}));
/* Le vrai helper est testé ailleurs; ici on garde la normalisation E.164. */
vi.mock('../../services/lead-identity', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../services/lead-identity')>();
  return { normalizeLeadPhone: mod.normalizeLeadPhone };
});

const takenSlots = vi.hoisted(() => vi.fn());
vi.mock('../../services/voice/worker-calendar.service', () => ({ workerCalendarService: { takenSlots } }));

const PROFIL = {
  clientId: 'c1', businessName: 'Chez Marie', agentName: 'Marc',
  language: 'fr', country: 'BE',
};

async function buildApp() {
  const { default: router } = await import('../voice-core.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/voice-core', router);
  return app;
}

describe('HTTP calendar dates', () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.VOICE_CORE_API_KEY = 'test-key'; takenSlots.mockResolvedValue([]); });
  afterEach(() => { delete process.env.VOICE_CORE_API_KEY; });
  it.each(['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01'])('rejects impossible day %s before calendar normalization', async day => {
    const app = await buildApp();
    const res = await request(app).get('/api/voice-core/bookings/day').set('x-api-key', 'test-key').query({ clientId: 'c1', day });
    expect(res.status).toBe(400); expect(takenSlots).not.toHaveBeenCalled();
    const create = await request(app).post('/api/voice-core/bookings').set('x-api-key', 'test-key').send({ clientId: 'c1', day, slot: '10:00', name: 'Julie' });
    expect(create.status).toBe(400);
    const move = await request(app).patch('/api/voice-core/bookings/b1').set('x-api-key', 'test-key').send({ clientId: 'c1', day, slot: '10:00' });
    expect(move.status).toBe(400);
  });
  it('accepts a real leap day and delegates to the existing calendar', async () => {
    const res = await request(await buildApp()).get('/api/voice-core/bookings/day').set('x-api-key', 'test-key').query({ clientId: 'c1', day: '2028-02-29' });
    expect(res.status).toBe(200); expect(takenSlots).toHaveBeenCalledWith('c1', '2028-02-29');
  });
});

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('POST /api/voice-core/leads — capture durable idempotente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOICE_CORE_API_KEY = 'test-key';
    getClientProfile.mockResolvedValue(PROFIL);
    remember.mockResolvedValue(undefined);
    magasin.persistRoomCapture.mockResolvedValue({ id: 'act-1', updated: false });
    magasin.persistCapture.mockResolvedValue({ id: 'act-2', updated: false });
  });

  afterEach(() => {
    delete process.env.VOICE_CORE_API_KEY;
  });

  it('avec room: délègue au magasin sérialisé par (tenant, room)', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/api/voice-core/leads')
      .set('x-api-key', 'test-key')
      .send({
        clientId: 'c1', room: 'room-9', caller: '0475123456',
        name: 'Julie Mertens', reason: 'rappel', urgence: 'urgente',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('act-1');
    expect(res.body.updated).toBe(false);
    expect(magasin.persistRoomCapture).toHaveBeenCalledTimes(1);
    const args = magasin.persistRoomCapture.mock.calls[0][0];
    expect(args.clientId).toBe('c1');
    expect(args.room).toBe('room-9');
    const contenu = args.buildContent(null);
    expect(contenu.source).toBe('voice-core');
    expect(contenu.vapiCallId).toBe('room-9');
    expect(contenu.contact.name).toBe('Julie Mertens');
    expect(contenu.contact.phone).toBe('+32475123456');
    expect(contenu.urgency).toBe('high');
  });

  it('normalise le numéro au pays du tenant et borne les chaînes', async () => {
    const app = await buildApp();
    await request(app)
      .post('/api/voice-core/leads')
      .set('x-api-key', 'test-key')
      .send({
        clientId: 'c1', room: 'room-9', caller: '0475123456',
        name: 'Julie Mertens', email: 'JULIE@EXAMPLE.BE',
        reason: 'x'.repeat(900), adresse: 'a'.repeat(400),
      });
    const contenu = magasin.persistRoomCapture.mock.calls[0][0].buildContent(null);
    expect(contenu.contact.phone).toBe('+32475123456');
    expect(contenu.contact.email).toBe('julie@example.be');
    expect(contenu.reason).toHaveLength(500);
    expect(contenu.contact.address).toHaveLength(255);
  });

  it("écarte un nom de remplissage (l'agent) au lieu de le persister", async () => {
    const app = await buildApp();
    await request(app)
      .post('/api/voice-core/leads')
      .set('x-api-key', 'test-key')
      .send({ clientId: 'c1', room: 'room-9', name: 'Marc', reason: 'rappel' });
    const contenu = magasin.persistRoomCapture.mock.calls[0][0].buildContent(null);
    expect(contenu.contact.name).toBeNull();
  });

  it('sans room: crée une ligne par émission, sans jamais fusionner', async () => {
    const app = await buildApp();
    const envoi = () => request(app)
      .post('/api/voice-core/leads')
      .set('x-api-key', 'test-key')
      .send({ clientId: 'c1', caller: '0475123456', reason: 'rappel' });
    await envoi();
    await envoi();
    expect(magasin.persistRoomCapture).not.toHaveBeenCalled();
    expect(magasin.persistCapture).toHaveBeenCalledTimes(2);
  });

  it('garde la mémoire sur la ligne de transport et le rappel comme fait distinct', async () => {
    const app = await buildApp();
    const res = await request(app).post('/api/voice-core/leads')
      .set('x-api-key', 'test-key')
      .send({ clientId: 'c1', room: 'room-transport', caller: '+33612345678',
        telephone: '+33623456789', name: 'Julie Mertens', reason: 'devis toiture',
        quand: 'demain matin', pourQui: 'Lucie' });
    expect(res.status).toBe(201);
    await flush();
    expect(remember).toHaveBeenCalledWith(expect.objectContaining({
      callerNumber: '+33612345678', callbackNumber: '+33623456789',
      callId: 'room-transport', phase: 'capture', identitySource: 'capture',
      request: { text: 'devis toiture', callbackWhen: 'demain matin', forPerson: 'Lucie' },
    }));
    const contenu = magasin.persistRoomCapture.mock.calls[0][0].buildContent(null);
    expect(contenu.contact.phone).toBe('+33623456789');
    expect(contenu.callerNumber).toBe('+33612345678');
  });

  it('sans ligne de transport ne classe pas une identité sous un rappel dicté', async () => {
    const app = await buildApp();
    await request(app).post('/api/voice-core/leads').set('x-api-key', 'test-key')
      .send({ clientId: 'c1', telephone: '+33623456789', name: 'Julie Mertens', reason: 'devis' });
    await flush();
    expect(magasin.persistCapture).toHaveBeenCalledTimes(1);
    expect(remember).not.toHaveBeenCalled();
  });

  it('clientId manquant: 400, aucune écriture', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/api/voice-core/leads')
      .set('x-api-key', 'test-key')
      .send({ reason: 'rappel' });
    expect(res.status).toBe(400);
    expect(magasin.persistRoomCapture).not.toHaveBeenCalled();
    expect(magasin.persistCapture).not.toHaveBeenCalled();
  });
});

describe('GET /api/voice-core/caller — contexte mémoire servi au prochain appel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOICE_CORE_API_KEY = 'test-key';
    prismaMock.clientCall.count.mockResolvedValue(1);
    prismaMock.clientBooking.findFirst.mockResolvedValue(null);
  });
  afterEach(() => { delete process.env.VOICE_CORE_API_KEY; });

  it('sert la synthèse structurée et les champs legacy à la frontière HTTP réelle', async () => {
    prismaMock.callerMemory.findUnique.mockResolvedValue({
      knownName: 'Julie Mertens', email: 'julie@example.test', preferences: ['le matin'],
      profileSummary: 'Devis toiture demandé', lastSummary: 'Appel de suivi',
      totalCalls: 1, lastCallAt: new Date(), isBlocked: false, facts: null,
    });
    const app = await buildApp();
    const res = await request(app).get('/api/voice-core/caller')
      .set('x-api-key', 'test-key').query({ clientId: 'c1', caller: '+33612345678' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ appels: 1, nom: 'Julie Mertens',
      profil: 'Devis toiture demandé', preferences: ['le matin'], email: 'julie@example.test',
      demandes: [], telephone_rappel: null, bloque: false });
    expect(prismaMock.callerMemory.findUnique.mock.calls[0][0].where.clientId_callerNumber.clientId).toBe('c1');
    expect(prismaMock.callerMemory.findUnique.mock.calls[0][0].select.facts).toBe(true);
  });

  it('ne restitue aucune mémoire personnelle d’un correspondant ayant fait opposition', async () => {
    prismaMock.callerMemory.findUnique.mockResolvedValue({ knownName: 'Ancien nom',
      email: 'private@example.test', preferences: ['privé'], profileSummary: 'secret',
      lastSummary: 'secret', totalCalls: 9, isBlocked: true });
    prismaMock.clientBooking.findFirst.mockResolvedValue({ customerName: 'Ancien nom' });
    const app = await buildApp();
    const res = await request(app).get('/api/voice-core/caller')
      .set('x-api-key', 'test-key').query({ clientId: 'c1', caller: '+33612345678' });
    expect(res.body).toMatchObject({ appels: 0, nom: null, profil: null,
      dernier_motif: null, email: null, preferences: [], demandes: [], rdv: false, bloque: true });
    expect(JSON.stringify(res.body)).not.toContain('private@');
  });
});

describe('POST /api/voice-core/calls — completion durable avant 202, idempotence, reprise', () => {
  /* La VRAIE boîte durable, sa frontière base en mémoire : on vérifie le
     contrat HTTP (persisté avant 202, déduplication, reprise sans double
     analyse), pas un mock de l'inbox — le comportement de la boîte lui-même
     est couvert par voice-completion-inbox.test.ts. */
  let lignes: Array<{ id: string; clientId: string; type: string; dealId: string | null;
    status: string; performedAt: Date | null; createdAt: Date; content: any }>;

  function correspond(ligne: any, where: any): boolean {
    return Object.entries(where).every(([cle, valeur]: [string, any]) => {
      if (cle === 'OR') return valeur.some((v: any) => correspond(ligne, v));
      if (cle === 'AND') return valeur.every((v: any) => correspond(ligne, v));
      const reel = ligne[cle];
      if (valeur === null || typeof valeur !== 'object') return reel === valeur;
      if ('equals' in valeur) return JSON.stringify(reel) === JSON.stringify(valeur.equals);
      if ('in' in valeur && !valeur.in.includes(reel)) return false;
      if ('lte' in valeur && (reel == null || reel > valeur.lte)) return false;
      if ('gt' in valeur && (reel == null || reel <= valeur.gt)) return false;
      return true;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOICE_CORE_API_KEY = 'test-key';
    handleClientCallCompleted.mockResolvedValue({ rescuedLead: null });
    remember.mockResolvedValue(undefined);
    prismaMock.clientCall.findUnique.mockResolvedValue(null);
    prismaMock.clientCall.deleteMany.mockResolvedValue({ count: 1 });

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

  afterEach(() => {
    delete process.env.VOICE_CORE_API_KEY;
  });

  it('persiste la remontée dans la boîte AVANT le 202, puis traite hors réponse', async () => {
    magasin.getPendingCaptureForRoom.mockResolvedValue(null);
    /* On retient le handler juste après la persistance : la ligne durable
       doit exister DÈS la réponse, avec son payload, indépendamment du
       traitement qui suit. */
    let ouvrir!: (valeur: unknown) => void;
    const porte = new Promise((r) => { ouvrir = r; });
    prismaMock.clientCall.findUnique.mockImplementationOnce(() => porte.then(() => null));

    const app = await buildApp();
    const res = await request(app)
      .post('/api/voice-core/calls')
      .set('x-api-key', 'test-key')
      .send({ room: 'room-1', clientId: 'c1', transcript: 'APPELANT: allo', durationSeconds: 42 });

    /* LE CONTRAT : la ligne durable existe DÈS la réponse — le 202 dit
       « conservé », pas seulement « reçu ». */
    expect(res.status).toBe(202);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].content.payload).toMatchObject({ room: 'room-1', clientId: 'c1' });
    expect(lignes[0].type).toBe('voice_completion');

    ouvrir(null);
    await vi.waitFor(() => expect(handleClientCallCompleted).toHaveBeenCalledTimes(1));
    expect(lignes[0].status).toBe('completed');
    /* La pierre tombale ne porte plus le transcript (PII effacé). */
    expect(lignes[0].content.payload).toBeUndefined();
  });

  it('rejete une charge malformée sans rien écrire (400, pas de fiche, pas de file)', async () => {
    magasin.getPendingCaptureForRoom.mockResolvedValue(null);
    const app = await buildApp();
    const res = await request(app)
      .post('/api/voice-core/calls')
      .set('x-api-key', 'test-key')
      .send({ room: 'room-1', clientId: 'c1', durationSeconds: 'quarante-deux' });
    expect(res.status).toBe(400);
    expect(lignes).toHaveLength(0);
    expect(handleClientCallCompleted).not.toHaveBeenCalled();
  });

  it('passe liveLead (forme attendue) à handleClientCallCompleted puis relie la capture à la fiche', async () => {
    magasin.getPendingCaptureForRoom.mockResolvedValue({
      id: 'act-9',
      content: {
        source: 'voice-core', vapiCallId: 'room-1',
        contact: { name: 'Julie Mertens', email: 'jl@ex.be', phone: '+324****3456' },
        reason: 'rappel toiture', urgency: 'high',
        forPerson: 'sa mère', callbackWhen: 'demain 10h',
      },
    });
    prismaMock.clientCall.findUnique
      .mockResolvedValueOnce(null)                 // garde anti-doublon du handler
      .mockResolvedValueOnce({ id: 'call-42' });   // fiche pour la liaison

    const app = await buildApp();
    const res = await request(app)
      .post('/api/voice-core/calls')
      .set('x-api-key', 'test-key')
      .send({ room: 'room-1', clientId: 'c1', transcript: 'APPELANT: allo', durationSeconds: 42 });
    expect(res.status).toBe(202);

    await vi.waitFor(() => expect(handleClientCallCompleted).toHaveBeenCalledTimes(1));
    expect(handleClientCallCompleted.mock.calls[0][7]).toEqual({
      liveLead: {
        name: 'Julie Mertens',
        email: 'jl@ex.be',
        phone: '+324****3456',
        reason: 'rappel toiture',
        urgency: 'high',
        forPerson: 'sa mère',
        callbackWhen: 'demain 10h',
      },
    });
    expect(magasin.linkCaptureToCall).toHaveBeenCalledWith({ clientId: 'c1', activityId: 'act-9', clientCallId: 'call-42' });
  });

  it("sans capture durable: liveLead est undefined, pas de liaison — l'ancien chemin tient", async () => {
    magasin.getPendingCaptureForRoom.mockResolvedValue(null);
    const app = await buildApp();
    const res = await request(app)
      .post('/api/voice-core/calls')
      .set('x-api-key', 'test-key')
      .send({ room: 'room-2', clientId: 'c1', transcript: '', durationSeconds: 5 });
    expect(res.status).toBe(202);

    await vi.waitFor(() => expect(handleClientCallCompleted).toHaveBeenCalledTimes(1));
    expect(handleClientCallCompleted.mock.calls[0][7]).toEqual({ liveLead: undefined });
    expect(magasin.linkCaptureToCall).not.toHaveBeenCalled();
  });

  it('passe identité de l’appel terminé et clé de déduplication à la mémoire', async () => {
    magasin.getPendingCaptureForRoom.mockResolvedValue(null);
    const app = await buildApp();
    await request(app).post('/api/voice-core/calls').set('x-api-key', 'test-key')
      .send({ room: 'room-memory-completion', clientId: 'c1', caller: '+336****5678', durationSeconds: 30 });
    await vi.waitFor(() => expect(remember).toHaveBeenCalledWith(expect.objectContaining({
      callerNumber: '+336****5678', callId: 'room-memory-completion',
      phase: 'completed', identitySource: 'analysis',
    })));
  });

  it('ne renouvelle pas un nom recopié de mémoire dans la completion worker', async () => {
    magasin.getPendingCaptureForRoom.mockResolvedValue(null);
    prismaMock.clientCall.findUnique.mockImplementation(async ({ select }) =>
      select?.summary ? { nameCollected: 'Ancien nom', metadata: { callerIdentityInherited: true } } : null);
    await request(await buildApp()).post('/api/voice-core/calls').set('x-api-key', 'test-key')
      .send({ room: 'inherited-memory', clientId: 'c1', caller: '+33612345678', durationSeconds: 30 });
    await vi.waitFor(() => expect(remember).toHaveBeenCalledWith(expect.objectContaining({
      callId: 'inherited-memory', name: null,
    })));
  });

  it('double remontée de la même room: la seconde répond 200 already, le service ne tourne qu’une fois', async () => {
    magasin.getPendingCaptureForRoom.mockResolvedValue(null);
    const app = await buildApp();
    const res1 = await request(app)
      .post('/api/voice-core/calls')
      .set('x-api-key', 'test-key')
      .send({ room: 'room-3', clientId: 'c1', durationSeconds: 1 });
    expect(res1.status).toBe(202);
    await vi.waitFor(() => expect(handleClientCallCompleted).toHaveBeenCalledTimes(1));

    const res2 = await request(app)
      .post('/api/voice-core/calls')
      .set('x-api-key', 'test-key')
      .send({ room: 'room-3', clientId: 'c1', durationSeconds: 1 });
    expect(res2.status).toBe(200);
    expect(res2.body.already).toBe(true);
    /* IDEMPOTENCE SANS DOUBLE SIDE-EFFECTS : une seule analyse, une seule
       fiche — la pierre tombale de la boîte tient la garde. */
    expect(handleClientCallCompleted).toHaveBeenCalledTimes(1);
    expect(lignes).toHaveLength(1);
  });

  it('rejeu dead_letter répond échec explicite et non pending', async () => {
    const { voiceCompletionInbox } = await import('../../services/voice/voice-completion-inbox.service');
    await voiceCompletionInbox.enqueue({ room: 'dead', clientId: 'c1' });
    lignes[0].status = 'dead_letter'; lignes[0].content = { attempts: 5 };
    const res = await request(await buildApp()).post('/api/voice-core/calls')
      .set('x-api-key', 'test-key').send({ room: 'dead', clientId: 'c1' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'completion_dead_letter', room: 'dead' });
    expect(res.body.pending).toBeUndefined();
  });

  it.each(['inbox', 'call'])('rejeu absorbe une panne de lecture %s avant réponse', async boundary => {
    const { voiceCompletionInbox } = await import('../../services/voice/voice-completion-inbox.service');
    await voiceCompletionInbox.enqueue({ room: 'read-down', clientId: 'c1' });
    lignes[0].status = 'completed';
    if (boundary === 'inbox') {
      const read = prismaMock.agentCrmActivity.findFirst.getMockImplementation()!;
      prismaMock.agentCrmActivity.findFirst.mockImplementationOnce(read).mockRejectedValueOnce(new Error('DB unavailable'));
    } else prismaMock.clientCall.findUnique.mockRejectedValueOnce(new Error('DB unavailable'));
    const res = await request(await buildApp()).post('/api/voice-core/calls')
      .set('x-api-key', 'test-key').send({ room: 'read-down', clientId: 'c1' }).timeout(1500);
    expect(res.status).toBe(500); expect(res.body.error).toBe('record_failed');
  });

  it('reprend une ligne durable au bootstrap sans nouvelle requête completion, une seule fois', async () => {
    vi.resetModules();
    magasin.getPendingCaptureForRoom.mockResolvedValue(null);
    const { voiceCompletionInbox } = await import('../../services/voice/voice-completion-inbox.service');
    await voiceCompletionInbox.enqueue({ room: 'orphan-at-boot', clientId: 'c1', durationSeconds: 12 });
    const start = vi.spyOn(voiceCompletionInbox, 'start');
    const routes = await import('../voice-core.routes');
    const boot = (routes as unknown as { assurerRepriseInbox?: () => void }).assurerRepriseInbox;
    expect(boot).toBeTypeOf('function');
    boot!(); boot!();
    await vi.waitFor(() => expect(lignes[0].status).toBe('completed'));
    expect(handleClientCallCompleted).toHaveBeenCalledTimes(1);
    expect(handleClientCallCompleted.mock.calls[0].slice(0, 2)).toEqual(['c1', 'orphan-at-boot']);
    expect(start).toHaveBeenCalledTimes(1);
    start.mockRestore();
  });

  it('reprise sans double analyse : fiche déjà créée, les étapes idempotentes tournent quand même', async () => {
    /* Un essai précédent a créé la fiche puis échoué plus loin. La reprise
       de la boîte NE rappelle PAS handleClientCallCompleted (un create — il
       referait toute l'analyse et créerait une seconde fiche), mais relie
       encore la capture et écrit la mémoire. */
    magasin.getPendingCaptureForRoom.mockResolvedValue({
      id: 'act-10',
      content: {
        source: 'voice-core', vapiCallId: 'room-4',
        contact: { name: 'Julie Mertens', email: null, phone: null },
        reason: 'rappel', urgency: 'normal', forPerson: null, callbackWhen: null,
      },
    });
    prismaMock.clientCall.findUnique
      .mockResolvedValueOnce({ id: 'call-44', clientId: 'c1', status: 'completed' }) // garde : fiche existante
      .mockResolvedValueOnce({ id: 'call-44', clientId: 'c1' });                     // fiche pour la liaison

    const app = await buildApp();
    const res = await request(app)
      .post('/api/voice-core/calls')
      .set('x-api-key', 'test-key')
      .send({ room: 'room-4', clientId: 'c1', transcript: 'APPELANT: allo', durationSeconds: 12 });
    expect(res.status).toBe(202);

    await vi.waitFor(() => expect(magasin.linkCaptureToCall).toHaveBeenCalledTimes(1));
    expect(handleClientCallCompleted).not.toHaveBeenCalled();
    expect(resumeClientCallCompletion).toHaveBeenCalledWith('c1', 'room-4');
    expect(magasin.linkCaptureToCall).toHaveBeenCalledWith({ clientId: 'c1', activityId: 'act-10', clientCallId: 'call-44' });
    expect(remember).toHaveBeenCalledWith(expect.objectContaining({ callId: 'room-4', phase: 'completed' }));
  });
});
