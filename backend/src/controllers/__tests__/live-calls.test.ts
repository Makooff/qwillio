import { describe, it, expect, vi, beforeEach } from 'vitest';

/* A8 — « API live erreur n'est plus 200 data vide ». La route rendait 200
   { data: [] } sur une panne, et le composant confondait ce vide avec « aucun
   appel en cours »: pendant une panne, un appel réel disparaissait de l'écran
   sans rien dire. Désormais: 502 avec un code stable, et l'écran distingue le
   dernier état connu (stale) d'une vraie absence. */

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  lignes: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: { clientCall: { findMany: h.findMany } },
}));

vi.mock('../../services/voice/live-transcript.store', () => ({
  liveTranscripts: { lignes: h.lignes },
}));

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ClientDashboardController } from '../client-dashboard.controller';

function res() {
  const r: { statusCode?: number; body?: unknown } = {};
  return {
    json: (b: unknown) => { r.body = b; return r; },
    status: (c: number) => { r.statusCode = c; return { json: (b: unknown) => { r.body = b; return r; } }; },
    _r: r,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.lignes.mockReturnValue([]);
});

describe('GET /my-dashboard/calls/live', () => {
  it('répond 200 avec les appels et leurs lignes', async () => {
    h.findMany.mockResolvedValue([
      { id: 'call-1', callerNumber: '+32470123456', startedAt: new Date('2026-10-04T10:00:00Z'), vapiCallId: 'room-1' },
    ]);
    h.lignes.mockReturnValue([{ role: 'user', text: 'Bonjour', at: 1 }]);
    const r = res();
    await new ClientDashboardController().getMyLiveCalls({ clientId: 'client-1' } as any, r as any);
    expect(r._r.statusCode).toBeUndefined();
    expect((r._r.body as any).data).toHaveLength(1);
    expect((r._r.body as any).data[0].lines).toHaveLength(1);
  });

  it('répond 502 avec un code stable quand la base est illisible — plus 200 vide', async () => {
    h.findMany.mockRejectedValue(new Error('connexion perdue'));
    const r = res();
    await new ClientDashboardController().getMyLiveCalls({ clientId: 'client-1' } as any, r as any);
    expect(r._r.statusCode).toBe(502);
    expect(r._r.body).toEqual({ error: 'live_unavailable' });
  });
});
