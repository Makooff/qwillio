import { AgentAction, AgentInsight, AgentStrategy, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export type AgentType = 'closer' | 'work_planner' | 'business_plan' | 'branding';

export interface StrategyPlaybook {
  toneRules: string[];
  openingHook?: string;
  keyPainPoints: string[];
  ctaVariants: string[];
  timingRules: string[];
  avoidPhrases: string[];
  winningFeatures: Record<string, number>;
  notes?: string;
}

export interface RecordActionInput {
  agentType: AgentType;
  prospectId?: string;
  niche?: string;
  language?: string;
  strategyId?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  features: Record<string, unknown>;
}

export class AgentMemoryService {

  async getStrategy(
    agentType: AgentType,
    niche: string,
    lang: string,
  ): Promise<{ strategy: AgentStrategy | null; insights: AgentInsight[] }> {
    try {
      const strategy = await prisma.agentStrategy.findFirst({
        where: { agentType, niche, language: lang, isActive: true },
        orderBy: { version: 'desc' },
      });

      const insights = await prisma.agentInsight.findMany({
        where: {
          isActive: true,
          targetAgents: { has: agentType },
          language: lang,
        },
        take: 10,
      });

      if (strategy) {
        logger.info(`[AgentMemory] Strategy found for ${agentType}/${niche}/${lang} v${strategy.version}`);
      } else {
        logger.info(`[AgentMemory] No strategy found for ${agentType}/${niche}/${lang}, using defaults`);
      }

      return { strategy, insights };
    } catch (error: unknown) {
      logger.error('[AgentMemory] getStrategy failed', error);
      return { strategy: null, insights: [] };
    }
  }

  async recordAction(data: RecordActionInput): Promise<string> {
    try {
      const action = await prisma.agentAction.create({
        data: {
          agentType: data.agentType,
          prospectId: data.prospectId ?? null,
          niche: data.niche ?? null,
          language: data.language ?? 'en',
          strategyId: data.strategyId ?? null,
          input: data.input as Prisma.InputJsonValue,
          output: data.output as Prisma.InputJsonValue,
          features: data.features as Prisma.InputJsonValue,
        },
      });

      return action.id;
    } catch (error: unknown) {
      logger.error('[AgentMemory] recordAction failed', error);
      throw error;
    }
  }

  async updateOutcome(
    actionId: string,
    outcome: 'converted' | 'rejected' | 'no_response' | 'bounced',
    reward: number,
  ): Promise<void> {
    try {
      await prisma.agentAction.update({
        where: { id: actionId },
        data: { outcome, reward },
      });

      logger.info(`[AgentMemory] Action ${actionId} outcome set to ${outcome} (reward: ${reward})`);
    } catch (error: unknown) {
      logger.error(`[AgentMemory] updateOutcome failed for action ${actionId}`, error);
      throw error;
    }
  }

  async getRecentActions(agentType: AgentType, niche: string, limit = 100): Promise<AgentAction[]> {
    try {
      return await prisma.agentAction.findMany({
        where: { agentType, niche },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (error: unknown) {
      logger.error('[AgentMemory] getRecentActions failed', error);
      return [];
    }
  }

  async createOrUpdateInsight(data: {
    sourceAgent: AgentType;
    targetAgents: AgentType[];
    niche?: string;
    language?: string;
    insightType: string;
    pattern: Record<string, unknown>;
    confidence: number;
    sampleSize: number;
  }): Promise<void> {
    try {
      const existing = await prisma.agentInsight.findFirst({
        where: {
          sourceAgent: data.sourceAgent,
          insightType: data.insightType,
          niche: data.niche ?? null,
          language: data.language ?? 'en',
        },
      });

      if (existing) {
        await prisma.agentInsight.update({
          where: { id: existing.id },
          data: {
            pattern: data.pattern as Prisma.InputJsonValue,
            confidence: data.confidence,
            sampleSize: existing.sampleSize + data.sampleSize,
          },
        });
        logger.info(`[AgentMemory] Insight updated: ${data.sourceAgent}/${data.insightType}`);
      } else {
        await prisma.agentInsight.create({
          data: {
            sourceAgent: data.sourceAgent,
            targetAgents: data.targetAgents,
            niche: data.niche ?? null,
            language: data.language ?? 'en',
            insightType: data.insightType,
            pattern: data.pattern as Prisma.InputJsonValue,
            confidence: data.confidence,
            sampleSize: data.sampleSize,
          },
        });
        logger.info(`[AgentMemory] Insight created: ${data.sourceAgent}/${data.insightType}`);
      }
    } catch (error: unknown) {
      logger.error('[AgentMemory] createOrUpdateInsight failed', error);
      throw error;
    }
  }
}

export const agentMemoryService = new AgentMemoryService();
