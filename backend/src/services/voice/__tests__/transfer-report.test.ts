import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
vi.mock('../../../config/database', () => ({
  prisma: { callTransfer: { findMany: (...a: any[]) => findMany(...a) } },
}));

const { transferReportService } = await import('../transfer-report.service');

const row = (transferStatus: string, failedReason: string | null = null) => ({ transferStatus, failedReason });

describe('transferReportService.funnel — ce que deviennent les transferts', () => {
  beforeEach(() => findMany.mockReset());

  it('compte tenté, abouti et échoué', async () => {
    findMany.mockResolvedValue([
      row('completed'),
      row('completed'),
      row('failed', 'le poste sonnait occupé'),
    ]);
    const f = await transferReportService.funnel('c1');
    expect(f.attempted).toBe(3);
    expect(f.completed).toBe(2);
    expect(f.failed).toBe(1);
    expect(f.pending).toBe(0);
  });

  it('range à part une tentative dont on n\'a jamais eu le dénouement', async () => {
    // Un transfert supposé réussi qui ne l'était pas est exactement ce qui a
    // fait croire que l'agent transférait.
    findMany.mockResolvedValue([row('initiated'), row('completed')]);
    const f = await transferReportService.funnel('c1');
    expect(f.pending).toBe(1);
    expect(f.completed).toBe(1);
  });

  it('groupe les causes, les plus fréquentes d\'abord', async () => {
    findMany.mockResolvedValue([
      row('failed', 'ça a sonné sans réponse'),
      row('failed', 'le poste sonnait occupé'),
      row('failed', 'ça a sonné sans réponse'),
    ]);
    const f = await transferReportService.funnel('c1');
    expect(f.causes[0]).toEqual({ label: 'ça a sonné sans réponse', count: 2 });
    expect(f.causes[1]).toEqual({ label: 'le poste sonnait occupé', count: 1 });
  });

  it('compte quand même un échec sans cause', async () => {
    // Le taire ferait un total de causes inférieur au nombre d'échecs, et
    // c'est l'écart qu'un lecteur attentif remarque sans pouvoir l'expliquer.
    findMany.mockResolvedValue([row('failed', null), row('failed', '   ')]);
    const f = await transferReportService.funnel('c1');
    expect(f.failed).toBe(2);
    expect(f.causes).toEqual([{ label: 'cause inconnue', count: 2 }]);
  });

  it('ne compte pas les causes des transferts réussis', async () => {
    findMany.mockResolvedValue([row('completed', 'résidu')]);
    expect((await transferReportService.funnel('c1')).causes).toEqual([]);
  });

  it('ne trébuche pas sur un client sans aucun transfert', async () => {
    findMany.mockResolvedValue([]);
    const f = await transferReportService.funnel('c1');
    expect(f).toMatchObject({ attempted: 0, completed: 0, failed: 0, pending: 0, causes: [] });
  });

  it('borne la fenêtre demandée', async () => {
    findMany.mockResolvedValue([]);
    await transferReportService.funnel('c1', 7);
    expect((await transferReportService.funnel('c1', 7)).days).toBe(7);
    expect(findMany.mock.calls[0][0].where.clientId).toBe('c1');
  });
});
