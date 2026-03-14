import { prisma } from '../config/database';
import { logger } from '../config/logger';

export class NicheLearningService {
  /**
   * After a non-converting call, extract failure insights using GPT-4
   * and store them in the NicheInsight table for future prompt enrichment.
   */
  async extractFailureInsights(callId: string, analysis: any, niche: string): Promise<void> {
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
              content: `You are an expert sales coach analyzing why a cold call failed to convert.

The niche is: ${niche}
Call outcome: ${analysis.outcome}
Interest level: ${analysis.interestLevel}/10
Objections raised: ${JSON.stringify(analysis.objections)}
Pain points mentioned: ${JSON.stringify(analysis.painPoints)}
Summary: ${analysis.summary}

Extract actionable insights as a JSON array. Each insight should have:
- insightType: one of "objection_pattern", "timing_issue", "pitch_weakness", "competitor_mention", "price_sensitivity", "trust_barrier", "decision_process"
- content: a concise, actionable insight (1 sentence max)
- suggestedAdjustment: how Ashley should adapt her script for this niche (1 sentence)

Return JSON: { "insights": [...] }
Only include genuinely useful insights — skip generic ones. Max 3 insights per call.`,
            },
            {
              role: 'user',
              content: `Analyze this failed call and extract niche-specific learnings.`,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await response.json() as any;
      const result = JSON.parse(data.choices[0].message.content);

      if (!result.insights || !Array.isArray(result.insights)) return;

      for (const insight of result.insights) {
        const content = `${insight.content} → ${insight.suggestedAdjustment}`;

        await prisma.nicheInsight.upsert({
          where: {
            niche_insightType_content: {
              niche,
              insightType: insight.insightType,
              content,
            },
          },
          update: {
            frequency: { increment: 1 },
            sampleSize: { increment: 1 },
            confidence: { increment: 0.1 },
            lastSeenAt: new Date(),
          },
          create: {
            niche,
            insightType: insight.insightType,
            content,
            frequency: 1,
            sampleSize: 1,
            confidence: 0.5,
            source: 'post_call',
          },
        });
      }

      logger.info(`Extracted ${result.insights.length} insights for niche "${niche}" from call ${callId}`);
    } catch (error) {
      logger.error(`Failed to extract failure insights for call ${callId}:`, error);
    }
  }

  /**
   * Get recent active insights for a niche, formatted for prompt injection.
   */
  async getRecentInsights(niche: string): Promise<string> {
    const insights = await prisma.nicheInsight.findMany({
      where: {
        niche,
        isActive: true,
        confidence: { gte: 0.3 },
      },
      orderBy: [
        { frequency: 'desc' },
        { confidence: 'desc' },
      ],
      take: 10,
    });

    if (insights.length === 0) return '';

    const grouped: Record<string, string[]> = {};
    for (const i of insights) {
      if (!grouped[i.insightType]) grouped[i.insightType] = [];
      grouped[i.insightType].push(`- ${i.content} (seen ${i.frequency}x)`);
    }

    let section = '\n\nRECENT LEARNINGS FOR THIS NICHE (adapt your approach accordingly):\n';
    for (const [type, items] of Object.entries(grouped)) {
      const label = type.replace(/_/g, ' ').toUpperCase();
      section += `\n${label}:\n${items.join('\n')}\n`;
    }

    return section;
  }

  /**
   * Weekly aggregation: analyze all calls from past week per niche,
   * generate higher-level insights, prune stale ones.
   */
  async runWeeklyAggregation(): Promise<number> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // 1. Prune stale insights (not seen in 30 days)
    const pruned = await prisma.nicheInsight.updateMany({
      where: {
        lastSeenAt: { lt: thirtyDaysAgo },
        isActive: true,
      },
      data: { isActive: false },
    });
    if (pruned.count > 0) {
      logger.info(`Pruned ${pruned.count} stale niche insights`);
    }

    // 2. Get all niches with recent calls
    const recentCalls = await prisma.call.findMany({
      where: {
        createdAt: { gte: oneWeekAgo },
        status: 'completed',
        interestLevel: { not: null, lt: 7 },
      },
      include: { prospect: { select: { businessType: true } } },
    });

    const nicheCallCounts: Record<string, number> = {};
    for (const call of recentCalls) {
      const niche = call.prospect?.businessType;
      if (niche) {
        nicheCallCounts[niche] = (nicheCallCounts[niche] || 0) + 1;
      }
    }

    // 3. For niches with 5+ failed calls this week, generate aggregated insight
    let aggregated = 0;
    for (const [niche, count] of Object.entries(nicheCallCounts)) {
      if (count < 5) continue;

      const nicheCalls = recentCalls.filter(c => c.prospect?.businessType === niche);
      const objections = nicheCalls.flatMap(c => c.objections || []);
      const outcomes = nicheCalls.map(c => c.outcome).filter(Boolean);

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
                content: `You are a sales strategy analyst. Analyze weekly call data for the "${niche}" niche and produce 1-2 high-level strategic insights.

This week's data:
- ${count} non-converting calls
- Common objections: ${JSON.stringify(objections)}
- Outcomes: ${JSON.stringify(outcomes)}

Return JSON: { "insights": [{ "insightType": "weekly_pattern", "content": "...", "suggestedAdjustment": "..." }] }
Focus on patterns, not individual calls. Max 2 insights.`,
              },
              { role: 'user', content: 'Generate weekly aggregated insights.' },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          }),
        });

        const data = await response.json() as any;
        const result = JSON.parse(data.choices[0].message.content);

        for (const insight of result.insights || []) {
          const content = `[WEEKLY] ${insight.content} → ${insight.suggestedAdjustment}`;
          await prisma.nicheInsight.upsert({
            where: {
              niche_insightType_content: {
                niche,
                insightType: 'weekly_pattern',
                content,
              },
            },
            update: {
              frequency: { increment: 1 },
              sampleSize: count,
              confidence: Math.min(0.9, 0.5 + count * 0.05),
              lastSeenAt: new Date(),
            },
            create: {
              niche,
              insightType: 'weekly_pattern',
              content,
              frequency: 1,
              sampleSize: count,
              confidence: Math.min(0.9, 0.5 + count * 0.05),
              source: 'weekly_aggregation',
            },
          });
        }

        aggregated++;
        logger.info(`Weekly aggregation for "${niche}": ${count} calls analyzed`);
      } catch (error) {
        logger.error(`Weekly aggregation failed for niche "${niche}":`, error);
      }
    }

    logger.info(`Weekly niche learning aggregation complete: ${aggregated} niches processed, ${pruned.count} stale insights pruned`);
    return aggregated;
  }
}

export const nicheLearningService = new NicheLearningService();
