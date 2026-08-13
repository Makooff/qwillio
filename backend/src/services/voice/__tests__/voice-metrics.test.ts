import { describe, it, expect, beforeEach } from 'vitest';
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
});
