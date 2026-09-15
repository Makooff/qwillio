import { describe, it, expect, vi, beforeEach } from 'vitest';

/* Le calendrier du portail (15/09/2026): un rendez-vous ouvre sur ce qu'on
   sait de l'appelant. Tout est lu sous le clientId du jeton, et le numéro est
   cherché sous ses deux écritures (chiffres seuls, avec +). */

const { bookingFindFirst, bookingFindMany, memoryFindFirst, callFindMany, callFindFirst } = vi.hoisted(() => ({
  bookingFindFirst: vi.fn(), bookingFindMany: vi.fn(), memoryFindFirst: vi.fn(), callFindMany: vi.fn(), callFindFirst: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    clientBooking: { findFirst: bookingFindFirst, findMany: bookingFindMany },
    callerMemory: { findFirst: memoryFindFirst },
    clientCall: { findMany: callFindMany, findFirst: callFindFirst },
    client: { findUnique: vi.fn() },
  },
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../services/google-calendar.service', () => ({ googleCalendarService: {} }));
vi.mock('../../services/voice/realtime-context.service', () => ({ realtimeContextService: { invalidateCaller: vi.fn() } }));
vi.mock('google-auth-library', () => ({ OAuth2Client: class {} }));

import { clientDashboardController } from '../client-dashboard.controller';
import { phoneForms } from '../../services/client-dashboard.service';

function mockRes() {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (payload: unknown) => { res.body = payload; return res; };
  return res;
}

beforeEach(() => {
  bookingFindFirst.mockReset(); bookingFindMany.mockReset(); memoryFindFirst.mockReset(); callFindMany.mockReset(); callFindFirst.mockReset();
  bookingFindMany.mockResolvedValue([]);
  memoryFindFirst.mockResolvedValue(null);
  callFindMany.mockResolvedValue([]);
  callFindFirst.mockResolvedValue(null);
});

describe('phoneForms', () => {
  it('rend les deux écritures du même numéro', () => {
    expect(phoneForms('32483620980')).toEqual(['32483620980', '+32483620980']);
    expect(phoneForms('+32 483 62 09 80')).toEqual(['32483620980', '+32483620980', '+32 483 62 09 80']);
  });
});

describe('getMyBookingContext', () => {
  it('lit tout sous le clientId du jeton, et le numéro sous ses deux formes', async () => {
    bookingFindFirst.mockResolvedValue({ id: 'b1', customerName: 'Jean-Luc de la Forge', customerPhone: '32483620980', clientCallId: 'call_9' });
    memoryFindFirst.mockResolvedValue({ knownName: 'Jean-Luc de la Forge', totalCalls: 3, lastCallAt: new Date('2026-09-13T04:11:18Z'), lastSummary: 'Déplacement du rendez-vous', lastOutcome: null, profileSummary: null, preferences: [], email: null });
    callFindMany.mockResolvedValue([{ id: 'call_1', callerName: 'Jean Lucas', callerNumber: '32483620980', createdAt: new Date(), durationSeconds: 120, summary: 'Prise de rendez-vous', sentiment: 'positive', outcome: null, isLead: true, leadScore: 80 }]);
    callFindFirst
      .mockResolvedValueOnce({ id: 'call_1', isLead: true, summary: 'Prise de rendez-vous' }) // lead
      .mockResolvedValueOnce({ id: 'call_9', callerName: 'Jean-Luc', callerNumber: '32483620980', createdAt: new Date(), durationSeconds: 90, summary: 'Réservation', sentiment: null, outcome: null, isLead: false, leadScore: null }); // linked call
    const res = mockRes();
    await clientDashboardController.getMyBookingContext({ clientId: 'c1', params: { id: 'b1' } }, res);
    expect(res.statusCode).toBe(200);
    expect(bookingFindFirst.mock.calls[0][0].where).toEqual({ id: 'b1', clientId: 'c1' });
    expect(memoryFindFirst.mock.calls[0][0].where).toEqual({ clientId: 'c1', callerNumber: { in: ['32483620980', '+32483620980'] } });
    expect(callFindMany.mock.calls[0][0].where).toMatchObject({ clientId: 'c1', isSpam: false });
    expect(bookingFindMany.mock.calls[0][0].where).toMatchObject({ clientId: 'c1', id: { not: 'b1' } });
    /* L'appel qui a PRIS le rendez-vous est en tête, sans doublon. */
    expect(res.body.calls.map((c: { id: string }) => c.id)).toEqual(['call_9', 'call_1']);
    expect(res.body.caller.totalCalls).toBe(3);
    expect(res.body.lead.id).toBe('call_1');
  });

  it('sans numéro: rien à chercher, mais la fiche répond', async () => {
    bookingFindFirst.mockResolvedValue({ id: 'b1', customerName: 'Inconnu Total', customerPhone: null, clientCallId: null });
    const res = mockRes();
    await clientDashboardController.getMyBookingContext({ clientId: 'c1', params: { id: 'b1' } }, res);
    expect(res.statusCode).toBe(200);
    expect(memoryFindFirst).not.toHaveBeenCalled();
    expect(callFindMany).not.toHaveBeenCalled();
    expect(res.body.calls).toEqual([]);
  });

  it('404 sur une réservation qui n\'est pas à ce client', async () => {
    bookingFindFirst.mockResolvedValue(null);
    const res = mockRes();
    await clientDashboardController.getMyBookingContext({ clientId: 'c1', params: { id: 'b-autre' } }, res);
    expect(res.statusCode).toBe(404);
  });
});
