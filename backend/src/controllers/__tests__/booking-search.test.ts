import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * La recherche de rendez-vous (16/09/2026): nom du client, sujet ou numéro,
 * sur TOUS les mois. Une recherche locale au mois affiché dirait « aucun
 * résultat » pour un rendez-vous de novembre, ce qui est le contraire d'une
 * réponse; c'est le piège que le filtre par numéro d'Appels et Leads a déjà
 * coûté une fois.
 */

const { bookingFindMany, bookingCount } = vi.hoisted(() => ({ bookingFindMany: vi.fn(), bookingCount: vi.fn() }));

vi.mock('../../config/database', () => ({
  prisma: { clientBooking: { findMany: bookingFindMany, count: bookingCount }, clientCall: {}, callerMemory: {}, client: {} },
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../services/google-calendar.service', () => ({ googleCalendarService: {} }));
vi.mock('../../services/voice/realtime-context.service', () => ({ realtimeContextService: { invalidateCaller: vi.fn() } }));
vi.mock('google-auth-library', () => ({ OAuth2Client: class {} }));

import { clientDashboardController } from '../client-dashboard.controller';
import { bookingSearch } from '../../services/client-dashboard.service';

function mockRes() {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (payload: unknown) => { res.body = payload; return res; };
  return res;
}

const where = () => bookingFindMany.mock.calls[0][0].where;

beforeEach(() => {
  bookingFindMany.mockReset(); bookingCount.mockReset();
  bookingFindMany.mockResolvedValue([]);
  bookingCount.mockResolvedValue(0);
});

describe('bookingSearch', () => {
  it('cherche le nom et le sujet, sans tenir compte de la casse', () => {
    expect(bookingSearch('dupont')).toEqual([
      { customerName: { contains: 'dupont', mode: 'insensitive' } },
      { serviceType: { contains: 'dupont', mode: 'insensitive' } },
    ]);
  });

  it('cherche le numéro sur ses CHIFFRES: il est stocké en plusieurs écritures', () => {
    const or = bookingSearch('+32 483 62') ?? [];
    expect(or).toContainEqual({ customerPhone: { contains: '3248362' } });
  });

  it('un numéro tapé avec son zéro initial trouve la forme internationale', () => {
    const or = bookingSearch('0483 62') ?? [];
    expect(or).toContainEqual({ customerPhone: { contains: '048362' } });
    expect(or).toContainEqual({ customerPhone: { contains: '48362' } });
  });

  it('deux chiffres ne cherchent pas un numéro: ça ramènerait la moitié de la base', () => {
    const or = bookingSearch('42') ?? [];
    expect(or.some(c => 'customerPhone' in c)).toBe(false);
  });

  it('rien à chercher rend null, pour que l\'appelant retombe sur son mois', () => {
    expect(bookingSearch('')).toBeNull();
    expect(bookingSearch('  a  ')).toBeNull();
    expect(bookingSearch(undefined)).toBeNull();
  });
});

describe('GET /my-dashboard/bookings?q=', () => {
  it('ignore le mois affiché: une recherche traverse les mois', async () => {
    const res = mockRes();
    await clientDashboardController.getMyBookings(
      { clientId: 'c1', query: { q: 'Dupont', from: '2026-09-01', to: '2026-09-30', limit: '50' } },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(where().clientId).toBe('c1');
    expect(where().bookingDate).toBeUndefined();
    expect(where().OR).toContainEqual({ customerName: { contains: 'Dupont', mode: 'insensitive' } });
    expect(where().status).toEqual({ not: 'cancelled' });
  });

  it('rend le plus récent d\'abord', async () => {
    await clientDashboardController.getMyBookings({ clientId: 'c1', query: { q: 'Dupont' } }, mockRes());
    expect(bookingFindMany.mock.calls[0][0].orderBy).toEqual([{ bookingDate: 'desc' }, { bookingTime: 'desc' }]);
  });

  it('sans recherche, le mois demandé est servi comme avant', async () => {
    await clientDashboardController.getMyBookings({ clientId: 'c1', query: { from: '2026-09-01', to: '2026-09-30' } }, mockRes());
    expect(where().OR).toBeUndefined();
    expect(where().bookingDate.gte.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(bookingFindMany.mock.calls[0][0].orderBy).toEqual([{ bookingDate: 'asc' }, { bookingTime: 'asc' }]);
  });

  it('un client ne peut jamais chercher chez un autre: le clientId vient du jeton', async () => {
    await clientDashboardController.getMyBookings({ clientId: 'c1', query: { q: 'Dupont', clientId: 'c2' } }, mockRes());
    expect(where().clientId).toBe('c1');
  });
});
