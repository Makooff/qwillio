import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { googleCalendarService } from '../google-calendar.service';
import { normalizeUtterance } from './intent-router';
import type { VoiceLanguage } from './speech-plans';

/**
 * Speculative availability lookup (chantier 9).
 *
 * The most common turn in a booking call is the caller naming a day. What
 * follows is always the same: the model asks for `checkAvailability`, the
 * server calls Google, and the caller waits through a filler line for
 * 400-900 ms.
 *
 * Almost all of that is knowable early. The day appears in the transcript
 * before the model has finished reading it, so the calendar read can start
 * immediately and be sitting in cache by the time the tool call arrives.
 *
 * Three rules keep this honest:
 *  - **Never writes.** A speculation only ever reads free/busy. A wrong guess
 *    must cost one wasted API call, never a booking.
 *  - **Bounded.** A hard cap per call, so a caller listing every day of the
 *    week cannot turn one conversation into thirty Google requests.
 *  - **Best-effort.** A failed speculation is silent; the real tool call runs
 *    the normal path and the caller notices nothing.
 */

interface CachedSlots {
  slots: string[];
  expiresAt: number;
}

/**
 * Short by design. Availability is exactly the kind of data that goes stale
 * while you hold it — long enough to cover the gap between speculation and
 * tool call, not long enough to promise a slot someone else just took.
 */
const CACHE_TTL_MS = 30_000;
const MAX_SPECULATIONS_PER_CALL = 4;

/** Weekday names to a JS day index, per language. */
const WEEKDAYS: Record<VoiceLanguage, Record<string, number>> = {
  fr: { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 },
  en: { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 },
  nl: { zondag: 0, maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6 },
};

const TODAY_WORDS: Record<VoiceLanguage, string[]> = {
  fr: ["aujourd hui", 'ce soir', 'ce midi'],
  en: ['today', 'this evening', 'tonight'],
  nl: ['vandaag', 'vanavond', 'vanmiddag'],
};
const TOMORROW_WORDS: Record<VoiceLanguage, string[]> = {
  fr: ['demain'],
  en: ['tomorrow'],
  nl: ['morgen'],
};

function atNoon(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

/**
 * Find the date a caller just referred to, if any.
 *
 * Deliberately conservative: it recognises the handful of forms that carry an
 * unambiguous day and returns null for everything else. A missed detection
 * costs the speculation; a wrong one costs a pointless API call, so there is no
 * reason to guess at "the week after next".
 */
export function detectDate(utterance: string, lang: VoiceLanguage, now = new Date()): Date | null {
  const text = normalizeUtterance(utterance);
  if (!text) return null;

  if (TODAY_WORDS[lang].some(w => text.includes(w))) return atNoon(now);
  if (TOMORROW_WORDS[lang].some(w => text.includes(w))) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return atNoon(d);
  }

  // "lundi", "lundi prochain", "next monday" — always the NEXT occurrence,
  // because a caller naming a weekday never means one in the past.
  for (const [name, index] of Object.entries(WEEKDAYS[lang])) {
    if (!new RegExp(`\\b${name}\\b`).test(text)) continue;
    const d = new Date(now);
    const delta = (index - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + delta);
    return atNoon(d);
  }

  // "le 14", "on the 14th" — a bare day number within the coming month.
  const dayMatch = text.match(/\b(?:le|on the|the)\s+(\d{1,2})\b/);
  if (dayMatch) {
    const day = Number(dayMatch[1]);
    if (day >= 1 && day <= 31) {
      const d = new Date(now);
      d.setDate(day);
      // A day already past this month means the caller means next month.
      if (d < now) d.setMonth(d.getMonth() + 1);
      return atNoon(d);
    }
  }

  return null;
}

class AvailabilitySpeculator {
  private cache = new Map<string, CachedSlots>();
  private counts = new Map<string, number>();
  /**
   * Lectures EN VOL, par clé de jour.
   *
   * Le cache ne se remplit qu'au RETOUR de Google, 400 à 900 ms plus tard.
   * Pendant cette fenêtre, deux demandes pour le même jour ne se voient pas
   * l'une l'autre: elles partent toutes les deux. C'était supportable tant que
   * la spéculation ne partait qu'à la transcription finale, une fois par tour;
   * ça ne l'est plus depuis qu'elle part aussi sur les partielles, qui
   * arrivent plusieurs fois par seconde et répètent le même mot. Sans ce
   * registre, « mardi » dit une fois épuiserait le budget de l'appel et
   * enverrait quatre requêtes identiques en moins d'une seconde.
   *
   * Il sert deux fois: le VRAI appel d'outil rejoint lui aussi la lecture en
   * cours au lieu d'en lancer une seconde. C'est exactement le cas que ce
   * module existe pour optimiser, et il le manquait.
   */
  private pending = new Map<string, Promise<string[]>>();

  private key(clientId: string, date: Date): string {
    return `${clientId}:${date.toISOString().slice(0, 10)}`;
  }

  /**
   * Read free slots for a day, from cache when warm.
   *
   * This is the single read path: the tool runtime calls it too, so a
   * speculation that landed is transparently reused and one that did not simply
   * costs the normal lookup.
   */
  async freeSlots(clientId: string, date: Date): Promise<string[]> {
    const key = this.key(clientId, date);
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.slots;

    /* Une lecture déjà partie pour ce jour: on l'attend plutôt que d'en lancer
       une seconde. Un échec partagé est le même échec que celui qu'un second
       appel aurait rencontré seul. */
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;

    const lookup = this.lookup(clientId, date, key);
    this.pending.set(key, lookup);
    /* Le retrait est attaché ici et non dans `lookup`, pour qu'il ait lieu que
       la lecture réussisse ou non: une clé restée coincée en vol bloquerait
       toute lecture de ce jour pour le reste de la vie du process. */
    void lookup.catch(() => {}).finally(() => this.pending.delete(key));
    return lookup;
  }

  private async lookup(clientId: string, date: Date, key: string): Promise<string[]> {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { googleCalendarRefreshToken: true, googleCalendarId: true },
    });
    if (!client?.googleCalendarRefreshToken) throw new Error('calendar not connected');

    const accessToken = await googleCalendarService.getAccessTokenFromRefresh(client.googleCalendarRefreshToken);
    const slots = await googleCalendarService.getAvailability(
      accessToken,
      client.googleCalendarId || 'primary',
      date,
    );

    this.cache.set(key, { slots, expiresAt: Date.now() + CACHE_TTL_MS });
    return slots;
  }

  /**
   * Kick off a lookup for a day mentioned in the transcript. Returns
   * immediately; the result lands in the cache.
   */
  speculate(clientId: string, vapiCallId: string | null, date: Date): void {
    const key = this.key(clientId, date);
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return;
    /* En vol: ni requête, ni budget. L'ordre compte — dépenser le budget avant
       de regarder rendrait la répétition d'une partielle coûteuse alors qu'elle
       ne demande rien de neuf. */
    if (this.pending.has(key)) return;

    const budgetKey = vapiCallId ?? clientId;
    const used = this.counts.get(budgetKey) ?? 0;
    if (used >= MAX_SPECULATIONS_PER_CALL) return;

    this.counts.set(budgetKey, used + 1);
    void this.freeSlots(clientId, date)
      .then(slots => logger.debug(`[Speculation] ${slots.length} slot(s) pre-loaded for ${key}`))
      .catch(err => logger.debug(`[Speculation] failed for ${key}: ${err.message}`));
  }

  /** Called at end of call so a long-running process does not leak budgets. */
  release(vapiCallId: string | null): void {
    if (vapiCallId) this.counts.delete(vapiCallId);
  }

  /** Test seam. */
  reset(): void {
    this.cache.clear();
    this.counts.clear();
    this.pending.clear();
  }
}

export const availabilitySpeculator = new AvailabilitySpeculator();
