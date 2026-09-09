import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
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
 * La fenêtre vit en mémoire process, mais elle ne PART PLUS de zéro: `hydrate()`
 * la remplit au démarrage depuis `ClientCall.metadata.realtime.latency`, où
 * chaque appel a déjà écrit sa mesure. Sans ça, un redéploiement effaçait
 * l'indicateur, et Render en fait plusieurs par jour: la fenêtre ne disait
 * jamais autre chose que « depuis le dernier déploiement », ce qui est la seule
 * période où l'on est certain qu'il ne s'est presque rien passé.
 *
 * L'export vers un vrai backend de télémétrie (Langfuse/OTel) est le niveau 2
 * de la roadmap; ce module en est l'alimentation, pas le remplacement.
 */

/** Objectif produit: latence voix-à-voix sous 1,1 s (état de l'art 2026). */
export const VOICE_TO_VOICE_OBJECTIVE_MS = 1100;

/** Bornage mémoire de la fenêtre: ~8 Ko par étage au maximum. */
const MAX_SAMPLES = 1000;

/** Un récapitulatif dans les logs au plus une fois par heure. */
const LOG_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Combien d'appels passés relire au démarrage.
 *
 * Plus haut que `MAX_SAMPLES` ne servirait à rien (la fenêtre coupe par le
 * début), plus bas ferait mentir la reprise. C'est une seule requête, bornée,
 * hors du chemin d'un appel.
 */
const HYDRATE_CALLS = MAX_SAMPLES;

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

const STAGES: LatencyStage[] = ['stt', 'llm', 'tts', 'ttfa', 'total'];

export class VoiceMetricsService {
  private samples: Record<LatencyStage, number[]> = { stt: [], llm: [], tts: [], ttfa: [], total: [] };
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

  /**
   * Remplit la fenêtre depuis les appels déjà en base, au démarrage.
   *
   * La mesure n'a jamais été perdue: `persistMetrics` l'écrit dans
   * `ClientCall.metadata.realtime.latency` à la fin de chaque appel. Ce qui
   * était perdu, c'est l'agrégat — et donc toute comparaison qui traverse un
   * déploiement, c'est-à-dire toutes celles qui comptent.
   *
   * Ne fait rien si des appels ont déjà alimenté la fenêtre: rejouer par-dessus
   * compterait deux fois les mêmes appels.
   */
  async hydrate(): Promise<number> {
    if (this.calls > 0) return 0;

    try {
      const rows = await prisma.clientCall.findMany({
        where: { metadata: { not: Prisma.DbNull } },
        orderBy: { createdAt: 'desc' },
        take: HYDRATE_CALLS,
        select: { createdAt: true, metadata: true },
      });

      let oldest: Date | null = null;
      let counted = 0;

      /* Du plus ancien au plus récent: la fenêtre coupe par le début, donc
         l'ordre décide de ce qui survit quand il y a plus d'appels que de
         places. */
      for (const row of rows.reverse()) {
        const meta = row.metadata as {
          realtime?: { latency?: Record<string, unknown> } | null;
          billing?: { costUsd?: number | null } | null;
        } | null;

        const latency = meta?.realtime?.latency;
        const billing = meta?.billing;
        if (!latency && typeof billing?.costUsd !== 'number') continue;

        const before = this.calls;
        this.record(latency ? { latency } : null, billing ?? null);
        if (this.calls > before) {
          counted++;
          oldest = oldest ?? row.createdAt;
        }
      }

      /* La fenêtre commence au premier appel relu, pas au démarrage: dater
         l'agrégat du boot est précisément le mensonge qu'on répare. */
      if (oldest) this.windowStartedAt = oldest.getTime();

      if (counted) {
        logger.info(`[VoiceMetrics] fenêtre reprise sur ${counted} appel(s) depuis ${oldest?.toISOString()}`);
      } else {
        logger.info("[VoiceMetrics] aucun appel mesuré en base — la fenêtre part vide");
      }
      return counted;
    } catch (error) {
      // Un indicateur ne fait pas échouer un démarrage.
      logger.warn(`[VoiceMetrics] reprise de la fenêtre impossible: ${(error as Error).message}`);
      return 0;
    }
  }

  /** Test seam. */
  reset(): void {
    this.samples = { stt: [], llm: [], tts: [], ttfa: [], total: [] };
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
