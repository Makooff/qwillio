import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { prisma } from '../../config/database';
import { applyCartesiaVoices, listCharacters } from '../../config/voice-characters';
import { listCartesiaVoices, CartesiaCatalogVoice } from './cartesia.service';

/**
 * ── POURQUOI LES VOIX DU SITE SONNAIENT TOUTES PAREIL ────────────────────────
 *
 * La voix d'un personnage part d'un identifiant ElevenLabs, puis `buildVoice`
 * le traduit vers Cartesia par la table `CARTESIA_VOICES`. Quand un personnage
 * n'y figure pas, `cartesiaVoiceFor` rend `CARTESIA_DEFAULT_VOICE_ID` — UNE
 * seule voix, la même pour tout le monde.
 *
 * Le résultat, constaté en écoutant le site : dix personnages, cinq femmes et
 * cinq hommes, tous servis par le même timbre, et comme ce timbre par défaut est
 * masculin, tout le monde sonnait homme. Ce n'était pas les voix qui étaient
 * fausses une par une : c'était l'absence de correspondance qui les faisait
 * toutes converger vers un seul point.
 *
 * ── CE QUE CE SERVICE FAIT ─────────────────────────────────────────────────
 *
 * Il lit le catalogue Cartesia — qui publie le GENRE et la LANGUE de chaque
 * voix — et associe à chaque personnage une voix française distincte du bon
 * genre. Même principe que le service équivalent côté ElevenLabs, et même
 * raison : un identifiant de voix est une chaîne opaque, rien dans le code ne
 * peut dire ce qui en sort, et la seule source qui sait est l'API.
 *
 * ── LA PARTIE PURE EST SÉPARÉE, ET CE N'EST PAS UN DÉTAIL ─────────────────
 *
 * `pairVoices` ne touche ni au réseau ni à la base. C'est la partie qui a
 * échoué la dernière fois — des personnages qui partagent une voix — et elle
 * doit pouvoir être vérifiée sans dépendre d'un appel distant qui répond
 * parfois autre chose.
 */

export class CartesiaVoicesError extends Error {}

/** Une voix telle qu'elle nous intéresse : un identifiant, un genre, un nom. */
export interface AssignableVoice {
  voiceId: string;
  name: string;
  gender: 'male' | 'female';
}

/**
 * Associe des voix à des personnages, une chacune, en respectant le genre.
 *
 * Pure : aucune E/S, donc vérifiable directement.
 *
 * Trois règles, et la deuxième compte plus qu'elle n'en a l'air :
 *
 *   1. **Une voix par personnage.** Deux personnages ne doivent jamais partager
 *      un timbre — c'est exactement ce qu'on répare, et un doublon se réintroduit
 *      sans bruit dès qu'un nouveau personnage arrive.
 *
 *   2. **Jamais de mauvaise voix par défaut.** S'il n'y a plus de voix du bon
 *      genre, le personnage est LAISSÉ SANS ASSIGNATION plutôt que de recevoir
 *      une voix de l'autre genre. Un personnage « Lucas » qui parle avec une
 *      voix de femme est pire qu'un personnage qui garde son ancienne voix : le
 *      premier est un défaut visible livré au client, le second est un défaut
 *      connu en attente d'une voix.
 *
 *   3. **Aucune voix réutilisée**, même quand les genres sont mal répartis.
 */
export function pairVoices(
  characters: Array<{ id: string; gender: 'f' | 'm' }>,
  pool: { female: AssignableVoice[]; male: AssignableVoice[] },
): Record<string, AssignableVoice> {
  const queues = { f: [...pool.female], m: [...pool.male] };
  const pairing: Record<string, AssignableVoice> = {};

  for (const character of characters) {
    const next = queues[character.gender].shift();
    if (next) pairing[character.id] = next;
  }
  return pairing;
}

/**
 * Les voix Cartesia qui parlent français, séparées par genre.
 *
 * `listCartesiaVoices` filtre déjà sur la langue, et `toCartesiaVoice` lit le
 * genre en tolérant `gender` comme `labels.gender` — Cartesia a changé de forme
 * entre deux versions de son API, et les deux se rencontrent encore.
 */
async function frenchPool(): Promise<{ female: AssignableVoice[]; male: AssignableVoice[] }> {
  const voices: CartesiaCatalogVoice[] = await listCartesiaVoices('fr');

  const female: AssignableVoice[] = [];
  const male: AssignableVoice[] = [];

  for (const v of voices) {
    if (!v.voiceId || !v.gender) continue; // Un genre inconnu n'est jamais deviné.
    const entry: AssignableVoice = { voiceId: v.voiceId, name: v.name || v.voiceId, gender: v.gender };
    if (v.gender === 'female') female.push(entry);
    else male.push(entry);
  }
  return { female, male };
}

class CartesiaVoicesService {
  /** Ce que le catalogue offre, sans rien changer. */
  async preview(): Promise<{ female: AssignableVoice[]; male: AssignableVoice[] }> {
    if (!env.CARTESIA_API_KEY) throw new CartesiaVoicesError('cartesia_key_missing');
    return frenchPool();
  }

  /**
   * Assigne, range en base, et applique tout de suite.
   *
   * Rangé en base parce que l'alternative est un redéploiement pour changer une
   * voix ; appliqué en mémoire parce qu'un client qui appuie sur ▶ dix secondes
   * plus tard doit entendre la nouvelle.
   */
  async assign(): Promise<Record<string, AssignableVoice>> {
    const pool = await this.preview();
    const characters = listCharacters().map(c => ({ id: c.id, gender: c.gender }));
    const pairing = pairVoices(characters, pool);

    const assigned: Record<string, string> = {};
    for (const [characterId, voice] of Object.entries(pairing)) {
      assigned[characterId] = voice.voiceId;
    }

    const sansVoix = characters.filter(c => !pairing[c.id]).map(c => c.id);

    if (Object.keys(assigned).length) {
      await this.persist(assigned);
      /* Identifiant ET provenance, posés ensemble. `applyCartesiaVoices`
         écrit dans la table Cartesia — pas dans celle d'ElevenLabs — et pose
         `voiceProvider` sur chaque fiche. C'est ce qui manquait : sans cette
         étiquette, `buildVoice` croyait lire un identifiant ElevenLabs. */
      applyCartesiaVoices(assigned);
      logger.info(`[CartesiaVoices] assigned ${Object.keys(assigned).length} voices`);
    }
    if (sansVoix.length) {
      /* On le DIT. Un personnage sans voix garde la précédente, donc l'écran ne
         montrera rien d'anormal — et c'est précisément pour ça qu'il faut le
         nommer dans le journal plutôt que de laisser croire à un succès
         complet. C'est presque toujours que le catalogue français manque de
         voix d'un genre. */
      logger.warn(`[CartesiaVoices] no French voice of the right gender for: ${sansVoix.join(', ')}`);
    }

    return pairing;
  }

  private async persist(assigned: Record<string, string>): Promise<void> {
    const existing = await prisma.adminConfig.findFirst();
    /* On FUSIONNE avec ce qui est déjà rangé au lieu de l'écraser : la table
       porte aussi les voix ElevenLabs assignées par l'autre service, et
       remplacer l'objet entier effacerait leur travail. Les clés sont les
       identifiants de personnage, donc les deux se recouvrent là où elles se
       recouvrent — et la plus récente gagne, ce qui est voulu. */
    const precedentes = ((existing as any)?.characterVoices ?? {}) as Record<string, unknown>;
    /* Typé en `Record<string, string>` et non `unknown` : Prisma n'accepte que
       des valeurs JSON, et `unknown` n'en est pas une. Les entrées non
       textuelles sont écartées plutôt que converties — une table de voix ne
       contient que des identifiants, et forcer une valeur d'un autre type
       cacherait une forme inattendue au lieu de la signaler. */
    const fusion: Record<string, string> = {};
    for (const [cle, valeur] of Object.entries(precedentes)) {
      if (typeof valeur === 'string') fusion[cle] = valeur;
    }
    for (const [cle, valeur] of Object.entries(assigned)) fusion[cle] = valeur;

    if (existing) {
      await prisma.adminConfig.update({ where: { id: existing.id }, data: { characterVoices: fusion } });
    } else {
      await prisma.adminConfig.create({ data: { characterVoices: fusion } });
    }
  }
}

export const cartesiaVoicesService = new CartesiaVoicesService();
