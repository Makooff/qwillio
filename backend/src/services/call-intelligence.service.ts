// @ts-nocheck
/**
 * Call Intelligence Engine — Ultra-intelligent self-learning system for Qwillio
 *
 * 1. Deep transcript analysis after every call (12+ fields)
 * 2. Pattern recognition engine (weekly)
 * 3. Micro-fix generation with guards
 * 4. Self-correction loop (validate/revert mutations)
 * 5. Objection tracking & optimization
 * 6. Frustration detection
 * 7. Sentiment analysis
 * 8. Weekly AI performance report
 * 9. Conversion drop alerts
 */
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { discordService } from './discord.service';

// ═══════════════════════════════════════════════════════════
// GUARD SYSTEM — Hardcoded, never override
// ═══════════════════════════════════════════════════════════
const GUARDS = {
  maxMutationsPerNichePerWeek: 1,
  maxOpeningChangesPerMonth: 1,
  maxScriptDurationSeconds: 90,
  minCallsForMutation: 20,
  minConfidenceScore: 75,
  minStatisticalSignificance: 0.05,
  neverChangeSimultaneously: ['opening', 'objection_handling'],
  cooldownAfterRevertMs: 7 * 24 * 60 * 60 * 1000,
};

function calculateConfidence(data: { callCount: number; patternConsistency: number; signalClarity: number; avgTranscriptLength: number }): number {
  let score = 0;
  if (data.callCount >= 100) score += 40;
  else if (data.callCount >= 50) score += 30;
  else if (data.callCount >= 20) score += 20;
  else return 0;
  score += Math.min(30, data.patternConsistency * 30);
  score += data.signalClarity * 20;
  score += data.avgTranscriptLength > 200 ? 10 : 5;
  return Math.min(100, score);
}

/** Call the best available AI API (Claude preferred, OpenAI fallback) */
async function callAI(prompt: string, maxTokens = 1000): Promise<any | null> {
  try {
    if (env.ANTHROPIC_API_KEY) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const text = data.content?.[0]?.text ?? '';
        const m = text.match(/\{[\s\S]*\}/);
        return m ? JSON.parse(m[0]) : null;
      }
      const err = await res.text();
      logger.error(`[CallIntel] Claude API ${res.status}: ${err.substring(0, 200)}`);
    } else if (env.OPENAI_API_KEY) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4-turbo', messages: [{ role: 'user', content: prompt }],
          temperature: 0.2, response_format: { type: 'json_object' }, max_tokens: maxTokens,
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        if (!data.choices?.[0]?.message?.content) return null;
        return JSON.parse(data.choices[0].message.content);
      }
      const err = await res.text();
      logger.error(`[CallIntel] OpenAI API ${res.status}: ${err.substring(0, 200)}`);
    }
  } catch (err) {
    logger.error('[CallIntel] AI call failed:', err);
  }
  return null;
}

export class CallIntelligenceService {

  // ═══════════════════════════════════════════════════════════
  // 1. DEEP TRANSCRIPT ANALYSIS — runs after every completed call
  // ═══════════════════════════════════════════════════════════
  async analyzeCallDeep(callId: string): Promise<void> {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { prospect: true },
    });
    if (!call?.transcript || !call.prospect) return;

    const agentName = call.language === 'fr' ? 'Marie' : 'Ashley';
    const niche = call.niche || call.prospect.businessType || 'unknown';

    const result = await callAI(
      `You are an expert sales coach analyzing a cold call transcript.
Product: Qwillio — AI receptionist for small businesses.
Agent: ${agentName} (${call.language === 'fr' ? 'French' : 'English'}).
Niche: ${niche} | Business: ${call.prospect.businessName}

Analyze this transcript and return JSON only:
{
  "drop_off_point": "opening|pain_amplification|solution|pricing|objection_handling|completed",
  "drop_off_reason": "one sentence explaining why prospect disengaged",
  "prospect_sentiment": "hostile|skeptical|neutral|curious|interested|enthusiastic",
  "sentiment_shift": "improved|stable|declined",
  "key_objection": "exact objection raised or null",
  "what_worked": "what got a positive reaction or null",
  "what_failed": "exact moment that caused disengagement or null",
  "missed_opportunity": "what should have been said instead or null",
  "prospect_pain_level": 1,
  "agent_confidence_score": 1,
  "call_quality_score": 1,
  "recommended_micro_fix": "one surgical change, max 2 sentences",
  "sentiment_timeline": [{"time_seconds": 0, "sentiment": "neutral"}],
  "filler_words_used": ["um"]
}
All number fields are integers 1-10.

Transcript:
${call.transcript.substring(0, 4000)}`
    );

    if (!result) return;

    try {
      await prisma.call.update({
        where: { id: callId },
        data: {
          scriptDropOffPoint: result.drop_off_point !== 'completed' ? result.drop_off_point : null,
          dropOffReason: result.drop_off_reason || null,
          prospectSentiment: result.prospect_sentiment || null,
          sentimentShift: result.sentiment_shift || null,
          keyObjection: result.key_objection || null,
          whatWorked: result.what_worked || null,
          whatFailed: result.what_failed || null,
          missedOpportunity: result.missed_opportunity || null,
          prospectPainLevel: typeof result.prospect_pain_level === 'number' ? result.prospect_pain_level : null,
          agentConfidenceScore: typeof result.agent_confidence_score === 'number' ? result.agent_confidence_score : null,
          callQualityScore: typeof result.call_quality_score === 'number' ? result.call_quality_score : null,
          recommendedMicroFix: result.recommended_micro_fix || null,
          sentimentTimeline: result.sentiment_timeline ?? undefined,
          fillerWordsUsed: Array.isArray(result.filler_words_used) ? result.filler_words_used : [],
        },
      });

      // Track objection
      if (result.key_objection) {
        await this.trackObjection(niche, call.language || 'en', result.key_objection, (call.interestLevel ?? 0) >= 5);
      }

      // Frustration detection
      if (result.sentiment_shift === 'declined' && (result.prospect_sentiment === 'hostile' || result.prospect_sentiment === 'skeptical')) {
        await this.checkFrustrationTrigger(niche, result.what_failed || result.drop_off_reason || 'unknown');
      }

      logger.info(`[CallIntel] Deep analysis: ${callId} → ${result.drop_off_point} (quality: ${result.call_quality_score}/10)`);
    } catch (error) {
      logger.error(`[CallIntel] Failed to save deep analysis for ${callId}:`, error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 2. OBJECTION TRACKING
  // ═══════════════════════════════════════════════════════════
  private async trackObjection(niche: string, language: string, objectionText: string, recovered: boolean): Promise<void> {
    try {
      const normalized = objectionText.toLowerCase().trim().substring(0, 200);
      const existing = await prisma.objectionHandler.findFirst({
        where: { niche, language, objectionText: { contains: normalized.substring(0, 50), mode: 'insensitive' } },
      });

      if (existing) {
        const winRateField = existing.activeHandler === 'v1' ? 'winRateV1' : 'winRateV2';
        const currentWinRate = existing.activeHandler === 'v1' ? existing.winRateV1 : existing.winRateV2;
        const newWinRate = (currentWinRate * existing.frequency + (recovered ? 1 : 0)) / (existing.frequency + 1);
        await prisma.objectionHandler.update({
          where: { id: existing.id },
          data: { frequency: { increment: 1 }, [winRateField]: newWinRate },
        });
      } else {
        await prisma.objectionHandler.create({
          data: { niche, language, objectionText: normalized, frequency: 1, winRateV1: recovered ? 1 : 0, activeHandler: 'v1' },
        });
      }
    } catch (error) {
      logger.error('[CallIntel] Objection tracking failed:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 3. FRUSTRATION DETECTION
  // ═══════════════════════════════════════════════════════════
  private async checkFrustrationTrigger(niche: string, trigger: string): Promise<void> {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const count = await prisma.call.count({
        where: { niche, sentimentShift: 'declined', createdAt: { gte: oneWeekAgo } },
      });
      if (count >= 5) {
        await discordService.notifyAlerts(
          `🚨 FRUSTRATION ALERT — ${niche}\n${count} calls this week with declining sentiment\nTrigger: "${trigger.substring(0, 100)}"\n⚠️ Script section may need review`
        );
      }
    } catch (error) {
      logger.error('[CallIntel] Frustration check failed:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 4. WEEKLY PATTERN RECOGNITION (Sunday 1am upgrade)
  // ═══════════════════════════════════════════════════════════
  async runWeeklyPatternAnalysis(): Promise<void> {
    logger.info('[CallIntel] Starting weekly pattern analysis...');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const nicheGroups = await prisma.call.groupBy({
      by: ['niche', 'language'],
      where: { niche: { not: null }, language: { not: null }, createdAt: { gte: sevenDaysAgo }, status: 'completed' },
      _count: { id: true },
    });

    for (const group of nicheGroups) {
      if (!group.niche || !group.language || group._count.id < GUARDS.minCallsForMutation) continue;
      try {
        await this.analyzeNichePatterns(group.niche, group.language, sevenDaysAgo);
      } catch (err) {
        logger.error(`[CallIntel] Pattern analysis failed for ${group.niche}/${group.language}:`, err);
      }
    }

    await this.optimizeTopObjections();
    await this.evaluateMutations();
    await this.generateWeeklyReport(sevenDaysAgo);
    await this.checkConversionAlerts(sevenDaysAgo);

    logger.info('[CallIntel] Weekly pattern analysis complete');
  }

  private async analyzeNichePatterns(niche: string, language: string, since: Date): Promise<void> {
    const guardResult = await this.checkAllGuards(niche, language, 'script_change');
    if (!guardResult.allowed) {
      await this.logDecision('guard_blocked', niche, language, 'blocked', { guard: guardResult.guard, reason: guardResult.reason });
      return;
    }

    const calls = await prisma.call.findMany({
      where: { niche, language, createdAt: { gte: since }, status: 'completed', transcript: { not: null } },
      select: {
        scriptDropOffPoint: true, dropOffReason: true, keyObjection: true,
        whatWorked: true, whatFailed: true, interestLevel: true, interestScore: true,
        callQualityScore: true, durationSeconds: true, transcript: true,
      },
    });

    if (calls.length < GUARDS.minCallsForMutation) return;

    const successful = calls.filter(c => (c.interestLevel ?? 0) >= 5 || (c.interestScore ?? 0) >= 5);
    const failed = calls.filter(c => (c.interestLevel ?? 0) < 4);

    const dropOffCounts: Record<string, number> = {};
    for (const c of failed) {
      if (c.scriptDropOffPoint) dropOffCounts[c.scriptDropOffPoint] = (dropOffCounts[c.scriptDropOffPoint] || 0) + 1;
    }

    const avgTranscriptLen = calls.reduce((s, c) => s + (c.transcript?.length ?? 0), 0) / calls.length;
    const topDropOff = Object.entries(dropOffCounts).sort((a, b) => b[1] - a[1])[0];
    const patternConsistency = topDropOff ? topDropOff[1] / Math.max(failed.length, 1) : 0;

    const confidence = calculateConfidence({ callCount: calls.length, patternConsistency, signalClarity: topDropOff && topDropOff[1] >= 5 ? 0.8 : 0.4, avgTranscriptLength: avgTranscriptLen });
    if (confidence < GUARDS.minConfidenceScore) return;

    const synthesis = await callAI(
      `Given ${calls.length} call analyses for "${niche}" (${language}):

FAILED (${failed.length}):
- Drop-off distribution: ${JSON.stringify(dropOffCounts)}
- Drop-off reasons: ${JSON.stringify(failed.filter(c => c.dropOffReason).map(c => c.dropOffReason).slice(0, 10))}
- Objections: ${JSON.stringify(failed.filter(c => c.keyObjection).map(c => c.keyObjection).slice(0, 10))}
- What failed: ${JSON.stringify(failed.filter(c => c.whatFailed).map(c => c.whatFailed).slice(0, 10))}

SUCCESSFUL (${successful.length}):
- What worked: ${JSON.stringify(successful.filter(c => c.whatWorked).map(c => c.whatWorked).slice(0, 10))}

Identify:
1. Single highest-impact script change (max 1 sentence)
2. Most common objection and best recovery response
3. Exact winning phrase from successful calls
4. One thing to REMOVE

Return JSON: {
  "opening_fix": "string or null",
  "objection_fix": { "objection": "string", "response": "string" },
  "winning_phrase": "string or null",
  "remove_this": "string or null",
  "micro_fix": { "target": "sentence to replace", "replacement": "new sentence", "reason": "why", "expected_impact": "string" },
  "confidence_score": 75
}`
    );

    if (!synthesis?.micro_fix) return;
    const fixConfidence = synthesis.confidence_score ?? confidence;
    if (fixConfidence < GUARDS.minConfidenceScore) return;

    const conversionBefore = calls.length > 0 ? successful.length / calls.length : 0;

    await prisma.scriptMutation.create({
      data: {
        niche, language,
        type: topDropOff?.[0] || 'script_change',
        changeApplied: `TARGET: ${synthesis.micro_fix.target}\nREPLACEMENT: ${synthesis.micro_fix.replacement}`,
        reason: `${synthesis.micro_fix.reason}. Expected: ${synthesis.micro_fix.expected_impact}. Based on ${calls.length} calls. Confidence: ${fixConfidence}%.`,
        callsBefore: calls.length, conversionBefore,
        status: 'testing', confidenceScore: fixConfidence,
      },
    });

    await this.logDecision('script_mutation', niche, language, 'applied', { synthesis, callCount: calls.length, failedCount: failed.length }, fixConfidence, calls.length);
    await discordService.notifySystem(
      `🧠 INTELLIGENT MUTATION — ${niche}/${language}\nBased on ${calls.length} calls (${failed.length} failures)\nTop drop-off: ${topDropOff?.[0] || 'N/A'} (${topDropOff?.[1] || 0}x)\nFix: ${(synthesis.micro_fix.replacement || '').substring(0, 100)}\nConfidence: ${fixConfidence}%`
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 5. OBJECTION OPTIMIZATION (weekly)
  // ═══════════════════════════════════════════════════════════
  private async optimizeTopObjections(): Promise<void> {
    const objections = await prisma.objectionHandler.findMany({
      where: { frequency: { gte: 5 } },
      orderBy: { frequency: 'desc' },
      take: 20,
    });

    const byNiche: Record<string, typeof objections> = {};
    for (const obj of objections) {
      if (!byNiche[obj.niche]) byNiche[obj.niche] = [];
      byNiche[obj.niche].push(obj);
    }

    for (const [niche, nicheObjs] of Object.entries(byNiche)) {
      const needsImprovement = nicheObjs
        .filter(o => (o.activeHandler === 'v1' ? o.winRateV1 : o.winRateV2) < 0.3)
        .slice(0, 2);

      for (const obj of needsImprovement) {
        const result = await callAI(
          `Expert cold call objection handler for Qwillio (AI receptionist SaaS).
Niche: ${niche} | Language: ${obj.language}

Objection "${obj.objectionText}" appears ${obj.frequency}x with ${Math.round((obj.activeHandler === 'v1' ? obj.winRateV1 : obj.winRateV2) * 100)}% recovery.

Generate a NEW response: empathetic, reframes with benefit, max 30 words, ${obj.language === 'fr' ? 'French' : 'English'}.
Return JSON: { "new_handler": "response text", "confidence": 75 }`
        );

        if (result?.new_handler && (result.confidence ?? 0) >= 60) {
          const updateField = obj.activeHandler === 'v1' ? 'handlerV2' : 'handlerV1';
          await prisma.objectionHandler.update({ where: { id: obj.id }, data: { [updateField]: result.new_handler } });
          logger.info(`[CallIntel] New objection handler for "${obj.objectionText.substring(0, 50)}..." in ${niche}`);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 6. SELF-CORRECTION LOOP — validate or revert mutations
  // ═══════════════════════════════════════════════════════════
  async evaluateMutations(): Promise<void> {
    const testingMutations = await prisma.scriptMutation.findMany({ where: { status: 'testing' } });

    for (const mutation of testingMutations) {
      const callsAfter = await prisma.call.count({
        where: { niche: mutation.niche, language: mutation.language, createdAt: { gte: mutation.createdAt }, status: 'completed' },
      });
      if (callsAfter < 50) continue;

      const conversionsAfter = await prisma.call.count({
        where: {
          niche: mutation.niche, language: mutation.language, createdAt: { gte: mutation.createdAt }, status: 'completed',
          OR: [{ interestLevel: { gte: 5 } }, { interestScore: { gte: 5 } }],
        },
      });

      const conversionAfter = callsAfter > 0 ? conversionsAfter / callsAfter : 0;
      const pA = mutation.conversionBefore;
      const pB = conversionAfter;
      const nA = mutation.callsBefore;
      const nB = callsAfter;
      const pPooled = nA + nB > 0 ? (pA * nA + pB * nB) / (nA + nB) : 0;
      const se = pPooled > 0 && pPooled < 1 ? Math.sqrt(pPooled * (1 - pPooled) * (1 / nA + 1 / nB)) : 0;
      const zScore = se > 0 ? Math.abs(pB - pA) / se : 0;
      const pValue = 2 * (1 - this.normalCDF(zScore));

      const improved = conversionAfter > mutation.conversionBefore;
      const significant = pValue < GUARDS.minStatisticalSignificance;

      if (improved && significant) {
        await prisma.scriptMutation.update({
          where: { id: mutation.id },
          data: {
            status: 'validated', callsAfter, conversionAfter, statisticalSignificance: pValue,
            callsVariantA: nA, callsVariantB: nB, conversionVariantA: pA, conversionVariantB: pB,
          },
        });
        await discordService.notifySystem(`✅ MUTATION VALIDATED — ${mutation.niche}/${mutation.language}\nConversion: ${(pA * 100).toFixed(1)}% → ${(pB * 100).toFixed(1)}% (p=${pValue.toFixed(4)})`);
      } else if (!improved || (callsAfter >= 100 && !significant)) {
        let forensics = '';
        try {
          const failedSamples = await prisma.call.findMany({
            where: { niche: mutation.niche, language: mutation.language, createdAt: { gte: mutation.createdAt }, interestLevel: { lt: 4 } },
            select: { whatFailed: true, dropOffReason: true },
            take: 5,
          });
          const result = await callAI(
            `Mutation "${mutation.changeApplied}" reverted after ${callsAfter} calls. Before: ${(pA * 100).toFixed(1)}%. After: ${(pB * 100).toFixed(1)}%. Failed insights: ${JSON.stringify(failedSamples.map(s => s.whatFailed || s.dropOffReason).filter(Boolean).slice(0, 5))}. Why did it fail? 2 sentences max.`,
            200
          );
          forensics = typeof result === 'string' ? result : (result?.analysis || result?.reason || JSON.stringify(result || ''));
        } catch (_) {}

        await prisma.scriptMutation.update({
          where: { id: mutation.id },
          data: {
            status: 'reverted', callsAfter, conversionAfter, revertedAt: new Date(),
            revertReason: `Conversion ${improved ? 'not significant' : 'dropped'}: ${(pA * 100).toFixed(1)}% → ${(pB * 100).toFixed(1)}%`,
            revertForensics: forensics.substring(0, 1000),
            statisticalSignificance: pValue, callsVariantA: nA, callsVariantB: nB, conversionVariantA: pA, conversionVariantB: pB,
          },
        });
        await discordService.notifyAlerts(`↩️ MUTATION REVERTED — ${mutation.niche}/${mutation.language}\nConversion: ${(pA * 100).toFixed(1)}% → ${(pB * 100).toFixed(1)}%\n${forensics.substring(0, 150)}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 7. WEEKLY REPORT — Discord
  // ═══════════════════════════════════════════════════════════
  async generateWeeklyReport(since: Date): Promise<void> {
    try {
      const twoWeeksAgo = new Date(since.getTime() - 7 * 24 * 60 * 60 * 1000);

      const thisWeekCalls = await prisma.call.findMany({
        where: { createdAt: { gte: since }, status: 'completed' },
        select: { niche: true, interestLevel: true, interestScore: true, callQualityScore: true },
      });
      const lastWeekCalls = await prisma.call.findMany({
        where: { createdAt: { gte: twoWeeksAgo, lt: since }, status: 'completed' },
        select: { interestLevel: true, interestScore: true },
      });

      const thisAvg = thisWeekCalls.length > 0 ? thisWeekCalls.reduce((s, c) => s + (c.interestLevel ?? c.interestScore ?? 0), 0) / thisWeekCalls.length : 0;
      const lastAvg = lastWeekCalls.length > 0 ? lastWeekCalls.reduce((s, c) => s + (c.interestLevel ?? c.interestScore ?? 0), 0) / lastWeekCalls.length : 0;

      const thisConverted = thisWeekCalls.filter(c => (c.interestLevel ?? 0) >= 7).length;
      const lastConverted = lastWeekCalls.filter(c => (c.interestLevel ?? 0) >= 7).length;
      const thisRate = thisWeekCalls.length > 0 ? thisConverted / thisWeekCalls.length * 100 : 0;
      const lastRate = lastWeekCalls.length > 0 ? lastConverted / lastWeekCalls.length * 100 : 0;

      const nicheStats: Record<string, { total: number; converted: number }> = {};
      for (const c of thisWeekCalls) {
        const n = c.niche || 'unknown';
        if (!nicheStats[n]) nicheStats[n] = { total: 0, converted: 0 };
        nicheStats[n].total++;
        if ((c.interestLevel ?? 0) >= 7) nicheStats[n].converted++;
      }
      const nicheRates = Object.entries(nicheStats).map(([n, s]) => ({ niche: n, rate: s.total > 0 ? s.converted / s.total * 100 : 0, total: s.total })).filter(n => n.total >= 3).sort((a, b) => b.rate - a.rate);

      const mutations = await prisma.scriptMutation.findMany({
        where: { createdAt: { gte: since } },
        select: { niche: true, language: true, changeApplied: true, status: true },
      });

      const topObj = await prisma.objectionHandler.findFirst({ orderBy: { frequency: 'desc' }, where: { frequency: { gte: 3 } } });

      const report =
        `📊 WEEKLY AI LEARNING REPORT — ${since.toLocaleDateString('en-US')}\n\n` +
        `PERFORMANCE:\n` +
        `• Interest: ${thisAvg.toFixed(1)}/10 (${thisAvg - lastAvg >= 0 ? '+' : ''}${(thisAvg - lastAvg).toFixed(1)})\n` +
        `• Conversion: ${thisRate.toFixed(1)}% (${thisRate - lastRate >= 0 ? '+' : ''}${(thisRate - lastRate).toFixed(1)}%)\n` +
        `• Calls: ${thisWeekCalls.length}\n` +
        (nicheRates[0] ? `• Best: ${nicheRates[0].niche} ${nicheRates[0].rate.toFixed(0)}%\n` : '') +
        (nicheRates.length > 1 ? `• Worst: ${nicheRates[nicheRates.length - 1].niche} ${nicheRates[nicheRates.length - 1].rate.toFixed(0)}%\n` : '') +
        `\nMUTATIONS: ${mutations.length > 0 ? mutations.map(m => `${m.niche}/${m.language}: ${m.status}`).join(', ') : 'none'}` +
        (topObj ? `\nTOP OBJECTION: "${topObj.objectionText.substring(0, 60)}" (${topObj.frequency}x)` : '');

      await discordService.notifySystem(report);
    } catch (error) {
      logger.error('[CallIntel] Weekly report failed:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 8. CONVERSION DROP ALERTS
  // ═══════════════════════════════════════════════════════════
  private async checkConversionAlerts(since: Date): Promise<void> {
    try {
      const prevWeek = new Date(since.getTime() - 7 * 24 * 60 * 60 * 1000);
      const nicheGroups = await prisma.call.groupBy({
        by: ['niche'],
        where: { createdAt: { gte: since }, status: 'completed', niche: { not: null } },
        _count: { id: true },
      });

      for (const group of nicheGroups) {
        if (!group.niche || group._count.id < 10) continue;
        const thisConverted = await prisma.call.count({ where: { niche: group.niche, createdAt: { gte: since }, status: 'completed', interestLevel: { gte: 7 } } });
        const thisRate = thisConverted / group._count.id;
        const lastTotal = await prisma.call.count({ where: { niche: group.niche, createdAt: { gte: prevWeek, lt: since }, status: 'completed' } });
        const lastConverted = await prisma.call.count({ where: { niche: group.niche, createdAt: { gte: prevWeek, lt: since }, status: 'completed', interestLevel: { gte: 7 } } });
        const lastRate = lastTotal > 0 ? lastConverted / lastTotal : 0;

        if (lastRate > 0 && thisRate < lastRate * 0.8) {
          await discordService.notifyAlerts(`⚠️ CONVERSION DROP — ${group.niche}\nThis week: ${(thisRate * 100).toFixed(1)}% | Last: ${(lastRate * 100).toFixed(1)}%\nDrop: ${((1 - thisRate / lastRate) * 100).toFixed(0)}%`);
        }
      }
    } catch (error) {
      logger.error('[CallIntel] Conversion alert failed:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GUARD SYSTEM
  // ═══════════════════════════════════════════════════════════
  private async checkAllGuards(niche: string, language: string, type: string): Promise<{ allowed: boolean; guard?: string; reason?: string }> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentMutations = await prisma.scriptMutation.count({ where: { niche, language, createdAt: { gte: oneWeekAgo } } });
    if (recentMutations >= GUARDS.maxMutationsPerNichePerWeek)
      return { allowed: false, guard: 'weekly_limit', reason: `${recentMutations} mutation(s) this week` };

    if (type === 'opening') {
      const openingChanges = await prisma.scriptMutation.count({ where: { niche, language, type: 'opening', createdAt: { gte: oneMonthAgo } } });
      if (openingChanges >= GUARDS.maxOpeningChangesPerMonth)
        return { allowed: false, guard: 'opening_monthly', reason: 'Opening already changed this month' };
    }

    for (const blockedType of GUARDS.neverChangeSimultaneously) {
      if (blockedType !== type) {
        const hasRecent = await prisma.scriptMutation.count({ where: { niche, language, type: blockedType, createdAt: { gte: oneWeekAgo } } });
        if (hasRecent > 0) return { allowed: false, guard: 'simultaneous', reason: `Cannot change "${type}" while "${blockedType}" changed this week` };
      }
    }

    const recentRevert = await prisma.scriptMutation.findFirst({
      where: { niche, language, status: 'reverted', revertedAt: { gte: new Date(Date.now() - GUARDS.cooldownAfterRevertMs) } },
    });
    if (recentRevert) return { allowed: false, guard: 'revert_cooldown', reason: '7-day cooldown after revert active' };

    return { allowed: true };
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════
  private normalCDF(x: number): number {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  }

  private async logDecision(type: string, niche: string, language: string, outcome: string, details: any, confidence?: number, dataPoints?: number): Promise<void> {
    await prisma.aiDecision.create({
      data: { type, niche, language, outcome, confidenceScore: confidence, dataPointsUsed: dataPoints, details },
    });
  }
}

export const callIntelligenceService = new CallIntelligenceService();
