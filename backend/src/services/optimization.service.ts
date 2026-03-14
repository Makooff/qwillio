import { prisma } from '../config/database';
import { vapiClient } from '../config/vapi';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { discordService } from './discord.service';

// ═══════════════════════════════════════════════════════════
// CONTINUOUS OPTIMIZATION SERVICE
// Analyzes call data and auto-tunes AI assistant prompts
// Enterprise plan feature
// ═══════════════════════════════════════════════════════════
export class OptimizationService {

  // ═══════════════════════════════════════════════════════════
  // RUN WEEKLY OPTIMIZATION - Called by CRON (Sunday at midnight)
  // Analyzes last 7 days of calls per client and optimizes
  // ═══════════════════════════════════════════════════════════
  async runWeeklyOptimization(): Promise<number> {
    const clients = await prisma.client.findMany({
      where: {
        subscriptionStatus: { in: ['active', 'trialing'] },
        planType: 'enterprise', // Only Enterprise clients get auto-optimization
        vapiAssistantId: { not: null },
      },
    });

    if (clients.length === 0) return 0;

    let optimized = 0;

    for (const client of clients) {
      try {
        const result = await this.optimizeClientAssistant(client);
        if (result) optimized++;
      } catch (error) {
        logger.error(`Optimization failed for ${client.businessName}:`, error);
      }
    }

    if (optimized > 0) {
      await discordService.notify(
        `🔧 WEEKLY OPTIMIZATION\n\n${optimized}/${clients.length} Enterprise client(s) optimized`
      );
    }

    return optimized;
  }

  // ═══════════════════════════════════════════════════════════
  // OPTIMIZE A SINGLE CLIENT'S ASSISTANT
  // ═══════════════════════════════════════════════════════════
  private async optimizeClientAssistant(client: any): Promise<boolean> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get recent calls for this client
    const recentCalls = await prisma.clientCall.findMany({
      where: {
        clientId: client.id,
        createdAt: { gte: sevenDaysAgo },
        transcript: { not: null },
      },
      select: {
        transcript: true,
        summary: true,
        sentiment: true,
        outcome: true,
        tags: true,
        bookingRequested: true,
        isLead: true,
        durationSeconds: true,
      },
      take: 50, // Last 50 calls max
    });

    if (recentCalls.length < 5) {
      // Not enough data to optimize
      return false;
    }

    // Analyze patterns
    const insights = await this.analyzeCallPatterns(recentCalls, client);

    if (!insights.needsUpdate) {
      logger.debug(`No optimization needed for ${client.businessName}`);
      return false;
    }

    // Generate optimization prompt additions
    const optimizationAddendum = this.generateOptimizationAddendum(insights);

    // Update VAPI assistant with improved prompt
    try {
      const assistant = await vapiClient.getAssistant(client.vapiAssistantId);
      if (!assistant) return false;

      const assistantAny = assistant as any;
      const currentPrompt = assistantAny.model?.messages?.[0]?.content || '';

      // Remove old optimization section if exists
      const cleanPrompt = currentPrompt.replace(/\n\n--- AUTO-OPTIMIZATION ---[\s\S]*--- END OPTIMIZATION ---/, '');

      // Append new optimization section
      const updatedPrompt = `${cleanPrompt}\n\n--- AUTO-OPTIMIZATION ---\n${optimizationAddendum}\n--- END OPTIMIZATION ---`;

      await vapiClient.updateAssistant(client.vapiAssistantId, {
        model: {
          ...assistantAny.model,
          messages: [{ role: 'system', content: updatedPrompt }],
        },
      });

      logger.info(`✅ Assistant optimized for ${client.businessName}: ${insights.changes.join(', ')}`);

      await discordService.notify(
        `🔧 ASSISTANT OPTIMIZED\n\nClient: ${client.businessName}\nCalls analyzed: ${recentCalls.length}\nChanges: ${insights.changes.join(', ')}\nSentiment improvement target: ${insights.sentimentScore}%`
      );

      return true;
    } catch (error) {
      logger.error(`Failed to update VAPI assistant for ${client.businessName}:`, error);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ANALYZE CALL PATTERNS with GPT-4
  // ═══════════════════════════════════════════════════════════
  private async analyzeCallPatterns(calls: any[], client: any): Promise<OptimizationInsights> {
    const summaries = calls
      .filter(c => c.summary)
      .map(c => `[${c.sentiment || 'unknown'}] ${c.summary} (outcome: ${c.outcome || 'unknown'}, tags: ${c.tags?.join(',') || 'none'})`)
      .join('\n');

    const totalCalls = calls.length;
    const negativeCalls = calls.filter(c => c.sentiment === 'negative').length;
    const positiveCalls = calls.filter(c => c.sentiment === 'positive').length;
    const sentimentScore = Math.round(((positiveCalls * 100) + ((totalCalls - negativeCalls - positiveCalls) * 50)) / totalCalls);
    const bookingRate = Math.round((calls.filter(c => c.bookingRequested).length / totalCalls) * 100);
    const leadRate = Math.round((calls.filter(c => c.isLead).length / totalCalls) * 100);
    const avgDuration = Math.round(calls.reduce((s, c) => s + (c.durationSeconds || 0), 0) / totalCalls);

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
              content: `You are an AI call center optimization expert. Analyze these call summaries for ${client.businessName} (${client.businessType}) and identify improvements.

Current metrics:
- Sentiment score: ${sentimentScore}%
- Booking rate: ${bookingRate}%
- Lead conversion rate: ${leadRate}%
- Average call duration: ${avgDuration}s

Return JSON with:
- needsUpdate: boolean (true if meaningful improvements can be made)
- changes: string[] (list of specific changes to make, max 5)
- commonQuestions: string[] (top 5 frequently asked questions that need better answers)
- commonComplaints: string[] (top 3 issues callers complain about)
- missedOpportunities: string[] (things the AI should do differently)
- suggestedResponses: { question: string, suggestedAnswer: string }[] (better answers for common questions)
- toneAdjustment: string or null (e.g., "more empathetic", "more professional", "more casual")`,
            },
            {
              role: 'user',
              content: `Call summaries:\n${summaries}`,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await response.json() as any;
      const result = JSON.parse(data.choices[0].message.content);

      return {
        ...result,
        sentimentScore,
        bookingRate,
        leadRate,
        avgDuration,
      };
    } catch (error) {
      logger.error('Failed to analyze call patterns:', error);
      return {
        needsUpdate: false,
        changes: [],
        commonQuestions: [],
        commonComplaints: [],
        missedOpportunities: [],
        suggestedResponses: [],
        toneAdjustment: null,
        sentimentScore,
        bookingRate,
        leadRate,
        avgDuration,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GENERATE OPTIMIZATION ADDENDUM for the system prompt
  // ═══════════════════════════════════════════════════════════
  private generateOptimizationAddendum(insights: OptimizationInsights): string {
    const parts: string[] = [];
    parts.push(`Last updated: ${new Date().toISOString().split('T')[0]}`);

    if (insights.toneAdjustment) {
      parts.push(`\nTONE ADJUSTMENT: Be ${insights.toneAdjustment} in your responses.`);
    }

    if (insights.commonQuestions?.length > 0) {
      parts.push(`\nFREQUENTLY ASKED QUESTIONS (answer these confidently):`);
      insights.commonQuestions.forEach((q, i) => {
        parts.push(`${i + 1}. ${q}`);
      });
    }

    if (insights.suggestedResponses?.length > 0) {
      parts.push(`\nOPTIMIZED RESPONSES:`);
      insights.suggestedResponses.forEach(sr => {
        parts.push(`Q: "${sr.question}"\nA: "${sr.suggestedAnswer}"`);
      });
    }

    if (insights.commonComplaints?.length > 0) {
      parts.push(`\nCOMMON CONCERNS (handle with extra care):`);
      insights.commonComplaints.forEach((c, i) => {
        parts.push(`${i + 1}. ${c}`);
      });
    }

    if (insights.missedOpportunities?.length > 0) {
      parts.push(`\nIMPROVEMENT AREAS:`);
      insights.missedOpportunities.forEach((m, i) => {
        parts.push(`${i + 1}. ${m}`);
      });
    }

    return parts.join('\n');
  }
}

interface OptimizationInsights {
  needsUpdate: boolean;
  changes: string[];
  commonQuestions: string[];
  commonComplaints: string[];
  missedOpportunities: string[];
  suggestedResponses: { question: string; suggestedAnswer: string }[];
  toneAdjustment: string | null;
  sentimentScore: number;
  bookingRate: number;
  leadRate: number;
  avgDuration: number;
}

export const optimizationService = new OptimizationService();
