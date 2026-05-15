import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { agentMemoryService } from './agent-memory.service';

export interface DayPlanItem {
  prospectId: string;
  businessName: string;
  niche: string;
  city: string;
  phone: string;
  score: number;
  priorityScore: number;
  reasoning: string;
  bestCallTime: string;
  language: 'en' | 'fr';
}

export interface DayPlan {
  date: string;
  totalProspects: number;
  items: DayPlanItem[];
  planNotes: string;
  generatedAt: Date;
}

interface GptPlanItem {
  prospectId: string;
  reasoning: string;
  bestCallTime: string;
  language: 'en' | 'fr';
}

interface GptPlanResponse {
  items: GptPlanItem[];
  planNotes: string;
}

interface ProspectCandidate {
  id: string;
  businessName: string;
  niche: string | null;
  city: string | null;
  phone: string | null;
  score: number;
  priorityScore: number;
  country: string | null;
  timezone: string | null;
  callAttempts: number;
  googleRating: number | null;
  googleReviewsCount: number | null;
}

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export class WorkPlannerAgentService {

  async generateDayPlan(date: Date, maxProspects = 50): Promise<DayPlan> {
    const candidates = await prisma.prospect.findMany({
      where: {
        eligibleForCall: true,
        status: { in: ['new', 'contacted'] },
        phone: { not: null },
        OR: [{ nextCallAt: null }, { nextCallAt: { lte: new Date() } }],
      },
      select: {
        id: true, businessName: true, niche: true, city: true,
        phone: true, score: true, priorityScore: true,
        country: true, timezone: true, callAttempts: true,
        googleRating: true, googleReviewsCount: true,
      },
      orderBy: [{ priorityScore: 'desc' }, { score: 'desc' }],
      take: 200,
    });

    const { strategy } = await agentMemoryService.getStrategy('work_planner', 'general', 'en');

    const items = await this.rankWithGpt(candidates, strategy?.playbook as Record<string, unknown> | null, maxProspects, date);

    const actionId = await agentMemoryService.recordAction({
      agentType: 'work_planner',
      niche: 'general',
      language: 'en',
      input: { date: date.toISOString(), candidateCount: candidates.length },
      output: { plannedCount: items.length },
      features: { dayOfWeek: date.getDay(), candidateCount: candidates.length },
    });

    logger.info(`[WorkPlanner] Day plan generated: ${items.length} prospects (actionId: ${actionId})`);

    return {
      date: date.toISOString().split('T')[0],
      totalProspects: items.length,
      items,
      planNotes: items.length > 0 ? `Plan ready for ${date.toDateString()}` : 'No eligible prospects found',
      generatedAt: new Date(),
    };
  }

  private async rankWithGpt(
    candidates: ProspectCandidate[],
    playbook: Record<string, unknown> | null,
    maxProspects: number,
    date: Date,
  ): Promise<DayPlanItem[]> {
    const compact = candidates.map(c => ({
      id: c.id,
      businessName: c.businessName,
      niche: c.niche,
      city: c.city,
      score: c.score,
      priorityScore: c.priorityScore,
      callAttempts: c.callAttempts,
      googleRating: c.googleRating,
      country: c.country,
    }));

    const systemPrompt = [
      'You are an expert call center scheduler for an outbound prospecting team.',
      playbook ? `Strategy notes: ${JSON.stringify(playbook)}` : '',
      `Select the top ${maxProspects} prospects to call on ${date.toDateString()}.`,
      'Return ONLY valid JSON: { "items": [{ "prospectId": string, "reasoning": string, "bestCallTime": string, "language": "en"|"fr" }], "planNotes": string }',
      'Prioritize by score, callAttempts (fewer is better), and business potential.',
      'bestCallTime format: "HH:MM local" e.g. "09:30 local". language based on country (fr for CA/FR, en otherwise).',
    ].filter(Boolean).join('\n');

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(compact) },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json() as { choices: [{ message: { content: string } }] };
      const parsed = JSON.parse(json.choices[0].message.content) as GptPlanResponse;

      return this.mergeGptWithCandidates(parsed, candidates);
    } catch (error: unknown) {
      logger.warn('[WorkPlanner] GPT ranking failed, falling back to priority score sort', error);
      return this.buildFallbackPlan(candidates, maxProspects);
    }
  }

  private mergeGptWithCandidates(gptResponse: GptPlanResponse, candidates: ProspectCandidate[]): DayPlanItem[] {
    const candidateMap = new Map(candidates.map(c => [c.id, c]));

    return gptResponse.items
      .map(item => {
        const prospect = candidateMap.get(item.prospectId);
        if (!prospect?.phone) return null;

        return {
          prospectId: prospect.id,
          businessName: prospect.businessName,
          niche: prospect.niche ?? '',
          city: prospect.city ?? '',
          phone: prospect.phone,
          score: prospect.score,
          priorityScore: prospect.priorityScore,
          reasoning: item.reasoning,
          bestCallTime: item.bestCallTime,
          language: item.language,
        } satisfies DayPlanItem;
      })
      .filter((item): item is DayPlanItem => item !== null);
  }

  private buildFallbackPlan(candidates: ProspectCandidate[], maxProspects: number): DayPlanItem[] {
    return candidates
      .slice(0, maxProspects)
      .filter(c => c.phone !== null)
      .map(c => ({
        prospectId: c.id,
        businessName: c.businessName,
        niche: c.niche ?? '',
        city: c.city ?? '',
        phone: c.phone as string,
        score: c.score,
        priorityScore: c.priorityScore,
        reasoning: 'priority_score_fallback',
        bestCallTime: '09:00 local',
        language: c.country === 'CA' || c.country === 'FR' ? 'fr' : 'en',
      }));
  }

  async recordPlanOutcome(actionId: string, contactedCount: number, qualifiedCount: number): Promise<void> {
    const reward = qualifiedCount / Math.max(contactedCount, 1);
    const outcome = qualifiedCount > 0 ? 'converted' : 'no_response';
    await agentMemoryService.updateOutcome(actionId, outcome, reward);
    logger.info(`[WorkPlanner] Plan outcome recorded: actionId=${actionId} outcome=${outcome} reward=${reward}`);
  }
}

export const workPlannerAgentService = new WorkPlannerAgentService();
