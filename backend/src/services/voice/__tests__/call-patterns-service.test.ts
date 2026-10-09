import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le balayage d'agrégation : idempotence du marqueur, compteur qui ne gonfle
 * pas sur un appel relu, signal UNE FOIS au seuil, et le silence quand la clé
 * OpenAI manque. Le réseau est mocké à `fetch`, la base à `prisma`.
 */

const { findManyCalls, updateCall, findPattern, createPattern, updatePattern, notify } = vi.hoisted(() => ({
  findManyCalls: vi.fn(),
  updateCall: vi.fn(),
  findPattern: vi.fn(),
  createPattern: vi.fn(),
  updatePattern: vi.fn(),
  notify: vi.fn(async () => {}),
}));

vi.mock('../../../config/database', () => ({
  prisma: {
    clientCall: { findMany: findManyCalls, update: updateCall },
    learningPattern: { findUnique: findPattern, create: createPattern, update: updatePattern },
  },
}));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../discord.service', () => ({ discordService: { notify } }));

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
  return { id, clientId: 'client-1', transcript: 'Agent : bonjour. Appelant : je veux un rendez-vous.', metadata };
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
});

describe('callPatternsService.run', () => {
  it('ne lit que les appels jugés perfectibles et non déjà lus', async () => {
    findManyCalls.mockResolvedValue([
      callRow('sain', { mortem: { verdict: 'ok' } }),
      callRow('deja-lu', { mortem: MORTEM, patterns: { at: 'x', found: [] } }),
      { ...callRow('sans-transcript', { mortem: MORTEM }), transcript: '   ' },
      callRow('non-juge', {}),
    ]);
    const sweep = await callPatternsService.run();
    expect(sweep.scanned).toBe(0);
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
        fingerprint: 'conversation:reservation-annoncee-avant-outil',
        callCount: 1,
        clientIds: ['client-1'],
      }),
    }));
    /* Le marqueur est une FUSION : mortem doit y survivre. */
    const written = updateCall.mock.calls[0][0].data.metadata;
    expect(written.mortem).toEqual(MORTEM);
    expect(written.patterns.found).toEqual(['conversation:reservation-annoncee-avant-outil']);
  });

  it('un appel relu ne gonfle pas le compteur', async () => {
    findManyCalls.mockResolvedValue([callRow('call-1', { mortem: MORTEM })]);
    mockOpenAI({ patterns: [PATTERN] });
    findPattern.mockResolvedValue({
      fingerprint: 'conversation:reservation-annoncee-avant-outil',
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
      fingerprint: 'conversation:reservation-annoncee-avant-outil',
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
      fingerprint: 'conversation:reservation-annoncee-avant-outil',
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
