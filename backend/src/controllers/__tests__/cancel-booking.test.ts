import { describe, it, expect, vi, beforeEach } from 'vitest';

/* Annuler un rendez-vous depuis le portail (13/09/2026). Le portail ne
   savait que lister ; or c'est la réservation EN BASE que l'agent lit pour
   reconnaître un appelant, et supprimer l'événement Google ne la touche pas. */

const { findFirst, updateMany, clientFindUnique, deleteEvent, getAccessToken, invalidateCaller } = vi.hoisted(() => ({
  findFirst: vi.fn(), updateMany: vi.fn(), clientFindUnique: vi.fn(),
  deleteEvent: vi.fn(), getAccessToken: vi.fn(), invalidateCaller: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    clientBooking: { findFirst, updateMany },
    client: { findUnique: clientFindUnique },
  },
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../services/google-calendar.service', () => ({
  googleCalendarService: { deleteEvent, getAccessTokenFromRefresh: getAccessToken },
}));
vi.mock('../../services/voice/realtime-context.service', () => ({
  realtimeContextService: { invalidateCaller },
}));
vi.mock('google-auth-library', () => ({ OAuth2Client: class {} }));

import { clientDashboardController } from '../client-dashboard.controller';

function mockRes() {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (payload: unknown) => { res.body = payload; return res; };
  return res;
}
const req = (id: string) => ({ clientId: 'c1', params: { id } });

beforeEach(() => {
  findFirst.mockReset(); updateMany.mockReset(); clientFindUnique.mockReset();
  deleteEvent.mockReset(); getAccessToken.mockReset(); invalidateCaller.mockReset();
  updateMany.mockResolvedValue({ count: 1 });
  invalidateCaller.mockResolvedValue(undefined);
});

describe('cancelMyBooking', () => {
  it('annule, retire l\'événement Google et oublie le nom en cache', async () => {
    findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', status: 'confirmed', googleEventId: 'evt_1', customerPhone: '32483620980' });
    clientFindUnique.mockResolvedValue({ googleCalendarRefreshToken: 'rt', googleCalendarId: 'primary' });
    getAccessToken.mockResolvedValue('at');
    const res = mockRes();
    await clientDashboardController.cancelMyBooking(req('b1'), res);
    expect(res.statusCode).toBe(200);
    /* Le clientId est dans le WHERE de l'écriture : la route ne touche jamais
       la réservation d'un autre locataire, même avec son identifiant. */
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: 'b1', clientId: 'c1' });
    expect(updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'b1', clientId: 'c1' }, data: { status: 'cancelled', googleEventId: null } });
    expect(deleteEvent).toHaveBeenCalledWith('evt_1', 'at', 'primary');
    expect(invalidateCaller).toHaveBeenCalledWith('c1', '32483620980');
  });

  it('un échec Google n\'empêche pas l\'annulation en base', async () => {
    findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', status: 'confirmed', googleEventId: 'evt_1', customerPhone: null });
    clientFindUnique.mockResolvedValue({ googleCalendarRefreshToken: 'rt', googleCalendarId: null });
    getAccessToken.mockRejectedValue(new Error('google down'));
    const res = mockRes();
    await clientDashboardController.cancelMyBooking(req('b1'), res);
    expect(res.statusCode).toBe(200);
    expect(updateMany).toHaveBeenCalled();
    expect(invalidateCaller).not.toHaveBeenCalled();
  });

  it('404 sur une réservation qui n\'est pas à ce client', async () => {
    findFirst.mockResolvedValue(null);
    const res = mockRes();
    await clientDashboardController.cancelMyBooking(req('b-autre'), res);
    expect(res.statusCode).toBe(404);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('déjà annulée : ne réécrit rien', async () => {
    findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', status: 'cancelled', googleEventId: null, customerPhone: null });
    const res = mockRes();
    await clientDashboardController.cancelMyBooking(req('b1'), res);
    expect(res.statusCode).toBe(200);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
