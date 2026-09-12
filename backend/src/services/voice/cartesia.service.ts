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
export const API_VERSION = '2024-11-13';
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
  /**
   * `male` / `female`, ou `null`.
   *
   * Cartesia le déclare sous une forme qu'on ne peut pas lire d'ici (la
   * documentation n'est pas atteignable de cet environnement), d'où une
   * lecture tolérante: `gender` ou `labels.gender`, « masculine » comme
   * « male ». C'est ce champ qui permet au portail de trier hommes et femmes;
   * absent, la voix est servie sous « autres » plutôt que cachée.
   */
  gender: 'male' | 'female' | null;
}

/** « masculine », « Male », « m » → `male`; le reste → `null`, jamais deviné. */
export function normaliseGender(raw: unknown): 'male' | 'female' | null {
  if (typeof raw !== 'string') return null;
  const g = raw.trim().toLowerCase();
  if (g === 'male' || g === 'masculine' || g === 'm' || g === 'homme' || g === 'man') return 'male';
  if (g === 'female' || g === 'feminine' || g === 'f' || g === 'femme' || g === 'woman') return 'female';
  return null;
}

export function toCartesiaVoice(raw: unknown): CartesiaCatalogVoice | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const id = [v.id, v.voice_id, v.voiceId].find(x => typeof x === 'string' && x !== '');
  if (typeof id !== 'string') return null;

  const str = (x: unknown) => (typeof x === 'string' && x.trim() !== '' ? x : null);
  const labels = v.labels && typeof v.labels === 'object' ? (v.labels as Record<string, unknown>) : {};
  return {
    voiceId: id,
    name: str(v.name) ?? 'Sans nom',
    description: str(v.description),
    language: str(v.language),
    gender: normaliseGender(v.gender) ?? normaliseGender(labels.gender),
  };
}

const CATALOG_TTL_MS = 10 * 60 * 1000;
let catalog: { at: number; voices: CartesiaCatalogVoice[] } | null = null;

/** Vide le cache, pour qu'une voix ajoutée chez Cartesia apparaisse tout de suite. */
export function invalidateCartesiaCatalog(): void {
  catalog = null;
}

/**
 * Combien de pages au plus. 100 voix par page: 50 pages couvrent 5 000 voix,
 * bien au-delà de la bibliothèque publique, et bornent une boucle qui ne
 * doit jamais tourner sans fin sur une réponse mal formée.
 */
const MAX_CATALOG_PAGES = 50;

/**
 * TOUT le catalogue, page après page.
 *
 * ── Le trou que ceci bouche ────────────────────────────────────────────────
 *
 * La première version demandait `?limit=100` UNE fois et filtrait sur la
 * langue ce qu'elle avait reçu. Or la réponse réelle, lue le 12/09/2026 avec
 * `npm run voice:cartesia -- --raw`, porte `has_more: true` et un
 * `next_page`: Cartesia sert sa bibliothèque PUBLIQUE entière
 * (`is_public: true`, `is_owner: false`), soit bien plus de cent voix, et les
 * cent premières sont à peu près toutes anglaises. Le sélecteur du portail
 * montrait donc « aucune voix française » ou une poignée, selon l'ordre du
 * jour — et le client, qui voyait des dizaines de voix françaises sur le site
 * de Cartesia, ne comprenait pas ce qui manquait. Rien ne manquait: on
 * n'avait pas tourné la page.
 *
 * ── Le curseur, et ce qu'on n'a PAS pu vérifier ───────────────────────────
 *
 * `next_page` vaut l'identifiant de la dernière entrée servie. Le nom du
 * paramètre qui le renvoie n'est pas lisible d'ici (la documentation n'est pas
 * atteignable); `starting_after` est la forme habituelle de ce type de
 * curseur. Si elle est fausse, la page suivante RÉPÈTE la première: la boucle
 * le détecte (aucun identifiant nouveau), s'arrête, et le journal nomme le
 * paramètre à corriger, plutôt que de tourner cinquante fois ou de servir la
 * même page en boucle. Une supposition qui se vérifie elle-même vaut mieux
 * qu'une lecture qu'on n'a pas.
 */
async function fetchWholeCatalog(): Promise<CartesiaCatalogVoice[]> {
  const seen = new Set<string>();
  const voices: CartesiaCatalogVoice[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_CATALOG_PAGES; page++) {
    const url = `https://api.cartesia.ai/voices/?limit=100${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ''}`;
    let r: Response;
    try {
      r = await fetch(url, { headers: { 'X-API-Key': env.CARTESIA_API_KEY, 'Cartesia-Version': API_VERSION } });
    } catch (error) {
      throw new CartesiaError('cartesia_unreachable', undefined, (error as Error).message);
    }

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      logger.warn(`[Cartesia] voices ${r.status}: ${detail.slice(0, 300)}`);
      throw new CartesiaError('cartesia_list_failed', r.status, detail.slice(0, 200));
    }

    const body = (await r.json().catch(() => ({}))) as
      | { data?: unknown[]; has_more?: boolean; next_page?: string | null }
      | unknown[];
    const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];

    let fresh = 0;
    for (const raw of rows) {
      const v = toCartesiaVoice(raw);
      if (!v || seen.has(v.voiceId)) continue;
      seen.add(v.voiceId);
      voices.push(v);
      fresh++;
    }

    const more = !Array.isArray(body) && body?.has_more === true && typeof body?.next_page === 'string';
    if (!more) break;

    if (fresh === 0) {
      /* La page suivante n'a rien apporté: le curseur n'est pas relu par ce
         paramètre. On s'arrête AVEC ce qu'on a, et on le dit, plutôt que de
         servir cent fois la même page. */
      logger.warn(
        `[Cartesia] pagination sans progrès après ${voices.length} voix: ` +
          'le paramètre `starting_after` ne relit pas `next_page`. Catalogue tronqué.',
      );
      break;
    }
    cursor = (body as { next_page: string }).next_page;
  }

  return voices;
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
    catalog = { at: Date.now(), voices: await fetchWholeCatalog() };
  }

  const wanted = CARTESIA_LANG[lang];
  return catalog.voices.filter(v => !v.language || v.language === wanted);
}
