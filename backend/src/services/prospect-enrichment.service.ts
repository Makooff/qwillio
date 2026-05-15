/**
 * Prospect Web Enrichment Service
 * Fetches prospect websites and extracts tech/pain-point signals.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

interface EnrichedData {
  scraped: boolean;
  scrapedAt: string;
  hasChatWidget: boolean;
  hasOnlineBooking: boolean;
  hasEcommerce: boolean;
  hasAIReceptionist: boolean;
  techStack: string[];
  painPoints: string[];
}

const CHAT_WIDGET_SIGNALS = ['tawk.to', 'intercom', 'crisp', 'livechat', 'drift', 'freshchat'];
const ONLINE_BOOKING_SIGNALS = ['calendly', 'booksy', 'acuity', 'mindbody', 'square'];
const ECOMMERCE_SIGNALS = ['shopify', 'woocommerce', 'stripe'];
const AI_RECEPTIONIST_SIGNALS = ['vapi', 'bland.ai', 'air.ai', 'synthflow'];

function containsAny(html: string, signals: string[]): boolean {
  const lower = html.toLowerCase();
  return signals.some(s => lower.includes(s));
}

function detectTechStack(html: string): string[] {
  const stack: string[] = [];
  const lower = html.toLowerCase();

  if (lower.includes('wordpress') || lower.includes('wp-content')) stack.push('WordPress');
  if (lower.includes('shopify')) stack.push('Shopify');
  if (lower.includes('woocommerce')) stack.push('WooCommerce');
  if (lower.includes('react') || lower.includes('__react')) stack.push('React');
  if (lower.includes('next.js') || lower.includes('_next/')) stack.push('Next.js');
  if (lower.includes('google-analytics') || lower.includes('gtag')) stack.push('Google Analytics');
  if (lower.includes('facebook-pixel') || lower.includes('fbq(')) stack.push('Facebook Pixel');
  if (lower.includes('intercom')) stack.push('Intercom');
  if (lower.includes('tawk.to')) stack.push('Tawk.to');
  if (lower.includes('crisp')) stack.push('Crisp');
  if (lower.includes('drift')) stack.push('Drift');
  if (lower.includes('freshchat')) stack.push('Freshchat');
  if (lower.includes('calendly')) stack.push('Calendly');
  if (lower.includes('acuity')) stack.push('Acuity Scheduling');
  if (lower.includes('mindbody')) stack.push('Mindbody');
  if (lower.includes('booksy')) stack.push('Booksy');
  if (lower.includes('stripe')) stack.push('Stripe');
  if (lower.includes('vapi')) stack.push('Vapi');
  if (lower.includes('bland.ai')) stack.push('Bland AI');
  if (lower.includes('synthflow')) stack.push('Synthflow');
  if (lower.includes('air.ai')) stack.push('Air AI');

  return [...new Set(stack)];
}

export class ProspectEnrichmentService {
  /**
   * Fetch and analyze a single prospect's website.
   */
  async enrichProspect(prospectId: string): Promise<void> {
    const prospect = await prisma.prospect.findUniqueOrThrow({
      where: { id: prospectId },
      select: { id: true, website: true, businessName: true, niche: true, score: true },
    });

    if (!prospect.website) {
      logger.debug(`[Enrichment] Skipping ${prospectId} — no website`);
      return;
    }

    let html = '';
    try {
      const response = await fetch(prospect.website, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QwillioBot/1.0)' },
      });
      html = await response.text();
    } catch (err) {
      logger.warn(`[Enrichment] Failed to fetch ${prospect.website}: ${(err as Error).message}`);
      return;
    }

    const hasChatWidget = containsAny(html, CHAT_WIDGET_SIGNALS);
    const hasOnlineBooking = containsAny(html, ONLINE_BOOKING_SIGNALS);
    const hasEcommerce = containsAny(html, ECOMMERCE_SIGNALS);
    const hasAIReceptionist = containsAny(html, AI_RECEPTIONIST_SIGNALS);
    const techStack = detectTechStack(html);

    const painPoints: string[] = [];
    if (!hasChatWidget) painPoints.push('No live chat');
    if (!hasOnlineBooking) painPoints.push('No online booking');
    if (!hasAIReceptionist) painPoints.push('No AI receptionist');
    if (!hasEcommerce) painPoints.push('No e-commerce');

    const enrichedData: EnrichedData = {
      scraped: true,
      scrapedAt: new Date().toISOString(),
      hasChatWidget,
      hasOnlineBooking,
      hasEcommerce,
      hasAIReceptionist,
      techStack,
      painPoints,
    };

    // Direct upsell signal: no chat widget AND no AI receptionist → +10 score
    const scoreBonus = !hasChatWidget && !hasAIReceptionist ? 10 : 0;

    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        enrichedData: enrichedData as unknown as import('@prisma/client').Prisma.InputJsonValue,
        ...(scoreBonus > 0 ? { score: { increment: scoreBonus } } : {}),
      },
    });

    logger.info(
      `[Enrichment] Enriched ${prospect.businessName} — chat:${hasChatWidget} booking:${hasOnlineBooking} ai:${hasAIReceptionist} bonus:${scoreBonus}`
    );
  }

  /**
   * Enrich a batch of high-score prospects that have a website but no enrichment yet.
   * Runs sequentially to avoid rate-limiting.
   */
  async enrichBatch(minScore = 60, limit = 20): Promise<number> {
    const prospects = await prisma.prospect.findMany({
      where: {
        score: { gte: minScore },
        website: { not: null },
        enrichedData: { equals: Prisma.JsonNull },
      },
      take: limit,
      select: { id: true },
      orderBy: { score: 'desc' },
    });

    let enriched = 0;
    for (const p of prospects) {
      try {
        await this.enrichProspect(p.id);
        enriched++;
      } catch (err) {
        logger.error(`[Enrichment] Error enriching prospect ${p.id}:`, err);
      }
    }

    logger.info(`[Enrichment] Batch complete: ${enriched}/${prospects.length} enriched`);
    return enriched;
  }
}

export const prospectEnrichmentService = new ProspectEnrichmentService();
