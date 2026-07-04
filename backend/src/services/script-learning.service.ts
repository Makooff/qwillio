/**
 * Self-Correcting Script Learning Engine — Part 10 of the prospecting spec
 * Weekly analysis (Sunday 1am UTC):
 *   1. Pull failed calls (score < 4) per niche/language
 *   2. Group by script_drop_off_point
 *   3. If one drop-off > 40% of failures → generate micro-fix via Claude API
 *   4. Requires confidence >= 75 across >= 20 similar calls
 *   5. Track next 50 calls → keep if improves, auto-revert if drops
 *
 * Guard rules:
 *   - Max 1 mutation per niche per week
 *   - Opening question: max 1 change per month
 *   - Script total: never exceed 90 seconds
 *   - Never change objection handlers and opening in same week
 */
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { discordService } from './discord.service';

const DROP_OFF_STAGES = ['opening', 'pain_amplification', 'solution', 'pricing', 'objection_handling'] as const;
type DropOffStage = typeof DROP_OFF_STAGES[number];

const MIN_SAMPLE_SIZE = 20;
const DROP_OFF_THRESHOLD = 0.4;  // 40% of failures at same stage
const CONFIDENCE_THRESHOLD = 75;
const TRACKING_CALLS = 50;
const MAX_MUTATIONS_PER_WEEK = 1;

export class ScriptLearningService {
  /** Weekly analysis job */
  async runWeeklyAnalysis(): Promise<void> {
    logger.info('[ScriptLearning] Starting weekly analysis...');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get all active niches
    const niches = await prisma.call.groupBy({
      by: ['niche', 'language'],
      where: {
        niche: { not: null },
        language: { not: null },
        createdAt: { gte: sevenDaysAgo },
      },
      _count: { id: true },
    });

    for (const { niche, language } of niches) {
      if (!niche || !language) continue;
      try {
        await this.analyzeNiche(niche, language, sevenDaysAgo);
      } catch (err) {
        logger.error(`[ScriptLearning] Analysis failed for ${niche}/${language}:`, err);
      }
    }

    // Check if any testing mutations should be validated or reverted
    await this.evaluateTestingMutations();
  }

  /** Analyze drop-off patterns for a niche/language */
  private async analyzeNiche(niche: string, language: string, since: Date): Promise<void> {
    // Guard: max 1 mutation per niche per week
    const recentMutation = await prisma.scriptMutation.findFirst({
      where: {
        niche,
        language,
        createdAt: { gte: since },
        status: { in: ['testing', 'validated'] },
      },
    });
    if (recentMutation) {
      logger.debug(`[ScriptLearning] ${niche}/${language} already has a mutation this week, skipping`);
      return;
    }

    // Get failed calls (interest score < 4)
    const failedCalls = await prisma.call.findMany({
      where: {
        niche,
        language,
        createdAt: { gte: since },
        interestScore: { lt: 4 },
        detectionResult: 'answered',
        scriptDropOffPoint: { not: null },
      },
      select: { scriptDropOffPoint: true },
    });

    if (failedCalls.length < MIN_SAMPLE_SIZE) {
      logger.debug(`[ScriptLearning] ${niche}/${language}: insufficient sample (${failedCalls.length} < ${MIN_SAMPLE_SIZE})`);
      return;
    }

    // Count drop-offs by stage
    const stageCounts: Record<string, number> = {};
    for (const call of failedCalls) {
      const stage = call.scriptDropOffPoint!;
      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
    }

    // Find dominant drop-off stage
    const [worstStage, worstCount] = Object.entries(stageCounts)
      .sort((a, b) => b[1] - a[1])[0] ?? ['', 0];

    const dropOffRatio = worstCount / failedCalls.length;
    if (dropOffRatio < DROP_OFF_THRESHOLD) {
      logger.debug(`[ScriptLearning] ${niche}/${language}: no dominant drop-off stage (max ratio: ${dropOffRatio.toFixed(2)})`);
      return;
    }

    // Guard: never change opening and objection handlers in same week
    const recentOpeningMutation = await prisma.scriptMutation.findFirst({
      where: { niche, language, type: 'opening', createdAt: { gte: since } },
    });
    const recentObjectionMutation = await prisma.scriptMutation.findFirst({
      where: { niche, language, type: 'objection_handling', createdAt: { gte: since } },
    });
    if (recentOpeningMutation && worstStage === 'objection_handling') return;
    if (recentObjectionMutation && worstStage === 'opening') return;

    // Guard: opening question max 1 change per month
    if (worstStage === 'opening') {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentOpening = await prisma.scriptMutation.findFirst({
        where: { niche, language, type: 'opening', createdAt: { gte: oneMonthAgo } },
      });
      if (recentOpening) {
        logger.debug(`[ScriptLearning] ${niche}/${language}: opening question changed this month, skipping`);
        return;
      }
    }

    // Compute current conversion rate (baseline)
    const totalAnswered = await prisma.call.count({
      where: { niche, language, createdAt: { gte: since }, detectionResult: 'answered' },
    });
    const totalConverted = await prisma.call.count({
      where: { niche, language, createdAt: { gte: since }, detectionResult: 'answered', interestScore: { gte: 5 } },
    });
    const conversionBefore = totalAnswered > 0 ? totalConverted / totalAnswered : 0;

    // Generate micro-fix via Claude API
    const { fix, confidence } = await this.generateMicroFix(
      niche, language, worstStage as DropOffStage, failedCalls.length
    );

    if (confidence < CONFIDENCE_THRESHOLD) {
      logger.debug(`[ScriptLearning] ${niche}/${language}: confidence too low (${confidence} < ${CONFIDENCE_THRESHOLD})`);
      return;
    }

    // Store mutation
    await prisma.scriptMutation.create({
      data: {
        niche,
        language,
        type: worstStage,
        changeApplied: fix,
        reason: `Drop-off rate at "${worstStage}" stage was ${(dropOffRatio * 100).toFixed(1)}% of ${failedCalls.length} failed calls`,
        callsBefore: totalAnswered,
        conversionBefore,
        confidenceScore: confidence,
        status: 'testing',
      },
    });

    logger.info(`[ScriptLearning] Mutation applied for ${niche}/${language} at stage "${worstStage}" (confidence: ${confidence})`);

    await discordService.notifySystem(
      `🧠 SCRIPT MUTATION\n` +
      `Niche: ${niche} | Lang: ${language} | Stage: ${worstStage}\n` +
      `Drop-off rate: ${(dropOffRatio * 100).toFixed(1)}% | Confidence: ${confidence}%\n` +
      `Tracking next ${TRACKING_CALLS} calls`
    );
  }

  /** Evaluate testing mutations: validate or revert based on results */
  private async evaluateTestingMutations(): Promise<void> {
    const testingMutations = await prisma.scriptMutation.findMany({
      where: { status: 'testing' },
    });

    for (const mutation of testingMutations) {
      const since = mutation.createdAt;

      const callsAfter = await prisma.call.count({
        where: {
          niche: mutation.niche,
          language: mutation.language,
          createdAt: { gte: since },
          detectionResult: 'answered',
        },
      });

      if (callsAfter < TRACKING_CALLS) continue; // Not enough data yet

      const conversionsAfter = await prisma.call.count({
        where: {
          niche: mutation.niche,
          language: mutation.language,
          createdAt: { gte: since },
          detectionResult: 'answered',
          interestScore: { gte: 5 },
        },
      });

      const conversionAfter = callsAfter > 0 ? conversionsAfter / callsAfter : 0;
      const improved = conversionAfter > mutation.conversionBefore;

      if (improved) {
        await prisma.scriptMutation.update({
          where: { id: mutation.id },
          data: { status: 'validated', callsAfter, conversionAfter },
        });
        logger.info(`[ScriptLearning] Mutation VALIDATED for ${mutation.niche}/${mutation.language}: ${(conversionAfter * 100).toFixed(1)}% > ${(mutation.conversionBefore * 100).toFixed(1)}%`);
      } else {
        await prisma.scriptMutation.update({
          where: { id: mutation.id },
          data: {
            status: 'reverted',
            callsAfter,
            conversionAfter,
            revertedAt: new Date(),
            revertReason: `Conversion dropped: ${(conversionAfter * 100).toFixed(1)}% < baseline ${(mutation.conversionBefore * 100).toFixed(1)}%`,
          },
        });
        logger.info(`[ScriptLearning] Mutation REVERTED for ${mutation.niche}/${mutation.language}`);

        await discordService.notifySystem(
          `↩️ SCRIPT MUTATION REVERTED\n` +
          `Niche: ${mutation.niche} | Lang: ${mutation.language}\n` +
          `Conversion dropped: ${(conversionAfter * 100).toFixed(1)}% vs baseline ${(mutation.conversionBefore * 100).toFixed(1)}%`
        );
      }
    }
  }

  /** Generate a micro-fix for a specific drop-off stage */
  private async generateMicroFix(
    niche: string,
    language: string,
    stage: DropOffStage,
    sampleSize: number,
  ): Promise<{ fix: string; confidence: number }> {
    const apiKey = env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY;
    if (!apiKey) {
      return { fix: `Improve ${stage} section`, confidence: 0 };
    }

    const prompt = `You are an expert sales coach analyzing why cold calls drop off.

Context:
- Product: Qwillio — AI receptionist SaaS for small businesses
- Niche: ${niche}
- Language: ${language === 'fr' ? 'French' : 'English'}
- Drop-off stage: ${stage}
- Failed calls analyzed: ${sampleSize}
- Agent name: ${language === 'fr' ? 'Marie' : 'Ashley'}

The script is consistently losing prospects at the "${stage}" stage.

Generate:
1. A specific micro-fix (1-2 sentence change to that section of the script)
2. A confidence score (0-100) based on how well this fix addresses the issue

Rules:
- Max script length: 90 seconds total
- Keep the fix natural and conversational
- Focus on reducing friction at the "${stage}" stage
- Language must match: ${language === 'fr' ? 'French' : 'English'}

Return JSON: { "fix": "the micro-fix text", "confidence": number }`;

    try {
      let responseText = '';

      if (env.ANTHROPIC_API_KEY) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (res.ok) {
          const data = await res.json() as any;
          responseText = data.content?.[0]?.text ?? '';
        }
      } else {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          }),
        });
        if (res.ok) {
          const data = await res.json() as any;
          responseText = data.choices?.[0]?.message?.content ?? '';
        }
      }

      if (responseText) {
        // Extract JSON from response (may have preamble)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            fix: parsed.fix ?? '',
            confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 0)),
          };
        }
      }
    } catch (err) {
      logger.error('[ScriptLearning] Micro-fix generation failed:', err);
    }

    return { fix: '', confidence: 0 };
  }

  /** Classify why a call failed (drop-off point detection) */
  async classifyDropOff(callId: string): Promise<DropOffStage | null> {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { transcript: true, interestScore: true, durationSeconds: true },
    });

    if (!call?.transcript || (call.interestScore ?? 10) >= 4) return null;

    const apiKey = env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY;
    if (!apiKey) {
      // Heuristic fallback based on duration
      if (!call.durationSeconds || call.durationSeconds < 15) return 'opening';
      if (call.durationSeconds < 30) return 'pain_amplification';
      if (call.durationSeconds < 60) return 'solution';
      if (call.durationSeconds < 90) return 'pricing';
      return 'objection_handling';
    }

    try {
      let responseText = '';

      if (env.ANTHROPIC_API_KEY) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 50,
            messages: [{
              role: 'user',
              content: `Analyze this failed cold call transcript and classify where the prospect dropped off.

Transcript: ${call.transcript.substring(0, 2000)}

Stages: opening, pain_amplification, solution, pricing, objection_handling

Return JSON: { "stage": "one_of_the_stages" }`,
            }],
          }),
        });
        if (res.ok) {
          const data = await res.json() as any;
          responseText = data.content?.[0]?.text ?? '';
        }
      } else {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{
              role: 'user',
              content: `Classify drop-off stage from this transcript: ${call.transcript.substring(0, 1000)}
Stages: opening/pain_amplification/solution/pricing/objection_handling
Return JSON: { "stage": "..." }`,
            }],
            response_format: { type: 'json_object' },
            max_tokens: 50,
          }),
        });
        if (res.ok) {
          const data = await res.json() as any;
          responseText = data.choices?.[0]?.message?.content ?? '';
        }
      }

      if (responseText) {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (DROP_OFF_STAGES.includes(parsed.stage)) {
            return parsed.stage as DropOffStage;
          }
        }
      }
    } catch (err) {
      logger.error('[ScriptLearning] Drop-off classification failed:', err);
    }

    return null;
  }
}

export const scriptLearningService = new ScriptLearningService();
