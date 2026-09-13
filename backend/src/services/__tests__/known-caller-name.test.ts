import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findBooking, findMemory } = vi.hoisted(() => ({ findBooking: vi.fn(), findMemory: vi.fn() }));
vi.mock('../../config/database', () => ({
  prisma: {
    clientBooking: { findFirst: findBooking },
    callerMemory: { findUnique: findMemory },
  },
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { clientCallService } = await import('../client-call.service');
const known = (...a: unknown[]) => (clientCallService as any).knownCallerName(...a) as Promise<string | null>;

/* Appel réel du 13/09: la réservation dit « Jean-Luc de la forge » (relu,
   épelé), le transcript dit « Jean Lucas », et le portail affichait le second. */
describe('knownCallerName — le nom confirmé prime sur le nom entendu', () => {
  beforeEach(() => {
    findBooking.mockReset();
    findMemory.mockReset();
  });

  it('la réservation prise pendant l\'appel d\'abord', async () => {
    findBooking.mockResolvedValueOnce({ customerName: 'Jean-Luc de la forge' });
    expect(await known('c1', '32483620980', 'b1')).toBe('Jean-Luc de la forge');
    expect(findBooking.mock.calls[0][0].where).toEqual({ id: 'b1', clientId: 'c1' });
  });

  it('puis la dernière réservation du numéro, puis la mémoire d\'appelant', async () => {
    findBooking.mockResolvedValueOnce(null).mockResolvedValueOnce({ customerName: 'Stéphane Van Hold' });
    expect(await known('c1', '32483620980', 'b1')).toBe('Stéphane Van Hold');

    findBooking.mockResolvedValueOnce(null);
    findMemory.mockResolvedValueOnce({ knownName: 'Élodie D\'Hoore' });
    expect(await known('c1', '32483620980', null)).toBe('Élodie D\'Hoore');
  });

  it('rien de connu, ou base illisible: null, et le nom entendu reste', async () => {
    findBooking.mockResolvedValueOnce(null);
    findMemory.mockResolvedValueOnce(null);
    expect(await known('c1', '32483620980', null)).toBeNull();
    expect(await known('c1', undefined, null)).toBeNull();
    findBooking.mockRejectedValueOnce(new Error('db down'));
    expect(await known('c1', '32483620980', null)).toBeNull();
  });
});
