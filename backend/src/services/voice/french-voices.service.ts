import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { prisma } from '../../config/database';
import { applyAssignedVoices, listCharacters } from '../../config/voice-characters';

/**
 * Assign a real French voice to every character, from ElevenLabs' own library.
 *
 * The hardcoded ids this replaces were pasted in by hand and never listened to.
 * The result was exactly what unverified opaque strings produce: a male
 * character speaking as a woman, two "women" who were men, and five men sharing
 * a single voice. No test could have caught any of it — a voice id says nothing
 * about what comes out of it.
 *
 * The library does say. Each shared voice publishes its gender, its language
 * and how many people have used it, so the assignment can be checked rather
 * than trusted: French, right gender, most-used first, one voice per character.
 */

const SHARED_VOICES_URL = 'https://api.elevenlabs.io/v1/shared-voices';

export interface SharedVoice {
  publicOwnerId: string;
  voiceId: string;
  name: string;
  gender: 'male' | 'female';
  /** How many accounts have added it — the only popularity signal published. */
  usage: number;
  accent: string | null;
  description: string | null;
}

/**
 * Field by field, and gender by gender.
 *
 * The filter is applied again here even though it is in the query string: this
 * is the check that failed last time, and a third party's filter honouring a
 * parameter is not something to take on faith when the cost of being wrong is a
 * receptionist named Lucas answering in a woman's voice.
 */
export function toSharedVoice(raw: unknown, wanted: 'male' | 'female'): SharedVoice | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.voice_id !== 'string' || !v.voice_id) return null;
  if (typeof v.public_owner_id !== 'string' || !v.public_owner_id) return null;

  const gender = String(v.gender || '').toLowerCase();
  if (gender !== wanted) return null;

  // A voice with no French is a voice that will speak French with an accent
  // nobody asked for. `language` is the voice's own; `verified_languages` lists
  // the ones it has been confirmed on.
  const language = String(v.language || '').toLowerCase();
  const verified = Array.isArray(v.verified_languages)
    ? (v.verified_languages as unknown[]).map(l => String((l as Record<string, unknown>)?.language || '').toLowerCase())
    : [];
  if (language !== 'fr' && !verified.includes('fr')) return null;

  return {
    publicOwnerId: v.public_owner_id,
    voiceId: v.voice_id,
    name: typeof v.name === 'string' && v.name.trim() ? v.name : 'Sans nom',
    gender: wanted,
    usage: typeof v.cloned_by_count === 'number' ? v.cloned_by_count : 0,
    accent: typeof v.accent === 'string' && v.accent ? v.accent : null,
    description: typeof v.description === 'string' && v.description ? v.description : null,
  };
}

async function search(gender: 'male' | 'female'): Promise<SharedVoice[]> {
  if (!env.ELEVENLABS_API_KEY) throw new Error('elevenlabs_key_missing');

  const url = `${SHARED_VOICES_URL}?page_size=100&language=fr&gender=${gender}&sort=trending`;
  const r = await fetch(url, { headers: { 'xi-api-key': env.ELEVENLABS_API_KEY } });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    logger.warn(`[FrenchVoices] search ${gender} failed ${r.status}: ${detail.slice(0, 200)}`);
    throw new Error('elevenlabs_search_failed');
  }

  const body = (await r.json().catch(() => ({}))) as { voices?: unknown[] };
  return (body.voices ?? [])
    .map(raw => toSharedVoice(raw, gender))
    .filter((v): v is SharedVoice => v !== null)
    // Most-used first: on a library of thousands of clones, usage is the
    // closest thing to "the best ones" that can be read rather than heard.
    .sort((a, b) => b.usage - a.usage);
}

/** Add a library voice to this account so it can be synthesised. */
async function addToAccount(voice: SharedVoice, label: string): Promise<string | null> {
  if (!env.ELEVENLABS_API_KEY) return null;
  const r = await fetch(
    `https://api.elevenlabs.io/v1/voices/add/${voice.publicOwnerId}/${voice.voiceId}`,
    {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_name: label }),
    },
  );

  if (r.ok) {
    const body = (await r.json().catch(() => ({}))) as { voice_id?: string };
    return body.voice_id || voice.voiceId;
  }

  const detail = await r.text().catch(() => '');
  // Already on the account: the library id is usable as it is, which is the
  // normal outcome of running this twice.
  if (r.status === 400 && /already/i.test(detail)) return voice.voiceId;
  logger.warn(`[FrenchVoices] add ${voice.name} failed ${r.status}: ${detail.slice(0, 200)}`);
  return null;
}

/**
 * Pair characters with voices, one each, keeping the genders straight.
 *
 * Pure so the pairing itself is testable: it is the part that went wrong, and
 * it must never again depend on a network call to be checked.
 */
export function pairVoices(
  characters: Array<{ id: string; gender: 'f' | 'm' }>,
  pool: { female: SharedVoice[]; male: SharedVoice[] },
): Record<string, SharedVoice> {
  const queues = { f: [...pool.female], m: [...pool.male] };
  const pairing: Record<string, SharedVoice> = {};

  for (const character of characters) {
    const next = queues[character.gender].shift();
    // No voice left is better than a wrong one: the character keeps its
    // previous id rather than borrowing another character's timbre.
    if (next) pairing[character.id] = next;
  }
  return pairing;
}

class FrenchVoicesService {
  /** What the library offers, without changing anything. */
  async preview(): Promise<{ female: SharedVoice[]; male: SharedVoice[] }> {
    const [female, male] = await Promise.all([search('female'), search('male')]);
    return { female, male };
  }

  /**
   * Assign, add to the account, persist, and apply immediately.
   *
   * Persisted because the alternative is a redeploy to change a voice, and
   * applied in-process because a client pressing ▶ ten seconds later should
   * hear the new one.
   */
  async assign(): Promise<Record<string, { voiceId: string; name: string; gender: string }>> {
    const pool = await this.preview();
    const characters = listCharacters().map(c => ({ id: c.id, gender: c.gender, name: c.name }));
    const pairing = pairVoices(characters, pool);

    const assigned: Record<string, string> = {};
    const report: Record<string, { voiceId: string; name: string; gender: string }> = {};

    for (const character of characters) {
      const chosen = pairing[character.id];
      if (!chosen) continue;
      const accountId = await addToAccount(chosen, `Qwillio — ${character.name}`);
      if (!accountId) continue;
      assigned[character.id] = accountId;
      report[character.id] = { voiceId: accountId, name: chosen.name, gender: chosen.gender };
    }

    if (Object.keys(assigned).length) {
      await this.persist(assigned);
      applyAssignedVoices(assigned);
      await this.invalidateCaches();
      logger.info(`[FrenchVoices] assigned ${Object.keys(assigned).length} voices`);
    }
    return report;
  }

  private async persist(assigned: Record<string, string>): Promise<void> {
    const existing = await prisma.adminConfig.findFirst();
    if (existing) {
      await prisma.adminConfig.update({ where: { id: existing.id }, data: { characterVoices: assigned } });
    } else {
      await prisma.adminConfig.create({ data: { characterVoices: assigned } });
    }
  }

  private async invalidateCaches(): Promise<void> {
    // Preview clips and live-call profiles both hold the old voice.
    const [{ previewAudioService }, { realtimeContextService }, { voiceCatalogService }] = await Promise.all([
      import('./preview-audio.service'),
      import('./realtime-context.service'),
      import('./voice-catalog.service'),
    ]);
    previewAudioService.clear();
    voiceCatalogService.invalidate();
    await realtimeContextService.invalidateAll().catch(() => undefined);
  }

  /**
   * Load the stored assignment into the process, and create one on first boot.
   *
   * Automatic on purpose: the alternative is a shell command, and the person
   * who needs this runs the product from a phone.
   */
  async loadOrBootstrap(): Promise<void> {
    try {
      const config = await prisma.adminConfig.findFirst();
      const stored = (config?.characterVoices ?? null) as Record<string, unknown> | null;

      if (stored && typeof stored === 'object') {
        const map: Record<string, string> = {};
        for (const [id, value] of Object.entries(stored)) {
          if (typeof value === 'string' && value) map[id] = value;
        }
        if (Object.keys(map).length) {
          applyAssignedVoices(map);
          logger.info(`[FrenchVoices] loaded ${Object.keys(map).length} assigned voices`);
          return;
        }
      }

      if (!env.ELEVENLABS_API_KEY) return;
      logger.info('[FrenchVoices] no assignment yet — picking French voices from the library');
      await this.assign();
    } catch (error: any) {
      // A failure here must never stop the server: the characters keep their
      // previous ids, which is the situation this replaces, not a worse one.
      logger.warn(`[FrenchVoices] bootstrap skipped: ${error?.message}`);
    }
  }
}

export const frenchVoicesService = new FrenchVoicesService();
