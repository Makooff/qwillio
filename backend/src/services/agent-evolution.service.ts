import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { agentMemoryService, AgentType, StrategyPlaybook } from './agent-memory.service';

// ─── Cross-niche cluster map ──────────────────────────────
const NICHE_CLUSTERS: Record<string, string[]> = {
  home_services: ['plumber', 'electrician', 'hvac', 'locksmith', 'garage'],
  health:        ['dental', 'medical', 'spa', 'chiropractor', 'pharmacy'],
  hospitality:   ['restaurant', 'hotel', 'bakery', 'cafe', 'bar'],
  professional:  ['law_firm', 'accountant', 'real_estate', 'insurance'],
};

function getClusterSiblings(niche: string): string[] {
  for (const niches of Object.values(NICHE_CLUSTERS)) {
    if (niches.includes(niche)) return niches.filter(n => n !== niche);
  }
  return [];
}

interface GptInsight {
  insightType: string;
  pattern: Record<string, unknown>;
  confidence: number;
  targetAgents: string[];
}

interface GptEvolutionResponse {
  playbook: StrategyPlaybook;
  insights: GptInsight[];
  summary: string;
}

interface ActionFeatureRow {
  features: Record<string, unknown>;
  outcome: string | null;
}

class AgentEvolutionService {

  async evolveAll(): Promise<{ evolved: number; skipped: number }> {
    const groups = await prisma.agentAction.groupBy({
      by: ['agentType', 'niche', 'language'],
      where: { outcome: { not: null }, niche: { not: null } },
      _count: { id: true },
      having: { id: { _count: { gte: 30 } } },
    });

    let evolved = 0;
    let skipped = 0;

    for (const group of groups) {
      try {
        await this.evolveCombo(group.agentType, group.niche as string, group.language);
        evolved++;
      } catch (error: unknown) {
        logger.error(
          `[AgentEvolution] evolveCombo failed for ${group.agentType}/${group.niche}/${group.language}`,
          error,
        );
        skipped++;
      }
    }

    await this.resolveAbTests();

    logger.info(`[AgentEvolution] evolveAll complete — evolved: ${evolved}, skipped: ${skipped}`);
    return { evolved, skipped };
  }

  /** Resolve A/B tests: for each combo, compare the last two strategy versions
   *  and keep the one with the higher winRate active, deactivating the other. */
  async resolveAbTests(): Promise<void> {
    // Find all combos that have at least 2 strategy versions
    const combos = await prisma.agentStrategy.groupBy({
      by: ['agentType', 'niche', 'language'],
      _count: { id: true },
      having: { id: { _count: { gte: 2 } } },
    });

    for (const combo of combos) {
      try {
        const strategies = await prisma.agentStrategy.findMany({
          where: { agentType: combo.agentType, niche: combo.niche, language: combo.language },
          orderBy: { version: 'desc' },
          take: 2,
        });

        if (strategies.length < 2) continue;

        const [latest, previous] = strategies;
        const playbook = latest.playbook as Record<string, unknown>;
        // Only resolve if the latest was created as an A/B variant
        if (playbook.abVariant !== 'B') continue;

        const winner = latest.winRate >= previous.winRate ? latest : previous;
        const loser = winner.id === latest.id ? previous : latest;

        if (!winner.isActive) {
          await prisma.agentStrategy.update({
            where: { id: winner.id },
            data: { isActive: true },
          });
        }

        if (loser.isActive) {
          await prisma.agentStrategy.update({
            where: { id: loser.id },
            data: { isActive: false },
          });
        }

        logger.info(
          `[AgentEvolution] A/B resolved for ${combo.agentType}/${combo.niche}/${combo.language} — winner: v${winner.version} (winRate ${(winner.winRate * 100).toFixed(1)}%)`,
        );
      } catch (error: unknown) {
        logger.error(
          `[AgentEvolution] resolveAbTests failed for ${combo.agentType}/${combo.niche}/${combo.language}`,
          error,
        );
      }
    }
  }

  private async evolveCombo(agentType: string, niche: string, language: string): Promise<void> {
    const actions = await prisma.agentAction.findMany({
      where: { agentType, niche, language, outcome: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { features: true, outcome: true, reward: true },
    });

    const winners = actions.filter(
      (a) => (a.reward != null && a.reward >= 0.7) || a.outcome === 'converted',
    ) as ActionFeatureRow[];

    const losers = actions.filter(
      (a) => (a.reward != null && a.reward <= 0.3) || a.outcome === 'rejected',
    ) as ActionFeatureRow[];

    // Cross-niche cluster boost: if not enough winners, pull sibling niche data
    if (winners.length < 10) {
      const siblings = getClusterSiblings(niche);
      if (siblings.length > 0) {
        const clusterActions = await prisma.agentAction.findMany({
          where: { agentType, niche: { in: siblings }, language, outcome: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 150,
          select: { features: true, outcome: true, reward: true },
        });
        actions.push(...(clusterActions as typeof actions));
        const clusterWinners = clusterActions.filter(
          a => (a.reward != null && a.reward >= 0.7) || a.outcome === 'converted',
        ) as ActionFeatureRow[];
        winners.push(...clusterWinners);
        losers.push(...(clusterActions.filter(
          a => (a.reward != null && a.reward <= 0.3) || a.outcome === 'rejected',
        ) as ActionFeatureRow[]));
        logger.info(`[AgentEvolution] Cross-niche boost for ${niche}: added ${clusterActions.length} actions from [${siblings.join(',')}]`);
      }
      if (winners.length < 10) {
        logger.info(`[AgentEvolution] Skipping ${agentType}/${niche}/${language} — only ${winners.length} winners after cluster boost`);
        return;
      }
    }

    const winRate = winners.length / actions.length;
    const sampleSize = actions.length;

    const winnerSample = winners.slice(0, 20).map((a) => ({ features: a.features, outcome: a.outcome }));
    const loserSample = losers.slice(0, 20).map((a) => ({ features: a.features, outcome: a.outcome }));

    const userPrompt = `
Analyze the following sales AI action data for agent "${agentType}", niche "${niche}", language "${language}".

WINNERS (${winners.length} total, sample of 20):
${JSON.stringify(winnerSample, null, 2)}

LOSERS (${losers.length} total, sample of 20):
${JSON.stringify(loserSample, null, 2)}

Win rate: ${(winRate * 100).toFixed(1)}%

Identify patterns that distinguish winners from losers and return a JSON object with:
- playbook: evolved StrategyPlaybook (toneRules, openingHook, keyPainPoints, ctaVariants, timingRules, avoidPhrases, winningFeatures, notes)
- insights: array of { insightType, pattern, confidence (0-1), targetAgents: string[] }
- summary: one paragraph describing the evolution
`.trim();

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a sales AI trainer. Analyze agent action patterns and produce actionable strategy improvements. Always respond with valid JSON.',
          },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
    }

    const response = await res.json() as { choices: Array<{ message: { content: string } }> };
    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as GptEvolutionResponse;

    await this.createOrUpdateStrategy(agentType, niche, language, parsed.playbook, winRate, sampleSize);

    for (const insight of parsed.insights ?? []) {
      await agentMemoryService.createOrUpdateInsight({
        sourceAgent: agentType as AgentType,
        targetAgents: (insight.targetAgents ?? [agentType]) as AgentType[],
        niche,
        language,
        insightType: insight.insightType,
        pattern: insight.pattern,
        confidence: insight.confidence,
        sampleSize,
      });
    }

    logger.info(`[AgentEvolution] Evolved ${agentType}/${niche}/${language} — winRate: ${(winRate * 100).toFixed(1)}%, insights: ${parsed.insights?.length ?? 0}`);
  }

  private async createOrUpdateStrategy(
    agentType: string,
    niche: string,
    language: string,
    playbook: StrategyPlaybook,
    winRate: number,
    sampleSize: number,
  ): Promise<void> {
    const existing = await prisma.agentStrategy.findFirst({
      where: { agentType, niche, language, isActive: true },
    });

    if (existing) {
      await prisma.agentStrategy.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
    }

    const nextVersion = existing ? existing.version + 1 : 1;

    await prisma.agentStrategy.create({
      data: {
        agentType,
        niche,
        language,
        isActive: true,
        version: nextVersion,
        playbook: playbook as unknown as Prisma.InputJsonValue,
        winRate,
        sampleSize,
        evolvedAt: new Date(),
      },
    });

    logger.info(`[AgentEvolution] Strategy v${nextVersion} created for ${agentType}/${niche}/${language}`);
  }
}

export const agentEvolutionService = new AgentEvolutionService();
