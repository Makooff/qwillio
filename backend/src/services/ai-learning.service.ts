// @ts-nocheck
import { prisma } from '../config/database';
import { logger } from '../config/logger';

// Guard constants — hardcoded, cannot be overridden by AI
const MAX_MUTATIONS_PER_NICHE_PER_WEEK = 1;
const MAX_OPENING_CHANGES_PER_MONTH = 1;
const MAX_SCRIPT_WORDS = 195; // 90 seconds at 130 words/min
const MIN_CONFIDENCE_SCORE = 75;
const MIN_DATA_POINTS = 20;
const VALIDATION_CALL_COUNT = 50;

type DropOffPoint = 'opening' | 'pain_amplification' | 'solution' | 'pricing' | 'objection_handling';

export class AiLearningService {

  // ═══════════════════════════════════════════
  // DROP-OFF DETECTION
  // ═══════════════════════════════════════════

  async classifyDropOff(callId: string, transcript: string): Promise<DropOffPoint | null> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo',
          messages: [
            {
              role: 'system',
              content: `Analyze this sales call transcript and identify where the prospect lost interest or dropped off.
Classify the drop-off point as exactly one of: opening | pain_amplification | solution | pricing | objection_handling
Also provide a confidence score 0-100.
Return JSON: { "dropOffPoint": "...", "confidence": N, "reason": "..." }`,
            },
            { role: 'user', content: transcript },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await response.json() as any;
      if (!data.choices?.[0]?.message?.content) {
        logger.error('[AI-Learning] OpenAI returned no choices for drop-off classification');
        return null;
      }
      const result = JSON.parse(data.choices[0].message.content);

      if (result.confidence >= MIN_CONFIDENCE_SCORE) {
        await prisma.call.update({
          where: { id: callId },
          data: { scriptDropOffPoint: result.dropOffPoint },
        });
        return result.dropOffPoint as DropOffPoint;
      }
      return null;
    } catch (error) {
      logger.error('Drop-off classification failed:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════
  // MICRO-FIX GENERATION (Sunday 1am CRON)
  // ═══════════════════════════════════════════

  async generateMicroFixes(): Promise<void> {
    const niches = ['dental', 'medical', 'law', 'salon', 'restaurant', 'garage', 'hotel'];
    const languages = ['en', 'fr'];

    for (const niche of niches) {
      for (const language of languages) {
        try {
          await this.processNicheMicroFix(niche, language);
        } catch (error) {
          logger.error(`Micro-fix generation failed for ${niche}/${language}:`, error);
        }
      }
    }
  }

  private async processNicheMicroFix(niche: string, language: string): Promise<void> {
    // Query calls via prospect relation to filter by niche
    const failedCalls = await prisma.call.findMany({
      where: {
        prospect: { industry: niche },
        interestLevel: { lt: 4 },
        scriptDropOffPoint: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (failedCalls.length < 50) {
      logger.info(`${niche}/${language}: Only ${failedCalls.length} failed calls, need 50+. Skipping.`);
      return;
    }

    // Check guard: max 1 mutation per niche per week
    const guardCheck = await this.checkGuards(niche, language, 'script_change');
    if (!guardCheck.allowed) {
      await this.logDecision({
        type: 'guard_blocked',
        niche,
        language,
        outcome: 'blocked',
        details: { guard: guardCheck.guard, reason: guardCheck.reason },
      });
      return;
    }

    // Identify top 3 drop-off points
    const dropOffCounts: Record<string, number> = {};
    for (const call of failedCalls) {
      const point = call.scriptDropOffPoint!;
      dropOffCounts[point] = (dropOffCounts[point] || 0) + 1;
    }

    const sorted = Object.entries(dropOffCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    if (sorted.length === 0) return;

    const topDropOff = sorted[0][0];
    const dataPoints = sorted[0][1];

    if (dataPoints < MIN_DATA_POINTS) {
      logger.info(`${niche}/${language}: Top drop-off "${topDropOff}" only has ${dataPoints} points, need ${MIN_DATA_POINTS}+. Skipping.`);
      return;
    }

    // Calculate current conversion rate
    const totalCalls = await prisma.call.count({ where: { prospect: { industry: niche } } });
    const convertedCalls = await prisma.call.count({
      where: { prospect: { industry: niche }, interestLevel: { gte: 7 } },
    });
    const conversionBefore = totalCalls > 0 ? convertedCalls / totalCalls : 0;

    // Generate micro-fix via GPT
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an expert sales script optimizer for the ${niche} industry.
Language: ${language === 'fr' ? 'French' : 'English'}
Agent name: ${language === 'fr' ? 'Marie' : 'Ashley'}

The top drop-off point is "${topDropOff}" with ${dataPoints} occurrences out of ${failedCalls.length} failed calls.

Generate ONE surgical micro-fix for this specific section. NOT a full rewrite.
The fix must:
- Be a single change (1-2 sentences max)
- Target specifically the "${topDropOff}" phase
- Keep total script under ${MAX_SCRIPT_WORDS} words
- Sound natural and conversational
- ${language === 'fr' ? 'Use natural French with fillers like "du coup", "voilà"' : 'Sound professional yet warm'}

Return JSON: { "change": "the new text to use", "reason": "why this should improve conversion", "confidence": 0-100, "targetSection": "${topDropOff}" }`,
          },
          { role: 'user', content: `Generate a micro-fix for the ${topDropOff} section.` },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json() as any;
    if (!data.choices?.[0]?.message?.content) {
      logger.error(`[AI-Learning] OpenAI returned no choices for micro-fix ${niche}/${language}`);
      return;
    }
    const fix = JSON.parse(data.choices[0].message.content);

    if (fix.confidence < MIN_CONFIDENCE_SCORE) {
      await this.logDecision({
        type: 'script_mutation',
        niche,
        language,
        confidenceScore: fix.confidence,
        dataPointsUsed: dataPoints,
        outcome: 'blocked',
        details: { reason: `Confidence ${fix.confidence} < ${MIN_CONFIDENCE_SCORE} threshold` },
      });
      return;
    }

    await prisma.scriptMutation.create({
      data: {
        niche,
        language,
        type: 'script_change',
        changeApplied: fix.change,
        reason: fix.reason,
        callsBefore: totalCalls,
        conversionBefore,
        status: 'testing',
        confidenceScore: fix.confidence,
      },
    });

    await this.logDecision({
      type: 'script_mutation',
      niche,
      language,
      confidenceScore: fix.confidence,
      dataPointsUsed: dataPoints,
      outcome: 'applied',
      details: { change: fix.change, reason: fix.reason, targetSection: topDropOff },
    });

    logger.info(`Applied micro-fix for ${niche}/${language} targeting "${topDropOff}": ${fix.change}`);
  }

  // ═══════════════════════════════════════════
  // SELF-CORRECTION LOOP
  // ═══════════════════════════════════════════

  async evaluateMutations(): Promise<void> {
    const testingMutations = await prisma.scriptMutation.findMany({
      where: { status: 'testing' },
    });

    for (const mutation of testingMutations) {
      const callsAfter = await prisma.call.count({
        where: {
          prospect: { industry: mutation.niche },
          createdAt: { gte: mutation.date },
        },
      });

      if (callsAfter < VALIDATION_CALL_COUNT) continue;

      const convertedAfter = await prisma.call.count({
        where: {
          prospect: { industry: mutation.niche },
          createdAt: { gte: mutation.date },
          interestLevel: { gte: 7 },
        },
      });

      const conversionAfter = callsAfter > 0 ? convertedAfter / callsAfter : 0;
      const improved = conversionAfter > mutation.conversionBefore;

      if (improved) {
        await prisma.scriptMutation.update({
          where: { id: mutation.id },
          data: { status: 'validated', callsAfter, conversionAfter },
        });
        await this.logDecision({
          type: 'script_mutation',
          niche: mutation.niche,
          language: mutation.language,
          outcome: 'applied',
          details: {
            action: 'validated',
            conversionBefore: mutation.conversionBefore,
            conversionAfter,
            delta: conversionAfter - mutation.conversionBefore,
          },
        });
      } else {
        await prisma.scriptMutation.update({
          where: { id: mutation.id },
          data: {
            status: 'reverted',
            callsAfter,
            conversionAfter,
            revertedAt: new Date(),
            revertReason: `Conversion dropped: ${mutation.conversionBefore.toFixed(3)} → ${conversionAfter.toFixed(3)}`,
          },
        });
        await this.logDecision({
          type: 'revert',
          niche: mutation.niche,
          language: mutation.language,
          outcome: 'applied',
          details: {
            action: 'reverted',
            conversionBefore: mutation.conversionBefore,
            conversionAfter,
            delta: conversionAfter - mutation.conversionBefore,
          },
        });
      }
    }
  }

  // ═══════════════════════════════════════════
  // OBJECTION HANDLER OPTIMIZATION (Weekly, Enterprise)
  // ═══════════════════════════════════════════

  async optimizeObjectionHandlers(): Promise<void> {
    const niches = ['dental', 'medical', 'law', 'salon', 'restaurant', 'garage', 'hotel'];

    for (const niche of niches) {
      try {
        const guardCheck = await this.checkGuards(niche, 'en', 'objection_handler');
        if (!guardCheck.allowed) continue;

        const failedCalls = await prisma.call.findMany({
          where: {
            prospect: { industry: niche },
            interestLevel: { lt: 4 },
            scriptDropOffPoint: 'objection_handling',
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });

        if (failedCalls.length < 20) continue;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
          },
          body: JSON.stringify({
            model: 'gpt-4-turbo',
            messages: [
              {
                role: 'system',
                content: `Analyze ${failedCalls.length} failed objection-handling interactions in the ${niche} niche.
Generate 2 improved objection responses. Each must be natural, empathetic, and under 30 words.
Return JSON: { "improvements": [{ "objection": "...", "newResponse": "...", "confidence": 0-100 }] }`,
              },
              { role: 'user', content: 'Generate improved objection handlers.' },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          }),
        });

        const data = await response.json() as any;
        if (!data.choices?.[0]?.message?.content) {
          logger.error(`[AI-Learning] OpenAI returned no choices for objection optimization ${niche}`);
          continue;
        }
        const result = JSON.parse(data.choices[0].message.content);

        for (const improvement of result.improvements) {
          if (improvement.confidence >= MIN_CONFIDENCE_SCORE) {
            await prisma.scriptMutation.create({
              data: {
                niche,
                language: 'en',
                type: 'objection_handler',
                changeApplied: `${improvement.objection}: ${improvement.newResponse}`,
                reason: `Improve objection handling (confidence: ${improvement.confidence})`,
                callsBefore: failedCalls.length,
                conversionBefore: 0,
                status: 'testing',
                confidenceScore: improvement.confidence,
              },
            });
          }
        }
      } catch (error) {
        logger.error(`Objection optimization failed for ${niche}:`, error);
      }
    }
  }

  // ═══════════════════════════════════════════
  // CALL QUALITY SCORING
  // ═══════════════════════════════════════════

  async scoreCallQuality(callId: string): Promise<number> {
    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) return 0;

    let score = 0;
    // Duration: longer = better engagement (max 3 points)
    const duration = call.durationSeconds || 0;
    if (duration > 120) score += 3;
    else if (duration > 60) score += 2;
    else if (duration > 30) score += 1;

    // Lead captured (2 points)
    if (call.emailCollected) score += 2;

    // Decision maker reached (2 points)
    if (call.decisionMakerReached) score += 2;

    // Interest level contribution (max 2 points)
    const interest = call.interestLevel || 0;
    if (interest >= 7) score += 2;
    else if (interest >= 4) score += 1;

    // Recommended package = strong signal (1 point)
    if (call.recommendedPackage) score += 1;

    const qualityScore = Math.min(score, 10);

    await prisma.call.update({
      where: { id: callId },
      data: { qualityScore },
    });

    return qualityScore;
  }

  // ═══════════════════════════════════════════
  // A/B TEST EVALUATION
  // ═══════════════════════════════════════════

  async evaluateAbTests(): Promise<void> {
    const activeTests = await prisma.scriptAbTest.findMany({
      where: { winner: null },
    });

    for (const test of activeTests) {
      if (test.callsA >= 200 && test.callsB >= 200) {
        const rateA = test.callsA > 0 ? test.conversionsA / test.callsA : 0;
        const rateB = test.callsB > 0 ? test.conversionsB / test.callsB : 0;

        const winner = rateA >= rateB ? 'A' : 'B';

        await prisma.scriptAbTest.update({
          where: { id: test.id },
          data: { winner, decidedAt: new Date() },
        });

        logger.info(`A/B test decided for ${test.niche}: Winner=${winner} (A:${rateA.toFixed(3)} vs B:${rateB.toFixed(3)})`);
      }
    }
  }

  // ═══════════════════════════════════════════
  // BEST TIME LEARNING
  // ═══════════════════════════════════════════

  async learnBestTimes(): Promise<void> {
    const niches = ['dental', 'medical', 'law', 'salon', 'restaurant', 'garage', 'hotel'];

    for (const niche of niches) {
      const calls = await prisma.call.findMany({
        where: { prospect: { industry: niche } },
        select: { createdAt: true, interestLevel: true },
      });

      if (calls.length < 500) continue;

      const buckets: Record<string, { total: number; converted: number }> = {};

      for (const call of calls) {
        const d = call.createdAt;
        const key = `${d.getDay()}-${d.getHours()}`;
        if (!buckets[key]) buckets[key] = { total: 0, converted: 0 };
        buckets[key].total++;
        if ((call.interestLevel || 0) >= 7) buckets[key].converted++;
      }

      for (const [key, bucketData] of Object.entries(buckets)) {
        const [dayStr, hourStr] = key.split('-');
        const dayOfWeek = parseInt(dayStr);
        const hour = parseInt(hourStr);
        const conversionRate = bucketData.total > 0 ? bucketData.converted / bucketData.total : 0;
        const entryId = `${niche}-${dayOfWeek}-${hour}`;

        await prisma.nicheBestTime.upsert({
          where: { id: entryId },
          create: {
            niche,
            dayOfWeek,
            hour,
            conversionRate,
            sampleSize: bucketData.total,
          },
          update: {
            conversionRate,
            sampleSize: bucketData.total,
          },
        });
      }

      logger.info(`Best times updated for ${niche}: ${calls.length} calls analyzed`);
    }
  }

  // ═══════════════════════════════════════════
  // INTEREST SCORE CALIBRATION
  // ═══════════════════════════════════════════

  async calibrateInterestScores(): Promise<void> {
    const niches = ['dental', 'medical', 'law', 'salon', 'restaurant', 'garage', 'hotel'];

    for (const niche of niches) {
      const callCount = await prisma.call.count({ where: { prospect: { industry: niche } } });
      if (callCount < 200) continue;

      const converted = await prisma.call.findMany({
        where: { prospect: { industry: niche }, interestLevel: { gte: 7 } },
        select: { durationSeconds: true, interestLevel: true, scriptDropOffPoint: true },
        take: 100,
      });

      const notConverted = await prisma.call.findMany({
        where: { prospect: { industry: niche }, interestLevel: { lt: 4 } },
        select: { durationSeconds: true, interestLevel: true, scriptDropOffPoint: true },
        take: 100,
      });

      if (converted.length < 20 || notConverted.length < 20) continue;

      await this.logDecision({
        type: 'script_mutation',
        niche,
        outcome: 'applied',
        details: {
          action: 'interest_calibration',
          convertedSample: converted.length,
          notConvertedSample: notConverted.length,
          avgConvertedDuration: converted.reduce((s, c) => s + (c.durationSeconds || 0), 0) / converted.length,
          avgNotConvertedDuration: notConverted.reduce((s, c) => s + (c.durationSeconds || 0), 0) / notConverted.length,
        },
      });

      logger.info(`Interest scores calibrated for ${niche}`);
    }
  }

  // ═══════════════════════════════════════════
  // GUARD SYSTEM
  // ═══════════════════════════════════════════

  private async checkGuards(
    niche: string,
    language: string,
    type: string
  ): Promise<{ allowed: boolean; guard?: string; reason?: string }> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentMutations = await prisma.scriptMutation.count({
      where: { niche, language, date: { gte: oneWeekAgo } },
    });
    if (recentMutations >= MAX_MUTATIONS_PER_NICHE_PER_WEEK) {
      return { allowed: false, guard: 'weekly_limit', reason: `Already ${recentMutations} mutations this week for ${niche}/${language}` };
    }

    if (type === 'script_change') {
      const openingChanges = await prisma.scriptMutation.count({
        where: { niche, language, changeApplied: { contains: 'opening' }, date: { gte: oneMonthAgo } },
      });
      if (openingChanges >= MAX_OPENING_CHANGES_PER_MONTH) {
        return { allowed: false, guard: 'opening_limit', reason: `Opening already changed this month for ${niche}` };
      }
    }

    return { allowed: true };
  }

  // ═══════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════

  async getStats() {
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [mutationsThisMonth, reverts, blockedDecisions, allMutations] = await Promise.all([
      prisma.scriptMutation.count({ where: { date: { gte: oneMonthAgo } } }),
      prisma.scriptMutation.count({ where: { status: 'reverted', date: { gte: oneMonthAgo } } }),
      prisma.aiDecision.count({ where: { outcome: 'blocked', timestamp: { gte: oneMonthAgo } } }),
      prisma.scriptMutation.findMany({
        where: { date: { gte: oneMonthAgo }, confidenceScore: { not: null } },
        select: { confidenceScore: true },
      }),
    ]);

    const avgConfidence = allMutations.length > 0
      ? allMutations.reduce((sum, m) => sum + (m.confidenceScore || 0), 0) / allMutations.length
      : 0;

    return { mutationsThisMonth, reverts, blocked: blockedDecisions, avgConfidence };
  }

  // ═══════════════════════════════════════════
  // LOGGING
  // ═══════════════════════════════════════════

  private async logDecision(params: {
    type: string;
    niche?: string;
    language?: string;
    confidenceScore?: number;
    dataPointsUsed?: number;
    outcome: string;
    details?: any;
  }): Promise<void> {
    await prisma.aiDecision.create({
      data: {
        type: params.type,
        niche: params.niche,
        language: params.language,
        confidenceScore: params.confidenceScore,
        dataPointsUsed: params.dataPointsUsed,
        outcome: params.outcome,
        details: params.details,
      },
    });
  }
}

export const aiLearningService = new AiLearningService();
