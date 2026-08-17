import { env } from '../../config/env';
import { logger } from '../../config/logger';

/**
 * Fish Audio, comme deuxième synthèse vocale — pour l'audition, pas pour l'appel.
 *
 * Pourquoi ce fichier existe, et où il s'arrête. Le chemin d'appel réel passe
 * par Vapi, qui parle nativement à ElevenLabs, PlayHT, Cartesia, Rime, LMNT,
 * Minimax, Azure et OpenAI — mais pas à Fish Audio. L'y brancher suppose un
 * endpoint `custom-voice` chez nous, que Vapi appellerait à chaque bout de
 * phrase: un aller-retour de plus DANS le chemin audio, à travers notre unique
 * instance Render. C'est cher, et ça n'a de sens que si la voix est réellement
 * meilleure en français.
 *
 * Or « meilleure » ne se déduit pas: le comparatif « Fish gagne 60 % des tests
 * à l'aveugle » vient de la page marketing de Fish Audio et porte sur
 * l'anglais. Une voix excellente en anglais peut rater ses liaisons en
 * français. La seule preuve possible est d'écouter, sur nos propres phrases.
 *
 * Ce module sert donc les APERÇUS du tableau de bord, qui sont hors du chemin
 * d'appel: une écoute ratée ne coûte qu'un aperçu muet. Si l'oreille tranche en
 * faveur de Fish, le travail suivant est l'endpoint `custom-voice`, et il
 * réutilisera cette fonction.
 *
 * Contrat de l'API (deux sources concordantes): POST vers `/v1/tts`, la clé en
 * `Authorization: Bearer`, le MODÈLE dans un en-tête `model` et non dans le
 * corps, et la voix en `reference_id` dans le corps.
 */

/** Le timbre demandé. `reference_id` est un identifiant du catalogue Fish. */
export interface FishSynthesisRequest {
  referenceId: string;
  text: string;
}

export interface FishSynthesisFailure {
  /** Statut HTTP renvoyé par Fish Audio, quand il y en a un. */
  upstream?: number;
  /** Message lisible, destiné à remonter jusqu'au navigateur. */
  reason?: string;
}

export class FishAudioError extends Error implements FishSynthesisFailure {
  constructor(message: string, readonly upstream?: number, readonly reason?: string) {
    super(message);
  }
}

const ENDPOINT = 'https://api.fish.audio/v1/tts';

/**
 * La voix Fish correspondant à une voix ElevenLabs.
 *
 * Les deux catalogues sont étrangers l'un à l'autre: un id ElevenLabs ne
 * désigne rien chez Fish. La table de correspondance est donc obligatoire, et
 * son absence est une erreur explicite plutôt qu'un repli — sans quoi
 * l'audition comparerait ElevenLabs à lui-même.
 */
export function fishVoiceFor(elevenVoiceId: string): string | null {
  for (const pair of env.FISH_AUDIO_VOICES.split(',')) {
    const [from, to] = pair.split('=').map(s => s.trim());
    if (from && to && from === elevenVoiceId) return to;
  }
  return env.FISH_AUDIO_DEFAULT_VOICE_ID || null;
}

/**
 * Un clip MP3, ou une erreur qui dit pourquoi.
 *
 * Une seule reprise, et seulement sur les échecs transitoires (429 et 5xx),
 * pour la même raison que du côté ElevenLabs: l'échec qui arrive vraiment ici
 * est un pic de concurrence quand plusieurs cartes sont pressées d'affilée, et
 * il passe à la seconde tentative. Réessayer un 401 ne ferait que doubler
 * l'attente avant la même réponse.
 */
export async function synthesiseWithFish(req: FishSynthesisRequest): Promise<Buffer> {
  if (!env.FISH_AUDIO_API_KEY) throw new FishAudioError('fish_key_missing');
  if (!req.referenceId) throw new FishAudioError('fish_voice_unmapped');

  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.FISH_AUDIO_API_KEY}`,
        'Content-Type': 'application/json',
        // Le modèle voyage dans un en-tête chez Fish Audio, pas dans le corps.
        model: env.FISH_AUDIO_MODEL,
      },
      body: JSON.stringify({
        text: req.text,
        reference_id: req.referenceId,
        // Le même format que les clips ElevenLabs, pour que le cache disque et
        // l'en-tête `audio/mpeg` de la route restent valables pour les deux.
        format: 'mp3',
      }),
    });

    if (r.ok) {
      const audio = Buffer.from(await r.arrayBuffer());
      // Un corps vide avec un 200 est le pire des cas: mis en cache, il rendrait
      // la carte définitivement muette sans jamais signaler d'erreur.
      if (!audio.length) throw new FishAudioError('fish_empty_audio', 200);
      return audio;
    }

    const detail = await r.text().catch(() => '');
    if ((r.status === 429 || r.status >= 500) && attempt === 0) {
      await new Promise(resolve => setTimeout(resolve, 700));
      continue;
    }

    logger.warn(`[FishAudio] ${r.status} for voice ${req.referenceId}: ${detail.slice(0, 300)}`);
    let reason: string | undefined;
    try {
      const body = JSON.parse(detail);
      reason = body?.detail?.message || body?.message || body?.detail;
    } catch { /* pas du JSON */ }
    throw new FishAudioError(
      'fish_request_failed',
      r.status,
      (typeof reason === 'string' ? reason : detail).slice(0, 200) || undefined,
    );
  }

  // Inatteignable: la boucle retourne ou lève.
  throw new FishAudioError('fish_request_failed');
}
