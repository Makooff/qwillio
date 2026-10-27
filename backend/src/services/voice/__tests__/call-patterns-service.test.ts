import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le balayage d'agrégation : idempotence du marqueur, compteur qui ne gonfle
 * pas sur un appel relu, signal UNE FOIS au seuil, et le silence quand la clé
 * OpenAI manque. Le réseau est mocké à `fetch`, la base à `prisma`.
 */

const { findManyCalls, updateCall, queryRaw, executeRaw, transaction, lockCall, lockClient, findClient, listClients, listPatterns, findPattern, createPattern, updatePattern, notify } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  transaction: vi.fn(),
  lockCall: vi.fn(),
  lockClient: vi.fn(),
  findClient: vi.fn(),
  listClients: vi.fn(),
  listPatterns: vi.fn(),
  findManyCalls: vi.fn(),
  updateCall: vi.fn(),
  findPattern: vi.fn(),
  createPattern: vi.fn(),
  updatePattern: vi.fn(),
  notify: vi.fn(async () => {}),
}));

const DEFAULT_TRANSCRIPT = 'Agent : bonjour. Appelant : je veux un rendez-vous. Agent : c’est réservé.';
const DEFAULT_CLIENT_ID = '11111111-1111-4111-8111-111111111111';

vi.mock('../../../config/database', () => ({
  prisma: {
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    $transaction: transaction,
    client: { findUnique: findClient, findMany: listClients },
    clientCall: { findMany: findManyCalls, update: updateCall },
    learningPattern: { findUnique: findPattern, findMany: listPatterns, create: createPattern, update: updatePattern },
  },
}));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../discord.service', () => ({ discordService: { notify } }));

import { transcriptHash } from '../call-review';
import { mapObservation } from '../learning-observations.service';
import { callPatternsService } from '../call-patterns.service';

const MORTEM = { verdict: 'broken', codes: ['dead_line'], evidence: ['aucun mot'] };
const PATTERN = {
  slug: 'reservation-annoncee-avant-outil',
  kind: 'conversation',
  title: 'Réservation annoncée trop tôt',
  summary: 'Annoncé avant le retour outil.',
  quote: 'Agent : c’est réservé.',
};

function callRow(id: string, metadata: any) {
  return { id, clientId: '11111111-1111-4111-8111-111111111111', transcript: 'Agent : bonjour. Appelant : je veux un rendez-vous. Agent : c’est réservé.', metadata };
}

function mockOpenAI(payload: any) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ model: 'gpt-6-fixture-snapshot', choices: [{ message: { content: JSON.stringify({ learningBehaviour: { schema_version: 1, observations: [] }, ...payload }) } }] }),
  })));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.CALL_REVIEW_MODEL = 'gpt-6-fixture';
  process.env.CALL_REVIEW_MODEL_SNAPSHOTS = 'gpt-6-fixture-snapshot';
  process.env.LEARNING_MODEL = '';
  updateCall.mockResolvedValue({});
  updatePattern.mockResolvedValue({});
  queryRaw.mockImplementation((strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (sql.includes('FOR UPDATE') && sql.includes('client_calls')) return lockCall();
    if (sql.includes('FOR UPDATE') && sql.includes('clients')) return lockClient();
    return findManyCalls();
  });
  transaction.mockImplementation(async (cb: any) => cb({
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    learningPattern: { findUnique: findPattern, create: createPattern, update: updatePattern },
  }));
  lockCall.mockImplementation(async () => {
    const rows = await findManyCalls();
    return rows.length ? [{ transcript: rows[0].transcript, clientId: rows[0].clientId }] : [];
  });
  lockClient.mockImplementation(async () => {
    const client = await findClient();
    return [{ businessType: client?.businessType ?? null, country: client?.country ?? null, agentLanguage: client?.agentLanguage ?? null }];
  });
  executeRaw.mockResolvedValue(1);
  findClient.mockResolvedValue({ businessName: 'Cabinet Test', businessType: 'dental', country: 'BE', agentLanguage: 'fr',
    vapiConfig: { knowledge: { parking: 'cour intérieure' } }, businessKnowledge: [] });
});

describe('reprise durable des revues', () => {
  it('réessaie un échec fournisseur puis exporte le modèle servi sans données privées', async () => {
    const row = callRow('retry', {});
    findManyCalls.mockResolvedValue([row]);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429 })));
    expect((await callPatternsService.run()).analysed).toBe(0);
    const failed = JSON.parse(executeRaw.mock.calls.at(-1)![1]);
    expect(failed.learningReview.status).toBe('failed');
    findManyCalls.mockResolvedValue([{ ...row, metadata: failed }]);
    mockOpenAI({ patterns: [] });
    expect((await callPatternsService.run()).analysed).toBe(1);
    const saved = JSON.parse(executeRaw.mock.calls.at(-1)![1]);
    const exported = mapObservation({ ...row, metadata: saved, status: 'completed', endedAt: new Date(),
      createdAt: new Date(), isSpam: false, client: { businessType: 'dental', country: 'BE', agentLanguage: 'fr' } } as any, new Map());
    expect(exported.behaviour).toEqual({ schema_version: 1, observations: [] });
    expect(exported.review.actualModel).toBe('gpt-6-fixture-snapshot');
    expect(JSON.stringify(exported)).not.toContain(row.transcript);
  });
  it('réutilise le résultat exact après échec agrégation sans seconde requête GPT', async () => {
    findManyCalls.mockResolvedValue([callRow('reuse', {})]);
    mockOpenAI({ patterns: [PATTERN] });
    findPattern.mockResolvedValue(null);
    createPattern.mockRejectedValueOnce(new Error('DB lower edge'));
    await callPatternsService.run();
    const saved = JSON.parse(executeRaw.mock.calls.at(-1)![1]);
    expect(saved.learningReview).toMatchObject({ status: 'succeeded', aggregated: false });
    findManyCalls.mockResolvedValue([callRow('reuse', saved)]);
    mockOpenAI({ patterns: [] });
    expect((await callPatternsService.run()).analysed).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('ne repaie pas un succès équivalent et reprend une transcription arrivée tard', async () => {
    findManyCalls.mockResolvedValue([callRow('done', {})]); mockOpenAI({ patterns: [] });
    await callPatternsService.run();
    const saved = JSON.parse(executeRaw.mock.calls.at(-1)![1]);
    expect(saved.learningReview.transcriptHash).toBe(transcriptHash(callRow('done', {}).transcript));
    findManyCalls.mockResolvedValue([callRow('done', saved)]); mockOpenAI({ patterns: [] });
    await callPatternsService.run(); expect(fetch).not.toHaveBeenCalled();
    findManyCalls.mockResolvedValue([{ ...callRow('done', saved), transcript: 'Agent : bonjour. Appelant : merci.' }]);
    expect((await callPatternsService.run()).analysed).toBe(1); expect(fetch).toHaveBeenCalledOnce();
  });
  it('fusionne sur la valeur courante avec le tenant et le transcript dans le prédicat', async () => {
    findManyCalls.mockResolvedValue([callRow('atomic', {})]); mockOpenAI({ patterns: [] });
    await callPatternsService.run();
    const call = executeRaw.mock.calls[0], sql = call[0].join('?');
    expect(sql).toContain('||'); expect(sql).toContain('client_id ='); expect(sql).toContain('transcript =');
    expect(call.slice(1)).toContain(callRow('atomic', {}).clientId);
    expect(call.slice(1)).toContain(callRow('atomic', {}).transcript);
  });
});

describe('revue configurable alimentant les observations', () => {
  it('envoie GPT6 sans temperature et persiste les observations avec provenance', async () => {
    process.env.CALL_REVIEW_MODEL = 'gpt-6-fixture';
    process.env.LEARNING_MODEL = '';
    findManyCalls.mockResolvedValue([callRow('review', { mortem: { verdict: 'ok' } })]);
    findClient.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', businessName: 'Test', businessType: 'dental', country: 'BE', agentLanguage: 'fr', vapiConfig: {}, businessKnowledge: [] });
    mockOpenAI({ patterns: [], learningBehaviour: { schema_version: 1, observations: [] } });
    await callPatternsService.run();
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.model).toBe('gpt-6-fixture');
    expect(body).not.toHaveProperty('temperature');
    expect(executeRaw.mock.calls.some(call => call.slice(1).some((v: unknown) => typeof v === 'string' && v.includes('learningEvidence')))).toBe(true);
    delete process.env.CALL_REVIEW_MODEL;
  });
});

describe('backlog complet et preuves sûres (RED)', () => {
  it('lit réellement un vieux mortem=ok et un appel non jugé', async () => {
    findManyCalls.mockResolvedValue([
      { ...callRow('old', { mortem: { verdict: 'ok' } }), endedAt: new Date('2020-01-01') },
      callRow('sans-mortem', {}),
    ]);
    mockOpenAI({ patterns: [] });
    const sweep = await callPatternsService.run();
    expect(sweep.analysed).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(executeRaw).toHaveBeenCalledTimes(6);
    const sql = queryRaw.mock.calls[0][0].join('?');
    expect(sql).toContain("learningReview");
    expect(sql).toContain("status IN ('completed', 'ended')");
    expect(sql).toContain('is_spam = false');
    expect(sql).toMatch(/ORDER BY[\s\S]*ASC/);
    expect(sql).toContain('LIMIT');
    expect(sql).not.toContain('mortem');
    expect(sql).not.toContain('180');
  });
  it.each(['{"patterns":null}', '{cassé', JSON.stringify({ patterns: [{ ...PATTERN, quote: 'preuve inventée' }] })])
    ('ne marque pas la lecture invalide %s', content => {
      findManyCalls.mockResolvedValue([callRow('pending', { mortem: MORTEM })]);
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) })));
      return callPatternsService.run().then(sweep => {
        expect(sweep.analysed).toBe(0);
        expect(JSON.parse(executeRaw.mock.calls.at(-1)![1]).learningReview.status).toBe('failed');
        expect(createPattern).not.toHaveBeenCalled();
      });
    });
  it('écrit le marker atomiquement sans réécrire le snapshot metadata', async () => {
    findManyCalls.mockResolvedValue([callRow('atomic', { mortem: MORTEM })]);
    mockOpenAI({ patterns: [] });
    await callPatternsService.run();
    const sql = executeRaw.mock.calls[0][0].join('?');
    expect(sql).toContain('jsonb_typeof');
    expect(sql).toContain('metadata');
    expect(updateCall).not.toHaveBeenCalled();
  });
});

describe('frontière d’autorité des observations (RED)', () => {
  const TRANSCRIPT = 'Agent : bonjour. Appelant : je veux un rendez-vous. Agent : c’est réservé.';
  const CLIENT = { businessType: 'dental', country: 'BE', agentLanguage: 'fr' };
  const SCOPE = { tenant_id: '11111111-1111-4111-8111-111111111111', niche: 'dental', country: 'BE', language: 'fr' };
  const BEHAVIOUR = { schema_version: 1, observations: [{ category: 'repeated_question', count: 2 }] };
  const evidence = { schema_version: 1, scope: SCOPE, behaviour: BEHAVIOUR };
  const review = (patch: any = {}) => ({ version: 1, status: 'succeeded', requestedModel: 'gpt-6-fixture',
    actualModel: 'gpt-6-fixture-snapshot', transcriptHash: transcriptHash(TRANSCRIPT), reviewedAt: '2026-01-01T00:00:00.000Z',
    scope: SCOPE, behaviour: BEHAVIOUR, businessType: 'dental', country: 'BE', agentLanguage: 'fr', ...patch });
  const observe = (metadata: any, transcript = TRANSCRIPT) => mapObservation({
    id: 'call-x', clientId: SCOPE.tenant_id, status: 'completed', endedAt: new Date(), createdAt: new Date(),
    transcript, isSpam: false, metadata, client: CLIENT,
  } as any, new Map());
  it('n’autorise que la revue GPT6 réussie exactement calée (transcription, modèle, scope)', () => {
    expect(observe({ learningReview: review(), learningEvidence: evidence }).behaviour).toEqual(BEHAVIOUR);
    expect(observe({ learningReview: review({ requestedModel: 'gpt-4o', actualModel: 'gpt-4o-2024' }), learningEvidence: evidence }).behaviour).toBeNull();
    expect(observe({ learningReview: review({ actualModel: 'gpt-4o-2024' }), learningEvidence: evidence }).behaviour).toBeNull();
    expect(observe({ learningReview: review({ status: 'pending' }), learningEvidence: evidence }).behaviour).toBeNull();
    expect(observe({ learningReview: review({ status: 'failed' }), learningEvidence: evidence }).behaviour).toBeNull();
    expect(observe({ learningReview: review(), learningEvidence: evidence }, 'Agent : bonjour. Appelant : merci.').behaviour).toBeNull();
    expect(observe({ learningReview: review({ scope: { ...SCOPE, niche: 'restaurant' } }), learningEvidence: evidence }).behaviour).toBeNull();
    expect(observe({ learningReview: review({ version: 0 }), learningEvidence: evidence }).behaviour).toBeNull();
  });
  it('dérive la preuve du behaviour de la revue, pas de l’ancienne learningEvidence', () => {
    // Revue valide vide + preuve historique non vide : seul [] est autorisé.
    expect(observe({ learningReview: review({ behaviour: { schema_version: 1, observations: [] } }),
      learningEvidence: evidence }).behaviour).toEqual({ schema_version: 1, observations: [] });
    // Revue sans behaviour : rien n’est autorisé, même avec une preuve valide.
    const { behaviour: _omitted, ...sansBehaviour } = review();
    expect(observe({ learningReview: sansBehaviour, learningEvidence: evidence }).behaviour).toBeNull();
    // Behaviour invalide dans la revue : pas de repli sur learningEvidence.
    expect(observe({ learningReview: review({ behaviour: { schema_version: 1, observations: [{ category: 'invented', count: 1 }] } }),
      learningEvidence: evidence }).behaviour).toBeNull();
  });
  it('applique la politique de modèle partagée : configuration courante et snapshots explicites', () => {
    // requestedModel d'une ancienne politique (GPT6 mais pas le modèle courant).
    expect(observe({ learningReview: review({ requestedModel: 'gpt-6-old-policy', actualModel: 'gpt-6-old-policy' }),
      learningEvidence: evidence }).behaviour).toBeNull();
    // Snapshot GPT6 arbitraire hors liste explicite.
    expect(observe({ learningReview: review({ actualModel: 'gpt-6-old-policy-snapshot' }),
      learningEvidence: evidence }).behaviour).toBeNull();
    // Snapshot explicitement autorisé : accepté.
    process.env.CALL_REVIEW_MODEL_SNAPSHOTS = 'gpt-6-fixture-snapshot,gpt-6-old-policy-snapshot';
    expect(observe({ learningReview: review({ actualModel: 'gpt-6-old-policy-snapshot' }),
      learningEvidence: evidence }).behaviour).toEqual(BEHAVIOUR);
    process.env.CALL_REVIEW_MODEL_SNAPSHOTS = 'gpt-6-fixture-snapshot';
    // Aucune configuration de modèle : export coupé, pas de petit modèle par défaut.
    process.env.CALL_REVIEW_MODEL = ''; process.env.LEARNING_MODEL = '';
    expect(observe({ learningReview: review(), learningEvidence: evidence }).behaviour).toBeNull();
    process.env.CALL_REVIEW_MODEL = 'gpt-6-fixture';
  });
  it('expose le statut de revue sans jamais le présenter comme preuve', () => {
    const pending = observe({ learningReview: review({ status: 'pending' }), learningEvidence: evidence });
    expect(pending.review).toMatchObject({ status: 'pending', requestedModel: 'gpt-6-fixture', actualModel: 'gpt-6-fixture-snapshot' });
    expect(pending.behaviour).toBeNull();
  });
  it('supprime la vieille preuve GPT4o sans marqueur de revue', () => {
    expect(observe({ learningEvidence: evidence }).behaviour).toBeNull();
    expect(observe({ learningReview: { status: 'succeeded', requestedModel: 'gpt-4o' }, learningEvidence: evidence }).behaviour).toBeNull();
  });
});

describe('revue après changement de scope client (RED)', () => {
  it('reprend une revue succeeded quand le métier client a changé, même agrégée', async () => {
    const succeeded = { version: 1, status: 'succeeded', requestedModel: 'gpt-6-fixture', actualModel: 'gpt-6-fixture-snapshot',
      transcriptHash: transcriptHash(callRow('scope', {}).transcript), reviewedAt: '2026-01-01T00:00:00.000Z',
      scope: { tenant_id: '11111111-1111-4111-8111-111111111111', niche: 'dental', country: 'BE', language: 'fr' },
      businessType: 'dental', country: 'BE', agentLanguage: 'fr', aggregated: true, patterns: [] };
    findManyCalls.mockResolvedValue([callRow('scope', { learningReview: succeeded })]);
    findClient.mockResolvedValue({ businessName: 'Cabinet Test', businessType: 'restaurant', country: 'BE', agentLanguage: 'fr',
      vapiConfig: {}, businessKnowledge: [] });
    mockOpenAI({ patterns: [] });
    const sweep = await callPatternsService.run();
    expect(sweep.analysed).toBe(1);
    expect(fetch).toHaveBeenCalledOnce();
    const sql = queryRaw.mock.calls[0][0].join('?');
    expect(sql).toContain('JOIN clients c ON c.id = cc.client_id');
    expect(sql).toContain("c.business_type IS DISTINCT FROM cc.metadata->'learningReview'->>'businessType'");
  });
  it('ne rapaie pas un GPT quand seule la forme brute canonise pareil (belgique -> BE)', async () => {
    const succeeded = { version: 1, status: 'succeeded', requestedModel: 'gpt-6-fixture', actualModel: 'gpt-6-fixture-snapshot',
      transcriptHash: transcriptHash(callRow('raw', {}).transcript), reviewedAt: '2026-01-01T00:00:00.000Z',
      scope: { tenant_id: '11111111-1111-4111-8111-111111111111', niche: 'dental', country: 'BE', language: 'fr' },
      businessType: 'dental', country: 'BE', agentLanguage: 'fr', aggregated: true, patterns: [],
      behaviour: { schema_version: 1, observations: [] } };
    findManyCalls.mockResolvedValue([callRow('raw', { learningReview: succeeded })]);
    findClient.mockResolvedValue({ businessName: 'Cabinet Test', businessType: 'dental', country: 'belgique', agentLanguage: 'fr',
      vapiConfig: {}, businessKnowledge: [] });
    mockOpenAI({ patterns: [] });
    const sweep = await callPatternsService.run();
    expect(sweep.analysed).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    const patch = JSON.parse(executeRaw.mock.calls.at(-1)![1]);
    expect(patch.learningReview.country).toBe('belgique');
    expect(patch.learningReview.status).toBe('succeeded');
    expect(patch.learningReview.aggregated).toBe(true);
  });
});

describe('finalisation transactionnelle sans course (P2)', () => {
  it('un marqueur pending à zéro ligne annule la lecture sans appel GPT ni agrégation', async () => {
    findManyCalls.mockResolvedValue([callRow('stale-pending', {})]);
    executeRaw.mockResolvedValue(0);
    const sweep = await callPatternsService.run();
    expect(sweep.scanned).toBe(1);
    expect(sweep.analysed).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(findPattern).not.toHaveBeenCalled();
    expect(createPattern).not.toHaveBeenCalled();
  });
  it('une transcription changée après la revue abandonne le résultat sans agrégation ni compteur', async () => {
    findManyCalls.mockResolvedValue([callRow('stale-save', {})]);
    mockOpenAI({ patterns: [PATTERN] });
    executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const sweep = await callPatternsService.run();
    expect(sweep.analysed).toBe(0);
    expect(fetch).toHaveBeenCalledOnce();
    expect(findPattern).not.toHaveBeenCalled();
    expect(createPattern).not.toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalledTimes(2); // pending + succeeded, jamais le marqueur aggregated
  });
  it('une transcription changée avant la finalisation annule la transaction et permet une reprise sans GPT', async () => {
    const row = callRow('race-transcript', {});
    findManyCalls.mockResolvedValue([row]);
    mockOpenAI({ patterns: [] });
    lockCall.mockResolvedValue([{ transcript: 'Agent : bonjour. Appelant : autre chose.', clientId: DEFAULT_CLIENT_ID }]);
    const sweep = await callPatternsService.run();
    expect(sweep.analysed).toBe(0);
    expect(findPattern).not.toHaveBeenCalled();
    expect(createPattern).not.toHaveBeenCalled();
    // Le marqueur succeeded/aggregated=false est persisté hors transaction.
    const persisted = JSON.parse(executeRaw.mock.calls.at(-1)![1]);
    expect(persisted.learningReview).toMatchObject({ status: 'succeeded', aggregated: false });
    // Reprise : la ligne est relue, le résultat exact est réutilisé sans GPT.
    lockCall.mockResolvedValue([{ transcript: row.transcript, clientId: DEFAULT_CLIENT_ID }]);
    findManyCalls.mockResolvedValue([callRow('race-transcript', persisted)]);
    expect((await callPatternsService.run()).analysed).toBe(1);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('un scope client changé avant la finalisation annule sans agréger la source périmée', async () => {
    findManyCalls.mockResolvedValue([callRow('race-scope', {})]);
    mockOpenAI({ patterns: [PATTERN] });
    lockClient.mockResolvedValue([{ businessType: 'restaurant', country: 'BE', agentLanguage: 'fr' }]);
    const sweep = await callPatternsService.run();
    expect(sweep.analysed).toBe(0);
    expect(findPattern).not.toHaveBeenCalled();
    expect(createPattern).not.toHaveBeenCalled();
    const persisted = JSON.parse(executeRaw.mock.calls.at(-1)![1]);
    expect(persisted.learningReview).toMatchObject({ status: 'succeeded', aggregated: false });
  });
  it('un rollback de transaction ne perd pas la revue réussie et ne duplique aucune preuve en reprise', async () => {
    const row = callRow('rollback', {});
    findManyCalls.mockResolvedValue([row]);
    mockOpenAI({ patterns: [PATTERN] });
    findPattern.mockResolvedValue(null);
    createPattern.mockRejectedValueOnce(new Error('DB lower edge'));
    expect((await callPatternsService.run()).analysed).toBe(0);
    expect(fetch).toHaveBeenCalledOnce();
    expect(updatePattern).not.toHaveBeenCalled();
    const persisted = JSON.parse(executeRaw.mock.calls.at(-1)![1]);
    expect(persisted.learningReview).toMatchObject({ status: 'succeeded', aggregated: false });
    findManyCalls.mockResolvedValue([callRow('rollback', persisted)]);
    expect((await callPatternsService.run()).analysed).toBe(1);
    expect(fetch).toHaveBeenCalledOnce(); // aucun second GPT
    expect(createPattern).toHaveBeenCalledTimes(2); // 1 échec simulé + 1 succès en reprise
  });
});

describe('callPatternsService.run', () => {
  it('lit les appels sains et non jugés, ignore lus et sans transcript', async () => {
    mockOpenAI({ patterns: [] });
    findManyCalls.mockResolvedValue([
      callRow('sain', { mortem: { verdict: 'ok' } }),
      callRow('deja-lu', { mortem: MORTEM, patterns: { at: 'x', found: [] } }),
      { ...callRow('sans-transcript', { mortem: MORTEM }), transcript: '   ' },
      callRow('non-juge', {}),
    ]);
    const sweep = await callPatternsService.run();
    expect(sweep.scanned).toBe(3);
    expect(sweep.analysed).toBe(3);
    expect(findPattern).not.toHaveBeenCalled();
  });

  it('s’éteint proprement sans clé OpenAI', async () => {
    delete process.env.OPENAI_API_KEY;
    findManyCalls.mockResolvedValue([callRow('a', { mortem: MORTEM })]);
    const sweep = await callPatternsService.run();
    expect(sweep.analysed).toBe(0);
  });

  it('crée le pattern au premier passage et marque l’appel lu', async () => {
    findManyCalls.mockResolvedValue([callRow('call-1', { mortem: MORTEM })]);
    mockOpenAI({ patterns: [PATTERN] });
    findPattern.mockResolvedValue(null);

    const sweep = await callPatternsService.run();
    expect(sweep.analysed).toBe(1);
    expect(sweep.patterns).toBe(1);
    expect(createPattern).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        fingerprint: expect.stringMatching(/^conversation:dental--reservation-annoncee-avant-outil-/),
        callCount: 1,
        clientIds: ['11111111-1111-4111-8111-111111111111'],
      }),
    }));
    const written = JSON.parse(executeRaw.mock.calls.at(-1)![1]);
    expect(written.patterns.found).toEqual([expect.stringMatching(/^conversation:dental--reservation-annoncee-avant-outil-/)]);
    expect(updateCall).not.toHaveBeenCalled();
  });

  it('un appel relu ne gonfle pas le compteur', async () => {
    findManyCalls.mockResolvedValue([callRow('call-1', { mortem: MORTEM })]);
    mockOpenAI({ patterns: [PATTERN] });
    findPattern.mockResolvedValue({
      fingerprint: 'conversation:dental--reservation-annoncee-avant-outil',
      evidence: [{ callId: 'call-1', clientId: 'client-1', quote: 'x', at: 'y' }],
      callCount: 2,
      clientIds: ['client-1'],
      status: 'observing',
    });

    await callPatternsService.run();
    expect(updatePattern).not.toHaveBeenCalled();
  });

  it('signale UNE FOIS au seuil de trois appels', async () => {
    findManyCalls.mockResolvedValue([callRow('call-3', { mortem: MORTEM })]);
    mockOpenAI({ patterns: [PATTERN] });
    findPattern.mockResolvedValue({
      fingerprint: 'conversation:dental--reservation-annoncee-avant-outil',
      evidence: [
        { callId: 'call-1', clientId: 'client-1', quote: 'a', at: '1' },
        { callId: 'call-2', clientId: 'client-1', quote: 'b', at: '2' },
      ],
      callCount: 2,
      clientIds: ['client-1'],
      status: 'observing',
    });

    const sweep = await callPatternsService.run();
    expect(sweep.signalled).toBe(1);
    expect(updatePattern.mock.calls[0][0].data.status).toBe('signal');
    expect(notify).toHaveBeenCalledOnce();
    expect(notify.mock.calls[0][0]).toContain('Réservation annoncée trop tôt');
    // Aucun réseau dans la transaction : le signal part après le commit.
    expect(transaction).toHaveBeenCalled();
    expect(notify.mock.invocationCallOrder[0]).toBeGreaterThan(transaction.mock.invocationCallOrder[0]);
  });

  it('ne re-signale pas un pattern déjà signalé ou proposé', async () => {
    findManyCalls.mockResolvedValue([callRow('call-4', { mortem: MORTEM })]);
    mockOpenAI({ patterns: [PATTERN] });
    findPattern.mockResolvedValue({
      fingerprint: 'conversation:dental--reservation-annoncee-avant-outil',
      evidence: [],
      callCount: 5,
      clientIds: ['client-1'],
      status: 'proposed',
    });

    const sweep = await callPatternsService.run();
    expect(sweep.signalled).toBe(0);
    expect(updatePattern.mock.calls[0][0].data.status).toBeUndefined();
    expect(notify).not.toHaveBeenCalled();
  });

  it('une erreur OpenAI sur un appel n’arrête pas le balayage', async () => {
    findManyCalls.mockResolvedValue([callRow('call-err', { mortem: MORTEM })]);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })));
    const sweep = await callPatternsService.run();
    expect(sweep.scanned).toBe(1);
    expect(sweep.analysed).toBe(0);
    expect(updateCall).not.toHaveBeenCalled(); // pas de marqueur : il sera relu
  });
});
