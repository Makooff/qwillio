/**
 * CE QUE COÛTE UN ALLER-RETOUR VERS NOTRE PROPRE BASE, mesuré depuis le
 * processus qui sert l'appel.
 *
 * Pourquoi ça existe. Le backend est déclaré en `oregon` (`render.yaml`) et
 * l'URL de production de la base nomme `us-east-1` (`docs/VOICE-DEPLOY-RUNBOOK.md`).
 * Deux fichiers, deux côtes: chaque requête Prisma du chemin d'appel traverse
 * donc un continent, et les outils sont justement le plus gros poste de latence
 * qui reste (6unsexagesies: « ce qui reste de lenteur, ce sont les OUTILS, et
 * d'abord la base »).
 *
 * Mais deux fichiers ne sont pas une mesure, et un nom de domaine encore moins:
 * l'URL de production vit dans l'environnement de Render, pas dans le dépôt, et
 * un audit lancé depuis un poste lirait le `.env` de CE poste (6duotrigesies,
 * 6quinquesexagesies, deux fois payé). La seule lecture qui vaille est prise par
 * le processus qui a servi l'appel, et elle voyage avec les métriques comme tout
 * le reste.
 *
 * DEUX NOMBRES, PAS UNE MOYENNE. Le PLANCHER (la plus rapide des sondes) est le
 * réseau seul: c'est lui qui répond à « la base est-elle loin ». Le PIRE est ce
 * qu'un réveil de pool ou de calcul Neon ajoute par-dessus, et c'est une autre
 * question, avec une autre réparation. Une moyenne les mélangerait et ne
 * répondrait ni à l'une ni à l'autre.
 *
 * `basePrisma` et jamais `prisma`: le second porte l'enveloppe de reprise
 * (`$allOperations`, jusqu'à 4 s de replis, 6tersexagesies). Une sonde qui
 * retenterait en silence mesurerait la reprise, pas la distance, et rendrait un
 * chiffre qui a l'air d'une lecture. Les deux partagent le même pool, donc la
 * sonde voit bien les connexions que l'appel utilise.
 */

import { basePrisma } from '../../config/database';

/**
 * LA RÉGION DE LA BASE, lue sur l'hôte et jamais sur les identifiants.
 *
 * Sans elle, « 310 ms » ne se compare à rien: c'est en sachant que l'hôte dit
 * `us-east-1` et que le backend est déclaré `oregon` qu'on peut dire si la
 * mesure vaut la distance (~70 ms) ou un multiple de celle-ci.
 *
 * Elle se lit DANS LE PROCESSUS qui sert l'appel, comme la mesure elle-même:
 * `DATABASE_URL` lu depuis un poste est le `.env` de ce poste, faute déjà
 * payée deux fois (6duotrigesies, 6quinquesexagesies).
 *
 * Seul le jeton de région sort d'ici. Ni l'hôte complet, ni le nom de la base,
 * ni évidemment le mot de passe: un relevé voyage jusque dans un journal et
 * dans une conversation, donc il ne transporte que ce qu'il doit prouver.
 */
export function dbRegion(url = process.env.DATABASE_URL || ''): string | null {
  const host = url.split('@')[1]?.split('/')[0] ?? '';
  /* La forme AWS/Neon: `…-pooler.c-5.us-east-1.aws.neon.tech`. Un hôte qui n'y
     répond pas rend `null` plutôt qu'une supposition: un audit qui devine une
     région conclut sur une distance qu'il n'a pas lue (6quinvicies). */
  return host.match(/\b([a-z]{2}-[a-z]+-\d)\b/)?.[1] ?? null;
}

export interface DbRoundTrip {
  /** La plus rapide des sondes: le réseau seul, sans réveil ni file. */
  floorMs: number;
  /** La plus lente: ce qu'un réveil de pool ou de calcul ajoute par-dessus. */
  worstMs: number;
  samples: number;
}

/**
 * Sonde l'aller-retour, en SÉQUENCE.
 *
 * En parallèle, les sondes partagent le même aller-retour et mesureraient la
 * largeur du pool au lieu de la distance: trois requêtes lancées ensemble
 * reviennent ensemble, et le plancher serait le même quelle que soit la
 * latence. L'une après l'autre, chacune paie son propre trajet.
 */
export async function measureDbRoundTrip(
  samples = 3,
  now: () => number = Date.now,
  ping: () => Promise<unknown> = () => basePrisma.$queryRaw`SELECT 1`,
): Promise<DbRoundTrip | null> {
  const taken: number[] = [];
  for (let i = 0; i < samples; i++) {
    const at = now();
    try {
      await ping();
    } catch {
      /* Une sonde qui échoue ne rend pas un zéro: un zéro se lirait « la base
         est à côté », c'est-à-dire l'inverse de ce qui se passe. On la laisse
         simplement tomber, et l'absence totale se dit `null`. */
      continue;
    }
    taken.push(now() - at);
  }
  if (!taken.length) return null;
  return {
    floorMs: Math.round(Math.min(...taken)),
    worstMs: Math.round(Math.max(...taken)),
    samples: taken.length,
  };
}
