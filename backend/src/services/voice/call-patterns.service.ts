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
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserMessage,
  parsePatterns,
  type ConversationPattern,
} from './call-patterns';

/** Même fenêtre que le post-mortem : réparer le jour même, pas rattraper un passé. */
const LOOKBACK_MINUTES = 180;

/** Appels lus par passage — le coût du modèle borne la fenêtre, pas l'envie. */
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

    const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);
    const rows = await prisma.clientCall.findMany({
      where: { status: 'completed', isSpam: false, endedAt: { gte: since } },
      orderBy: { endedAt: 'desc' },
      take: MAX_CALLS,
      select: { id: true, clientId: true, transcript: true, metadata: true },
    });

    for (const row of rows) {
      const metadata = (row.metadata as Record<string, any> | null) ?? null;
      const mortem = metadata?.mortem as { verdict?: string; codes?: string[]; evidence?: string[] } | undefined;
      /* Pas jugé, jugé sain, ou déjà lu : dans les trois cas il n'y a rien à
         faire. `metadata.patterns` est la seule chose qui empêche de payer le
         même transcript à chaque passage. */
      if (!mortem?.verdict || mortem.verdict === 'ok' || metadata?.patterns) continue;
      if (!row.transcript?.trim()) continue;

      sweep.scanned += 1;

      let patterns: ConversationPattern[];
      try {
        patterns = await this.analyse(apiKey, row.transcript, mortem);
      } catch (error) {
        logger.warn(`[CallPatterns] lecture impossible pour ${row.id}: ${(error as Error).message}`);
        continue;
      }
      sweep.analysed += 1;
      sweep.patterns += patterns.length;

      for (const pattern of patterns) {
        if (await this.aggregate(row.id, row.clientId, pattern)) sweep.signalled += 1;
      }

      await this.markRead(row.id, metadata, patterns).catch(error =>
        logger.warn(`[CallPatterns] marqueur non rangé pour ${row.id}: ${(error as Error).message}`),
      );
    }

    if (sweep.scanned) {
      logger.info(
        `[CallPatterns] ${sweep.scanned} appel(s) à lire: ${sweep.analysed} lu(s), ` +
          `${sweep.patterns} enseignement(s), ${sweep.signalled} signal(aux) nouveau(x)`,
      );
    }
    return sweep;
  }

  /** L'appel au modèle, isolé pour que le test n'ait pas de réseau à mocker en profondeur. */
  private async analyse(
    apiKey: string,
    transcript: string,
    mortem: { verdict?: string; codes?: string[]; evidence?: string[] },
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
                verdict: mortem.verdict ?? 'watch',
                codes: mortem.codes ?? [],
                evidence: mortem.evidence ?? [],
              }),
            },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });
      const data = (await response.json()) as any;
      if (!response.ok) throw new Error(`OpenAI ${response.status}: ${JSON.stringify(data).slice(0, 200)}`);
      return parsePatterns(data.choices?.[0]?.message?.content ?? '');
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * L'agrégation par empreinte. Rend vrai UNE FOIS, au passage du seuil :
   * c'est ce qui fait qu'un signal est un événement et pas un rappel
   * toutes les cinq minutes.
   */
  private async aggregate(callId: string, clientId: string, pattern: ConversationPattern): Promise<boolean> {
    const fingerprint = `${pattern.kind}:${pattern.slug}`;
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
              ? `Le synthétiseur local peut en faire une règle prompts.py + test, en PR brouillon.`
              : `Réglage chiffré proposé — relecture manuelle, pas de règle automatique.`),
          'alerts',
        )
        .catch(error => logger.warn(`[CallPatterns] signal non envoyé: ${(error as Error).message}`));
    }
    return crossed;
  }

  /** Même écriture EN FUSION que le post-mortem, pour la même raison. */
  private async markRead(
    id: string,
    metadata: Record<string, any> | null,
    patterns: ConversationPattern[],
  ): Promise<void> {
    await prisma.clientCall.update({
      where: { id },
      data: {
        metadata: {
          ...(metadata ?? {}),
          patterns: { at: new Date().toISOString(), found: patterns.map(p => `${p.kind}:${p.slug}`) },
        } as unknown as Prisma.InputJsonObject,
      },
    });
  }
}

export const callPatternsService = new CallPatternsService();
