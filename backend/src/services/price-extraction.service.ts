import { logger } from '../config/logger';
import { env } from '../config/env';

// Reads a price list, a menu or a rate card out of a photo, so a customer can
// hand over what they already have instead of retyping thirty rows.
//
// Nothing is stored. The image is held in memory for the length of the request
// and dropped: there is no file to leak, no retention policy to write, and
// nothing extra to answer for when an accountant asks where their documents
// live. The only thing kept is the extracted lines, once the user confirms.

const VISION_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';
const TIMEOUT_MS = 60_000;

/** Same reasoning as the transcription cap: base64 inflates by ~4/3 under a 10 MB json limit. */
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

/** Mirrors the KbItem the dashboard already stores, so nothing new lands in the schema. */
export interface ExtractedItem {
  category: string;
  name: string;
  price: string;
}

const CATEGORIES = ['service', 'menu', 'tarif', 'produit', 'prestation', 'autre'];

const SYSTEM_PROMPT = `Tu extrais des lignes tarifaires d'une image (carte, menu, grille de prix, devis).

Règles:
- Retourne UNIQUEMENT du JSON, sans texte autour, au format {"items":[{"category","name","price"}]}.
- "category" est l'une de: ${CATEGORIES.join(', ')}.
- "name" est le libellé exact lu sur l'image, sans le reformuler.
- "price" garde la devise et le format lus (ex: "45 €", "12,50 €", "sur devis").
- N'invente jamais une ligne, un prix ou une catégorie. Si un prix est illisible, mets "".
- Si l'image ne contient aucun tarif, retourne {"items":[]}.
- Ignore les en-têtes, adresses, numéros de téléphone et mentions légales.`;

export class PriceExtractionService {
  /**
   * @param image  Raw image bytes, held in memory only.
   * @param mimeType  Used to build the data URL the vision model reads.
   */
  async extract(image: Buffer, mimeType: string): Promise<ExtractedItem[]> {
    if (!env.OPENAI_API_KEY) throw new Error('extraction_unavailable');
    if (!image.length) throw new Error('empty_image');
    if (image.length > MAX_IMAGE_BYTES) throw new Error('image_too_large');

    const type = ALLOWED_MIME.has(mimeType) ? mimeType : 'image/jpeg';
    const dataUrl = `data:${type};base64,${image.toString('base64')}`;

    let res: Response;
    try {
      res = await fetch(VISION_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extrais les lignes tarifaires de cette image.' },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      logger.error('[PriceExtraction] Vision request failed or timed out:', err);
      throw new Error('extraction_failed');
    }

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      logger.error(`[PriceExtraction] Vision ${res.status}: ${detail}`);
      throw new Error('extraction_failed');
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('extraction_failed');

    let parsed: { items?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      logger.error('[PriceExtraction] model returned non-JSON');
      throw new Error('extraction_failed');
    }

    if (!Array.isArray(parsed.items)) return [];

    // Normalise defensively: this feeds a customer's configuration, so a
    // malformed row is dropped rather than written through.
    return parsed.items
      .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
      .map((it) => ({
        category: CATEGORIES.includes(String(it.category)) ? String(it.category) : 'autre',
        name: String(it.name ?? '').trim().slice(0, 200),
        price: String(it.price ?? '').trim().slice(0, 50),
      }))
      .filter((it) => it.name.length > 0)
      .slice(0, 100);
  }
}

export const priceExtractionService = new PriceExtractionService();
