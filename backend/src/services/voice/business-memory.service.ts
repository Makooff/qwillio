import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { normalizeUtterance } from './intent-router';
import { knowledgeEmbeddingsService } from './knowledge-embeddings.service';
import type { VoiceLanguage } from './speech-plans';

/**
 * Business knowledge the receptionist answers from: FAQ, staff, house rules.
 *
 * Two consumers, two shapes, and the distinction matters:
 *
 *  - `promptBlock()` — the high-priority entries baked into the system prompt at
 *    `call-start`. Bounded hard, because this text is replayed on every model
 *    turn of the call.
 *  - `search()` — the rest, reachable on demand through the `lookupKnowledge`
 *    tool. This is how a client can hold 200 FAQ entries without paying for 200
 *    entries of prompt on every turn.
 */

export interface KnowledgeEntry {
  id: string;
  kind: string;
  title: string;
  content: string;
  keywords: string[];
  priority: number;
}

/** Entries baked into the prompt. Past this, use the lookup tool. */
const PROMPT_ENTRY_LIMIT = 8;
const PROMPT_CONTENT_CHARS = 220;
const SEARCH_RESULT_LIMIT = 3;

function clamp(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

class BusinessMemoryService {
  /** Active entries for a client, highest priority first. */
  async all(clientId: string): Promise<KnowledgeEntry[]> {
    try {
      return await prisma.businessKnowledge.findMany({
        where: { clientId, isActive: true },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, kind: true, title: true, content: true, keywords: true, priority: true },
      });
    } catch (error) {
      logger.warn(`[BusinessMemory] read failed for ${clientId}: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * The block injected into the system prompt. Rules come first: a rule the
   * agent breaks is worse than a FAQ it cannot recite, so if the budget forces
   * a trim, the FAQ is what goes.
   */
  promptBlock(entries: KnowledgeEntry[], lang: VoiceLanguage): string {
    if (!entries.length) return '';

    const order = { rule: 0, staff: 1, faq: 2 } as Record<string, number>;
    const ranked = [...entries]
      .sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || b.priority - a.priority)
      .slice(0, PROMPT_ENTRY_LIMIT);

    const lines: string[] = [];
    const rules = ranked.filter(e => e.kind === 'rule');
    const staff = ranked.filter(e => e.kind === 'staff');
    const faq = ranked.filter(e => e.kind === 'faq');

    if (rules.length) {
      lines.push(lang === 'fr' ? 'RÈGLES DE LA MAISON (à respecter):' : 'HOUSE RULES (must follow):');
      rules.forEach(r => lines.push(`- ${r.title}: ${clamp(r.content, PROMPT_CONTENT_CHARS)}`));
    }
    if (staff.length) {
      lines.push(lang === 'fr' ? 'ÉQUIPE:' : 'STAFF:');
      staff.forEach(s => lines.push(`- ${s.title}: ${clamp(s.content, PROMPT_CONTENT_CHARS)}`));
    }
    if (faq.length) {
      lines.push(lang === 'fr' ? 'QUESTIONS FRÉQUENTES:' : 'FAQ:');
      faq.forEach(f => lines.push(`- ${f.title} → ${clamp(f.content, PROMPT_CONTENT_CHARS)}`));
    }

    return lines.join('\n');
  }

  /**
   * Search the knowledge base for the on-demand tool.
   *
   * Two layers, in this order:
   *
   *  - **Semantic**, but only once the base is large enough to justify an
   *    embedding round-trip on a turn the caller is waiting through. It is what
   *    matches "vous avez un parking ?" against an entry titled "Où se garer" —
   *    the case the lexical score cannot reach, since they share no word.
   *  - **Lexical** token overlap, which answers a small base accurately and for
   *    free, and which also catches every failure of the layer above.
   *
   * The lexical pass is a fallback rather than an else branch on purpose: an
   * empty semantic result means "unavailable", never "nothing matched".
   */
  async search(clientId: string, query: string): Promise<KnowledgeEntry[]> {
    const normalised = normalizeUtterance(query);
    if (!normalised) return [];
    const queryTokens = new Set(normalised.split(' ').filter(t => t.length > 2));
    if (!queryTokens.size) return [];

    const entries = await this.all(clientId);
    if (!entries.length) return [];

    // Semantic first, but only on a base big enough to justify the round-trip.
    // An empty result means "unavailable", never "nothing matched" — the
    // lexical score below is the answer in both the small-base and failure
    // cases, which is why it is not an else branch but a fallback.
    if (knowledgeEmbeddingsService.shouldUseEmbeddings(entries.length)) {
      const ranked = await knowledgeEmbeddingsService.rank(clientId, query);
      if (ranked.length) {
        const byId = new Map(entries.map(e => [e.id, e]));
        const hits = ranked
          .map(r => byId.get(r.id))
          .filter((e): e is KnowledgeEntry => Boolean(e))
          .slice(0, SEARCH_RESULT_LIMIT);
        if (hits.length) return hits;
      }
    }

    const scored = entries
      .map(entry => ({ entry, score: this.score(entry, queryTokens) }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score || b.entry.priority - a.entry.priority);

    return scored.slice(0, SEARCH_RESULT_LIMIT).map(s => s.entry);
  }

  /**
   * Explicit keywords are worth more than incidental title or body matches:
   * they are what the client wrote specifically so this entry would be found.
   */
  private score(entry: KnowledgeEntry, queryTokens: Set<string>): number {
    const keywordTokens = new Set(entry.keywords.flatMap(k => normalizeUtterance(k).split(' ')));
    const titleTokens = new Set(normalizeUtterance(entry.title).split(' '));
    const bodyTokens = new Set(normalizeUtterance(entry.content).split(' '));

    let score = 0;
    for (const token of queryTokens) {
      if (keywordTokens.has(token)) score += 3;
      else if (titleTokens.has(token)) score += 2;
      else if (bodyTokens.has(token)) score += 1;
    }
    return score;
  }

  /** Formatted for the model to read out. Short: it re-enters context. */
  formatForSpeech(entries: KnowledgeEntry[], lang: VoiceLanguage): string {
    if (!entries.length) {
      return lang === 'fr'
        ? 'AUCUNE INFO. Dis que tu vas faire remonter la question et propose de prendre les coordonnees.'
        : 'NO INFO. Say you will pass the question on and offer to take their details.';
    }
    const body = entries.map(e => `${e.title}: ${clamp(e.content, PROMPT_CONTENT_CHARS)}`).join(' | ');
    return lang === 'fr' ? `INFO: ${body}. Reponds avec tes mots.` : `INFO: ${body}. Answer in your own words.`;
  }
}

export const businessMemoryService = new BusinessMemoryService();
