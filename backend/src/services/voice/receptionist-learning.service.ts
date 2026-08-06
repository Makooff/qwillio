import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { knowledgeEmbeddingsService } from './knowledge-embeddings.service';
import { receptionistDigestService } from './receptionist-digest.service';

/**
 * Learning loop over the receptionist's real-time signals (chantier 11).
 *
 * `optimization.service` already learns from inbound calls, but only from what
 * the transcript analysis produces: sentiment, outcome, tags. It never sees the
 * signals this refactor started recording — per-stage latency, hard barge-ins,
 * deflection rate, live mood, tool failures — and those are precisely the ones
 * that say *why* a call went badly rather than *that* it did.
 *
 * This service reads them and produces findings. Deliberately narrow in what it
 * changes on its own: it appends guidance to the client's own instructions and
 * refreshes embeddings, and it reports everything else for a human to act on.
 * An agent that silently rewrites its own prompt on a week of noisy data is how
 * a working receptionist becomes a broken one.
 *
 * It ADDS a source. The outbound prospecting loop (`script-learning`,
 * `ai-learning`) is untouched.
 */

export interface RealtimeMetrics {
  callerTurns?: number;
  deflectedTurns?: number;
  bargeIns?: number;
  hardBargeIns?: number;
  mood?: string;
  toolCalls?: Array<{ name: string; ms: number }>;
  latency?: { stt?: Stat; llm?: Stat; tts?: Stat; total?: Stat };
  tokens?: { input: number; cached: number; output: number };
}

interface Stat {
  count: number;
  median: number;
  p95: number;
  max: number;
}

export interface Finding {
  /** Machine-readable, so the dashboard can group them. */
  code: string;
  severity: 'info' | 'warn';
  detail: string;
  /** What a human should change. Empty when the loop already handled it. */
  action: string;
  /**
   * What the finding is about when the code alone is not enough, currently the
   * failing tool name. The digest needs it to tell a broken calendar (the
   * client's to reconnect) from any other tool failure (ours to fix).
   */
  subject?: string;
}

export interface LearningReport {
  clientId: string;
  callsAnalysed: number;
  findings: Finding[];
}

/** Below this there is no signal, only noise. */
const MIN_CALLS = 8;
/** Interruptions of real sentences, per call, above which pacing is wrong. */
const HARD_BARGE_IN_THRESHOLD = 1.5;
/** Share of calls where the caller ended up unhappy. */
const UPSET_RATE_THRESHOLD = 0.25;
/** Turn latency past which callers audibly wait. */
const SLOW_TURN_P95_MS = 900;
/** Share of tool calls that errored. */
const TOOL_ERROR_THRESHOLD = 0.1;
/** Cache hit rate below which the prompt prefix is probably being mutated. */
const LOW_CACHE_HIT_RATE = 0.3;

const LOOKBACK_DAYS = 7;
const MAX_CALLS = 200;

class ReceptionistLearningService {
  /**
   * Analyse one client's recent calls. Read-only except for the two safe
   * remediations below.
   */
  async analyseClient(clientId: string): Promise<LearningReport> {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const calls = await prisma.clientCall.findMany({
      where: { clientId, isSpam: false, createdAt: { gte: since } },
      select: { metadata: true, outcome: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_CALLS,
    });

    const metrics = calls
      .map(c => (c.metadata as Record<string, any> | null)?.realtime as RealtimeMetrics | undefined)
      .filter((m): m is RealtimeMetrics => Boolean(m));

    if (metrics.length < MIN_CALLS) {
      return { clientId, callsAnalysed: metrics.length, findings: [] };
    }

    const findings = [
      ...this.pacingFindings(metrics),
      ...this.latencyFindings(metrics),
      ...this.toolFindings(metrics),
      ...this.costFindings(metrics),
    ];

    return { clientId, callsAnalysed: metrics.length, findings };
  }

  /** Pacing: the agent talking over people, or leaving them unhappy. */
  private pacingFindings(metrics: RealtimeMetrics[]): Finding[] {
    const findings: Finding[] = [];

    const hardPerCall = avg(metrics.map(m => m.hardBargeIns ?? 0));
    if (hardPerCall > HARD_BARGE_IN_THRESHOLD) {
      findings.push({
        code: 'verbose_agent',
        severity: 'warn',
        detail: `${hardPerCall.toFixed(1)} interruptions of a real sentence per call`,
        // Callers cutting in mid-sentence means the answers are too long, not
        // that barge-in is misconfigured — barge-in working is what let us see
        // this at all.
        action: 'Shorten the agent answers: lower VOICE_MAX_COMPLETION_TOKENS or tighten the client instructions.',
      });
    }

    const upsetRate = share(metrics, m => m.mood === 'upset');
    if (upsetRate > UPSET_RATE_THRESHOLD) {
      findings.push({
        code: 'upset_callers',
        severity: 'warn',
        detail: `${Math.round(upsetRate * 100)}% of calls open with an unhappy caller`,
        action: 'Callers are arriving already frustrated: check what happens BEFORE the call — hold times, unanswered lines, a failing follow-up.',
      });
    }

    const deflectionRate = ratio(
      metrics.reduce((s, m) => s + (m.deflectedTurns ?? 0), 0),
      metrics.reduce((s, m) => s + (m.callerTurns ?? 0), 0),
    );
    findings.push({
      code: 'deflection_rate',
      severity: 'info',
      detail: `${Math.round(deflectionRate * 100)}% of caller turns answered without a model call`,
      action: '',
    });

    return findings;
  }

  /** Latency, attributed to the stage that owns it. */
  private latencyFindings(metrics: RealtimeMetrics[]): Finding[] {
    const stages = ['stt', 'llm', 'tts', 'total'] as const;
    const p95: Partial<Record<(typeof stages)[number], number>> = {};
    for (const stage of stages) {
      const values = metrics.map(m => m.latency?.[stage]?.p95).filter((v): v is number => typeof v === 'number');
      if (values.length) p95[stage] = Math.round(avg(values));
    }

    if (!p95.total || p95.total <= SLOW_TURN_P95_MS) return [];

    // Name the worst stage rather than reporting a slow call: which stage owns
    // it is the entire reason the measurement was split.
    const worst = (['llm', 'tts', 'stt'] as const)
      .map(s => ({ stage: s, value: p95[s] ?? 0 }))
      .sort((a, b) => b.value - a.value)[0];

    return [
      {
        code: 'slow_turns',
        severity: 'warn',
        detail: `p95 turn latency ${p95.total}ms, worst stage ${worst.stage} at ${worst.value}ms`,
        action:
          worst.stage === 'llm'
            ? 'Model round-trip dominates: check the cache hit rate and whether the expensive tier is being over-selected.'
            : worst.stage === 'tts'
              ? 'Synthesis dominates: lower VOICE_TTS_MIN_CHUNK_CHARS or shorten the answers.'
              : 'Transcription dominates: VOICE_ENDPOINTING_MS may be too high for this client audio.',
      },
    ];
  }

  /** Tool reliability, and gaps in the knowledge base. */
  private toolFindings(metrics: RealtimeMetrics[]): Finding[] {
    const calls = metrics.flatMap(m => m.toolCalls ?? []);
    if (!calls.length) return [];

    const errors = calls.filter(c => c.name.endsWith(':error'));
    const findings: Finding[] = [];

    if (ratio(errors.length, calls.length) > TOOL_ERROR_THRESHOLD) {
      const byTool = new Map<string, number>();
      for (const e of errors) {
        const name = e.name.replace(':error', '');
        byTool.set(name, (byTool.get(name) ?? 0) + 1);
      }
      const worst = [...byTool.entries()].sort((a, b) => b[1] - a[1])[0];
      findings.push({
        code: 'tool_failures',
        severity: 'warn',
        detail: `${errors.length}/${calls.length} tool calls failed, mostly ${worst[0]}`,
        subject: worst[0],
        action:
          worst[0] === 'checkAvailability' || worst[0] === 'bookAppointment'
            ? 'Calendar access is failing: the Google token is likely expired or revoked.'
            : 'Investigate the failing tool — every failure here is a caller told to expect a call back instead.',
      });
    }

    const knowledgeLookups = calls.filter(c => c.name.startsWith('lookupKnowledge')).length;
    if (knowledgeLookups > metrics.length) {
      findings.push({
        code: 'knowledge_gaps',
        severity: 'info',
        detail: `${knowledgeLookups} knowledge lookups over ${metrics.length} calls`,
        action: 'Callers keep asking things not covered in the prompt: promote the most-asked entries so they are answered without a lookup.',
      });
    }

    return findings;
  }

  /** Token spend, and whether the prompt cache is actually engaging. */
  private costFindings(metrics: RealtimeMetrics[]): Finding[] {
    const input = metrics.reduce((s, m) => s + (m.tokens?.input ?? 0), 0);
    const cached = metrics.reduce((s, m) => s + (m.tokens?.cached ?? 0), 0);
    if (input === 0) return [];

    const hitRate = ratio(cached, input);
    if (hitRate >= LOW_CACHE_HIT_RATE) {
      return [{ code: 'cache_hit_rate', severity: 'info', detail: `${Math.round(hitRate * 100)}% prompt cache hit rate`, action: '' }];
    }
    return [
      {
        code: 'cache_missing',
        severity: 'warn',
        detail: `prompt cache hit rate only ${Math.round(hitRate * 100)}%`,
        // The prefix must be byte-identical across turns for the cache to
        // engage; anything appended to the FRONT of the messages breaks it.
        action: 'Something is mutating the stable prompt prefix mid-call — check that per-turn additions are appended, not prepended.',
      },
    ];
  }

  /**
   * Weekly pass over every active client with a receptionist.
   *
   * The only thing it changes on its own is embedding freshness, which is
   * mechanical and cannot make the agent say something wrong. Everything else
   * is reported: to the client by email and SMS for the findings they can act
   * on (`receptionist-digest`), to us for the rest.
   */
  async runWeekly(): Promise<LearningReport[]> {
    const clients = await prisma.client.findMany({
      where: { subscriptionStatus: { in: ['active', 'trialing'] }, vapiAssistantId: { not: null } },
      select: {
        id: true,
        businessName: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        agentLanguage: true,
        country: true,
        vapiConfig: true,
      },
    });

    const reports: LearningReport[] = [];
    for (const client of clients) {
      try {
        const report = await this.analyseClient(client.id);
        if (!report.findings.length) continue;

        reports.push(report);
        await knowledgeEmbeddingsService.generateMissing(client.id).catch(() => 0);

        // The client hears about their own findings here. The digest decides
        // which ones are theirs to act on and stays silent when none are.
        await receptionistDigestService.send(client, report);

        const warnings = report.findings.filter(f => f.severity === 'warn');
        if (warnings.length) {
          logger.warn(
            `[ReceptionistLearning] ${client.businessName}: ` +
              warnings.map(w => `${w.code} (${w.detail})`).join('; ')
          );
        }
      } catch (error) {
        logger.error(`[ReceptionistLearning] failed for ${client.businessName}:`, error);
      }
    }
    return reports;
  }
}

function avg(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function ratio(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

function share<T>(items: T[], predicate: (item: T) => boolean): number {
  return ratio(items.filter(predicate).length, items.length);
}

export const receptionistLearningService = new ReceptionistLearningService();
