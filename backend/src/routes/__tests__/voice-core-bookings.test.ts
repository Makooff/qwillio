import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

/**
 * Tests COMPORTEMENTAUX du pont voice-core pour le cycle de vie des
 * réservations (déplacement / annulation) CÔTÉ AGENDA.
 *
 * Le chemin Vapi (`tool-runtime`) supprime l'ancien événement avant de
 * resynchroniser (`moveCalendarEvent`) et passe l'annulation par la fonction
 * partagée `booking-cancel` qui retire l'événement Google, efface
 * `googleEventId` et invalide le cache appelant. Le pont voice-core doit
 * tenir EXACTEMENT les mêmes garanties : un déplacement qui laisse l'ancien
 * événement dans l'agenda produit un doublon visible du gérant, et une
 * annulation qui ne retire pas l'événement laisse un rendez-vous fantôme.
 *
 * On monte le VRAI routeur express ; seules les frontières externes
 * (Prisma, les services d'agenda/SMS) sont remplacées.
 */

const magasin = vi.hoisted(() => ({
  persistRoomCapture: vi.fn(),
  persistCapture: vi.fn(),
  getPendingCaptureForRoom: vi.fn(),
  linkCaptureToCall: vi.fn(),
}));
vi.mock('../../services/voice/lead-capture-store.service', () => magasin);

vi.mock('../../services/client-call.service', () => ({
  clientCallService: {
    handleClientCallCompleted: vi.fn(),
    resumeClientCallCompletion: vi.fn(async () => ({ rescuedLead: null })),
  },
}));

const prismaMock = vi.hoisted(() => ({
  clientBooking: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  clientCall: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  client: { findUnique: vi.fn(), findFirst: vi.fn() },
  businessKnowledge: { findMany: vi.fn() },
  knowledgeGap: { upsert: vi.fn() },
  callerMemory: { findUnique: vi.fn() },
  agentCrmActivity: { findFirst: vi.fn() },
}));
vi.mock('../../config/database', () => ({ prisma: prismaMock }));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/voice/realtime-context.service', () => ({
  realtimeContextService: { getClientProfile: vi.fn(), invalidateCaller: vi.fn() },
  shouldRecord: vi.fn(() => false),
}));
vi.mock('../../services/voice/twilio-recording.service', () => ({
  twilioRecordingService: { delAppel: vi.fn(), demarrer: vi.fn(), parSid: vi.fn(), sidEnCours: vi.fn() },
}));
const syncBookingToCalendar = vi.hoisted(() => vi.fn(async () => true));
vi.mock('../../services/voice/tool-runtime.service', () => ({
  toolRuntimeService: { syncBookingToCalendar, sendBookingSms: vi.fn() },
}));
vi.mock('../../services/voice/caller-memory.service', () => ({
  callerMemoryService: { get: vi.fn(), remember: vi.fn() },
}));
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
vi.mock('../../services/lead-identity', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../services/lead-identity')>();
  return { normalizeLeadPhone: mod.normalizeLeadPhone };
});
vi.mock('../../services/voice/worker-calendar.service', () => ({
  workerCalendarService: { takenSlots: vi.fn(async () => []) },
}));

/* LA FONCTION PARTAGÉE D'ANNULATION — le contrat que le pont doit appeler. */
const cancelBooking = vi.hoisted(() => vi.fn());
vi.mock('../../services/booking-cancel', () => ({ cancelBooking }));

/* LA SUPPRESSION D'ÉVÉNEMENT FOURNISSEUR-AWARE (celle de moveCalendarEvent). */
const moveBookingEvent = vi.hoisted(() => vi.fn(async (_clientId: string, _bookingId: string, _oldEventId: string | null, synchronize: () => Promise<boolean>) => synchronize()));
const deleteBookingEvent = vi.hoisted(() => vi.fn(async () => true));
vi.mock('../../services/calendar-provider.service', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../services/calendar-provider.service')>();
  return { ...mod, deleteBookingEvent, moveBookingEvent };
});

const CLIENT = {
  id: 'c1',
  googleCalendarRefreshToken: 'rt-google',
  googleCalendarId: 'primary',
  outlookRefreshToken: null,
  outlookCalendarId: null,
  calendarProvider: 'google',
};

async function buildApp() {
  const { default: router } = await import('../voice-core.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/voice-core', router);
  return app;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('PATCH /api/voice-core/bookings/:id — déplacement SANS doublon agenda', () => {
  it('rend un état pending explicite et ne recrée rien après suppression impossible', async () => {
    prismaMock.clientBooking.findFirst.mockResolvedValue({ googleEventId: 'outlook:old' });
    prismaMock.clientBooking.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.clientBooking.findUnique.mockResolvedValue(null);
    moveBookingEvent.mockResolvedValueOnce(false);
    const res = await request(await buildApp()).patch('/api/voice-core/bookings/b1')
      .set('x-api-key', 'test-key').send({ clientId: 'c1', day: '2026-11-12', slot: '15:00' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ calendarSync: 'pending', retryable: true, warning: 'calendar_sync_pending' });
    expect(syncBookingToCalendar).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOICE_CORE_API_KEY = 'test-key';
  });
  afterEach(() => { delete process.env.VOICE_CORE_API_KEY; });

  it("retire l'ancien événement avant de resynchroniser (pareil que le chemin Vapi)", async () => {
    prismaMock.clientBooking.findFirst.mockResolvedValue({ id: 'b1', googleEventId: 'evt-ancien' });
    prismaMock.clientBooking.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.clientBooking.findUnique.mockResolvedValue({
      id: 'b1', clientId: 'c1', bookingDate: new Date('2026-11-10T12:00:00Z'),
      bookingTime: '14:00', customerPhone: '+32460258033', customerName: 'Julie',
      serviceType: null, status: 'confirmed', customerEmail: null, partySize: null, specialRequests: null,
    });
    prismaMock.client.findUnique.mockResolvedValue(CLIENT);

    const res = await request(await buildApp())
      .patch('/api/voice-core/bookings/b1')
      .set('x-api-key', 'test-key')
      .send({ clientId: 'c1', day: '2026-11-12', slot: '15:00' });

    expect(res.status).toBe(200);
    await flush();
    expect(moveBookingEvent).toHaveBeenCalledWith('c1', 'b1', 'evt-ancien', expect.any(Function));
    expect(syncBookingToCalendar).toHaveBeenCalledWith('c1', 'b1');
  });

  it("ne touche à aucun événement quand la réservation n'a jamais été synchronisée", async () => {
    prismaMock.clientBooking.findFirst.mockResolvedValue({ id: 'b2', googleEventId: null });
    prismaMock.clientBooking.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.clientBooking.findUnique.mockResolvedValue({
      id: 'b2', clientId: 'c1', bookingDate: new Date('2026-11-12T12:00:00Z'),
      bookingTime: '15:00', customerPhone: null, customerName: 'Julie',
      serviceType: null, status: 'confirmed', customerEmail: null, partySize: null, specialRequests: null,
    });

    const res = await request(await buildApp())
      .patch('/api/voice-core/bookings/b2')
      .set('x-api-key', 'test-key')
      .send({ clientId: 'c1', day: '2026-11-13', slot: '09:00' });

    expect(res.status).toBe(200);
    await flush();
    expect(deleteBookingEvent).not.toHaveBeenCalled();
    expect(syncBookingToCalendar).toHaveBeenCalledWith('c1', 'b2');
  });

  it('rend 404 sans rien effacer quand la réservation appartient à un autre client', async () => {
    prismaMock.clientBooking.findFirst.mockResolvedValue(null);
    prismaMock.clientBooking.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(await buildApp())
      .patch('/api/voice-core/bookings/b3')
      .set('x-api-key', 'test-key')
      .send({ clientId: 'c1', day: '2026-11-12', slot: '15:00' });

    expect(res.status).toBe(404);
    await flush();
    expect(deleteBookingEvent).not.toHaveBeenCalled();
    expect(syncBookingToCalendar).not.toHaveBeenCalled();
  });
});

describe('POST /api/voice-core/bookings/:id/cancel — annulation COMPLÈTE', () => {
  it('expose la synchronisation retenue comme avertissement réessayable', async () => {
    process.env.VOICE_CORE_API_KEY = 'test-key';
    cancelBooking.mockResolvedValue({ok:true,calendarSync:'retained',alreadyCancelled:false});
    const res = await request(await buildApp()).post('/api/voice-core/bookings/b1/cancel').set('x-api-key','test-key').send({clientId:'c1'});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ok:true,calendarSync:'retained',retryable:true,warning:'calendar_sync_pending'});
  });
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOICE_CORE_API_KEY = 'test-key';
  });
  afterEach(() => { delete process.env.VOICE_CORE_API_KEY; });

  it("passe par la fonction partagée qui retire l'événement agenda et vide googleEventId", async () => {
    cancelBooking.mockResolvedValue({
      ok: true, alreadyCancelled: false,
      customerName: 'Julie', bookingDate: new Date('2026-11-12T12:00:00Z'), bookingTime: '14:00',
    });

    const res = await request(await buildApp())
      .post('/api/voice-core/bookings/b1/cancel')
      .set('x-api-key', 'test-key')
      .send({ clientId: 'c1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(cancelBooking).toHaveBeenCalledWith('c1', 'b1');
    expect(prismaMock.clientBooking.updateMany).not.toHaveBeenCalled();
  });

  it('rend 404 quand la réservation est introuvable pour CE client', async () => {
    cancelBooking.mockResolvedValue({ ok: false, reason: 'not-found' });

    const res = await request(await buildApp())
      .post('/api/voice-core/bookings/inconnue/cancel')
      .set('x-api-key', 'test-key')
      .send({ clientId: 'c1' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'unknown_booking' });
  });

  it('reste idempotent sur une annulation déjà faite (même contrat que le chemin Vapi)', async () => {
    cancelBooking.mockResolvedValue({
      ok: true, alreadyCancelled: true,
      customerName: 'Julie', bookingDate: new Date('2026-11-12T12:00:00Z'), bookingTime: '14:00',
    });

    const res = await request(await buildApp())
      .post('/api/voice-core/bookings/b1/cancel')
      .set('x-api-key', 'test-key')
      .send({ clientId: 'c1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
