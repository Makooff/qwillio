import { describe, it, expect, vi, beforeEach } from 'vitest';

/* Appel réel du 13/09/2026 : l'appelant dit « Jean-Luc », le transcripteur
   écrit « Jean Lucas », et l'agent l'appelle ainsi pendant tout l'appel alors
   que sa réservation, relue et épelée, dit « Jean-Luc de la Forge ». Le nom
   CONFIRMÉ doit primer partout : historique posé à chaque tour, consigne au
   modèle, résumé post-appel, mémoire d'appelant. */

const { findMemory, findCalls, findBooking } = vi.hoisted(() => ({
  findMemory: vi.fn(),
  findCalls: vi.fn(),
  findBooking: vi.fn(),
}));
vi.mock('../../../config/database', () => ({
  prisma: {
    callerMemory: { findUnique: findMemory },
    clientCall: { findMany: findCalls },
    clientBooking: { findFirst: findBooking },
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
    findBooking.mockReset();
    findCalls.mockResolvedValue([]);
  });

  it('le nom de la réservation prime sur la mémoire d\'appelant', async () => {
    findMemory.mockResolvedValue({ knownName: 'Jean Lucas', profileSummary: null, lastSummary: null, lastCallAt: new Date(), totalCalls: 3 });
    findBooking.mockResolvedValue({ id: 'b1', customerName: 'Jean-Luc de la Forge' });
    const h = await realtimeContextService.getCallerHistory('c-name-1', '32483620980');
    expect(h.knownName).toBe('Jean-Luc de la Forge');
    expect(h.hasUpcomingBooking).toBe(true);
  });

  it('sans réservation, la mémoire, puis les appels', async () => {
    findMemory.mockResolvedValue({ knownName: 'Élodie', profileSummary: null, lastSummary: null, lastCallAt: new Date(), totalCalls: 1 });
    findBooking.mockResolvedValue(null);
    expect((await realtimeContextService.getCallerHistory('c-name-2', '32483620981')).knownName).toBe('Élodie');

    findMemory.mockResolvedValue(null);
    findCalls.mockResolvedValue([{ createdAt: new Date(), summary: null, nameCollected: null, callerName: 'Marc' }]);
    expect((await realtimeContextService.getCallerHistory('c-name-3', '32483620982')).knownName).toBe('Marc');
  });

  it('la sélection lit le nom de la réservation', async () => {
    findMemory.mockResolvedValue(null);
    findBooking.mockResolvedValue(null);
    await realtimeContextService.getCallerHistory('c-name-4', '32483620983');
    expect(findBooking.mock.calls[0][0].select).toMatchObject({ customerName: true });
  });
});

describe('callerHistoryBlock — le nom connu vaut plus que le nom entendu', () => {
  it('dit au modèle d\'utiliser ce nom, pas ce qu\'il a cru entendre', () => {
    const block = callerHistoryBlock('fr', {
      previousCalls: 2, lastCallAt: null, lastSummary: null, knownName: 'Jean-Luc de la Forge', hasUpcomingBooking: true,
    })!;
    expect(block).toMatch(/ne redemande pas son nom/);
    expect(block).toMatch(/appelle-le Jean-Luc de la Forge, jamais par ce que tu as cru entendre/);
    const en = callerHistoryBlock('en', {
      previousCalls: 1, lastCallAt: null, lastSummary: null, knownName: 'Jean-Luc', hasUpcomingBooking: false,
    })!;
    expect(en).toMatch(/call them Jean-Luc, never what you thought you heard/);
  });
});
