import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le balayage d'agrégation : idempotence du marqueur, compteur qui ne gonfle
 * pas sur un appel relu, signal UNE FOIS au seuil, et le silence quand la clé
 * OpenAI manque. Le réseau est mocké à `fetch`, la base à `prisma`.
 */

const { findManyCalls, updateCall, queryRaw, executeRaw, findClient, listClients, listPatterns, findPattern, createPattern, updatePattern, notify } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
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

vi.mock('../../../config/database', () => ({
  prisma: {
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    client: { findUnique: findClient, findMany: listClients },
    clientCall: { findMany: findManyCalls, update: updateCall },
    learningPattern: { findUnique: findPattern, findMany: listPatterns, create: createPattern, update: updatePattern },
  },
}));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../discord.service', () => ({ discordService: { notify } }));
// Contrat du parent seulement : aucun fichier métier de remplacement n'est créé.
vi.mock('../../../config/receptionist-industry-rules', () => ({
  resolveReceptionistNiche: (type?: string | null) => type === 'restaurant' ? 'restaurant' : type === 'dental' ? 'dental' : 'default',
  industryRulesForReview: (type?: string | null) => ({ niche: type === 'restaurant' ? 'restaurant' : 'dental',
    rules: type === 'restaurant' ? ['Confirmer la réservation de table'] : ['Ne pas diagnostiquer'],
    requiredBusinessFacts: ['horaires déclarés'], sources: ['référence de revue'] }),
  scopedFingerprint: (p: { kind: string; slug: string }, niche: string) => `${p.kind}:${niche}--${p.slug}`,
  learningScopeFromFingerprint: (fingerprint: string) => {
    const slug = fingerprint.slice(fingerprint.indexOf(':') + 1);
    const scoped = slug.includes('--');
    return { niche: scoped ? slug.split('--')[0] : null, slug: scoped ? slug.split('--')[1] : slug, scoped };
  },
}));

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
  return { id, clientId: 'client-1', transcript: 'Agent : bonjour. Appelant : je veux un rendez-vous. Agent : c’est réservé.', metadata };
}

function mockOpenAI(payload: any) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
  })));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = 'sk-test';
  updateCall.mockResolvedValue({});
  updatePattern.mockResolvedValue({});
  queryRaw.mockImplementation(() => findManyCalls());
  executeRaw.mockResolvedValue(1);
  findClient.mockResolvedValue({ businessName: 'Cabinet Test', businessType: 'dental', country: 'BE',
    vapiConfig: { knowledge: { parking: 'cour intérieure' } }, businessKnowledge: [] });
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
    expect(executeRaw).toHaveBeenCalledTimes(2);
    const sql = queryRaw.mock.calls[0][0].join('?');
    expect(sql).toContain("COALESCE(metadata, '{}'::jsonb) ? 'patterns'");
    expect(sql).toContain("status = 'completed'");
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
        expect(executeRaw).not.toHaveBeenCalled();
        expect(createPattern).not.toHaveBeenCalled();
      });
    });
  it('écrit le marker atomiquement sans réécrire le snapshot metadata', async () => {
    findManyCalls.mockResolvedValue([callRow('atomic', { mortem: MORTEM })]);
    mockOpenAI({ patterns: [] });
    await callPatternsService.run();
    const sql = executeRaw.mock.calls[0][0].join('?');
    expect(sql).toContain('jsonb_set');
    expect(sql).toContain('metadata');
    expect(updateCall).not.toHaveBeenCalled();
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
    expect(sweep.scanned).toBe(2);
    expect(sweep.analysed).toBe(2);
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
        fingerprint: 'conversation:dental--reservation-annoncee-avant-outil',
        callCount: 1,
        clientIds: ['client-1'],
      }),
    }));
    const written = JSON.parse(executeRaw.mock.calls[0][1]);
    expect(written.found).toEqual(['conversation:dental--reservation-annoncee-avant-outil']);
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
