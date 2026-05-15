import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { agentMemoryService } from './agent-memory.service';

export interface BrandAnalysis {
  prospectId: string;
  businessName: string;
  brandTone: 'professional' | 'friendly' | 'urgent' | 'luxury' | 'technical';
  brandPersonality: string[];
  recommendedVoiceTone: string;
  recommendedSmsStyle: string;
  recommendedEmailOpener: string;
  pitchAngle: string;
  colorMood: string;
  actionId: string;
}

type BrandTone = BrandAnalysis['brandTone'];

interface GptBrandResponse {
  brandTone: BrandTone;
  brandPersonality: string[];
  recommendedVoiceTone: string;
  recommendedSmsStyle: string;
  recommendedEmailOpener: string;
  pitchAngle: string;
  colorMood: string;
}

const NICHE_TONE_MAP: Record<string, BrandTone> = {
  medical: 'professional',
  dental: 'professional',
  law: 'professional',
  legal: 'professional',
  finance: 'professional',
  accounting: 'professional',
  food: 'friendly',
  restaurant: 'friendly',
  cafe: 'friendly',
  bakery: 'friendly',
  beauty: 'friendly',
  spa: 'luxury',
  hotel: 'luxury',
  jewelry: 'luxury',
  tech: 'technical',
  it: 'technical',
  software: 'technical',
  repair: 'technical',
  plumbing: 'urgent',
  electrical: 'urgent',
  emergency: 'urgent',
  locksmith: 'urgent',
};

function getRatingTier(rating: number | null): 'high' | 'mid' | 'low' | 'unknown' {
  if (rating === null) return 'unknown';
  if (rating >= 4.5) return 'high';
  if (rating >= 4.0) return 'mid';
  return 'low';
}

function buildHeuristicBrand(niche: string): GptBrandResponse {
  const nicheLower = niche.toLowerCase();
  let matchedTone: BrandTone = 'friendly';

  for (const [key, tone] of Object.entries(NICHE_TONE_MAP)) {
    if (nicheLower.includes(key)) {
      matchedTone = tone;
      break;
    }
  }

  const toneDefaults: Record<BrandTone, GptBrandResponse> = {
    professional: {
      brandTone: 'professional',
      brandPersonality: ['reliable', 'trustworthy', 'expert', 'precise'],
      recommendedVoiceTone: 'Calm, authoritative, and reassuring',
      recommendedSmsStyle: 'Formal, concise, action-oriented',
      recommendedEmailOpener: 'I hope this message finds you well.',
      pitchAngle: 'Focus on reliability and professional image',
      colorMood: 'Navy blue and white — conveys trust and clarity',
    },
    friendly: {
      brandTone: 'friendly',
      brandPersonality: ['warm', 'approachable', 'helpful', 'enthusiastic'],
      recommendedVoiceTone: 'Warm, conversational, and upbeat',
      recommendedSmsStyle: 'Casual, personable, emoji-friendly',
      recommendedEmailOpener: 'Hi there! We wanted to reach out with something exciting.',
      pitchAngle: 'Emphasize customer experience and personal touch',
      colorMood: 'Orange and green — energy and warmth',
    },
    urgent: {
      brandTone: 'urgent',
      brandPersonality: ['fast', 'dependable', 'available', 'decisive'],
      recommendedVoiceTone: 'Direct, confident, and action-focused',
      recommendedSmsStyle: 'Short, urgent, with clear CTA',
      recommendedEmailOpener: 'Every minute counts — here\'s how we can help.',
      pitchAngle: 'Highlight 24/7 availability and zero missed emergencies',
      colorMood: 'Red and dark grey — urgency and reliability',
    },
    luxury: {
      brandTone: 'luxury',
      brandPersonality: ['exclusive', 'refined', 'premium', 'attentive'],
      recommendedVoiceTone: 'Polished, sophisticated, and measured',
      recommendedSmsStyle: 'Elegant, minimal, no slang',
      recommendedEmailOpener: 'We are pleased to present a tailored solution for your establishment.',
      pitchAngle: 'Position Qwillio as a premium extension of your brand',
      colorMood: 'Gold and deep black — exclusivity and prestige',
    },
    technical: {
      brandTone: 'technical',
      brandPersonality: ['knowledgeable', 'systematic', 'accurate', 'efficient'],
      recommendedVoiceTone: 'Precise, informative, and solution-oriented',
      recommendedSmsStyle: 'Structured, factual, benefit-led',
      recommendedEmailOpener: 'Here is a data-backed overview of how Qwillio integrates with your workflow.',
      pitchAngle: 'Lead with integration capabilities and uptime metrics',
      colorMood: 'Steel blue and charcoal — precision and modernity',
    },
  };

  return toneDefaults[matchedTone];
}

async function callGptBrand(
  businessName: string,
  niche: string,
  city: string | null,
  googleRating: number | null,
  googleReviewsCount: number | null,
  callTranscript: string | null,
  website: string | null,
  strategyNotes: string | null,
): Promise<GptBrandResponse> {
  const ratingTier = getRatingTier(googleRating);
  const websiteDomain = website ? new URL(website.startsWith('http') ? website : `https://${website}`).hostname : 'N/A';

  const prompt = `You analyze a business's brand identity from limited data.

Business: ${businessName}
Niche: ${niche}
City: ${city ?? 'Unknown'}
Google Rating: ${googleRating ?? 'N/A'} (${googleReviewsCount ?? 0} reviews, tier: ${ratingTier})
Website: ${websiteDomain}
Call/Review Text: ${callTranscript ? callTranscript.slice(0, 400) : 'None'}
Strategy Notes: ${strategyNotes ?? 'None'}

Return ONLY valid JSON with this exact shape:
{
  "brandTone": "professional" | "friendly" | "urgent" | "luxury" | "technical",
  "brandPersonality": ["adjective1", "adjective2", "adjective3"],
  "recommendedVoiceTone": "<string>",
  "recommendedSmsStyle": "<string>",
  "recommendedEmailOpener": "<string>",
  "pitchAngle": "<string>",
  "colorMood": "<string>"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from GPT');

  return JSON.parse(content) as GptBrandResponse;
}

export class BrandingAgentService {

  async analyzeBrand(prospectId: string): Promise<BrandAnalysis> {
    const prospect = await prisma.prospect.findUniqueOrThrow({
      where: { id: prospectId },
      select: {
        id: true,
        businessName: true,
        niche: true,
        businessType: true,
        city: true,
        country: true,
        googleRating: true,
        googleReviewsCount: true,
        callTranscript: true,
        notes: true,
        website: true,
      },
    });

    const niche = prospect.niche ?? prospect.businessType ?? 'general';
    const { strategy } = await agentMemoryService.getStrategy('branding', niche, 'en');
    const playbookNotes =
      strategy?.playbook && typeof strategy.playbook === 'object' && !Array.isArray(strategy.playbook)
        ? ((strategy.playbook as Record<string, unknown>).notes as string | undefined) ?? null
        : null;

    let brandData: GptBrandResponse;
    try {
      brandData = await callGptBrand(
        prospect.businessName,
        niche,
        prospect.city,
        prospect.googleRating,
        prospect.googleReviewsCount,
        prospect.callTranscript,
        prospect.website,
        playbookNotes,
      );
    } catch (error: unknown) {
      logger.error('[BrandingAgent] GPT call failed, using heuristic fallback', error);
      brandData = buildHeuristicBrand(niche);
    }

    const ratingTier = getRatingTier(prospect.googleRating);

    const actionId = await agentMemoryService.recordAction({
      agentType: 'branding',
      prospectId,
      niche,
      language: 'en',
      strategyId: strategy?.id,
      input: { prospectId, businessName: prospect.businessName, niche },
      output: brandData as unknown as Record<string, unknown>,
      features: {
        niche,
        hasWebsite: !!prospect.website,
        hasTranscript: !!prospect.callTranscript,
        ratingTier,
      },
    });

    logger.info(`[BrandingAgent] Brand analyzed for prospect ${prospectId}, action ${actionId}`);

    return {
      prospectId,
      businessName: prospect.businessName,
      ...brandData,
      actionId,
    };
  }

  async getBrandForProspect(prospectId: string): Promise<BrandAnalysis | null> {
    try {
      const action = await prisma.agentAction.findFirst({
        where: { agentType: 'branding', prospectId },
        orderBy: { createdAt: 'desc' },
      });

      if (!action) return null;

      const output = action.output as unknown as GptBrandResponse & { businessName?: string };

      return {
        prospectId,
        businessName: output.businessName ?? '',
        brandTone: output.brandTone,
        brandPersonality: output.brandPersonality,
        recommendedVoiceTone: output.recommendedVoiceTone,
        recommendedSmsStyle: output.recommendedSmsStyle,
        recommendedEmailOpener: output.recommendedEmailOpener,
        pitchAngle: output.pitchAngle,
        colorMood: output.colorMood,
        actionId: action.id,
      };
    } catch (error: unknown) {
      logger.error(`[BrandingAgent] getBrandForProspect failed for ${prospectId}`, error);
      return null;
    }
  }
}

export const brandingAgentService = new BrandingAgentService();
