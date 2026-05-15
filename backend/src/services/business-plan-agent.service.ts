import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { agentMemoryService } from './agent-memory.service';

export interface BusinessPlanResult {
  prospectId: string;
  businessName: string;
  niche: string;
  htmlPitch: string;
  projectedMonthlyRevenue: number;
  projectedAnnualRevenue: number;
  roiMonths: number;
  keyBenefits: string[];
  generatedAt: Date;
  actionId: string;
}

interface GptBusinessPlanResponse {
  htmlPitch: string;
  projectedMonthlyRevenue: number;
  projectedAnnualRevenue: number;
  roiMonths: number;
  keyBenefits: string[];
}

function buildFallbackHtml(businessName: string, niche: string): GptBusinessPlanResponse {
  const projectedMonthlyRevenue = 2000;
  const projectedAnnualRevenue = 24000;
  const roiMonths = 2;
  const keyBenefits = [
    'Never miss a customer call again',
    'Available 24/7 with no downtime',
    'Reduce receptionist costs',
    'Capture more leads automatically',
  ];

  const htmlPitch = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1a1a2e;">ROI Business Plan for ${businessName}</h1>
      <p>Based on industry data for <strong>${niche}</strong> businesses, implementing Qwillio can transform your customer communications.</p>
      <h2>Projected Revenue Impact</h2>
      <ul>
        <li>Monthly revenue gain: <strong>$${projectedMonthlyRevenue.toLocaleString()}</strong></li>
        <li>Annual revenue gain: <strong>$${projectedAnnualRevenue.toLocaleString()}</strong></li>
        <li>ROI achieved in: <strong>${roiMonths} months</strong></li>
      </ul>
      <h2>Key Benefits</h2>
      <ul>${keyBenefits.map((b) => `<li>${b}</li>`).join('')}</ul>
      <p><strong>Investment:</strong> $99 setup + $149/month</p>
    </div>
  `;

  return { htmlPitch, projectedMonthlyRevenue, projectedAnnualRevenue, roiMonths, keyBenefits };
}

async function callGptBusinessPlan(
  businessName: string,
  niche: string,
  city: string | null,
  googleRating: number | null,
  googleReviewsCount: number | null,
  callTranscript: string | null,
  interestLevel: number | null,
  painPoints: string[],
  strategyNotes: string | null,
): Promise<GptBusinessPlanResponse> {
  const prompt = `You are an ROI pitch writer for Qwillio AI receptionist.
Given this prospect data, generate a personalized HTML business plan with projected revenue gains.
Assume Qwillio costs $99/month setup + $149/month. Industry avg: each missed call = $200 lost revenue.

Business: ${businessName}
Niche: ${niche}
City: ${city ?? 'Unknown'}
Google Rating: ${googleRating ?? 'N/A'} (${googleReviewsCount ?? 0} reviews)
Interest Level: ${interestLevel ?? 'N/A'}/10
Pain Points: ${painPoints.join(', ') || 'None identified'}
Call Transcript Summary: ${callTranscript ? callTranscript.slice(0, 500) : 'No transcript'}
Strategy Notes: ${strategyNotes ?? 'None'}

Return ONLY valid JSON with this exact shape:
{
  "htmlPitch": "<full HTML string>",
  "projectedMonthlyRevenue": <number>,
  "projectedAnnualRevenue": <number>,
  "roiMonths": <number>,
  "keyBenefits": ["<string>", ...]
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from GPT');

  return JSON.parse(content) as GptBusinessPlanResponse;
}

export class BusinessPlanAgentService {

  async generateBusinessPlan(prospectId: string): Promise<BusinessPlanResult> {
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
        interestLevel: true,
        painPoints: true,
        email: true,
      },
    });

    const niche = prospect.niche ?? prospect.businessType ?? 'general';
    const { strategy } = await agentMemoryService.getStrategy('business_plan', niche, 'en');
    const playbookNotes =
      strategy?.playbook && typeof strategy.playbook === 'object' && !Array.isArray(strategy.playbook)
        ? ((strategy.playbook as Record<string, unknown>).notes as string | undefined) ?? null
        : null;

    let planData: GptBusinessPlanResponse;
    try {
      planData = await callGptBusinessPlan(
        prospect.businessName,
        niche,
        prospect.city,
        prospect.googleRating,
        prospect.googleReviewsCount,
        prospect.callTranscript,
        prospect.interestLevel,
        prospect.painPoints,
        playbookNotes,
      );
    } catch (error: unknown) {
      logger.error('[BusinessPlanAgent] GPT call failed, using fallback', error);
      planData = buildFallbackHtml(prospect.businessName, niche);
    }

    const actionId = await agentMemoryService.recordAction({
      agentType: 'business_plan',
      prospectId,
      niche,
      language: 'en',
      strategyId: strategy?.id,
      input: { prospectId, businessName: prospect.businessName, niche },
      output: {
        projectedMonthlyRevenue: planData.projectedMonthlyRevenue,
        projectedAnnualRevenue: planData.projectedAnnualRevenue,
        roiMonths: planData.roiMonths,
        keyBenefits: planData.keyBenefits,
      },
      features: {
        niche,
        hasRating: !!prospect.googleRating,
        reviewCount: prospect.googleReviewsCount ?? 0,
        hasTranscript: !!prospect.callTranscript,
        interestLevel: prospect.interestLevel ?? 0,
      },
    });

    logger.info(`[BusinessPlanAgent] Plan generated for prospect ${prospectId}, action ${actionId}`);

    return {
      prospectId,
      businessName: prospect.businessName,
      niche,
      htmlPitch: planData.htmlPitch,
      projectedMonthlyRevenue: planData.projectedMonthlyRevenue,
      projectedAnnualRevenue: planData.projectedAnnualRevenue,
      roiMonths: planData.roiMonths,
      keyBenefits: planData.keyBenefits,
      generatedAt: new Date(),
      actionId,
    };
  }

  async recordPlanOutcome(
    actionId: string,
    outcome: 'converted' | 'rejected' | 'no_response',
  ): Promise<void> {
    const rewardMap: Record<'converted' | 'rejected' | 'no_response', number> = {
      converted: 1.0,
      rejected: 0.0,
      no_response: 0.5,
    };

    try {
      await agentMemoryService.updateOutcome(actionId, outcome, rewardMap[outcome]);
      logger.info(`[BusinessPlanAgent] Outcome recorded: ${outcome} for action ${actionId}`);
    } catch (error: unknown) {
      logger.error(`[BusinessPlanAgent] Failed to record outcome for action ${actionId}`, error);
      throw error;
    }
  }
}

export const businessPlanAgentService = new BusinessPlanAgentService();
