/**
 * A/B Testing Engine — Part 7 of the prospecting spec
 * Tracks 2 script variants per niche/language.
 * Auto-selects winner after 200 connected calls if diff > 15%.
 * Generates new challenger via Claude API after winner is decided.
 */
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { discordService } from './discord.service';

// ─── Default A/B test seeds (niche → initial variants) ───
const DEFAULT_VARIANTS: Record<string, { a: string; b: string }> = {
  'home_services_en': {
    a: "Hi, this is Ashley — quick question, when you're out on a job and your phone rings, what usually happens to that call?",
    b: "Hi, is this {{business_name}}? Great — I'll be quick. I'm Ashley from Qwillio. We work with plumbers and HVAC guys in {{city}} to make sure they never miss a customer call again.",
  },
  'dental_en': {
    a: "Hi, this is Ashley calling for {{business_name}}. Quick question — when your front desk is with a patient, what happens to calls coming in?",
    b: "Hi, I'm Ashley from Qwillio. Quick question for the office manager — when you're with a patient and the phone rings, who picks it up?",
  },
  'home_services_fr': {
    a: "Allô, bonjour — c'est Marie de Qwillio. Question rapide — quand vous êtes sur un chantier et votre téléphone sonne, ça se passe comment ?",
    b: "Bonjour, c'est Marie de Qwillio. Je suis rapide — vous êtes {{business_name}} à {{city}} ? Parfait. On aide les artisans à ne plus jamais manquer un appel client.",
  },
  'dental_fr': {
    a: "Bonjour, c'est Marie de Qwillio. Quand votre secrétaire est avec un patient, qu'est-ce qui se passe avec les appels entrants ?",
    b: "Bonjour, Marie de Qwillio. Question rapide — combien d'appels votre cabinet manque-t-il par semaine quand la secrétaire est occupée ?",
  },
};

export class AbTestingService {
  /** Pick the variant to use for an outbound call */
  async pickVariant(niche: string, language: string): Promise<'A' | 'B'> {
    const test = await this.getOrCreateTest(niche, language);
    if (!test) return 'A';

    // If a winner was decided, always use winner
    if (test.winner) return test.winner as 'A' | 'B';

    // Alternate: whichever has fewer calls gets the next one
    return test.callsA <= test.callsB ? 'A' : 'B';
  }

  /** Record a call attempt for variant tracking */
  async recordCall(niche: string, language: string, variant: 'A' | 'B'): Promise<void> {
    const test = await this.getOrCreateTest(niche, language);
    if (!test) return;

    await prisma.scriptAbTest.update({
      where: { id: test.id },
      data: variant === 'A'
        ? { callsA: { increment: 1 } }
        : { callsB: { increment: 1 } },
    });
  }

  /** Record a conversion (interest score >= 5) */
  async recordConversion(niche: string, language: string, variant: 'A' | 'B'): Promise<void> {
    const test = await this.getOrCreateTest(niche, language);
    if (!test) return;

    await prisma.scriptAbTest.update({
      where: { id: test.id },
      data: variant === 'A'
        ? { conversionsA: { increment: 1 } }
        : { conversionsB: { increment: 1 } },
    });
  }

  /** Run analysis — called weekly or when sample is large enough */
  async analyzeAll(): Promise<void> {
    const tests = await prisma.scriptAbTest.findMany({
      where: { active: true, winner: null },
    });

    for (const test of tests) {
      const totalA = test.callsA;
      const totalB = test.callsB;

      // Require at least 200 connected calls per variant
      if (totalA < 200 || totalB < 200) continue;

      const rateA = totalA > 0 ? test.conversionsA / totalA : 0;
      const rateB = totalB > 0 ? test.conversionsB / totalB : 0;

      const diff = Math.abs(rateA - rateB);
      if (diff < 0.15) continue; // Need > 15% relative difference

      const winner = rateA >= rateB ? 'A' : 'B';
      const loser  = winner === 'A' ? 'B' : 'A';

      logger.info(`[A/B] Winner decided for ${test.niche}/${test.language}: Variant ${winner} (${(Math.max(rateA, rateB) * 100).toFixed(1)}% vs ${(Math.min(rateA, rateB) * 100).toFixed(1)}%)`);

      // Generate new challenger
      const newChallenger = await this.generateChallenger(
        test.niche,
        test.language,
        winner === 'A' ? test.variantA : test.variantB,
        winner === 'A' ? rateA : rateB,
      );

      // Mark current test as decided, create new test
      await prisma.scriptAbTest.update({
        where: { id: test.id },
        data: { winner, decidedAt: new Date(), active: false },
      });

      await prisma.scriptAbTest.create({
        data: {
          niche: test.niche,
          language: test.language,
          variantA: winner === 'A' ? test.variantA : test.variantB, // Keep winner as A
          variantB: newChallenger,
          active: true,
        },
      });

      await discordService.notifySystem(
        `🧪 A/B TEST RESULT — ${test.niche} (${test.language})\n` +
        `Winner: Variant ${winner} (${(Math.max(rateA, rateB) * 100).toFixed(1)}% vs ${(Math.min(rateA, rateB) * 100).toFixed(1)}%)\n` +
        `New challenger generated and deployed`
      );
    }
  }

  /** Get or create the active A/B test for a niche/language */
  private async getOrCreateTest(niche: string, language: string) {
    const existing = await prisma.scriptAbTest.findFirst({
      where: { niche, language, active: true },
    });
    if (existing) return existing;

    const key = `${niche}_${language}`;
    const defaults = DEFAULT_VARIANTS[key] ?? DEFAULT_VARIANTS['home_services_en'];

    return prisma.scriptAbTest.create({
      data: {
        niche,
        language,
        variantA: defaults.a,
        variantB: defaults.b,
        active: true,
      },
    });
  }

  /** Generate a new script challenger via Claude API */
  private async generateChallenger(
    niche: string,
    language: string,
    winnerScript: string,
    winnerRate: number,
  ): Promise<string> {
    const apiKey = env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY;
    if (!apiKey) return winnerScript; // Fallback to winner if no AI key

    try {
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
            messages: [{
              role: 'user',
              content: `You are an expert cold call script writer for an AI receptionist SaaS called Qwillio.

The current winning script for ${niche} in ${language} has a ${(winnerRate * 100).toFixed(1)}% conversion rate:
"${winnerScript}"

Write a new challenger variant that:
1. Opens with a different angle or question
2. Still focuses on missed calls and lost revenue
3. Is natural, conversational, max 3 sentences for the opener
4. Language: ${language === 'fr' ? 'French' : 'English'}
5. Uses {{business_name}} and {{city}} as placeholders

Return ONLY the opening script text, no explanation.`,
            }],
          }),
        });

        if (res.ok) {
          const data = await res.json() as any;
          return data.content?.[0]?.text?.trim() ?? winnerScript;
        }
      } else {
        // OpenAI fallback
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{
              role: 'user',
              content: `You are an expert cold call script writer for Qwillio (AI receptionist SaaS).
Current winning script for ${niche}/${language}: "${winnerScript}" (${(winnerRate*100).toFixed(1)}% conversion)
Write a challenger variant with a different opening angle. Max 3 sentences. Use {{business_name}} and {{city}} placeholders.
Language: ${language === 'fr' ? 'French' : 'English'}. Return only the script text.`,
            }],
            temperature: 0.7,
            max_tokens: 300,
          }),
        });

        if (res.ok) {
          const data = await res.json() as any;
          return data.choices?.[0]?.message?.content?.trim() ?? winnerScript;
        }
      }
    } catch (err) {
      logger.error('[A/B] Challenger generation failed:', err);
    }

    return winnerScript;
  }
}

export const abTestingService = new AbTestingService();
