/**
 * Le balayage qui LIT les appels perfectibles et agrège ce qu'ils enseignent.
 *
 * Pourquoi un balayage et pas un branchement dans la fin d'appel : la même
 * raison que `call-postmortem`, dont ce service est le cadet — le chemin chaud
 * n'attend personne, et un jugement idempotent sur la ligne terminée survit à
 * un redéploiement et se rejoue. Il ne lit que les appels que le post-mortem
 * a DÉJÀ jugés (`metadata.mortem` posé, verdict ≠ ok) : analyser chaque appel
 * sain coûterait un modèle pour n'apprendre que ce que les règles savent.
 *
 * La chaîne complète de l'apprentissage :
 *
 *   post-mortem (règles) → CE service (lecture) → learning_pattern (agrégat)
 *   → signal Discord → synthétiseur local (voice-core) → PR brouillon
 *   → relecture humaine → merge. Le `prompts.py` grossit, les tests figent.
 *
 * Ce service s'arrête au signal. Aucune ligne de code n'est écrite ici, et
 * c'est voulu : le seul endroit où l'on décide ce qui touche au code reste la
 * relecture humaine, comme pour `autofix`.
 */

import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';
import { logger } from '../../config/logger';
import { discordService } from '../discord.service';
import { industryRulesForReview, resolveReceptionistNiche, scopedFingerprint } from '../../config/receptionist-industry-rules';
import { entreesDepuisVapiConfig } from './portal-knowledge.service';
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserMessage,
  parsePatterns,
  type ConversationPattern,
  type BusinessReviewContext,
} from './call-patterns';

/** Un lot borné par passage, sans expiration du backlog. */
const MAX_CALLS = 50;

/** En dessous, c'est un appel, pas un phénomène. */
const SIGNAL_MIN_CALLS = 3;

/** Preuves gardées par pattern : assez pour relire, pas assez pour déborder. */
const MAX_EVIDENCE = 10;

/** Modèle de lecture — petit, la tâche est de la classification, pas de la création. */
const MODEL = process.env.LEARNING_MODEL || 'gpt-4o-mini';

const TIMEOUT_MS = 30_000;

export interface PatternSweep {
  scanned: number;
  analysed: number;
  patterns: number;
  signalled: number;
}

interface EvidenceItem {
  callId: string;
  clientId: string;
  quote: string;
  at: string;
}

class CallPatternsService {
  private keyWarned = false;

  async run(): Promise<PatternSweep> {
    const sweep: PatternSweep = { scanned: 0, analysed: 0, patterns: 0, signalled: 0 };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      if (!this.keyWarned) {
        logger.warn('[CallPatterns] OPENAI_API_KEY absente — la lecture des transcripts est éteinte');
        this.keyWarned = true;
      }
      return sweep;
    }

    // Prisma JSON filters cannot express key absence reliably (SQL NULL, JSON
    // null and a present patterns:null are different). Parameterized SQL keeps
    // the LIMIT AFTER the pending predicate, never after filtering in JS.
    const rows = await prisma.$queryRaw<Array<{
      id: string; clientId: string; transcript: string; metadata: Prisma.JsonValue | null;
    }>>`
      SELECT id, client_id AS "clientId", transcript, metadata
      FROM client_calls
      WHERE status = 'completed' AND is_spam = false
        AND transcript IS NOT NULL AND transcript ~ '[^[:space:]]'
        AND NOT (COALESCE(metadata, '{}'::jsonb) ? 'patterns')
      ORDER BY COALESCE(ended_at, created_at) ASC, id ASC
      LIMIT ${MAX_CALLS}
    `;

    for (const row of rows) {
      const metadata = (row.metadata as Record<string, any> | null) ?? null;
      const mortem = metadata?.mortem as { verdict?: string; codes?: string[]; evidence?: string[] } | undefined;
      // Défense supplémentaire pour un résultat ancien/injecté, pas le filtre du lot.
      if (metadata && Object.prototype.hasOwnProperty.call(metadata, 'patterns')) continue;
      if (!row.transcript?.trim()) continue;

      sweep.scanned += 1;

      try {
        const business = await this.businessContext(row.clientId);
        const patterns = await this.analyse(apiKey, row.transcript, mortem ?? {}, business);
        sweep.analysed += 1;
        sweep.patterns += patterns.length;
        for (const pattern of patterns) {
          if (await this.aggregate(row.id, row.clientId, pattern, business.niche)) sweep.signalled += 1;
        }
        await this.markRead(row.id, patterns, business.niche);
      } catch (error) {
        // Modèle, JSON, preuve, lecture client ou écriture ratée : aucun marker.
        logger.warn(`[CallPatterns] lecture impossible pour ${row.id}: ${(error as Error).message}`);
      }
    }

    if (sweep.scanned) {
      logger.info(
        `[CallPatterns] ${sweep.scanned} appel(s) à lire: ${sweep.analysed} lu(s), ` +
          `${sweep.patterns} enseignement(s), ${sweep.signalled} signal(aux) nouveau(x)`,
      );
    }
    return sweep;
  }

  private async businessContext(clientId: string): Promise<BusinessReviewContext> {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        businessName: true, businessType: true, country: true, vapiConfig: true,
        businessKnowledge: { where: { isActive: true }, orderBy: [{ priority: 'desc' }, { id: 'asc' }],
          take: 20, select: { title: true, content: true } },
      },
    });
    if (!client) throw new Error('Client authentique introuvable');
    const review = industryRulesForReview(client.businessType);
    return {
      ...review,
      niche: resolveReceptionistNiche(client.businessType),
      businessName: client.businessName, country: client.country,
      knowledge: [
        ...entreesDepuisVapiConfig(client.vapiConfig as Record<string, unknown> | null, client.businessType)
          .map(entry => `${entry.title}: ${entry.content}`),
        ...client.businessKnowledge.map(entry => `${entry.title}: ${entry.content}`),
      ],
    };
  }

  /** L'appel au modèle hors du chemin audio. */
  private async analyse(
    apiKey: string,
    transcript: string,
    mortem: { verdict?: string; codes?: string[]; evidence?: string[] },
    business: BusinessReviewContext,
  ): Promise<ConversationPattern[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
            {
              role: 'user',
              content: buildAnalysisUserMessage({
                transcript,
                verdict: mortem.verdict ?? 'non jugé',
                codes: mortem.codes ?? [],
                evidence: mortem.evidence ?? [],
                business,
              }),
            },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });
      const data = (await response.json()) as any;
      if (!response.ok) throw new Error(`OpenAI ${response.status}`);
      return parsePatterns(data.choices?.[0]?.message?.content ?? '', transcript);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * L'agrégation par empreinte. Rend vrai UNE FOIS, au passage du seuil :
   * c'est ce qui fait qu'un signal est un événement et pas un rappel
   * toutes les cinq minutes.
   */
  private async aggregate(callId: string, clientId: string, pattern: ConversationPattern, niche: string): Promise<boolean> {
    const fingerprint = scopedFingerprint(pattern, niche);
    const item: EvidenceItem = { callId, clientId, quote: pattern.quote, at: new Date().toISOString() };

    const existing = await prisma.learningPattern.findUnique({ where: { fingerprint } });

    if (!existing) {
      await prisma.learningPattern.create({
        data: {
          fingerprint,
          kind: pattern.kind,
          title: pattern.title,
          summary: pattern.summary,
          evidence: [item] as unknown as Prisma.InputJsonArray,
          callCount: 1,
          clientIds: [clientId],
        },
      });
      return SIGNAL_MIN_CALLS <= 1; // jamais en l'état, écrit pour le jour où le seuil bouge
    }

    /* Le même appel relu (marqueur perdu, rejoue manuelle) ne doit pas gonfler
       le compteur : la preuve existe déjà, on s'arrête là. */
    const evidence = (Array.isArray(existing.evidence) ? existing.evidence : []) as unknown as EvidenceItem[];
    if (evidence.some(e => e.callId === callId)) return false;

    const callCount = existing.callCount + 1;
    const clientIds = existing.clientIds.includes(clientId)
      ? existing.clientIds
      : [...existing.clientIds, clientId];

    const crossed = existing.status === 'observing' && callCount >= SIGNAL_MIN_CALLS;
    await prisma.learningPattern.update({
      where: { fingerprint },
      data: {
        evidence: [...evidence, item].slice(-MAX_EVIDENCE) as unknown as Prisma.InputJsonArray,
        callCount,
        clientIds,
        lastSeenAt: new Date(),
        ...(crossed ? { status: 'signal' } : {}),
      },
    });

    if (crossed) {
      await discordService
        .notify(
          `🧠 PATTERN APPRIS — ${pattern.title}\n` +
            `${pattern.summary}\n\n` +
            `Vu sur ${callCount} appels (${clientIds.length} client(s)). ` +
            `Extrait le plus récent :\n« ${item.quote} »\n\n` +
            (pattern.kind === 'conversation'
              ? `Conversation (${niche}) : proposition de règle de cette niche en PR brouillon, relecture humaine obligatoire.`
              : pattern.kind === 'knowledge'
                ? `Connaissance client (${niche}) : compléter la base des clients concernés (${clientIds.join(', ')}), jamais une règle globale ni un fait partagé.`
                : `Seuil (${niche}) : réglage chiffré proposé, relecture manuelle, pas de règle automatique.`),
          'alerts',
        )
        .catch(error => logger.warn(`[CallPatterns] signal non envoyé: ${(error as Error).message}`));
    }
    return crossed;
  }

  /** Ne touche que patterns sur la valeur EN BASE, jamais sur le snapshot lu. */
  private async markRead(id: string, patterns: ConversationPattern[], niche: string): Promise<void> {
    const marker = JSON.stringify({
      at: new Date().toISOString(), found: patterns.map(p => scopedFingerprint(p, niche)),
    });
    await prisma.$executeRaw`
      UPDATE client_calls
      SET metadata = jsonb_set(
        CASE WHEN jsonb_typeof(metadata) = 'object' THEN metadata ELSE '{}'::jsonb END,
        '{patterns}', ${marker}::jsonb, true
      )
      WHERE id = ${id}::uuid AND NOT (COALESCE(metadata, '{}'::jsonb) ? 'patterns')
    `;
  }
}

export const callPatternsService = new CallPatternsService();
