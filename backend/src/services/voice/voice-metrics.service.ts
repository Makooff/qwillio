import { logger } from '../../config/logger';
import type { LatencyStage } from './latency-tracker';

/**
 * Agrégation flotte des latences et des coûts (quick win observabilité).
 *
 * `latency-tracker` mesure chaque appel, puis le chiffre meurt dans
 * `ClientCall.metadata`: aucune vue d'ensemble, donc aucune régression
 * visible. Ce service accumule les médianes PAR APPEL de chaque étage
 * (STT/LLM/TTS/total) sur une fenêtre glissante et en sert les P50/P95/P99.
 *
 * Pourquoi la médiane par appel et pas chaque tour: le rapport de fin d'appel
 * ne transporte que les stats agrégées du tracker, pas les échantillons bruts.
 * Une médiane par appel suffit pour la question posée ici — « la flotte
 * a-t-elle ralenti ? » — et rend la fenêtre bornée en mémoire par
 * construction.
 *
 * Tout est en mémoire process, comme le reste de la couche voix (sessions,
 * holds de créneaux): un redémarrage remet la fenêtre à zéro, ce qui est un
 * comportement acceptable pour un indicateur glissant. L'export vers un vrai
 * backend de télémétrie (Langfuse/OTel) est le niveau 2 de la roadmap; ce
 * module en est l'alimentation, pas le remplacement.
 */

/** Objectif produit: latence voix-à-voix sous 1,1 s (état de l'art 2026). */
export const VOICE_TO_VOICE_OBJECTIVE_MS = 1100;

/** Bornage mémoire de la fenêtre: ~8 Ko par étage au maximum. */
const MAX_SAMPLES = 1000;

/** Un récapitulatif dans les logs au plus une fois par heure. */
const LOG_INTERVAL_MS = 60 * 60 * 1000;

export interface FleetStageStats {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface FleetMetricsSummary {
  windowStartedAt: string;
  calls: number;
  latency: Partial<Record<LatencyStage, FleetStageStats>>;
  cost: { calls: number; avgUsd: number; p95Usd: number } | null;
  voiceToVoiceObjectiveMs: number;
  /** null tant qu'aucun appel n'a fourni de latence totale. */
  meetsObjective: boolean | null;
}

const STAGES: LatencyStage[] = ['stt', 'llm', 'tts', 'total'];

export class VoiceMetricsService {
  private samples: Record<LatencyStage, number[]> = { stt: [], llm: [], tts: [], total: [] };
  private costsUsd: number[] = [];
  private calls = 0;
  private windowStartedAt = Date.now();
  private lastLoggedAt = Date.now();

  /**
   * Ingestion d'un appel terminé. Les deux arguments sont les objets déjà
   * construits par `finalizeCall` — aucun re-calcul, aucune I/O: cette méthode
   * vit dans le chemin de fin d'appel et doit rester gratuite.
   */
  record(
    metrics: { latency?: Record<string, unknown> } | null | undefined,
    billing: { costUsd?: number | null } | null | undefined,
  ): void {
    let counted = false;

    const latency = metrics?.latency as
      | Partial<Record<LatencyStage, { median?: number }>>
      | undefined;
    if (latency) {
      for (const stage of STAGES) {
        const median = latency[stage]?.median;
        if (typeof median === 'number' && median >= 0 && median <= 60_000) {
          this.push(this.samples[stage], median);
          counted = true;
        }
      }
    }

    const cost = billing?.costUsd;
    if (typeof cost === 'number' && cost >= 0) {
      this.push(this.costsUsd, cost);
      counted = true;
    }

    if (counted) this.calls += 1;
    this.maybeLog();
  }

  summary(): FleetMetricsSummary {
    const latency: FleetMetricsSummary['latency'] = {};
    for (const stage of STAGES) {
      const stats = summarise(this.samples[stage]);
      if (stats) latency[stage] = stats;
    }

    const costStats = summarise(this.costsUsd);
    const total = latency.total ?? null;

    return {
      windowStartedAt: new Date(this.windowStartedAt).toISOString(),
      calls: this.calls,
      latency,
      cost: costStats
        ? {
            calls: costStats.count,
            avgUsd: round4(this.costsUsd.reduce((a, b) => a + b, 0) / this.costsUsd.length),
            p95Usd: round4(costStats.p95),
          }
        : null,
      voiceToVoiceObjectiveMs: VOICE_TO_VOICE_OBJECTIVE_MS,
      meetsObjective: total ? total.p95 <= VOICE_TO_VOICE_OBJECTIVE_MS : null,
    };
  }

  /** Test seam. */
  reset(): void {
    this.samples = { stt: [], llm: [], tts: [], total: [] };
    this.costsUsd = [];
    this.calls = 0;
    this.windowStartedAt = Date.now();
    this.lastLoggedAt = Date.now();
  }

  private push(arr: number[], value: number): void {
    arr.push(value);
    if (arr.length > MAX_SAMPLES) arr.splice(0, arr.length - MAX_SAMPLES);
  }

  private maybeLog(): void {
    const now = Date.now();
    if (now - this.lastLoggedAt < LOG_INTERVAL_MS || this.calls === 0) return;
    this.lastLoggedAt = now;
    const s = this.summary();
    const stagePart = (name: LatencyStage) => {
      const st = s.latency[name];
      return st ? `${name} p50 ${st.p50}ms p95 ${st.p95}ms p99 ${st.p99}ms` : `${name} n/a`;
    };
    logger.info(
      `[VoiceMetrics] ${s.calls} appels depuis ${s.windowStartedAt} — ` +
        `${STAGES.map(stagePart).join(' | ')}` +
        (s.cost ? ` | coût moyen $${s.cost.avgUsd}` : '') +
        ` | objectif <${VOICE_TO_VOICE_OBJECTIVE_MS}ms: ${s.meetsObjective === null ? 'n/a' : s.meetsObjective ? 'tenu' : 'DÉPASSÉ'}`
    );
  }
}

function summarise(values: number[]): FleetStageStats | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1],
  };
}

/** Nearest-rank, même convention que latency-tracker: pas de précision inventée. */
function percentile(sorted: number[], q: number): number {
  const rank = Math.ceil(q * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export const voiceMetricsService = new VoiceMetricsService();
