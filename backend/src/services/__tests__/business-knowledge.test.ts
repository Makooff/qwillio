import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le chemin d'écriture de la base de connaissance (roadmap 2.3).
 *
 * Deux contrats: (1) une écriture rend la base visible de l'agent au prochain
 * appel — invalidation du cache de profil + embeddings relancés; (2) l'import
 * de préset amorce sans jamais dupliquer ni écraser ce que le client a écrit.
 */
const {
  bkFindMany, bkFindFirst, bkCount, bkCreate, bkCreateMany, bkUpdate, bkDeleteMany,
  invalidateClient, generateMissing,
} = vi.hoisted(() => ({
  bkFindMany: vi.fn(), bkFindFirst: vi.fn(), bkCount: vi.fn(), bkCreate: vi.fn(),
  bkCreateMany: vi.fn(), bkUpdate: vi.fn(), bkDeleteMany: vi.fn(),
  invalidateClient: vi.fn().mockResolvedValue(undefined),
  generateMissing: vi.fn().mockResolvedValue(0),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    businessKnowledge: {
      findMany: bkFindMany, findFirst: bkFindFirst, count: bkCount,
      create: bkCreate, createMany: bkCreateMany, update: bkUpdate, deleteMany: bkDeleteMany,
    },
  },
}));
vi.mock('../voice/realtime-context.service', () => ({ realtimeContextService: { invalidateClient } }));
vi.mock('../voice/knowledge-embeddings.service', () => ({ knowledgeEmbeddingsService: { generateMissing } }));

import { businessKnowledgeService, validateKnowledgeInput, MAX_ENTRIES_PER_CLIENT } from '../business-knowledge.service';

const flushAsync = () => new Promise(resolve => setImmediate(resolve));

describe('validateKnowledgeInput', () => {
  it('borne le kind aux trois valeurs que le retrieval connaît', () => {
    expect(validateKnowledgeInput({ kind: 'faq', title: 'Q', content: 'A' })).not.toHaveProperty('error');
    expect(validateKnowledgeInput({ kind: 'blog', title: 'Q', content: 'A' })).toHaveProperty('error');
  });

  it('exige titre et contenu, borne longueurs, mots-clés et priorité', () => {
    expect(validateKnowledgeInput({ kind: 'faq', title: '', content: 'A' })).toHaveProperty('error');
    expect(validateKnowledgeInput({ kind: 'faq', title: 'Q', content: '' })).toHaveProperty('error');
    const ok = validateKnowledgeInput({
      kind: 'rule',
      title: 'T',
      content: 'C',
      keywords: Array.from({ length: 30 }, (_, i) => `k${i}`),
      priority: 9999,
    });
    if ('error' in ok) throw new Error('should validate');
    expect(ok.keywords).toHaveLength(12);
    expect(ok.priority).toBe(100);
  });
});

describe('create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crée, puis invalide le cache de profil et relance les embeddings', async () => {
    bkCount.mockResolvedValue(0);
    bkCreate.mockResolvedValue({ id: 'k1', kind: 'faq', title: 'Q', content: 'A', keywords: [], priority: 0, isActive: true });

    const result = await businessKnowledgeService.create('c1', { kind: 'faq', title: 'Q', content: 'A' });
    await flushAsync();

    expect(result).toHaveProperty('id', 'k1');
    // Sans l'invalidation, hasKnowledgeBase reste faux jusqu'au TTL et l'agent
    // ignore la base qu'on vient de remplir.
    expect(invalidateClient).toHaveBeenCalledWith('c1');
    expect(generateMissing).toHaveBeenCalledWith('c1');
  });

  it('refuse au-delà du plafond d\'entrées', async () => {
    bkCount.mockResolvedValue(MAX_ENTRIES_PER_CLIENT);
    const result = await businessKnowledgeService.create('c1', { kind: 'faq', title: 'Q', content: 'A' });
    expect(result).toHaveProperty('error');
    expect(bkCreate).not.toHaveBeenCalled();
  });
});

describe('update / remove — scopés tenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('un id d\'un autre client répond not_found, jamais « interdit »', async () => {
    bkFindFirst.mockResolvedValue(null);
    const result = await businessKnowledgeService.update('c1', 'k-autre-tenant', { kind: 'faq', title: 'Q', content: 'A' });
    expect(result).toEqual({ error: 'not_found' });
    expect(bkUpdate).not.toHaveBeenCalled();
  });

  it('une mise à jour vide le vecteur: il décrit l\'ancien texte', async () => {
    bkFindFirst.mockResolvedValue({ id: 'k1' });
    bkUpdate.mockResolvedValue({ id: 'k1', kind: 'faq', title: 'Q2', content: 'A2', keywords: [], priority: 0, isActive: true });
    await businessKnowledgeService.update('c1', 'k1', { kind: 'faq', title: 'Q2', content: 'A2' });
    expect(bkUpdate.mock.calls[0][0].data).toMatchObject({ embedding: [], embeddingModel: null });
  });

  it('remove passe par deleteMany scopé clientId', async () => {
    bkDeleteMany.mockResolvedValue({ count: 1 });
    const result = await businessKnowledgeService.remove('c1', 'k1');
    expect(result).toEqual({ success: true });
    expect(bkDeleteMany).toHaveBeenCalledWith({ where: { id: 'k1', clientId: 'c1' } });
  });
});

describe('importPreset', () => {
  beforeEach(() => vi.clearAllMocks());

  it('amorce la FAQ du métier sans dupliquer les titres existants', async () => {
    // Le préset restaurant existe réellement dans knowledge-presets.ts.
    bkFindMany.mockImplementation(async (args: { where?: { kind?: string } }) => {
      if (args?.where?.kind === 'faq') return [];
      return [];
    });
    bkCreateMany.mockResolvedValue({ count: 5 });

    const first = await businessKnowledgeService.importPreset('c1', 'restaurant');
    expect(first.imported).toBeGreaterThan(0);
    const created = bkCreateMany.mock.calls[0][0].data as Array<{ title: string; kind: string }>;
    expect(created.every(e => e.kind === 'faq')).toBe(true);

    // Réimport: toutes les questions existent déjà → zéro écriture.
    vi.clearAllMocks();
    bkFindMany.mockResolvedValue(created.map(e => ({ title: e.title })));
    const second = await businessKnowledgeService.importPreset('c1', 'restaurant');
    expect(second.imported).toBe(0);
    expect(bkCreateMany).not.toHaveBeenCalled();
  });
});
