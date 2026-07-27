import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { aiScriptGeneratorService, GeneratedScript, ScriptContext } from './ai-script-generator.service';
import { prospectEnrichmentService } from './prospect-enrichment.service';
import { adminClientsService, ManualClientResult } from './admin-clients.service';

/**
 * What the founder needs in front of him to call a business by hand: a briefing
 * he can read in ten seconds, a script written for that specific business, and
 * a way to turn a prospect into a customer once the call goes well.
 */

interface WebsiteSignals {
  scraped: boolean;
  scrapedAt?: string;
  hasChatWidget?: boolean;
  hasOnlineBooking?: boolean;
  hasEcommerce?: boolean;
  hasAIReceptionist?: boolean;
  techStack?: string[];
  painPoints?: string[];
}

const FRENCH_COUNTRIES = ['FR', 'BE', 'LU', 'MC', 'CH'];

function isFrench(country?: string | null): boolean {
  return FRENCH_COUNTRIES.includes(String(country || '').toUpperCase());
}

/** Turns the enrichment blob into plain sentences worth reading aloud. */
function talkingPoints(signals: WebsiteSignals, fr: boolean): string[] {
  const out: string[] = [];
  if (!signals.scraped) return out;

  if (signals.hasAIReceptionist) {
    out.push(fr
      ? 'Utilise déjà un concurrent IA — attaquer sur le prix et le français natif.'
      : 'Already runs a competing AI — lead on price and native French.');
  } else if (!signals.hasChatWidget) {
    out.push(fr
      ? 'Aucun chat sur le site : personne ne récupère les visiteurs hors horaires.'
      : 'No chat on the site: nobody catches visitors outside opening hours.');
  }
  if (!signals.hasOnlineBooking) {
    out.push(fr
      ? 'Pas de réservation en ligne — chaque rendez-vous passe donc par le téléphone.'
      : 'No online booking, so every appointment has to go through the phone.');
  }
  if (signals.hasEcommerce) {
    out.push(fr
      ? 'Vend en ligne : habitué à payer pour des outils qui rapportent.'
      : 'Sells online: used to paying for tools that pay back.');
  }
  return out;
}

export const prospectWorkbenchService = {
  /**
   * Everything worth knowing before dialling. Enriches the website on first
   * open, since nothing ever exposed the enrichment service over HTTP.
   */
  async brief(prospectId: string) {
    let prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      include: {
        calls: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!prospect) return null;

    // First open pays for the scrape; every later one is free.
    if (prospect.website && !prospect.enrichedData) {
      try {
        await prospectEnrichmentService.enrichProspect(prospectId);
        prospect = await prisma.prospect.findUnique({
          where: { id: prospectId },
          include: { calls: { orderBy: { createdAt: 'desc' }, take: 5 } },
        });
      } catch (err) {
        // A dead website must not stop the founder from seeing the rest.
        logger.warn(`[workbench] enrichment failed for ${prospectId}: ${(err as Error).message}`);
      }
    }
    if (!prospect) return null;

    const signals = (prospect.enrichedData as unknown as WebsiteSignals) || { scraped: false };
    const fr = isFrench(prospect.country);

    return {
      id: prospect.id,
      businessName: prospect.businessName,
      niche: prospect.niche,
      businessType: prospect.businessType,
      phone: prospect.phone,
      email: prospect.email,
      website: prospect.website,
      address: prospect.address,
      city: prospect.city,
      country: prospect.country,
      contactName: prospect.contactName,
      google: {
        rating: prospect.googleRating,
        reviews: prospect.googleReviewsCount,
      },
      score: prospect.score,
      priorityScore: prospect.priorityScore,
      interestLevel: prospect.interestLevel,
      status: prospect.status,
      isFavorite: prospect.isFavorite,
      website_signals: signals,
      talkingPoints: talkingPoints(signals, fr),
      painPoints: [...(prospect.painPoints || []), ...(signals.painPoints || [])],
      notes: prospect.notes,
      lastContactDate: prospect.lastContactDate,
      callAttempts: prospect.callAttempts,
      calls: prospect.calls.map((c) => ({
        id: c.id,
        createdAt: c.createdAt,
        outcome: (c as any).outcome ?? null,
        durationSeconds: (c as any).durationSeconds ?? null,
      })),
      hasScript: !!prospect.salesScript,
      language: fr ? 'fr' : 'en',
    };
  },

  /**
   * The sales script for this exact business. Generated on the first click and
   * kept, so re-reading it before a call costs nothing.
   */
  async script(prospectId: string, refresh = false): Promise<{ script: GeneratedScript; cached: boolean } | null> {
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) return null;

    if (!refresh && prospect.salesScript) {
      return { script: prospect.salesScript as unknown as GeneratedScript, cached: true };
    }

    // Website signals sharpen the pitch, so make sure we have them first.
    if (prospect.website && !prospect.enrichedData) {
      try {
        await prospectEnrichmentService.enrichProspect(prospectId);
      } catch {
        /* the script is still worth generating without them */
      }
    }

    const fr = isFrench(prospect.country);
    const ctx: ScriptContext = {
      businessName: prospect.businessName,
      niche: prospect.niche || prospect.businessType || 'other',
      city: prospect.city || '',
      reviewCount: prospect.googleReviewsCount,
      rating: prospect.googleRating ? Number(prospect.googleRating) : null,
      hasWebsite: !!prospect.website,
      agentName: fr ? 'Marie' : 'Ashley',
      language: fr ? 'fr' : 'en',
    };

    const script = await aiScriptGeneratorService.generateScript(ctx);

    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        salesScript: script as unknown as import('@prisma/client').Prisma.InputJsonValue,
        salesScriptAt: new Date(),
      },
    });

    logger.info(`[workbench] script generated for ${prospect.businessName}`);
    return { script, cached: false };
  },

  /** Records that the founder dialled this business himself. */
  async markContacted(prospectId: string) {
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) return null;

    return prisma.prospect.update({
      where: { id: prospectId },
      data: {
        // Never walk a prospect backwards: 'converted' or 'rejected' outrank a dial.
        status: ['new', 'contacted'].includes(prospect.status) ? 'contacted' : prospect.status,
        lastContactDate: new Date(),
        callAttempts: { increment: 1 },
      },
      select: { id: true, status: true, callAttempts: true, lastContactDate: true },
    });
  },

  /**
   * Turns a prospect into a paying customer. `Client.prospectId` has been in the
   * schema since the beginning without a single writer; this fills it, so the
   * customer stays traceable back to the lead that produced them.
   */
  async convert(
    prospectId: string,
    input: { contactEmail?: unknown; planType?: unknown; contactName?: unknown },
  ): Promise<ManualClientResult | { ok: false; status: 404; error: string }> {
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) return { ok: false, status: 404, error: 'prospect_not_found' };

    if (prospect.status === 'converted') {
      const existing = await prisma.client.findFirst({ where: { prospectId } });
      return { ok: false, status: 409, error: 'already_converted', clientId: existing?.id };
    }

    // The scraper never collects an email, so the form usually supplies it.
    const contactEmail = String(input.contactEmail || prospect.email || '').trim();
    if (!contactEmail) {
      return { ok: false, status: 400, error: 'contact_email_required' };
    }

    const result = await adminClientsService.create({
      businessName: prospect.businessName,
      businessType: prospect.businessType || prospect.niche || 'other',
      contactName: input.contactName || prospect.contactName || prospect.businessName,
      contactEmail,
      contactPhone: prospect.phone,
      city: prospect.city,
      country: prospect.country,
      planType: input.planType,
      prospectId,
    });
    if (!result.ok) return result;

    await prisma.prospect.update({
      where: { id: prospectId },
      data: { status: 'converted', eligibleForCall: false, lastContactDate: new Date() },
    });

    logger.info(`[workbench] ${prospect.businessName} converted → client ${result.client.id}`);
    return result;
  },
};

/**
 * Saved searches. Working through a couple of thousand leads by hand takes many
 * sittings, so a search remembers both its filters and where the calling
 * stopped.
 */
export const savedSearchService = {
  list(userId: string) {
    return prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  },

  /** Re-saving under the same name updates it instead of piling up duplicates. */
  save(userId: string, name: string, filters: Record<string, unknown>) {
    const clean = String(name || '').trim().slice(0, 120);
    if (!clean) return null;
    return prisma.savedSearch.upsert({
      where: { userId_name: { userId, name: clean } },
      create: { userId, name: clean, filters: filters as any },
      update: { filters: filters as any },
    });
  },

  /** Remembers the last business called, so the next sitting picks up there. */
  async setProgress(userId: string, id: string, lastProspectId: string | null) {
    const owned = await prisma.savedSearch.findFirst({ where: { id, userId } });
    if (!owned) return null;
    return prisma.savedSearch.update({ where: { id }, data: { lastProspectId } });
  },

  async remove(userId: string, id: string) {
    const owned = await prisma.savedSearch.findFirst({ where: { id, userId } });
    if (!owned) return false;
    await prisma.savedSearch.delete({ where: { id } });
    return true;
  },
};
