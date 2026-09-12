import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { firstMessageVariants } from './system-prompt';
import { voiceForProfile } from './profile-voice';
import { synthesiseWithCartesia } from './cartesia.service';
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
 *
 * ── La signature vocale, et pourquoi elle décide de tout ────────────────────
 *
 * Un accueil enregistré n'est bon que tant qu'il ressemble à la suite de
 * l'appel. La première version ne comparait que le TEXTE, ce qui suffit à
 * détecter un renommage et à rien d'autre: la bascule du 27/08 vers Cartesia a
 * laissé en base des accueils dits par ElevenLabs, encore servis à l'appel,
 * donc une voix qui accueille et une autre qui répond au milieu du premier
 * tour de parole. Le garde-fou d'alors était posé à la GÉNÉRATION (« ne rien
 * pré-enregistrer si le fournisseur n'est pas ElevenLabs »), ce qui éteignait
 * l'optimisation pour tout le monde sans réparer les lignes déjà écrites.
 *
 * Chaque ligne porte donc désormais la voix qui l'a dite — fournisseur,
 * identifiant, modèle — calculée par `buildVoice`, c'est-à-dire par la MÊME
 * fonction que l'assistant de l'appel. La lecture compare, et refuse ce qui
 * diffère. Une ligne dont la provenance est inconnue (antérieure à ce
 * changement) ne correspond à rien et retourne à la synthèse en direct, le
 * temps d'être régénérée.
 */

const ELEVEN_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
/** Generation is off the audio path (onboarding, config change), so it can wait. */
const SYNTHESIS_TIMEOUT_MS = 15_000;

export interface GreetingRef {
  variant: number;
  text: string;
  url: string;
}

/** La voix qu'un accueil doit avoir pour être servi: celle de l'appel. */
export interface VoiceSignature {
  provider: '11labs' | 'cartesia';
  voiceId: string;
  model: string;
  /**
   * POURQUOI ce fournisseur, et pas seulement lequel.
   *
   * L'accueil pré-enregistré n'en a que faire: il compare une ligne à une
   * signature. `voice:doctor`, lui, répond à « pourquoi cette ligne parle chez
   * ElevenLabs alors que j'ai demandé Cartesia », relevé réel du 12/09, et le
   * motif est toute la réponse. Il voyage ici plutôt que de laisser le docteur
   * relire la règle de personnage une seconde fois — son propre test le lui
   * interdit, et c'est cette relecture qui fait diverger.
   */
  why: string;
}

/**
 * La voix que CET appel servira, telle que l'assistant la décrira.
 *
 * Passer par `buildVoice` et non par les variables d'environnement est le
 * point entier: la bascule vers Cartesia dépend du réglage global, mais aussi
 * du réglage par client, d'une voix clonée qui ne quitte jamais ElevenLabs,
 * et d'une voix choisie directement dans le catalogue Cartesia. Reconstituer
 * ces règles ici, c'est se condamner à les voir diverger.
 *
 * EXPORTÉE parce que `voice:doctor` a la même question à poser, et que la
 * poser deux fois est exactement la façon dont deux réponses finissent par
 * différer. Le docteur répond à « quelle voix parle VRAIMENT »: il compare
 * cette signature à celle de l'assistant DISTANT, et un écart dit que
 * l'assistant enregistré est périmé.
 *
 * Depuis le 12/09, ce n'est plus qu'une lecture de `voiceForProfile`: la
 * synchronisation de l'assistant enregistré résolvait la voix une TROISIÈME
 * fois, sans la voix choisie ni le clone, et c'est elle qui décroche.
 */
export function voiceSignatureFor(profile: ClientVoiceProfile): VoiceSignature {
  return voiceForProfile(profile).signature;
}


class GreetingAudioService {
  /** Public URL Vapi fetches. Must be reachable without auth. */
  private urlFor(clientId: string, variant: number): string {
    return `${env.API_BASE_URL}/api/voice/greeting/${clientId}/${variant}`;
  }

  /**
   * La voix que CET appel servira, telle que l'assistant la décrira.
   *
   * Passer par `buildVoice` et non par les variables d'environnement est le
   * point entier: la bascule vers Cartesia dépend du réglage global, mais aussi
   * du réglage par client, d'une voix clonée qui ne quitte jamais ElevenLabs,
   * et d'une voix choisie directement dans le catalogue Cartesia. Reconstituer
   * ces règles ici, c'est se condamner à les voir diverger.
   */
  private matches(
    row: { provider: string | null; voiceId: string | null; ttsModel: string | null },
    sig: VoiceSignature,
  ): boolean {
    return row.provider === sig.provider && row.voiceId === sig.voiceId && row.ttsModel === sig.model;
  }

  /** La clé du fournisseur qui doit dire l'accueil, et lui seul. */
  private hasKeyFor(sig: VoiceSignature): boolean {
    return sig.provider === 'cartesia' ? !!env.CARTESIA_API_KEY : !!env.ELEVENLABS_API_KEY;
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
    const sig = voiceSignatureFor(profile);

    if (!this.hasKeyFor(sig)) {
      logger.info(`[Greeting] pas de clé ${sig.provider} — accueil laissé à la synthèse en direct`);
      return 0;
    }

    // Only the anonymous variants are pre-generated: the named ones depend on
    // who is calling, which is not knowable before the phone rings.
    const variants = firstMessageVariants(profile, null);

    const existing = await prisma.greetingAudio.findMany({
      where: { clientId: profile.clientId },
      select: { variant: true, text: true, provider: true, voiceId: true, ttsModel: true },
    });
    const stored = new Map(existing.map(e => [e.variant, e]));

    let written = 0;
    for (const [variant, text] of variants.entries()) {
      /* Le texte ET la voix: une ligne juste par son texte mais dite par
         l'ancien fournisseur est exactement le défaut qu'on répare. */
      const row = stored.get(variant);
      if (row && row.text === text && this.matches(row, sig)) continue;

      try {
        const audio = await this.synthesise(text, sig, profile.language);
        await prisma.greetingAudio.upsert({
          where: { clientId_variant: { clientId: profile.clientId, variant } },
          create: {
            clientId: profile.clientId,
            variant,
            language: profile.language,
            text,
            data: audio,
            provider: sig.provider,
            voiceId: sig.voiceId,
            ttsModel: sig.model,
          },
          update: {
            language: profile.language,
            text,
            data: audio,
            provider: sig.provider,
            voiceId: sig.voiceId,
            ttsModel: sig.model,
          },
        });
        written++;
      } catch (error) {
        // One failed variant does not block the others: two cached greetings
        // out of three still removes the TTS wait two calls in three.
        logger.warn(`[Greeting] variant ${variant} failed for ${profile.clientId}: ${(error as Error).message}`);
      }
    }

    if (written) {
      logger.info(`[Greeting] ${written} variante(s) synthétisée(s) chez ${sig.provider} pour ${profile.businessName}`);
    }
    return written;
  }

  /**
   * The variants available as audio, for the orchestrator to choose from.
   * Returns only what genuinely exists, so the caller can fall back per variant
   * rather than all-or-nothing.
   *
   * Le profil et non le seul identifiant client: c'est lui qui dit quelle voix
   * l'appel servira, donc lesquelles de ces lignes sont encore les bonnes.
   */
  async available(profile: ClientVoiceProfile): Promise<GreetingRef[]> {
    const sig = voiceSignatureFor(profile);
    try {
      const rows = await prisma.greetingAudio.findMany({
        where: { clientId: profile.clientId },
        select: { variant: true, text: true, provider: true, voiceId: true, ttsModel: true },
        orderBy: { variant: 'asc' },
      });

      const usable = rows.filter(r => this.matches(r, sig));
      if (usable.length < rows.length) {
        /* Une trace, parce que c'est silencieux autrement: l'appel repart sur
           la synthèse en direct, ce qui est correct mais plus lent, et rien ne
           dirait pourquoi. La ligne nomme la voix attendue, donc ce qu'il
           faudra régénérer. */
        logger.info(
          `[Greeting] ${rows.length - usable.length} accueil(s) écarté(s) pour ${profile.clientId}: ` +
            `enregistrés avec une autre voix que ${sig.provider}/${sig.voiceId}`,
        );
      }

      return usable.map(r => ({ variant: r.variant, text: r.text, url: this.urlFor(profile.clientId, r.variant) }));
    } catch (error) {
      logger.warn(`[Greeting] lookup failed for ${profile.clientId}: ${(error as Error).message}`);
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

  /** Le fournisseur de la signature, et aucun autre. */
  private async synthesise(
    text: string,
    sig: VoiceSignature,
    lang: ClientVoiceProfile['language'],
  ): Promise<Uint8Array<ArrayBuffer>> {
    if (sig.provider === 'cartesia') {
      const audio = await synthesiseWithCartesia({ voiceId: sig.voiceId, text, lang });
      /* Copie et non `new Uint8Array(buf.buffer)`: un Buffer node est une VUE
         sur un tampon partagé, plus grand que lui la plupart du temps. Le
         passer tel quel écrirait en base l'octet de quelqu'un d'autre. */
      return new Uint8Array(audio) as Uint8Array<ArrayBuffer>;
    }
    return this.synthesiseWithEleven(text, sig);
  }

  private async synthesiseWithEleven(text: string, sig: VoiceSignature): Promise<Uint8Array<ArrayBuffer>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SYNTHESIS_TIMEOUT_MS);
    try {
      const response = await fetch(`${ELEVEN_URL}/${sig.voiceId}`, {
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
             phrase est pire que les deux grains pris séparément. Il vient de la
             signature, donc de `buildVoice`, et non de l'environnement. */
          model_id: sig.model,
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
