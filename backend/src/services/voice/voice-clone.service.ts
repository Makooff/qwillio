import { env } from '../../config/env';
import { logger } from '../../config/logger';

/**
 * Instant Voice Cloning against ElevenLabs — the client's own voice as the
 * receptionist.
 *
 * Instant, not Professional: a clone is expected to be usable seconds after the
 * owner stops recording. Professional cloning needs hours of audio and a
 * training delay, which does not fit a setup screen.
 *
 * Two things this module refuses to do quietly:
 *
 *   - clone without recorded consent. Cloning someone's voice without their
 *     agreement is against ElevenLabs' terms and is the kind of thing that gets
 *     an account closed. The caller must pass `consent: true`, and the reason it
 *     is a parameter rather than a UI checkbox alone is that a checkbox can be
 *     bypassed by calling the API directly.
 *   - hide why it failed. ElevenLabs answers 401 on a free plan (cloning is a
 *     paid feature) and that is indistinguishable from a bad key unless the
 *     upstream body is surfaced.
 */

/** ElevenLabs rejects very short samples; below this a clone is worthless anyway. */
export const MIN_SAMPLE_BYTES = 40 * 1024;
/** Kept under the 10 MB express json limit, base64 inflation included. */
export const MAX_SAMPLE_BYTES = 6 * 1024 * 1024;

export interface ClonedVoice {
  voiceId: string;
  name: string;
  createdAt: string;
}

export class VoiceCloneError extends Error {
  constructor(message: string, readonly status: number, readonly upstream?: number) {
    super(message);
  }
}

class VoiceCloneService {
  /**
   * Create a cloned voice from one recorded sample.
   *
   * The name is prefixed with the client id: an ElevenLabs account is shared by
   * every tenant, and two clients both naming their voice "Accueil" would
   * otherwise be indistinguishable in the dashboard when one has to be deleted.
   */
  async create(params: {
    clientId: string;
    sample: Buffer;
    mimeType: string;
    label: string;
    consent: boolean;
  }): Promise<ClonedVoice> {
    const { clientId, sample, mimeType, label, consent } = params;

    if (!consent) throw new VoiceCloneError('consent_required', 400);
    if (!env.ELEVENLABS_API_KEY) throw new VoiceCloneError('elevenlabs_key_missing', 503);
    if (sample.length < MIN_SAMPLE_BYTES) throw new VoiceCloneError('sample_too_short', 400);
    if (sample.length > MAX_SAMPLE_BYTES) throw new VoiceCloneError('sample_too_large', 413);

    const name = `${clientId.slice(0, 8)} — ${label.trim().slice(0, 40) || 'Voix du client'}`;

    const form = new FormData();
    form.append('name', name);
    form.append('description', 'Qwillio — voix clonée par le client depuis son tableau de bord');
    form.append('files', new Blob([new Uint8Array(sample)], { type: mimeType }), 'sample.webm');

    const r = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
      body: form,
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      logger.warn(`[VoiceClone] add failed ${r.status} for ${clientId}: ${detail.slice(0, 300)}`);
      // 401 here is almost always a free plan rather than a bad key: the same
      // key works for the voice previews. Saying so saves an hour of guessing.
      throw new VoiceCloneError('elevenlabs_clone_failed', 502, r.status);
    }

    const body = (await r.json().catch(() => ({}))) as { voice_id?: string };
    if (!body.voice_id) throw new VoiceCloneError('elevenlabs_clone_failed', 502, r.status);

    logger.info(`[VoiceClone] created ${body.voice_id} for ${clientId}`);
    return { voiceId: body.voice_id, name, createdAt: new Date().toISOString() };
  }

  /**
   * Delete a cloned voice upstream.
   *
   * Never throws: the caller's real goal is to stop using the voice, and that
   * is a local config change. A voice left behind on the ElevenLabs account is
   * clutter, not a failure worth blocking the user on.
   */
  async remove(voiceId: string): Promise<boolean> {
    if (!env.ELEVENLABS_API_KEY) return false;
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
      });
      if (!r.ok) logger.warn(`[VoiceClone] delete ${r.status} for ${voiceId}`);
      return r.ok;
    } catch (error) {
      logger.warn(`[VoiceClone] delete failed for ${voiceId}: ${(error as Error).message}`);
      return false;
    }
  }
}

export const voiceCloneService = new VoiceCloneService();
