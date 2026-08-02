import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
const update = vi.fn();
vi.mock('../../../config/database', () => ({
  prisma: {
    businessKnowledge: {
      findMany: (...a: unknown[]) => findMany(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

const envState = vi.hoisted(() => ({
  OPENAI_API_KEY: 'key',
  VOICE_EMBEDDING_ENABLED: true,
  VOICE_EMBEDDING_MIN_ENTRIES: 25,
  VOICE_EMBEDDING_MODEL: 'text-embedding-3-small',
}));
vi.mock('../../../config/env', () => ({ env: envState }));

const { knowledgeEmbeddingsService, cosine } = await import('../knowledge-embeddings.service');

describe('cosine', () => {
  it('is 1 for identical vectors and 0 for orthogonal ones', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('is 0 rather than NaN for a zero or mismatched vector', () => {
    // A stored vector from a previous model version must score nothing, not
    // crash the lookup.
    expect(cosine([0, 0], [1, 1])).toBe(0);
    expect(cosine([1, 2, 3], [1, 2])).toBe(0);
    expect(cosine([], [])).toBe(0);
  });
});

describe('shouldUseEmbeddings — the gate', () => {
  beforeEach(() => {
    envState.VOICE_EMBEDDING_ENABLED = true;
    envState.VOICE_EMBEDDING_MIN_ENTRIES = 25;
  });

  it('stays off for a small base — the lexical score already answers those', () => {
    expect(knowledgeEmbeddingsService.shouldUseEmbeddings(12)).toBe(false);
  });

  it('engages once the base is large enough to justify the round-trip', () => {
    expect(knowledgeEmbeddingsService.shouldUseEmbeddings(25)).toBe(true);
  });

  it('respects the global kill switch', () => {
    envState.VOICE_EMBEDDING_ENABLED = false;
    expect(knowledgeEmbeddingsService.shouldUseEmbeddings(500)).toBe(false);
  });
});

describe('rank', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    envState.OPENAI_API_KEY = 'key';
  });

  function mockEmbedding(vector: number[]) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: vector, index: 0 }] }),
    } as unknown as Response);
  }

  it('ranks by similarity, best first', async () => {
    findMany.mockResolvedValue([
      { id: 'far', embedding: [0, 1] },
      { id: 'near', embedding: [1, 0] },
    ]);
    mockEmbedding([1, 0]);
    const ranked = await knowledgeEmbeddingsService.rank('client_1', 'parking?');
    expect(ranked[0].id).toBe('near');
  });

  it('drops matches below the noise floor', async () => {
    findMany.mockResolvedValue([{ id: 'noise', embedding: [0, 1] }]);
    mockEmbedding([1, 0]);
    // Returning a 0-similarity entry would be worse than returning nothing.
    expect(await knowledgeEmbeddingsService.rank('client_1', 'parking?')).toEqual([]);
  });

  it('returns nothing when no entry has been embedded yet', async () => {
    findMany.mockResolvedValue([]);
    const fetchSpy = mockEmbedding([1, 0]);
    expect(await knowledgeEmbeddingsService.rank('client_1', 'parking?')).toEqual([]);
    // And does not pay for a query embedding it cannot use.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns nothing — not an error — when the embedding call fails', async () => {
    findMany.mockResolvedValue([{ id: 'a', embedding: [1, 0] }]);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    // The caller reads empty as "use the lexical score".
    expect(await knowledgeEmbeddingsService.rank('client_1', 'parking?')).toEqual([]);
  });

  it('does nothing without an OpenAI key', async () => {
    envState.OPENAI_API_KEY = '';
    expect(await knowledgeEmbeddingsService.rank('client_1', 'parking?')).toEqual([]);
  });

  it('only considers vectors from the current model', async () => {
    findMany.mockResolvedValue([]);
    await knowledgeEmbeddingsService.rank('client_1', 'parking?');
    expect(findMany.mock.calls[0][0].where.embeddingModel).toBe('text-embedding-3-small');
  });
});

describe('generateMissing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    envState.OPENAI_API_KEY = 'key';
    envState.VOICE_EMBEDDING_ENABLED = true;
    update.mockResolvedValue({});
  });

  it('embeds only entries missing a vector for the current model', async () => {
    findMany.mockResolvedValue([{ id: 'a', title: 'Parking', content: 'Free', keywords: ['car'] }]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2], index: 0 }] }),
    } as unknown as Response);

    expect(await knowledgeEmbeddingsService.generateMissing('client_1')).toBe(1);
    expect(update.mock.calls[0][0].data.embeddingModel).toBe('text-embedding-3-small');
  });

  it('reorders results by index — the API may answer out of order', async () => {
    findMany.mockResolvedValue([
      { id: 'a', title: 'A', content: 'a', keywords: [] },
      { id: 'b', title: 'B', content: 'b', keywords: [] },
    ]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [2], index: 1 }, { embedding: [1], index: 0 }] }),
    } as unknown as Response);

    await knowledgeEmbeddingsService.generateMissing('client_1');
    expect(update.mock.calls.find(c => c[0].where.id === 'a')![0].data.embedding).toEqual([1]);
    expect(update.mock.calls.find(c => c[0].where.id === 'b')![0].data.embedding).toEqual([2]);
  });

  it('writes nothing when the count comes back wrong', async () => {
    findMany.mockResolvedValue([
      { id: 'a', title: 'A', content: 'a', keywords: [] },
      { id: 'b', title: 'B', content: 'b', keywords: [] },
    ]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [1], index: 0 }] }),
    } as unknown as Response);

    // Writing a mismatched set would attach one entry's vector to another.
    expect(await knowledgeEmbeddingsService.generateMissing('client_1')).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns zero instead of throwing when the API errors', async () => {
    findMany.mockResolvedValue([{ id: 'a', title: 'A', content: 'a', keywords: [] }]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 429 } as unknown as Response);
    expect(await knowledgeEmbeddingsService.generateMissing('client_1')).toBe(0);
  });
});
