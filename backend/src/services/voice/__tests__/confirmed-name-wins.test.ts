import { describe, it, expect, vi, beforeEach } from 'vitest';

/* Appel réel du 13/09/2026 : l'appelant dit « Jean-Luc », le transcripteur
   écrit « Jean Lucas », et l'agent l'appelle ainsi pendant tout l'appel alors
   que sa réservation, relue et épelée, dit « Jean-Luc de la Forge ». Le nom
   CONFIRMÉ doit primer partout : historique posé à chaque tour, consigne au
   modèle, résumé post-appel, mémoire d'appelant. */

const { findMemory, findCalls, findBookings } = vi.hoisted(() => ({
  findMemory: vi.fn(),
  findCalls: vi.fn(),
  findBookings: vi.fn(),
}));
vi.mock('../../../config/database', () => ({
  prisma: {
    callerMemory: { findUnique: findMemory },
    clientCall: { findMany: findCalls },
    clientBooking: { findMany: findBookings },
    client: { findUnique: vi.fn() },
  },
}));
vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../../config/env', () => ({ env: { REDIS_URL: undefined, VOICE_CONTEXT_TTL_MS: 60_000, DEFAULT_TIMEZONE: 'Europe/Brussels' } }));

const { realtimeContextService } = await import('../realtime-context.service');
const { callerHistoryBlock } = await import('../system-prompt');

describe('getCallerHistory — la réservation confirmée nomme l\'appelant', () => {
  beforeEach(() => {
    findMemory.mockReset();
    findCalls.mockReset();
    findBookings.mockReset();
    findCalls.mockResolvedValue([]);
    findBookings.mockResolvedValue([]);
  });

  it('le nom de la réservation prime sur la mémoire d\'appelant', async () => {
    findMemory.mockResolvedValue({ knownName: 'Jean Lucas', profileSummary: null, lastSummary: null, lastCallAt: new Date(), totalCalls: 3 });
    findBookings.mockResolvedValue([{ customerName: 'Jean-Luc de la Forge', bookingDate: new Date('2027-03-22T12:00:00.000Z'), bookingTime: '17:00', serviceType: null }]);
    const h = await realtimeContextService.getCallerHistory('c-name-1', '32483620980');
    expect(h.knownName).toBe('Jean-Luc de la Forge');
    expect(h.hasUpcomingBooking).toBe(true);
  });

  it('sans réservation, la mémoire, puis les appels', async () => {
    findMemory.mockResolvedValue({ knownName: 'Élodie', profileSummary: null, lastSummary: null, lastCallAt: new Date(), totalCalls: 1 });
    expect((await realtimeContextService.getCallerHistory('c-name-2', '32483620981')).knownName).toBe('Élodie');

    findMemory.mockResolvedValue(null);
    findCalls.mockResolvedValue([{ createdAt: new Date(), summary: null, nameCollected: null, callerName: 'Marc' }]);
    expect((await realtimeContextService.getCallerHistory('c-name-3', '32483620982')).knownName).toBe('Marc');
  });

  /* Appel réel du 13/09 à 16:52 : sans tri, la base rendait une vieille
     réservation de test (« Paul Matthieu ») et l'agent a appelé Jean-Luc
     ainsi pendant tout l'appel, malgré quatre démentis. */
  it('lit la réservation la plus récemment touchée, et son nom', async () => {
    findMemory.mockResolvedValue(null);
    await realtimeContextService.getCallerHistory('c-name-4', '32483620983');
    const q = findBookings.mock.calls[0][0];
    expect(q.select).toMatchObject({ customerName: true });
    expect(q.orderBy).toEqual({ updatedAt: 'desc' });
  });

  it('un numéro qui réserve pour plusieurs personnes ne nomme personne', async () => {
    findMemory.mockResolvedValue(null);
    findBookings.mockResolvedValue([{ customerName: 'Jean-Luc de la Forge', bookingDate: new Date('2027-03-22T12:00:00.000Z'), bookingTime: '17:00', serviceType: null }, { customerName: 'Paul Matthieu', bookingDate: new Date('2027-03-22T12:00:00.000Z'), bookingTime: '17:00', serviceType: null }]);
    const h = await realtimeContextService.getCallerHistory('c-name-5', '32483620984');
    expect(h.knownName).toBeNull();
    expect(h.hasUpcomingBooking).toBe(true);

    /* Deux réservations sous le MÊME nom, entendu différemment : un seul nom. */
    findBookings.mockResolvedValue([{ customerName: 'Jean-Luc de la Forge', bookingDate: new Date('2027-03-22T12:00:00.000Z'), bookingTime: '17:00', serviceType: null }, { customerName: 'Jean-Luc Delaforge', bookingDate: new Date('2027-03-22T12:00:00.000Z'), bookingTime: '17:00', serviceType: null }]);
    expect((await realtimeContextService.getCallerHistory('c-name-6', '32483620985')).knownName).toBe('Jean-Luc de la Forge');
  });
});

describe('callerHistoryBlock — le nom connu vaut plus que le nom entendu', () => {
  it('dit au modèle d\'utiliser ce nom, pas ce qu\'il a cru entendre', () => {
    const block = callerHistoryBlock('fr', {
      previousCalls: 2, lastCallAt: null, lastSummary: null, knownName: 'Jean-Luc de la Forge', hasUpcomingBooking: true,
    })!;
    expect(block).toMatch(/probablement Jean-Luc de la Forge/);
    expect(block).toMatch(/ne redemande pas/);
    /* Et l'appelant qui dément a le dernier mot (16:52). */
    expect(block).toMatch(/S'il dit que ce n'est PAS son nom, crois-le/);
    const en = callerHistoryBlock('en', {
      previousCalls: 1, lastCallAt: null, lastSummary: null, knownName: 'Jean-Luc', hasUpcomingBooking: false,
    })!;
    expect(en).toMatch(/probably Jean-Luc/);
    expect(en).toMatch(/If they say that is NOT their name, believe them/);
  });
});
