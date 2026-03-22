// @ts-nocheck
import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Lead Enrichment Service
 * After every lead captured: Google Places API lookup
 * Enriches contact with: address, rating, review count, website, hours
 */

export class LeadEnrichmentService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
  }

  async enrichContact(contactId: string): Promise<void> {
    if (!this.apiKey) {
      logger.warn('Google Places API key not configured, skipping enrichment');
      return;
    }

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || !contact.name) return;

    try {
      // Text search by business name
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(contact.name)}&key=${this.apiKey}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json() as any;

      if (!searchData.results || searchData.results.length === 0) {
        logger.debug(`No Google Places results for "${contact.name}"`);
        return;
      }

      const place = searchData.results[0];

      // Get details
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_address,rating,user_ratings_total,website,opening_hours,formatted_phone_number&key=${this.apiKey}`;
      const detailsRes = await fetch(detailsUrl);
      const detailsData = await detailsRes.json() as any;
      const details = detailsData.result || {};

      // Update contact with enrichment data
      const enrichment = {
        address: details.formatted_address || place.formatted_address || null,
        googleRating: details.rating || null,
        googleReviewCount: details.user_ratings_total || null,
        website: details.website || null,
        googlePlaceId: place.place_id,
        openingHours: details.opening_hours?.weekday_text || null,
      };

      await prisma.contact.update({
        where: { id: contactId },
        data: {
          address: enrichment.address,
          externalIds: {
            ...(contact.externalIds as object || {}),
            googlePlaceId: enrichment.googlePlaceId,
          },
          notes: [
            contact.notes || '',
            enrichment.googleRating ? `Google: ${enrichment.googleRating}★ (${enrichment.googleReviewCount} reviews)` : '',
            enrichment.website ? `Website: ${enrichment.website}` : '',
          ].filter(Boolean).join('\n'),
        },
      });

      logger.info(`Enriched contact ${contactId}: ${enrichment.address}, ${enrichment.googleRating}★`);
    } catch (error) {
      logger.error(`Lead enrichment failed for contact ${contactId}:`, error);
    }
  }

  /**
   * Hot lead alert — interest score >= 8
   */
  async checkHotLead(callId: string): Promise<boolean> {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { prospect: true },
    });

    if (!call || (call.interestScore || 0) < 8) return false;

    logger.info(`🔥 HOT LEAD: ${call.prospect?.businessName || 'Unknown'} — Score: ${call.interestScore}`);

    // Discord alert will be sent by the caller of this method
    return true;
  }
}

export const leadEnrichmentService = new LeadEnrichmentService();
