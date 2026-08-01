import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

/**
 * Semantic search over the knowledge base (chantier 12).
 *
 * The lexical score handles a small base well and costs nothing. What it cannot
 * do is match two phrasings with no word in common — "vous avez un parking ?"
 * against an entry titled "Où se garer". Past a few dozen entries that failure
 * mode stops being rare.
 *
 * So embeddings are added, and deliberately gated:
 *
 *  - **Only above a threshold.** A client with twelve FAQ entries must not pay
 *    an embedding round-trip on a turn the caller is waiting through; the
 *    lexical score already answers those correctly.
 *  - **Always with a lexical fallback.** A failed or slow embedding returns
 *    nothing and the caller silently gets the keyword result.
 *  - **Cosine in-process.** At a few hundred entries per client this is
 *    microseconds and needs no pgvector, no index, no extension to install on
 *    a managed Neon instance.
 */

const EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
/** Tight: this sits on a turn the caller is waiting through. */
const QUERY_TIMEOUT_MS = 700;
/** Generous: generation runs off the call path. */
const GENERATE_TIMEOUT_MS = 20_000;
/** Below this cosine the match is noise; returning it would be worse than nothing. */
const MIN_SIMILARITY = 0.3;

export interface ScoredEntry {
  id: string;
  similarity: number;
}

/**
 * Cosine similarity. Inputs come from the same model so they are already
 * unit-length in practice, but the norms are computed anyway — a stored vector
 * from a previous model version would otherwise score nonsense.
 */
export function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

class KnowledgeEmbeddingsService {
  /** Whether a client's base is big enough to be worth embedding at all. */
  shouldUseEmbeddings(entryCount: number): boolean {
    return env.VOICE_EMBEDDING_ENABLED && entryCount >= env.VOICE_EMBEDDING_MIN_ENTRIES;
  }

  /**
   * Rank entries against a query. Returns an empty array on any failure, which
   * the caller reads as "use the lexical score" — never as "no results".
   */
  async rank(clientId: string, query: string): Promise<ScoredEntry[]> {
    if (!env.OPENAI_API_KEY || !query.trim()) return [];

    try {
      const rows = await prisma.businessKnowledge.findMany({
        where: { clientId, isActive: true, embeddingModel: env.VOICE_EMBEDDING_MODEL },
        select: { id: true, embedding: true },
      });
      const usable = rows.filter(r => r.embedding.length > 0);
      // Nothing generated yet: the lexical path is the whole answer today.
      if (!usable.length) return [];

      const queryVector = await this.embed([query], QUERY_TIMEOUT_MS);
      if (!queryVector.length) return [];

      return usable
        .map(r => ({ id: r.id, similarity: cosine(queryVector[0], r.embedding) }))
        .filter(s => s.similarity >= MIN_SIMILARITY)
        .sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      logger.debug(`[KnowledgeEmbeddings] rank failed for ${clientId}: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Generate the missing embeddings for a client. Off the call path: run at
   * knowledge-base edits or from a maintenance job.
   *
   * Only entries with no vector for the CURRENT model are embedded, so changing
   * `VOICE_EMBEDDING_MODEL` re-embeds the base cleanly instead of silently
   * mixing two vector spaces — which would produce confidently wrong matches.
   */
  async generateMissing(clientId: string): Promise<number> {
    if (!env.VOICE_EMBEDDING_ENABLED || !env.OPENAI_API_KEY) return 0;

    const stale = await prisma.businessKnowledge.findMany({
      where: {
        clientId,
        isActive: true,
        OR: [{ embeddingModel: null }, { embeddingModel: { not: env.VOICE_EMBEDDING_MODEL } }],
      },
      select: { id: true, title: true, content: true, keywords: true },
    });
    if (!stale.length) return 0;

    // Keywords are part of the embedded text: they are the phrasings the client
    // wrote specifically so the entry would be found.
    const inputs = stale.map(e => `${e.title}\n${e.content}\n${e.keywords.join(' ')}`.trim());

    try {
      const vectors = await this.embed(inputs, GENERATE_TIMEOUT_MS);
      if (vectors.length !== stale.length) throw new Error('embedding count mismatch');

      await Promise.all(
        stale.map((entry, i) =>
          prisma.businessKnowledge.update({
            where: { id: entry.id },
            data: { embedding: vectors[i], embeddingModel: env.VOICE_EMBEDDING_MODEL },
          })
        )
      );
      logger.info(`[KnowledgeEmbeddings] embedded ${stale.length} entr(ies) for ${clientId}`);
      return stale.length;
    } catch (error) {
      logger.warn(`[KnowledgeEmbeddings] generation failed for ${clientId}: ${(error as Error).message}`);
      return 0;
    }
  }

  private async embed(inputs: string[], timeoutMs: number): Promise<number[][]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(EMBEDDING_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: env.VOICE_EMBEDDING_MODEL, input: inputs }),
      });
      if (!response.ok) throw new Error(`OpenAI embeddings responded ${response.status}`);
      const body = (await response.json()) as { data?: Array<{ embedding: number[]; index: number }> };
      // The API may return results out of order; index is authoritative.
      const sorted = [...(body.data ?? [])].sort((a, b) => a.index - b.index);
      return sorted.map(d => d.embedding);
    } finally {
      clearTimeout(timer);
    }
  }
}

export const knowledgeEmbeddingsService = new KnowledgeEmbeddingsService();
