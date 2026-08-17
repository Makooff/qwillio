import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { FishAudioError, fishVoiceFor, synthesiseWithFish } from './fish-audio.service';

/**
 * Preview clips, synthesised once and then read from a file.
 *
 * Previews used to call ElevenLabs on every press of ▶. That is one paid,
 * rate-limited network round-trip for a sentence that never changes — so the
 * button had a delay before any sound, and when the account hit its concurrency
 * limit the clip simply stopped arriving: previews worked, then after a refresh
 * the same button produced nothing at all.
 *
 * A preview line is fixed text in a fixed voice. It only has to be produced
 * once. After that it is a file, and a file cannot be rate-limited.
 *
 * Deux fournisseurs depuis le 17/08/2026, choisis par `VOICE_PREVIEW_PROVIDER`:
 * ElevenLabs par défaut, Fish Audio en option. Ces aperçus sont hors du chemin
 * d'appel, ce qui en fait le seul endroit où l'on peut ENTENDRE une autre voix
 * sur nos propres phrases sans rien risquer sur un appel réel.
 *
 * Two layers, both deliberate:
 *  - memory, so a warm instance answers without touching the disk;
 *  - disk, so a redeploy or a second worker does not re-buy every clip.
 * The disk is Render's ephemeral one on purpose: losing the cache costs one
 * synthesis, so it is a cache, never a store.
 */

const MODEL = 'eleven_multilingual_v2';
/** Roughly 60 KB a clip, so the whole catalog in both languages stays small. */
const MAX_MEMORY_ENTRIES = 60;
const CACHE_DIR = join(tmpdir(), 'qwillio-preview-audio');

export class PreviewAudioError extends Error {
  constructor(message: string, readonly status: number, readonly upstream?: number, readonly reason?: string) {
    super(message);
  }
}

export interface PreviewRequest {
  voiceId: string;
  text: string;
  stability: number;
  similarityBoost: number;
  style: number;
}

/**
 * Same voice, same words, same knobs — same audio.
 *
 * Le fournisseur et son modèle font partie de la clé, et ce n'est pas une
 * précaution de style: sans eux, basculer sur Fish Audio servirait les clips
 * ElevenLabs déjà en cache, et l'audition comparerait ElevenLabs à lui-même
 * sans que rien ne le signale. Le seul symptôme serait « je n'entends aucune
 * différence », c'est-à-dire la mauvaise conclusion.
 */
export function previewKey(req: PreviewRequest): string {
  const provider = env.VOICE_PREVIEW_PROVIDER === 'fish'
    ? `fish:${env.FISH_AUDIO_MODEL}:${fishVoiceFor(req.voiceId) ?? 'unmapped'}`
    : '11labs';
  return createHash('sha1')
    .update([provider, req.voiceId, req.text, req.stability, req.similarityBoost, req.style].join('|'))
    .digest('hex');
}

const memory = new Map<string, Buffer>();
/**
 * Requests in flight, so ten cards pressed in a row (or two tabs) produce one
 * synthesis rather than ten. Concurrency is exactly what the account limit
 * punishes, and it was the likeliest reason previews died after a refresh.
 */
const inFlight = new Map<string, Promise<Buffer>>();

function remember(key: string, audio: Buffer): void {
  memory.set(key, audio);
  if (memory.size > MAX_MEMORY_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
}

async function readDisk(key: string): Promise<Buffer | null> {
  try {
    return await readFile(join(CACHE_DIR, `${key}.mp3`));
  } catch {
    return null; // absent, or the directory does not exist yet
  }
}

async function writeDisk(key: string, audio: Buffer): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, `${key}.mp3`), audio);
  } catch (err) {
    // A cache that cannot be written is still a working preview.
    logger.debug(`[PreviewAudio] disk cache write failed: ${(err as Error).message}`);
  }
}

/**
 * L'aperçu par Fish Audio, quand `VOICE_PREVIEW_PROVIDER=fish`.
 *
 * Les réglages ElevenLabs (`stability`, `similarityBoost`, `style`) n'ont pas
 * d'équivalent ici et sont ignorés: ils restent dans la clé de cache parce
 * qu'ils décrivent la demande, pas parce que Fish les honore.
 */
async function synthesiseWithFishProvider(req: PreviewRequest): Promise<Buffer> {
  const referenceId = fishVoiceFor(req.voiceId);

  try {
    return await synthesiseWithFish({ referenceId: referenceId ?? '', text: req.text });
  } catch (err) {
    if (err instanceof FishAudioError) {
      // `fish_key_missing` et `fish_voice_unmapped` sont des réglages absents,
      // pas des pannes: 503 pour que l'écran le dise au lieu d'afficher une
      // erreur serveur. Et surtout, aucun repli sur ElevenLabs — c'est
      // précisément ce qui rendrait l'audition fausse.
      const configMissing = err.message === 'fish_key_missing' || err.message === 'fish_voice_unmapped';
      throw new PreviewAudioError(err.message, configMissing ? 503 : 502, err.upstream, err.reason);
    }
    throw err;
  }
}

async function synthesise(req: PreviewRequest): Promise<Buffer> {
  if (env.VOICE_PREVIEW_PROVIDER === 'fish') return synthesiseWithFishProvider(req);
  if (!env.ELEVENLABS_API_KEY) throw new PreviewAudioError('elevenlabs_key_missing', 503);

  // One retry, because the failure that actually happens here is a transient
  // 429 from too many previews at once, and a retry a second later succeeds.
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${req.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: req.text,
        model_id: MODEL,
        voice_settings: {
          stability: req.stability,
          similarity_boost: req.similarityBoost,
          style: req.style,
        },
      }),
    });

    if (r.ok) {
      const audio = Buffer.from(await r.arrayBuffer());
      if (!audio.length) throw new PreviewAudioError('elevenlabs_empty_audio', 502, 200);
      return audio;
    }

    const detail = await r.text().catch(() => '');
    const retryable = r.status === 429 || r.status >= 500;
    if (retryable && attempt === 0) {
      await new Promise(resolve => setTimeout(resolve, 700));
      continue;
    }

    logger.warn(`[PreviewAudio] ElevenLabs ${r.status} for voice ${req.voiceId}: ${detail.slice(0, 300)}`);
    // The reason travels to the browser: server logs are not reachable from a
    // phone, and without it "no sound" is indistinguishable from a bad voice.
    let reason: string | undefined;
    try {
      const body = JSON.parse(detail);
      reason = body?.detail?.message || body?.detail?.status || body?.message;
    } catch { /* not JSON */ }
    throw new PreviewAudioError('elevenlabs_request_failed', 502, r.status, (reason || detail).slice(0, 200) || undefined);
  }

  // Unreachable: the loop either returns or throws.
  throw new PreviewAudioError('elevenlabs_request_failed', 502);
}

class PreviewAudioService {
  /** The clip, from memory, then disk, then ElevenLabs — in that order. */
  async get(req: PreviewRequest): Promise<{ audio: Buffer; key: string }> {
    const key = previewKey(req);

    const cached = memory.get(key) ?? await readDisk(key);
    if (cached) {
      remember(key, cached);
      return { audio: cached, key };
    }

    const pending = inFlight.get(key);
    if (pending) return { audio: await pending, key };

    const task = synthesise(req)
      .then(async audio => {
        remember(key, audio);
        await writeDisk(key, audio);
        return audio;
      })
      .finally(() => inFlight.delete(key));

    inFlight.set(key, task);
    return { audio: await task, key };
  }

  /**
   * Produce clips ahead of the first press, one at a time.
   *
   * Sequential on purpose: firing twenty syntheses at once is how the account
   * hits its concurrency limit, which is the failure this whole service exists
   * to remove. Failures are swallowed — a warm-up that breaks the page it is
   * trying to speed up would be a bad trade.
   */
  async warm(requests: PreviewRequest[]): Promise<void> {
    for (const req of requests) {
      try {
        await this.get(req);
      } catch {
        return; // a failing key or an exhausted quota will fail for all of them
      }
    }
  }

  /** Test seam. */
  clear(): void {
    memory.clear();
    inFlight.clear();
  }
}

export const previewAudioService = new PreviewAudioService();
