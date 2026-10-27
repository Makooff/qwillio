/** Revue durable de tous les appels entrants terminés non spam, hors chemin audio. */

import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';
import { logger } from '../../config/logger';
import { discordService } from '../discord.service';
import { industryRulesForReview, resolveReceptionistNiche, scopedFingerprint } from '../../config/receptionist-industry-rules';
import { entreesDepuisVapiConfig } from './portal-knowledge.service';
import { reviewCall, reviewModel, transcriptHash, REVIEW_VERSION } from './call-review';
import { evidenceForAnalysis, verifiedScope, type LearningScope } from './learning-evidence';
import { servedModelAllowed } from './review-model-policy';
import { canonicalCountry, canonicalNiche } from './learning-observations.service';
import { createHash } from 'node:crypto';
import {
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

/** Version de politique de revue — incrémenter pour relire tout le stock. */
const MODEL_POLICY_VERSION = REVIEW_VERSION;

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

/** La source a changé entre la sélection/validation et la persistance : on
 * abandonne le résultat périmé sans agréger, le balayage reprendra la ligne. */
class StaleReviewSourceError extends Error {
  constructor(message: string) { super(message); this.name = 'StaleReviewSourceError'; }
}

type SignalNotification = () => Promise<void>;

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

    let model: string;
    try { model = reviewModel(); }
    catch { logger.warn('[CallPatterns] Modèle explicite requis, backlog conservé'); return sweep; }
    const rows = await prisma.$queryRaw<Array<{
      id: string; clientId: string; transcript: string; metadata: Prisma.JsonValue | null;
    }>>`
      SELECT cc.id, cc.client_id AS "clientId", cc.transcript, cc.metadata
      FROM client_calls cc
      JOIN clients c ON c.id = cc.client_id
      WHERE cc.status IN ('completed', 'ended') AND cc.is_spam = false
        AND cc.direction = 'inbound' AND cc.ended_at IS NOT NULL
        AND cc.transcript IS NOT NULL AND cc.transcript ~ '[^[:space:]]'
        AND (cc.metadata->'learningReview'->>'status' IS DISTINCT FROM 'succeeded'
          OR cc.metadata->'learningReview'->>'version' IS DISTINCT FROM ${String(MODEL_POLICY_VERSION)}
          OR cc.metadata->'learningReview'->>'requestedModel' IS DISTINCT FROM ${model}
          OR cc.metadata->'learningReview'->>'transcriptHash' IS DISTINCT FROM md5(cc.transcript)
          OR cc.metadata->'learningReview'->>'aggregated' IS DISTINCT FROM 'true'
          OR c.business_type IS DISTINCT FROM cc.metadata->'learningReview'->>'businessType'
          OR c.country IS DISTINCT FROM cc.metadata->'learningReview'->>'country'
          OR c.agent_language IS DISTINCT FROM cc.metadata->'learningReview'->>'agentLanguage')
      ORDER BY cc.metadata->'learningReview'->>'attemptedAt' ASC NULLS FIRST,
        COALESCE(cc.ended_at, cc.created_at) ASC, cc.id ASC
      LIMIT ${MAX_CALLS}
    `;

    for (const row of rows) {
      const metadata = (row.metadata as Record<string, any> | null) ?? null;
      const mortem = metadata?.mortem as { verdict?: string; codes?: string[]; evidence?: string[] } | undefined;
      if (!row.transcript?.trim()) continue;
      sweep.scanned += 1;
      let savedReview: Record<string, any> | undefined;
      try {
        const business = await this.businessContext(row.clientId);
        const scope = { tenant_id: row.clientId, niche: canonicalNiche(business.businessType),
          country: canonicalCountry(business.country), language: business.language } as LearningScope;
        const previous = metadata?.learningReview;
        const rawScope = { businessType: business.businessType, country: business.country, agentLanguage: business.language };
        /* Revue encore valide : version, politique de modèle partagée,
           transcription et scope canonique inchangés. Le scope brut
           (businessType/country/agentLanguage) peut différer tout en
           canonisant pareil ('belgique' -> 'BE') : on réécrit alors seulement
           la source brute, sans nouveau appel GPT. */
        const current = previous?.version === REVIEW_VERSION && previous.status === 'succeeded'
          && previous.requestedModel === model && typeof previous.actualModel === 'string'
          && servedModelAllowed(previous.requestedModel, previous.actualModel)
          && previous.transcriptHash === transcriptHash(row.transcript)
          && Object.entries(scope).every(([key, value]) => previous.scope?.[key] === value);
        let patterns: ConversationPattern[];
        let evidence;
        if (current) {
          const rawCurrent = previous.businessType === rawScope.businessType
            && previous.country === rawScope.country && previous.agentLanguage === rawScope.agentLanguage;
          if (previous.aggregated === true) {
            if (!rawCurrent) await this.patchReview(row, { learningReview: { ...previous, ...rawScope } });
            continue;
          }
          patterns = parsePatterns(JSON.stringify({ patterns: previous.patterns }), row.transcript);
          evidence = evidenceForAnalysis(previous.behaviour, scope);
          if (!evidence) throw new Error('Preuve sauvegardée invalide');
          savedReview = { ...previous, ...rawScope };
        } else {
          const marked = await this.patchReview(row, { learningReview: { status: 'pending', requestedModel: model,
            version: REVIEW_VERSION, attemptedAt: new Date().toISOString(), transcriptHash: transcriptHash(row.transcript), ...rawScope } });
          if (marked === 0) {
            logger.warn(`[CallPatterns] Source périmée avant revue pour ${row.id} — reprise au prochain passage`);
            continue;
          }
          const result = await reviewCall(apiKey, row.transcript, scope, buildAnalysisUserMessage({
            transcript: '', verdict: mortem?.verdict ?? 'non jugé', codes: mortem?.codes ?? [], evidence: mortem?.evidence ?? [], business,
          }));
          patterns = result.patterns;
          evidence = result.evidence;
          savedReview = { ...result.review, ...rawScope, aggregated: false, attemptedAt: new Date().toISOString() };
          const persisted = await this.patchReview(row, { learningReview: savedReview, learningEvidence: evidence });
          if (persisted === 0) {
            logger.warn(`[CallPatterns] Transcription changée pendant la revue de ${row.id} — résultat abandonné, sans agrégation`);
            continue;
          }
        }
        /* Finalisation sous transaction : verrou et relecture de la
           transcription et du scope client autoritatifs entre la validation et
           l'écriture learningPattern, puis marqueur aggregated. Le réseau
           (Discord) reste hors transaction et est différé après le commit. */
        const pendingSignals: SignalNotification[] = [];
        const signalled = await this.finalizeReview(row, scope, business.niche, savedReview!, patterns, evidence, pendingSignals);
        for (const signal of pendingSignals) {
          await signal().catch(error => logger.warn(`[CallPatterns] signal non envoyé: ${(error as Error).message}`));
        }
        sweep.analysed += 1;
        sweep.patterns += patterns.length;
        sweep.signalled += signalled;
      } catch {
        await this.patchReview(row, { learningReview: savedReview
          ? { ...savedReview, aggregated: false, attemptedAt: new Date().toISOString() }
          : { version: REVIEW_VERSION, status: 'failed', requestedModel: model, transcriptHash: transcriptHash(row.transcript),
              attemptedAt: new Date().toISOString(), error: 'review_failed' },
        }).catch(() => logger.warn('[CallPatterns] Échec de persistance de revue'));
        logger.warn(`[CallPatterns] Revue à reprendre pour ${row.id}`);
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

  private async businessContext(clientId: string): Promise<BusinessReviewContext & { businessType: string; language: string }> {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        businessName: true, businessType: true, country: true, agentLanguage: true, vapiConfig: true,
        businessKnowledge: { where: { isActive: true }, orderBy: [{ priority: 'desc' }, { id: 'asc' }],
          take: 20, select: { title: true, content: true } },
      },
    });
    if (!client) throw new Error('Client authentique introuvable');
    const review = industryRulesForReview(client.businessType);
    return {
      ...review,
      businessType: client.businessType, language: client.agentLanguage,
      niche: resolveReceptionistNiche(client.businessType),
      businessName: client.businessName, country: client.country,
      knowledge: [
        ...entreesDepuisVapiConfig(client.vapiConfig as Record<string, unknown> | null, client.businessType)
          .map(entry => `${entry.title}: ${entry.content}`),
        ...client.businessKnowledge.map(entry => `${entry.title}: ${entry.content}`),
      ],
    };
  }

  /** Renvoie le nombre de lignes écrites : 0 = source périmée (transcript/tenant
   *  changé depuis la sélection), le résultat en cours ne doit pas être agrégé. */
  private async patchReview(row: { id: string; clientId: string; transcript: string }, patch: Record<string, unknown>): Promise<number> {
    return prisma.$executeRaw`
      UPDATE client_calls
      SET metadata = (CASE WHEN jsonb_typeof(metadata) = 'object' THEN metadata ELSE '{}'::jsonb END) || ${JSON.stringify(patch)}::jsonb
      WHERE id = ${row.id}::uuid AND client_id = ${row.clientId}::uuid AND transcript = ${row.transcript}
    `;
  }

  /**
   * Finalisation atomique d'une revue réussie : sous verrou, relecture de la
   * transcription de l'appel ET du scope client autoritatif ; toute dérive
   * abandonne sans agréger (le marqueur succeeded/aggregated=false persisté
   * par l'appelant permet une reprise sans nouveau appel GPT). L'agrégation
   * learningPattern et le marqueur aggregated=true se valident ou s'annulent
   * ensemble. Aucun appel réseau ici : les signaux Discord sont empilés puis
   * envoyés par l'appelant après le commit.
   */
  private async finalizeReview(
    row: { id: string; clientId: string; transcript: string },
    scope: LearningScope,
    niche: string,
    savedReview: Record<string, unknown>,
    patterns: ConversationPattern[],
    evidence: unknown,
    pendingSignals: SignalNotification[],
  ): Promise<number> {
    let signalled = 0;
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ transcript: string; clientId: string }>>`
        SELECT cc.transcript, cc.client_id AS "clientId"
        FROM client_calls cc
        WHERE cc.id = ${row.id}::uuid
        FOR UPDATE
      `;
      const lockedRow = locked[0];
      if (!lockedRow || lockedRow.transcript !== row.transcript || lockedRow.clientId !== row.clientId) {
        throw new StaleReviewSourceError('transcript changé entre la revue et la finalisation');
      }
      const lockedClient = await tx.$queryRaw<Array<{ businessType: string | null; country: string | null; agentLanguage: string | null }>>`
        SELECT c.business_type AS "businessType", c.country, c.agent_language AS "agentLanguage"
        FROM clients c
        WHERE c.id = ${row.clientId}::uuid
        FOR UPDATE
      `;
      const clientRow = lockedClient[0];
      if (!clientRow) throw new StaleReviewSourceError('client introuvable pendant la finalisation');
      const authoritative = {
        tenant_id: row.clientId,
        niche: canonicalNiche(clientRow.businessType),
        country: canonicalCountry(clientRow.country),
        language: clientRow.agentLanguage,
      };
      if (!verifiedScope(authoritative)
        || Object.keys(scope).some(k => scope[k as keyof LearningScope] !== authoritative[k as keyof LearningScope])) {
        throw new StaleReviewSourceError('scope client changé entre la revue et la finalisation');
      }
      for (const pattern of patterns) {
        if (await this.aggregate(tx, row.id, row.clientId, pattern, niche, scope, pendingSignals)) signalled += 1;
      }
      const finalized = await tx.$executeRaw`
        UPDATE client_calls
        SET metadata = (CASE WHEN jsonb_typeof(metadata) = 'object' THEN metadata ELSE '{}'::jsonb END) || ${JSON.stringify({
          learningReview: { ...savedReview, aggregated: true },
          learningEvidence: evidence,
          patterns: { at: new Date().toISOString(), found: patterns.map(p => this.fingerprint(p, niche, scope)) },
        })}::jsonb
        WHERE id = ${row.id}::uuid AND client_id = ${row.clientId}::uuid AND transcript = ${row.transcript}
      `;
      if (finalized === 0) throw new StaleReviewSourceError('source périmée avant le marqueur aggregated');
    });
    return signalled;
  }

  private fingerprint(pattern: ConversationPattern, niche: string, scope: LearningScope): string {
    const boundary = createHash('sha256').update(JSON.stringify(scope)).digest('hex').slice(0, 24);
    return `${scopedFingerprint(pattern, niche)}-${boundary}`;
  }

  /**
   * L'agrégation par empreinte, à l'intérieur de la transaction de
   * finalisation. Rend vrai UNE FOIS, au passage du seuil : c'est ce qui fait
   * qu'un signal est un événement et pas un rappel toutes les cinq minutes.
   * La notification Discord est empilée, jamais émise ici (pas de réseau dans
   * la transaction) : l'appelant l'envoie après le commit.
   */
  private async aggregate(
    tx: Prisma.TransactionClient,
    callId: string,
    clientId: string,
    pattern: ConversationPattern,
    niche: string,
    scope: LearningScope,
    pendingSignals: SignalNotification[],
  ): Promise<boolean> {
    const fingerprint = this.fingerprint(pattern, niche, scope);
    const item: EvidenceItem = { callId, clientId, quote: pattern.quote, at: new Date().toISOString() };

    const existing = await tx.learningPattern.findUnique({ where: { fingerprint } });

    if (!existing) {
      await tx.learningPattern.create({
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
    await tx.learningPattern.update({
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
      pendingSignals.push(() => discordService
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
        ));
    }
    return crossed;
  }
}

export const callPatternsService = new CallPatternsService();
