import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
vi.mock('../../../config/database', () => ({
  prisma: { clientCall: { findMany: (...a: unknown[]) => findMany(...a) }, client: { findMany: vi.fn() } },
}));
vi.mock('../knowledge-embeddings.service', () => ({
  knowledgeEmbeddingsService: { generateMissing: vi.fn().mockResolvedValue(0) },
}));

const { receptionistLearningService } = await import('../receptionist-learning.service');

/** N calls carrying the given real-time metrics. */
function calls(n: number, realtime: Record<string, unknown>) {
  return Array.from({ length: n }, () => ({ metadata: { realtime }, outcome: 'completed' }));
}

const codes = async (rows: unknown[]) => {
  findMany.mockResolvedValue(rows);
  const report = await receptionistLearningService.analyseClient('client_1');
  return report.findings.map(f => f.code);
};

describe('analyseClient — the noise floor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses to conclude anything from a handful of calls', async () => {
    findMany.mockResolvedValue(calls(3, { hardBargeIns: 10 }));
    const report = await receptionistLearningService.analyseClient('client_1');
    expect(report.findings).toEqual([]);
    expect(report.callsAnalysed).toBe(3);
  });

  it('ignores calls with no real-time metrics at all', async () => {
    findMany.mockResolvedValue([{ metadata: null }, { metadata: {} }]);
    expect((await receptionistLearningService.analyseClient('client_1')).callsAnalysed).toBe(0);
  });
});

describe('analyseClient — pacing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flags an agent that keeps getting cut off mid-sentence', async () => {
    // Callers interrupting real sentences means the answers are too long — not
    // that barge-in is misconfigured.
    expect(await codes(calls(10, { hardBargeIns: 3, callerTurns: 10 }))).toContain('verbose_agent');
  });

  it('does not flag interruptions of backchannels', async () => {
    expect(await codes(calls(10, { bargeIns: 8, hardBargeIns: 0, callerTurns: 10 }))).not.toContain('verbose_agent');
  });

  it('flags callers who arrive already unhappy, and points upstream', async () => {
    findMany.mockResolvedValue([...calls(6, { mood: 'upset' }), ...calls(6, { mood: 'neutral' })]);
    const report = await receptionistLearningService.analyseClient('client_1');
    const finding = report.findings.find(f => f.code === 'upset_callers');
    expect(finding).toBeDefined();
    expect(finding!.action).toMatch(/BEFORE the call/i);
  });

  it('always reports the deflection rate, as information rather than a warning', async () => {
    findMany.mockResolvedValue(calls(10, { callerTurns: 10, deflectedTurns: 3 }));
    const report = await receptionistLearningService.analyseClient('client_1');
    const finding = report.findings.find(f => f.code === 'deflection_rate')!;
    expect(finding.severity).toBe('info');
    expect(finding.detail).toContain('30%');
  });
});

describe('analyseClient — latency attribution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says nothing when turns are fast', async () => {
    const fast = { latency: { total: { count: 5, median: 300, p95: 400, max: 500 } } };
    expect(await codes(calls(10, fast))).not.toContain('slow_turns');
  });

  it('names the stage that owns a slow turn, not just the call', async () => {
    findMany.mockResolvedValue(
      calls(10, {
        latency: {
          total: { count: 5, median: 900, p95: 1400, max: 1600 },
          llm: { count: 5, median: 700, p95: 1000, max: 1100 },
          tts: { count: 5, median: 80, p95: 120, max: 140 },
          stt: { count: 5, median: 150, p95: 200, max: 220 },
        },
      })
    );
    const report = await receptionistLearningService.analyseClient('client_1');
    const finding = report.findings.find(f => f.code === 'slow_turns')!;
    expect(finding.detail).toContain('worst stage llm');
    expect(finding.action).toMatch(/cache hit rate/i);
  });

  it('gives TTS-specific advice when synthesis dominates', async () => {
    findMany.mockResolvedValue(
      calls(10, {
        latency: {
          total: { count: 5, median: 900, p95: 1400, max: 1600 },
          llm: { count: 5, median: 90, p95: 120, max: 130 },
          tts: { count: 5, median: 800, p95: 1100, max: 1200 },
        },
      })
    );
    const report = await receptionistLearningService.analyseClient('client_1');
    expect(report.findings.find(f => f.code === 'slow_turns')!.action).toMatch(/VOICE_TTS_MIN_CHUNK_CHARS/);
  });
});

describe('analyseClient — tools and cost', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flags a failing calendar and says what is actually broken', async () => {
    findMany.mockResolvedValue(
      calls(10, {
        toolCalls: [
          { name: 'checkAvailability:error', ms: 2500 },
          { name: 'checkAvailability', ms: 300 },
        ],
      })
    );
    const report = await receptionistLearningService.analyseClient('client_1');
    const finding = report.findings.find(f => f.code === 'tool_failures')!;
    expect(finding.action).toMatch(/token is likely expired/i);
  });

  it('stays quiet when tools are healthy', async () => {
    expect(await codes(calls(10, { toolCalls: [{ name: 'checkAvailability', ms: 300 }] }))).not.toContain('tool_failures');
  });

  it('flags a prompt cache that is not engaging, and names the likely cause', async () => {
    findMany.mockResolvedValue(calls(10, { tokens: { input: 1000, cached: 50, output: 40 } }));
    const report = await receptionistLearningService.analyseClient('client_1');
    const finding = report.findings.find(f => f.code === 'cache_missing')!;
    expect(finding.action).toMatch(/appended, not prepended/i);
  });

  it('reports a healthy cache as information', async () => {
    findMany.mockResolvedValue(calls(10, { tokens: { input: 1000, cached: 900, output: 40 } }));
    const report = await receptionistLearningService.analyseClient('client_1');
    expect(report.findings.find(f => f.code === 'cache_hit_rate')!.severity).toBe('info');
  });

  it('says nothing about cost when no tokens were spent', async () => {
    expect(await codes(calls(10, { callerTurns: 5 }))).not.toContain('cache_missing');
  });
});

/**
 * TST-9: un taux d'abandon global ne dit rien d'exploitable.
 *
 * Il mélange l'appelant qui raccroche en entendant une voix de synthèse et
 * celui qui décroche au moment de donner sa carte. Découpé par tour, il pointe
 * l'endroit exact où l'agent perd les gens — et cet endroit désigne une cause
 * différente à chaque fois.
 */
describe('analyseClient — l\'abandon par index de tour', () => {
  beforeEach(() => vi.clearAllMocks());

  /** N appels abandonnés au tour donné. */
  const lost = (n: number, callerTurns: number, outcome: string | null = 'missed') =>
    Array.from({ length: n }, () => ({ metadata: { realtime: { callerTurns } }, outcome }));

  it('découpe les abandons par tour et nomme le pire', async () => {
    findMany.mockResolvedValue([...lost(8, 1), ...lost(2, 5)]);
    const report = await receptionistLearningService.analyseClient('client_1');
    const finding = report.findings.find(f => f.code === 'abandon_by_turn')!;

    expect(finding.detail).toContain('tour 1: 8');
    expect(finding.detail).toContain('tours 4-6: 2');
    expect(finding.subject).toBe('tour 1');
  });

  it('donne une action DIFFÉRENTE selon l\'endroit où ils partent', async () => {
    findMany.mockResolvedValue(lost(10, 1));
    const early = (await receptionistLearningService.analyseClient('c')).findings
      .find(f => f.code === 'abandon_by_turn')!;
    // Au premier tour ils n'ont entendu que l'accueil.
    expect(early.action).toMatch(/accueil/);

    findMany.mockResolvedValue(lost(10, 8));
    const late = (await receptionistLearningService.analyseClient('c')).findings
      .find(f => f.code === 'abandon_by_turn')!;
    // Au huitième ils étaient engagés: c'est la prise de rendez-vous.
    expect(late.action).toMatch(/rendez-vous|collecte/);
  });

  /**
   * Une liste POSITIVE d'issues d'abandon, et pas « tout ce qui n'est pas un
   * succès »: une issue inconnue comptée comme un abandon ferait crier au loup
   * sur toute la flotte, et un rapport qui se trompe une fois est un rapport
   * qu'on cesse de lire.
   */
  it('ne compte pas comme abandon une issue qu\'il ne connaît pas', async () => {
    findMany.mockResolvedValue(lost(12, 1, 'un_nouveau_statut'));
    const codes = (await receptionistLearningService.analyseClient('c')).findings.map(f => f.code);
    expect(codes).not.toContain('abandon_by_turn');
  });

  it('ne compte ni la plainte ni le transfert, qui sont de vraies conversations', async () => {
    findMany.mockResolvedValue([...lost(6, 2, 'complaint'), ...lost(6, 2, 'transferred')]);
    const codes = (await receptionistLearningService.analyseClient('c')).findings.map(f => f.code);
    expect(codes).not.toContain('abandon_by_turn');
  });

  it('se tait en dessous du plancher de bruit', async () => {
    findMany.mockResolvedValue(lost(3, 1));
    expect((await receptionistLearningService.analyseClient('c')).findings).toEqual([]);
  });
});
