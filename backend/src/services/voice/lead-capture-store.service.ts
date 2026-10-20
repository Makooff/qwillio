import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import type { Prisma } from '@prisma/client';

/** Un contenu prêt à être écrit dans la colonne `Json` de Prisma. */
const enJson = (c: LeadCaptureContent): Prisma.InputJsonObject => c as unknown as Prisma.InputJsonObject;

/**
 * Le magasin durable des captures de lead — `agent_crm_activity` de type
 * `lead_capture`, statut `pending`.
 *
 * Deux producteurs écrivent la MÊME fiche logique :
 *
 *  - `captureLead` de `tool-runtime` (Vapi), plusieurs fois par appel quand
 *    l'appelant corrige son numéro ou son nom — chaque correction était une
 *    ligne de plus, et le CRM voyait trois leads pour un seul appelant.
 *  - `POST /api/voice-core/leads` (le worker `voice-core`), réémis à chaque
 *    relecture corrigée — même doublon, même cause.
 *
 * La règle qui tient les deux : UNE capture logique par (tenant, room) tant
 * qu'elle est `pending`. Les faits les plus récents gagnent ; l'ancien contenu
 * part en `revisions` (borné), parce que la correction qui rétracte un numéro
 * faux a de la valeur elle aussi — la première version est parfois celle que
 * l'appelant a confirmée à voix haute.
 *
 * `null` room (appel sans salle identifiable) ne se regroupe JAMAIS : sans
 * room il n'y a pas d'identité d'appel, et fusionner des captures sans room
 * fusionnerait des appelants différents.
 *
 * La sérialisation par tenant+room repose sur `pg_advisory_xact_lock` DANS la
 * transaction : c'est la base qui sérialise, pas ce processus — deux workers
 * ou deux requêtes simultanées sur la même room se mettent en file au lieu de
 * créer chacune leur ligne.
 */

export interface LeadContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  address?: string | null;
}

export interface LeadCaptureContent {
  source: string;
  vapiCallId: string | null;
  capturedAt: string;
  clientCallId?: string | null;
  contact: LeadContact;
  reason: string;
  urgency: string;
  forPerson?: string | null;
  callbackWhen?: string | null;
  language?: string | null;
  businessName?: string | null;
  /** Les contenus précédents, du plus récent au plus ancien (borné). */
  revisions?: unknown[];
  [cle: string]: unknown;
}

const MAX_REVISIONS = 5;

function asContent(brut: unknown): LeadCaptureContent {
  return (typeof brut === 'object' && brut !== null ? brut : {}) as LeadCaptureContent;
}

/**
 * Le dernier état gagne, l'ancien n'est pas perdu.
 *
 * Chaque correction remplace les faits (contact, raison, urgence…) par ce que
 * l'appelant vient de dire, et pousse le contenu complet qu'elle remplace en
 * tête de `revisions`, borné à `MAX_REVISIONS`. Les clés que le nouveau
 * contenu ne porte pas (p. ex. `clientCallId` posé par le post-appel) sont
 * conservées — fusion, pas écrasement.
 */
export function mergeCaptureContent(
  precedent: unknown,
  dernier: LeadCaptureContent,
): LeadCaptureContent {
  const avant = asContent(precedent);
  const revisions = [
    { ...avant, revisions: undefined },
    ...(Array.isArray(avant.revisions) ? avant.revisions : []),
  ].filter((r) => r !== null && typeof r === 'object' && !Array.isArray(r) && Object.keys(r).length > 0).slice(0, MAX_REVISIONS);
  return { ...avant, ...dernier, revisions };
}

/**
 * Crée la capture, ou met à jour celle que la session connaît déjà.
 *
 * `activityId` vient de `session.leadActivityId` : c'est l'écriture précédente
 * de CE outil dans CETTE session, donc la correction d'un même appel — la mise
 * à jour est exacte et ne touche à rien d'autre. En l'absence d'`activityId`
 * (session perdue, redémarrage du worker), on crée : le dédoublonnage par room
 * est le travail de `persistRoomCapture`, qui a la room quand la session ne
 * l'a plus.
 */
export async function persistCapture(args: {
  clientId: string;
  activityId?: string | null;
  content: LeadCaptureContent;
}): Promise<{ id: string; updated: boolean }> {
  if (args.content.vapiCallId) {
    return persistRoomCapture({ clientId: args.clientId, room: args.content.vapiCallId, buildContent: () => args.content });
  }
  if (args.activityId) {
    const existante = await prisma.agentCrmActivity.findUnique({
      where: { id: args.activityId, clientId: args.clientId, type: 'lead_capture' },
      select: { id: true, content: true, status: true },
    });
    /* Seule une capture encore `pending` se laisse corriger: une traitée
       (convertie, perdue) est une décision, pas une ébauche. */
    if (existante && existante.status === 'pending') {
      await prisma.agentCrmActivity.update({
        where: { id: existante.id, clientId: args.clientId, type: 'lead_capture', status: 'pending' },
        data: { content: enJson(mergeCaptureContent(existante.content, args.content)) },
      });
      return { id: existante.id, updated: true };
    }
  }
  const cree = await prisma.agentCrmActivity.create({
    data: {
      clientId: args.clientId,
      type: 'lead_capture',
      status: 'pending',
      content: enJson(args.content),
    },
    select: { id: true },
  });
  return { id: cree.id, updated: false };
}

/**
 * Une capture `pending` pour (tenant, room), la plus récente en premier.
 * `null` quand la room n'a rien laissé — c'est la réponse normale d'un appel
 * sans lead, pas une anomalie.
 */
export async function getPendingCaptureForRoom(
  clientId: string,
  room: string,
): Promise<{ id: string; content: LeadCaptureContent } | null> {
  const trouvee = await prisma.agentCrmActivity.findFirst({
    where: {
      clientId,
      type: 'lead_capture',
      status: 'pending',
      content: { path: ['vapiCallId'], equals: room },
    },
    select: { id: true, content: true },
    orderBy: { createdAt: 'desc' },
  });
  return trouvee ? { id: trouvee.id, content: asContent(trouvee.content) } : null;
}

/**
 * Écrit la capture d'une room, en la SÉRIALISANT par (tenant, room).
 *
 * Deux remontées simultanées de la même room (relecture corrigée croisée avec
 * la fin d'appel, deux workers après un redéploiement) prennent le verrou
 * d'advisory de la base l'un après l'autre : le second voit la ligne du
 * premier et la corrige au lieu d'empiler un doublon.
 *
 * `buildContent` reçoit le contenu existant (ou `null`) : il peut préserver un
 * fait déjà posé — en pratique `mergeCaptureContent` s'en charge après lui.
 */
export async function persistRoomCapture(args: {
  clientId: string;
  room: string;
  buildContent: (existant: LeadCaptureContent | null) => LeadCaptureContent;
}): Promise<{ id: string; updated: boolean }> {
  const verrou = `lead-capture:${args.clientId}:${args.room}`;
  return prisma.$transaction(async (tx) => {
      /* Verrou d'advisory par transaction: relâché au commit, pas au
         `unlock`. `hashtended` existe sur toutes les versions Postgres que
         la plateforme vise (11+). */
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${verrou}, 0))::text`;
      const existante = await tx.agentCrmActivity.findFirst({
        where: {
          clientId: args.clientId,
          type: 'lead_capture',
          status: 'pending',
          content: { path: ['vapiCallId'], equals: args.room },
        },
        select: { id: true, content: true },
        orderBy: { createdAt: 'desc' },
      });
      if (existante) {
        const brut = asContent(existante.content);
        await tx.agentCrmActivity.update({
          where: { id: existante.id, clientId: args.clientId, type: 'lead_capture', status: 'pending' },
          data: { content: enJson(mergeCaptureContent(brut, args.buildContent(brut))) },
        });
        return { id: existante.id, updated: true };
      }
      const cree = await tx.agentCrmActivity.create({
        data: {
          clientId: args.clientId,
          type: 'lead_capture',
          status: 'pending',
          content: args.buildContent(null) as object,
        },
        select: { id: true },
      });
      return { id: cree.id, updated: false };
    });
}

/**
 * Relie la capture durable à la fiche d'appel que le post-appel vient
 * d'écrire: la fiche porte le transcript, la capture le numéro de rappel —
 * le suivi veut les deux au même endroit. Fusion dans `content`, jamais
 * remplacement: ce contenu est la charge utile que la synchro CRM draine.
 */
export async function linkCaptureToCall(args: {
  clientId: string;
  activityId: string;
  clientCallId: string;
}): Promise<void> {
  const existante = await prisma.agentCrmActivity.findUnique({
    where: { id: args.activityId, clientId: args.clientId, type: 'lead_capture' },
    select: { content: true },
  });
  if (!existante) return;
  const brut = asContent(existante.content);
  if (brut.clientCallId === args.clientCallId) return; // déjà liée: idempotent
  await prisma.agentCrmActivity.update({
    where: { id: args.activityId, clientId: args.clientId, type: 'lead_capture' },
    data: { content: enJson({ ...brut, clientCallId: args.clientCallId }) },
  });
}
