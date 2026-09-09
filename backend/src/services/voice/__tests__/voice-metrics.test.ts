import { describe, it, expect, beforeEach, vi } from 'vitest';

const findMany = vi.hoisted(() => vi.fn());
vi.mock('../../../config/database', () => ({ prisma: { clientCall: { findMany: (...a: unknown[]) => findMany(...a) } } }));

import { VoiceMetricsService, VOICE_TO_VOICE_OBJECTIVE_MS } from '../voice-metrics.service';

/** Un rapport d'appel tel que `finalizeCall` le produit, réduit à l'utile. */
function callWith(totalMedian: number, costUsd?: number) {
  return {
    metrics: { latency: { total: { count: 5, median: totalMedian, p95: totalMedian + 100, max: totalMedian + 200 } } },
    billing: { costUsd: costUsd ?? null },
  };
}

describe('VoiceMetricsService', () => {
  let service: VoiceMetricsService;

  beforeEach(() => {
    service = new VoiceMetricsService();
  });

  it('part vide: aucun étage, pas de coût, objectif indéterminé', () => {
    const s = service.summary();
    expect(s.calls).toBe(0);
    expect(s.latency).toEqual({});
    expect(s.cost).toBeNull();
    expect(s.meetsObjective).toBeNull();
  });

  it('agrège les médianes par appel en P50/P95/P99 (nearest-rank)', () => {
    // 100 appels de 10, 20, ..., 1000 ms.
    for (let i = 1; i <= 100; i++) {
      service.record(callWith(i * 10).metrics, null);
    }
    const total = service.summary().latency.total!;
    expect(total.count).toBe(100);
    expect(total.p50).toBe(500);
    expect(total.p95).toBe(950);
    expect(total.p99).toBe(990);
    expect(total.max).toBe(1000);
  });

  it('compare le P95 total à l\'objectif voix-à-voix', () => {
    service.record(callWith(800).metrics, null);
    expect(service.summary().meetsObjective).toBe(true);

    service.reset();
    for (let i = 0; i < 20; i++) service.record(callWith(1600).metrics, null);
    const s = service.summary();
    expect(s.voiceToVoiceObjectiveMs).toBe(VOICE_TO_VOICE_OBJECTIVE_MS);
    expect(s.meetsObjective).toBe(false);
  });

  it('suit le coût par appel indépendamment des latences', () => {
    // Un rapport de coût peut arriver sans session (processus redémarré):
    // metrics est null, le coût compte quand même.
    service.record(null, { costUsd: 0.10 });
    service.record(null, { costUsd: 0.30 });
    const s = service.summary();
    expect(s.calls).toBe(2);
    expect(s.cost).toEqual({ calls: 2, avgUsd: 0.2, p95Usd: 0.3 });
  });

  it('ignore les valeurs absurdes plutôt que d\'empoisonner les percentiles', () => {
    service.record(callWith(-5).metrics, { costUsd: -1 });
    service.record(callWith(120_000).metrics, null);
    const s = service.summary();
    expect(s.latency.total).toBeUndefined();
    expect(s.cost).toBeNull();
  });

  it('borne la fenêtre: les plus vieux échantillons sortent', () => {
    for (let i = 0; i < 1200; i++) service.record(callWith(100).metrics, null);
    service.record(callWith(2000).metrics, null);
    const total = service.summary().latency.total!;
    expect(total.count).toBe(1000);
    expect(total.max).toBe(2000);
  });

  it('tolère un rapport sans latence ni coût sans compter un appel', () => {
    service.record({ latency: undefined }, { costUsd: null });
    expect(service.summary().calls).toBe(0);
  });

  /**
   * La fenêtre repartait de zéro à chaque redéploiement, et Render en fait
   * plusieurs par jour: l'indicateur ne disait jamais autre chose que « depuis
   * le dernier déploiement ». La mesure, elle, n'a jamais été perdue.
   */
  describe('hydrate', () => {
    /* Corps à accolades, et pas une expression: `mockReset()` REND le mock, et
       vitest appelle la valeur rendue par un hook comme fonction de nettoyage.
       Le test qui programme le mock pour lever le faisait alors lever au
       démontage, et échouait après avoir pourtant passé toutes ses assertions. */
    beforeEach(() => {
      findMany.mockReset();
    });

    it('reprend la fenêtre depuis les appels déjà en base', async () => {
      const at = (iso: string) => new Date(iso);
      // Rendus du plus récent au plus ancien, comme la requête les ordonne.
      findMany.mockResolvedValue([
        { createdAt: at('2026-09-02T10:00:00Z'), metadata: { realtime: { latency: { total: { median: 900 } } } } },
        { createdAt: at('2026-09-01T10:00:00Z'), metadata: { realtime: { latency: { total: { median: 700 } } } }, },
      ]);

      expect(await service.hydrate()).toBe(2);
      const s = service.summary();
      expect(s.calls).toBe(2);
      expect(s.latency.total!.count).toBe(2);
      expect(s.latency.total!.max).toBe(900);
      // La fenêtre est datée du premier appel relu, pas du démarrage: c'est le
      // mensonge que cette reprise existe pour corriger.
      expect(s.windowStartedAt).toBe('2026-09-01T10:00:00.000Z');
    });

    it('ignore les appels sans mesure', async () => {
      findMany.mockResolvedValue([
        { createdAt: new Date(), metadata: { analysis: { summary: 'rdv pris' } } },
        { createdAt: new Date(), metadata: { billing: { costUsd: 0.12 } } },
      ]);
      expect(await service.hydrate()).toBe(1);
      expect(service.summary().cost!.calls).toBe(1);
    });

    it('ne rejoue pas par-dessus des appels déjà comptés', async () => {
      service.record(callWith(800).metrics, null);
      expect(await service.hydrate()).toBe(0);
      expect(findMany).not.toHaveBeenCalled();
      expect(service.summary().calls).toBe(1);
    });

    it("une base injoignable n'empêche pas le démarrage", async () => {
      findMany.mockImplementation(async () => {
        throw new Error('connection lost');
      });
      expect(await service.hydrate()).toBe(0);
      expect(service.summary().calls).toBe(0);
    });
  });
});
