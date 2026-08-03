import { env } from '../../config/env';
import { logger } from '../../config/logger';

/**
 * The voices actually available on this ElevenLabs account.
 *
 * Why this exists: the character catalog hardcodes voice ids that were pasted
 * in by hand. One of them (Lucas) turned out to be a female voice and shipped
 * that way for weeks — nothing in the code could catch it, because a voice id
 * is an opaque string and only listening tells you what it is.
 *
 * Serving the account's real voices, with their gender and accent labels and a
 * playable sample, replaces pasting an id with choosing one that has been
 * heard. That is the only reliable fix for a whole class of bug.
 */

export interface CatalogVoice {
  voiceId: string;
  name: string;
  /** ElevenLabs labels: gender, accent, age, use case. Free-form, often partial. */
  gender: string | null;
  accent: string | null;
  description: string | null;
  /** Short sample hosted by ElevenLabs. Absent on some cloned voices. */
  previewUrl: string | null;
  /** True for a voice cloned on this account rather than a library voice. */
  cloned: boolean;
}

const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; voices: CatalogVoice[] } | null = null;

class VoiceCatalogService {
  /**
   * List the account's voices, newest clones first.
   *
   * Cached for ten minutes: the list changes only when someone adds or removes
   * a voice, and the settings screen would otherwise hit ElevenLabs on every
   * render.
   */
  async list(): Promise<CatalogVoice[]> {
    if (!env.ELEVENLABS_API_KEY) throw new Error('elevenlabs_key_missing');

    if (cache && Date.now() - cache.at < TTL_MS) return cache.voices;

    const r = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      logger.warn(`[VoiceCatalog] list failed ${r.status}: ${detail.slice(0, 200)}`);
      throw new Error('elevenlabs_list_failed');
    }

    const body = (await r.json().catch(() => ({}))) as { voices?: unknown[] };
    const voices = (body.voices ?? []).map(toCatalogVoice).filter((v): v is CatalogVoice => v !== null);

    // Cloned voices are the ones the owner made deliberately; a library of a
    // hundred stock voices should not bury them.
    voices.sort((a, b) => Number(b.cloned) - Number(a.cloned) || a.name.localeCompare(b.name));

    cache = { at: Date.now(), voices };
    return voices;
  }

  /** Drops the cache so a freshly cloned voice shows up without a ten-minute wait. */
  invalidate(): void {
    cache = null;
  }
}

/**
 * Field-by-field rather than a cast: this JSON comes from a third party that
 * has changed its shape before, and a missing voice_id would put an empty
 * string in front of a live caller.
 */
export function toCatalogVoice(raw: unknown): CatalogVoice | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.voice_id !== 'string' || v.voice_id === '') return null;

  const labels = (v.labels && typeof v.labels === 'object' ? v.labels : {}) as Record<string, unknown>;
  const str = (x: unknown) => (typeof x === 'string' && x.trim() !== '' ? x : null);

  return {
    voiceId: v.voice_id,
    name: str(v.name) ?? 'Sans nom',
    gender: str(labels.gender),
    accent: str(labels.accent),
    description: str(v.description) ?? str(labels.description) ?? str(labels.use_case),
    previewUrl: str(v.preview_url),
    cloned: v.category === 'cloned' || v.category === 'professional',
  };
}

export const voiceCatalogService = new VoiceCatalogService();
