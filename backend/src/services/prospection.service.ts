import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { calculateProspectScore } from '../utils/helpers';
import { CITIES_COORDINATES, GOOGLE_PLACES_TYPES, GOOGLE_PLACES_TYPE_MAP } from '../utils/constants';
import { detectTimezone } from '../config/scheduling';

interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  types: string[];
  address_components?: Array<{ long_name: string; types: string[] }>;
  geometry: { location: { lat: number; lng: number } };
}

export class ProspectionService {
  private apiKey: string;
  private requestCount = 0;
  private readonly MAX_REQUESTS_PER_RUN = 100; // Google Places safety limit
  private readonly DELAY_BETWEEN_REQUESTS_MS = 200; // 200ms between API calls

  constructor() {
    this.apiKey = env.GOOGLE_PLACES_API_KEY;
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Rate limiting
        if (this.requestCount >= this.MAX_REQUESTS_PER_RUN) {
          logger.warn('Google Places API request limit reached for this run');
          return { status: 'ZERO_RESULTS', results: [] };
        }

        await this.delay(this.DELAY_BETWEEN_REQUESTS_MS);
        this.requestCount++;

        const response = await fetch(url);
        const data = await response.json() as any;

        // Handle rate limiting from Google
        if (data.status === 'OVER_QUERY_LIMIT') {
          logger.warn(`Google Places rate limited (attempt ${attempt}/${maxRetries}), waiting ${attempt * 2}s...`);
          await this.delay(attempt * 2000);
          continue;
        }

        return data;
      } catch (error) {
        if (attempt === maxRetries) throw error;
        logger.warn(`Google Places request failed (attempt ${attempt}/${maxRetries}):`, error);
        await this.delay(attempt * 1000);
      }
    }
    return { status: 'ERROR', results: [] };
  }

  async runDailyProspection(): Promise<number> {
    logger.info('Starting daily prospection...');
    this.requestCount = 0; // Reset per run
    let totalAdded = 0;

    const cities = env.PROSPECTION_CITIES;
    const quotaPerCity = Math.floor(env.PROSPECTION_DAILY_QUOTA / cities.length);

    for (const city of cities) {
      const coords = CITIES_COORDINATES[city];
      if (!coords) {
        logger.warn(`No coordinates for city: ${city}`);
        continue;
      }

      for (const type of GOOGLE_PLACES_TYPES) {
        if (totalAdded >= env.PROSPECTION_DAILY_QUOTA) break;

        try {
          const places = await this.searchPlaces(coords.lat, coords.lng, type, env.PROSPECTION_RADIUS_METERS);

          for (const place of places) {
            if (totalAdded >= env.PROSPECTION_DAILY_QUOTA) break;

            const existing = await prisma.prospect.findUnique({
              where: { googlePlaceId: place.place_id },
            });

            if (existing) continue;

            const details = await this.getPlaceDetails(place.place_id);
            if (!details) continue;

            const businessType = this.detectBusinessType(details.types);
            const cityName = this.extractCity(details.address_components || []);

            const prospectCity = cityName || city;
            const prospectCountry = 'US';
            const timezone = detectTimezone(prospectCity, prospectCountry);

            const score = calculateProspectScore({
              rating: details.rating || null,
              reviewsCount: details.user_ratings_total || null,
              hasWebsite: !!details.website,
              hasPhone: !!details.formatted_phone_number,
              businessType,
              country: prospectCountry,
            });

            await prisma.prospect.create({
              data: {
                businessName: details.name,
                businessType,
                address: details.formatted_address,
                city: prospectCity,
                phone: details.formatted_phone_number || null,
                website: details.website || null,
                googlePlaceId: place.place_id,
                googleRating: details.rating || null,
                googleReviewsCount: details.user_ratings_total || null,
                googleTypes: details.types,
                score,
                status: 'new',
                nextAction: 'call',
                nextActionDate: new Date(),
                country: prospectCountry,
                timezone,
              },
            });

            totalAdded++;
            logger.info(`Added prospect: ${details.name} (score: ${score})`);
          }
        } catch (error) {
          logger.error(`Error prospecting ${type} in ${city}:`, error);
        }
      }
    }

    // Update analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.analyticsDaily.upsert({
      where: { date: today },
      update: { prospectsAdded: { increment: totalAdded } },
      create: { date: today, prospectsAdded: totalAdded },
    });

    // Update bot status
    await this.updateBotLastProspection();

    logger.info(`Daily prospection complete: ${totalAdded} new prospects added`);
    return totalAdded;
  }

  private async searchPlaces(lat: number, lng: number, type: string, radius: number): Promise<GooglePlace[]> {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${this.apiKey}&language=en`;

    const data = await this.fetchWithRetry(url);

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      logger.error(`Google Places API error: ${data.status} - ${data.error_message || ''}`);
      return [];
    }

    return data.results || [];
  }

  private async getPlaceDetails(placeId: string): Promise<GooglePlace | null> {
    const fields = 'place_id,name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,types,address_components';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${this.apiKey}&language=en`;

    const data = await this.fetchWithRetry(url);

    if (data.status !== 'OK') {
      return null;
    }

    return data.result;
  }

  private detectBusinessType(types: string[]): string {
    for (const type of types) {
      if (GOOGLE_PLACES_TYPE_MAP[type]) {
        return GOOGLE_PLACES_TYPE_MAP[type];
      }
    }
    return 'other';
  }

  private extractCity(addressComponents: Array<{ long_name: string; types: string[] }>): string | null {
    const cityComponent = addressComponents.find((c) => c.types.includes('locality'));
    return cityComponent?.long_name || null;
  }

  private async updateBotLastProspection() {
    const botStatus = await prisma.botStatus.findFirst();
    if (botStatus) {
      await prisma.botStatus.update({
        where: { id: botStatus.id },
        data: { lastProspection: new Date() },
      });
    }
  }
}

export const prospectionService = new ProspectionService();
