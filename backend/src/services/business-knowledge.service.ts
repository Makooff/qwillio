import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { knowledgePreset } from '../config/knowledge-presets';
import { knowledgeEmbeddingsService } from './voice/knowledge-embeddings.service';
import { realtimeContextService } from './voice/realtime-context.service';

/**
 * Le chemin d'ÉCRITURE de la base de connaissance (roadmap 2.3).
 *
 * Tout le chemin de lecture existait déjà — recherche hybride, outil
 * `lookupKnowledge`, bloc de prompt — mais aucun contrôleur ne créait de
 * ligne `BusinessKnowledge`: `hasKnowledgeBase` restait faux et l'étage RAG
 * entier était mort. Ce service est la moitié manquante.
 *
 * Deux règles héritées du CLAUDE.md:
 *  - les présets par métier viennent de `knowledge-presets.ts`, indexés sur
 *    `NicheId` — jamais une seconde liste de niches qui divergerait;
 *  - chaque écriture invalide le cache de profil (sinon `hasKnowledgeBase`
 *    reste faux jusqu'au TTL et l'agent ignore la base qu'on vient de remplir)
 *    et déclenche la génération d'embeddings hors du chemin d'appel.
 */

export const KNOWLEDGE_KINDS = ['faq', 'staff', 'rule'] as const;
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];

/** Au-delà, le retrieval in-process cesse d'être « microseconds » — et une
 * base de 500 entrées est un signe que le client colle un site entier. */
export const MAX_ENTRIES_PER_CLIENT = 500;
const MAX_TITLE_CHARS = 300;
const MAX_CONTENT_CHARS = 4000;
const MAX_KEYWORDS = 12;
const MAX_KEYWORD_CHARS = 60;

export interface KnowledgeInput {
  kind: string;
  title: string;
  content: string;
  keywords?: unknown;
  priority?: unknown;
  isActive?: unknown;
}

export interface ValidationError {
  error: string;
}

type Validated = {
  kind: KnowledgeKind;
  title: string;
  content: string;
  keywords: string[];
  priority: number;
  isActive: boolean;
};

export function validateKnowledgeInput(input: KnowledgeInput): Validated | ValidationError {
  const kind = String(input.kind || '').trim() as KnowledgeKind;
  if (!KNOWLEDGE_KINDS.includes(kind)) {
    return { error: `kind must be one of: ${KNOWLEDGE_KINDS.join(', ')}` };
  }

  const title = String(input.title || '').trim();
  if (!title) return { error: 'title is required' };
  if (title.length > MAX_TITLE_CHARS) return { error: `title must be at most ${MAX_TITLE_CHARS} characters` };

  const content = String(input.content || '').trim();
  if (!content) return { error: 'content is required' };
  if (content.length > MAX_CONTENT_CHARS) return { error: `content must be at most ${MAX_CONTENT_CHARS} characters` };

  const keywords = Array.isArray(input.keywords)
    ? input.keywords
        .map(k => String(k).trim())
        .filter(Boolean)
        .slice(0, MAX_KEYWORDS)
        .map(k => k.slice(0, MAX_KEYWORD_CHARS))
    : [];

  const priority =
    typeof input.priority === 'number' && Number.isFinite(input.priority)
      ? Math.max(-100, Math.min(100, Math.round(input.priority)))
      : 0;

  const isActive = input.isActive === undefined ? true : input.isActive === true;

  return { kind, title, content, keywords, priority, isActive };
}

class BusinessKnowledgeService {
  async list(clientId: string) {
    return prisma.businessKnowledge.findMany({
      where: { clientId },
      orderBy: [{ kind: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true, kind: true, title: true, content: true, keywords: true,
        priority: true, isActive: true, createdAt: true, updatedAt: true,
      },
    });
  }

  async create(clientId: string, input: KnowledgeInput) {
    const validated = validateKnowledgeInput(input);
    if ('error' in validated) return validated;

    const count = await prisma.businessKnowledge.count({ where: { clientId } });
    if (count >= MAX_ENTRIES_PER_CLIENT) {
      return { error: `knowledge base is full (${MAX_ENTRIES_PER_CLIENT} entries max)` };
    }

    const entry = await prisma.businessKnowledge.create({
      data: { clientId, ...validated },
      select: { id: true, kind: true, title: true, content: true, keywords: true, priority: true, isActive: true },
    });
    this.afterWrite(clientId);
    return entry;
  }

  async update(clientId: string, id: string, input: KnowledgeInput) {
    // Scopé clientId dans le WHERE: un id deviné d'un autre tenant ne matche
    // rien, il n'y a pas de chemin « trouvé mais interdit » à gérer.
    const existing = await prisma.businessKnowledge.findFirst({ where: { id, clientId }, select: { id: true } });
    if (!existing) return { error: 'not_found' };

    const validated = validateKnowledgeInput(input);
    if ('error' in validated) return validated;

    const entry = await prisma.businessKnowledge.update({
      where: { id },
      // Le contenu change ⇒ le vecteur existant décrit l'ancien texte.
      data: { ...validated, embedding: [], embeddingModel: null },
      select: { id: true, kind: true, title: true, content: true, keywords: true, priority: true, isActive: true },
    });
    this.afterWrite(clientId);
    return entry;
  }

  async remove(clientId: string, id: string) {
    const deleted = await prisma.businessKnowledge.deleteMany({ where: { id, clientId } });
    if (deleted.count === 0) return { error: 'not_found' };
    this.afterWrite(clientId);
    return { success: true };
  }

  /**
   * Amorce la base depuis le préset du métier: la FAQ déjà rédigée que le
   * client corrige au lieu d'écrire. Idempotent par titre — réimporter ne
   * duplique pas, et n'écrase jamais une entrée que le client a retouchée.
   */
  async importPreset(clientId: string, businessType: string | null | undefined) {
    const preset = knowledgePreset(businessType);
    if (!preset.faq.length) return { imported: 0 };

    const existing = await prisma.businessKnowledge.findMany({
      where: { clientId, kind: 'faq' },
      select: { title: true },
    });
    const known = new Set(existing.map(e => e.title.trim().toLowerCase()));

    const fresh = preset.faq.filter(f => !known.has(f.q.trim().toLowerCase()));
    if (!fresh.length) return { imported: 0 };

    await prisma.businessKnowledge.createMany({
      data: fresh.map(f => ({
        clientId,
        kind: 'faq',
        title: f.q.slice(0, MAX_TITLE_CHARS),
        content: f.a.slice(0, MAX_CONTENT_CHARS),
      })),
    });
    this.afterWrite(clientId);
    return { imported: fresh.length };
  }

  /**
   * Après toute écriture, hors du chemin de la réponse HTTP:
   *  - le cache de profil tombe, pour que `hasKnowledgeBase` (et donc l'outil
   *    `lookupKnowledge` et le bloc de prompt) reflète la base dès le prochain
   *    appel;
   *  - les embeddings manquants se génèrent, pour que la recherche sémantique
   *    couvre la nouvelle entrée sans attendre un cron.
   */
  private afterWrite(clientId: string): void {
    void realtimeContextService
      .invalidateClient(clientId)
      .catch(err => logger.debug(`[Knowledge] cache invalidation failed for ${clientId}: ${(err as Error).message}`));
    void knowledgeEmbeddingsService
      .generateMissing(clientId)
      .catch(err => logger.debug(`[Knowledge] embedding generation failed for ${clientId}: ${(err as Error).message}`));
  }
}

export const businessKnowledgeService = new BusinessKnowledgeService();
