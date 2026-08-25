import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { firstMessageVariants } from './system-prompt';
import { resolveCharacter } from '../../config/voice-characters';
import type { ClientVoiceProfile } from './realtime-context.service';

/**
 * Pre-synthesised greeting audio (chantier 8).
 *
 * The opening line is identical from one call to the next, yet it is
 * re-synthesised every time — spending the TTS time-to-first-byte precisely on
 * the second where the caller decides whether they are talking to a person.
 * Vapi will play an audio URL supplied as `firstMessage`, so the greeting can
 * be generated once and served as bytes.
 *
 * Everything here is best-effort. A missing or failed greeting means the
 * assistant falls back to the text `firstMessage` and simply loses the
 * optimisation — it must never mean a call with no greeting.
 */

const ELEVEN_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
/** Generation is off the audio path (onboarding, config change), so it can wait. */
const SYNTHESIS_TIMEOUT_MS = 15_000;

export interface GreetingRef {
  variant: number;
  text: string;
  url: string;
}

class GreetingAudioService {
  /** Public URL Vapi fetches. Must be reachable without auth. */
  private urlFor(clientId: string, variant: number): string {
    return `${env.API_BASE_URL}/api/voice/greeting/${clientId}/${variant}`;
  }

  /**
   * Generate and store every greeting variant for a client.
   *
   * Called at onboarding and whenever the agent name, business name, character
   * or language changes — anything that alters what the greeting says or how it
   * sounds. Existing rows for unchanged text are left alone so a config change
   * does not re-bill the whole set.
   */
  async generate(profile: ClientVoiceProfile): Promise<number> {
    if (!env.ELEVENLABS_API_KEY) {
      logger.info('[Greeting] no ElevenLabs key — greetings stay on live synthesis');
      return 0;
    }
    /* Ce service synthétise chez ElevenLabs, en direct. Quand les APPELS
       passent par Cartesia, un accueil pré-enregistré ici serait d'un autre
       grain que la phrase suivante, et le changement de voix au milieu du
       premier tour s'entend beaucoup plus qu'un accueil un peu plus lent.
       On rend donc l'accueil à la synthèse en direct de l'appel, qui elle est
       du bon fournisseur. */
    if (env.VOICE_TTS_PROVIDER !== '11labs') {
      logger.info(`[Greeting] fournisseur ${env.VOICE_TTS_PROVIDER} — accueil laissé à la synthèse en direct`);
      return 0;
    }

    const character = resolveCharacter({
      characterId: profile.characterId,
      isFrench: profile.language === 'fr',
      country: profile.country,
      customVoice: profile.customVoice,
    });
    // Only the anonymous variants are pre-generated: the named ones depend on
    // who is calling, which is not knowable before the phone rings.
    const variants = firstMessageVariants(profile, null);

    const existing = await prisma.greetingAudio.findMany({
      where: { clientId: profile.clientId },
      select: { variant: true, text: true },
    });
    const unchanged = new Map(existing.map(e => [e.variant, e.text]));

    let written = 0;
    for (const [variant, text] of variants.entries()) {
      if (unchanged.get(variant) === text) continue;
      try {
        const audio = await this.synthesise(text, character.voiceId);
        await prisma.greetingAudio.upsert({
          where: { clientId_variant: { clientId: profile.clientId, variant } },
          create: { clientId: profile.clientId, variant, language: profile.language, text, data: audio },
          update: { language: profile.language, text, data: audio },
        });
        written++;
      } catch (error) {
        // One failed variant does not block the others: two cached greetings
        // out of three still removes the TTS wait two calls in three.
        logger.warn(`[Greeting] variant ${variant} failed for ${profile.clientId}: ${(error as Error).message}`);
      }
    }

    if (written) logger.info(`[Greeting] ${written} variant(s) synthesised for ${profile.businessName}`);
    return written;
  }

  /**
   * The variants available as audio, for the orchestrator to choose from.
   * Returns only what genuinely exists, so the caller can fall back per variant
   * rather than all-or-nothing.
   */
  async available(clientId: string): Promise<GreetingRef[]> {
    try {
      const rows = await prisma.greetingAudio.findMany({
        where: { clientId },
        select: { variant: true, text: true },
        orderBy: { variant: 'asc' },
      });
      return rows.map(r => ({ variant: r.variant, text: r.text, url: this.urlFor(clientId, r.variant) }));
    } catch (error) {
      logger.warn(`[Greeting] lookup failed for ${clientId}: ${(error as Error).message}`);
      return [];
    }
  }

  /** Bytes for the public route. */
  async fetch(clientId: string, variant: number) {
    return prisma.greetingAudio.findUnique({
      where: { clientId_variant: { clientId, variant } },
      select: { data: true, mimeType: true },
    });
  }

  /**
   * Drop a client's greetings so the next generation rebuilds them. Called when
   * the wording or the voice changes — a stale greeting is worse than no
   * greeting, because it introduces the agent under the wrong name.
   */
  async invalidate(clientId: string): Promise<void> {
    try {
      await prisma.greetingAudio.deleteMany({ where: { clientId } });
    } catch (error) {
      logger.warn(`[Greeting] invalidate failed for ${clientId}: ${(error as Error).message}`);
    }
  }

  private async synthesise(text: string, voiceId: string): Promise<Uint8Array<ArrayBuffer>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SYNTHESIS_TIMEOUT_MS);
    try {
      const response = await fetch(`${ELEVEN_URL}/${voiceId}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'xi-api-key': env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          // Same model as the live pipeline: a greeting that sounds different
          // from the rest of the call is worse than a slower one.
          /* Le même modèle que l'appel: l'accueil est le premier son que
             l'appelant entend, et l'entendre changer de grain à la deuxième
             phrase est pire que les deux grains pris séparément. */
          model_id: env.VOICE_TTS_MODEL,
          voice_settings: { stability: 0.22, similarity_boost: 0.65, style: 0.7, use_speaker_boost: true },
        }),
      });
      if (!response.ok) throw new Error(`ElevenLabs responded ${response.status}`);
      // Uint8Array<ArrayBuffer>, not Buffer: Prisma's Bytes column types against
      // the former, and Buffer's ArrayBufferLike admits SharedArrayBuffer.
      const bytes = await response.arrayBuffer();
      return new Uint8Array(bytes) as Uint8Array<ArrayBuffer>;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const greetingAudioService = new GreetingAudioService();
