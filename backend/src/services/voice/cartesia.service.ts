import { env } from '../../config/env';
import { logger } from '../../config/logger';
// `import type` et non `import`: `speech-plans` importe ce module en retour,
// et seul le type, effacé à la compilation, évite le cycle à l'exécution.
import type { VoiceLanguage } from './speech-plans';

/**
 * Cartesia Sonic, comme seconde synthèse vocale — et cette fois DANS l'appel.
 *
 * Ce que ce module a de différent de `fish-audio.service`, et qui décide de
 * tout: Vapi parle nativement à Cartesia. Il n'y a donc pas d'endpoint
 * `custom-voice` à exposer, pas d'aller-retour de plus à travers Render, pas de
 * latence ajoutée au chemin audio. On pose un bloc `voice` et Vapi s'adresse
 * directement à Cartesia. C'est la raison pour laquelle Cartesia est jouable et
 * Fish Audio ne l'était pas, à qualité de voix égale.
 *
 * Ce fichier ne sert que les APERÇUS. Sur l'appel, c'est Vapi qui appelle
 * Cartesia avec ses propres clés, et `buildVoice` ne fait que décrire la voix.
 * Mais un aperçu qui ne passerait pas par Cartesia auditionnerait ElevenLabs et
 * ferait croire à une voix qu'on n'aura pas: c'est le défaut qu'on vient de
 * corriger, on ne le réintroduit pas par la porte d'à côté.
 */

/** Version d'API épinglée: Cartesia la lit dans un en-tête et refuse sans elle. */
const API_VERSION = '2024-11-13';
const ENDPOINT = 'https://api.cartesia.ai/tts/bytes';

/** Les codes de langue de Cartesia, qui sont ceux de Vapi pour ce fournisseur. */
export const CARTESIA_LANG: Record<VoiceLanguage, string> = { fr: 'fr', en: 'en', nl: 'nl' };

export class CartesiaError extends Error {
  constructor(message: string, readonly upstream?: number, readonly reason?: string) {
    super(message);
  }
}

/**
 * La voix Cartesia correspondant à une voix ElevenLabs.
 *
 * Les deux catalogues sont étrangers l'un à l'autre: un identifiant ElevenLabs
 * ne désigne rien chez Cartesia. D'où une table, qui permet de basculer voix
 * par voix, à l'oreille, au lieu de tout basculer d'un coup et de découvrir sur
 * un appel réel qu'un personnage sonne faux.
 *
 * DEUX ÉCRITURES SONT ACCEPTÉES, et la seconde existe pour une raison précise:
 *
 *   - `voixEleven:voixCartesia,…` — la correspondance fine, personnage par
 *     personnage;
 *   - `voixCartesia` seule, sans deux-points — « celle-là, pour tout le monde ».
 *
 * La première version n'acceptait que la forme à deux-points, et une entrée
 * sans deux-points ne produisait RIEN: pas d'erreur, pas de journal, la
 * réceptionniste restait simplement chez ElevenLabs. Or « je colle
 * l'identifiant de la voix que j'aime » est le geste naturel, et il tombait
 * exactement dans ce trou. Une configuration qui ne marche pas doit se voir;
 * celle-ci se comprend maintenant toute seule.
 *
 * Précédence: correspondance explicite, puis voix unique, puis
 * `CARTESIA_DEFAULT_VOICE_ID`.
 */
export function cartesiaVoiceFor(elevenVoiceId: string): string | null {
  let blanket: string | null = null;

  for (const raw of env.CARTESIA_VOICES.split(',')) {
    const entry = raw.trim();
    if (!entry) continue;

    if (!entry.includes(':')) {
      // Une voix seule: elle sert tout le monde, à moins qu'une correspondance
      // explicite ne la contredise, d'où le fait qu'on continue à lire.
      blanket = blanket ?? entry;
      continue;
    }

    const [from, to] = entry.split(':').map(s => s.trim());
    if (from && to && from === elevenVoiceId) return to;
  }

  return blanket || env.CARTESIA_DEFAULT_VOICE_ID || null;
}

/**
 * Un clip d'aperçu, synthétisé par Cartesia.
 *
 * `mp3` plutôt que `wav`: l'aperçu descend jusqu'au navigateur, qui le reçoit
 * en `audio/mpeg` comme tous les autres, et un conteneur différent obligerait
 * l'écran à savoir de quel fournisseur vient le clip qu'il joue.
 */
export async function synthesiseWithCartesia(req: {
  voiceId: string;
  text: string;
  lang: VoiceLanguage;
}): Promise<Buffer> {
  if (!env.CARTESIA_API_KEY) throw new CartesiaError('cartesia_key_missing');
  if (!req.voiceId) throw new CartesiaError('cartesia_voice_unmapped');

  let r: Response;
  try {
    r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-Key': env.CARTESIA_API_KEY,
        'Cartesia-Version': API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: env.CARTESIA_MODEL,
        transcript: req.text,
        voice: { mode: 'id', id: req.voiceId },
        language: CARTESIA_LANG[req.lang],
        output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
      }),
    });
  } catch (error) {
    throw new CartesiaError('cartesia_unreachable', undefined, (error as Error).message);
  }

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    // Le corps amont est REMONTÉ: chez Cartesia, un 400 sur un identifiant de
    // voix inconnu et un 400 sur un modèle inconnu se ressemblent, et seul le
    // message les sépare. Sans lui, on cherche à l'aveugle.
    logger.warn(`[Cartesia] tts ${r.status}: ${detail.slice(0, 300)}`);
    throw new CartesiaError('cartesia_tts_failed', r.status, detail.slice(0, 200));
  }

  const audio = Buffer.from(await r.arrayBuffer());
  if (!audio.length) throw new CartesiaError('cartesia_empty_audio', 200);
  return audio;
}

/**
 * Le catalogue Cartesia, dans la forme que le sélecteur sait déjà afficher.
 *
 * Champ par champ, et volontairement tolérant: la documentation de Cartesia
 * n'est pas atteignable depuis l'environnement où ce code a été écrit, et
 * deviner une forme exacte qu'on ne peut pas lire produirait un écran vide sans
 * rien pour l'expliquer. On accepte donc les deux noms plausibles pour chaque
 * champ (`id` ou `voice_id`, `data` ou tableau nu), on ignore ce qu'on ne
 * reconnaît pas, et on refuse une entrée sans identifiant utilisable plutôt que
 * de mettre une chaîne vide devant un appelant. C'est exactement la précaution
 * déjà prise pour ElevenLabs, pour la même raison: un tiers change ses formes.
 */
export interface CartesiaCatalogVoice {
  voiceId: string;
  name: string;
  description: string | null;
  language: string | null;
}

export function toCartesiaVoice(raw: unknown): CartesiaCatalogVoice | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const id = [v.id, v.voice_id, v.voiceId].find(x => typeof x === 'string' && x !== '');
  if (typeof id !== 'string') return null;

  const str = (x: unknown) => (typeof x === 'string' && x.trim() !== '' ? x : null);
  return {
    voiceId: id,
    name: str(v.name) ?? 'Sans nom',
    description: str(v.description),
    language: str(v.language),
  };
}

const CATALOG_TTL_MS = 10 * 60 * 1000;
let catalog: { at: number; voices: CartesiaCatalogVoice[] } | null = null;

/** Vide le cache, pour qu'une voix ajoutée chez Cartesia apparaisse tout de suite. */
export function invalidateCartesiaCatalog(): void {
  catalog = null;
}

/**
 * Les voix du compte, filtrées sur la langue de l'agent.
 *
 * Le filtre est appliqué SEULEMENT quand l'entrée porte une langue: une voix
 * sans langue déclarée est servie plutôt que cachée, parce qu'une liste vide
 * ne se distingue pas d'une panne à l'écran.
 */
export async function listCartesiaVoices(lang: VoiceLanguage): Promise<CartesiaCatalogVoice[]> {
  if (!env.CARTESIA_API_KEY) throw new CartesiaError('cartesia_key_missing');

  if (!catalog || Date.now() - catalog.at >= CATALOG_TTL_MS) {
    let r: Response;
    try {
      r = await fetch('https://api.cartesia.ai/voices/?limit=100', {
        headers: { 'X-API-Key': env.CARTESIA_API_KEY, 'Cartesia-Version': API_VERSION },
      });
    } catch (error) {
      throw new CartesiaError('cartesia_unreachable', undefined, (error as Error).message);
    }

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      logger.warn(`[Cartesia] voices ${r.status}: ${detail.slice(0, 300)}`);
      throw new CartesiaError('cartesia_list_failed', r.status, detail.slice(0, 200));
    }

    const body = (await r.json().catch(() => ({}))) as { data?: unknown[] } | unknown[];
    const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
    catalog = {
      at: Date.now(),
      voices: rows.map(toCartesiaVoice).filter((v): v is CartesiaCatalogVoice => v !== null),
    };
  }

  const wanted = CARTESIA_LANG[lang];
  return catalog.voices.filter(v => !v.language || v.language === wanted);
}
