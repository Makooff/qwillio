import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

/**
 * LA BOÎTE D'ACHÈVEMENT DURABLE — `voice-core` n'attend jamais le traitement.
 *
 * Le worker coupe sa remontée à 10 s et l'émet depuis son `shutdown_callback`
 * : répondre 202 AVANT d'avoir persisté, c'est répondre 202 pour une fiche qui
 * disparaît si le processus meurt dans l'intervalle. L'ordre est donc
 * inversé par rapport à l'ancienne route : la charge utile est écrite DANS
 * LA BASE D'ABORD, et seulement ensuite le 202 part. Le traitement (analyse
 * GPT-4, fiche CRM, agenda) se fait après coup, hors transaction, et la
 * reprise après panne repart de la même ligne. Cela ne garantit pas
 * exactement une exécution des effets externes après un crash.
 *
 * L'identité de dédupplication est (tenant, room) : une room LiveKit, un
 * appel. Le verrou de sérialisation est `pg_advisory_xact_lock` dans la
 * transaction : c'est la base qui sérialise deux remontées simultanées du
 * même appel, pas ce processus — exactement la règle que suit déjà
 * `lead-capture-store`.
 *
 * La ligne ne porte QUE la charge utile jusqu'à son traitement : à
 * l'achèvement (ou au dead-letter, ou à l'expiration 24 h), le payload —
 * transcript, numéros, le PII de l'appelant — est effacé et il ne reste
 * qu'une pierre tombale. Le type `lead_capture` est un producteur voisin de
 * la même table : il n'est JAMAIS drainé ni expiré par ce service.
 */

const TYPE = 'voice_completion';
/** Verrou d'exécution : un autre worker peut reprendre après 5 minutes. */
const LEASE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const BATCH = 20;
const POLL_MS = 30_000;
const PII_TTL_MS = 24 * 60 * 60_000;
const RETRY_BASE_MS = 30_000;

export interface VoiceCompletionPayload {
  room: string;
  clientId: string;
  caller?: string;
  trunkNumber?: string;
  brain?: string;
  startedAt?: string;
  durationSeconds?: number;
  latency?: Record<string, number>;
  transcript?: string;
  twilioCallSid?: string;
}

type JobContent = { payload?: VoiceCompletionPayload; attempts?: number } & Record<string, unknown>;

function invalid(): never {
  throw new Error('Invalid voice completion payload');
}

/** La dernière frontière avant la base : rien de mal formé ne s'y écrit. */
export function validateVoiceCompletionPayload(raw: unknown): VoiceCompletionPayload {
  if (typeof raw !== 'object' || raw === null) invalid();
  const p = raw as Record<string, unknown>;
  if (typeof p.room !== 'string' || !p.room || p.room.length > 255) invalid();
  if (typeof p.clientId !== 'string' || !p.clientId) invalid();
  for (const key of ['caller', 'trunkNumber', 'brain', 'twilioCallSid'] as const) {
    if (p[key] !== undefined && typeof p[key] !== 'string') invalid();
  }
  if (p.transcript !== undefined
    && (typeof p.transcript !== 'string' || p.transcript.length > 200_000)) invalid();
  if (p.durationSeconds !== undefined) {
    const d = p.durationSeconds;
    if (typeof d !== 'number' || !Number.isFinite(d) || d < 0) invalid();
  }
  if (p.startedAt !== undefined
    && (typeof p.startedAt !== 'string' || Number.isNaN(new Date(p.startedAt).getTime()))) invalid();
  if (p.latency !== undefined) {
    if (typeof p.latency !== 'object' || p.latency === null) invalid();
    for (const value of Object.values(p.latency)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) invalid();
    }
  }
  return p as unknown as VoiceCompletionPayload;
}

function sansPayload(content: JobContent): JobContent {
  const rest: JobContent = { ...content };
  delete rest.payload;
  return rest;
}

export class VoiceCompletionInbox {
  /**
   * Persiste la remontée AVANT tout accusé. Deux remontées simultanées de la
   * même room se sérialisent sur le verrou Postgres : la première écrit, la
   * seconde lit la ligne existante et reçoit `already: true` — jamais deux
   * lignes, jamais deux traitements.
   */
  async enqueue(raw: unknown): Promise<{ id: string; already: boolean }> {
    const payload = validateVoiceCompletionPayload(raw);
    const key = `${payload.clientId}:${payload.room}`;

    return prisma.$transaction(async (tx) => {
      /* `pg_advisory_xact_lock` rend void : le sélectionner directement ferait
         échouer la désérialisation Prisma. On l'enferme dans un CTE et on ne
         lit que le 1. La clé voyage en PARAMÈTRE — jamais interpolée dans le
         SQL, où elle finirait dans les journaux de requêtes. */
      await tx.$queryRaw`WITH l AS (SELECT pg_advisory_xact_lock(hashtext(${key}::text)::bigint)) SELECT 1 FROM l`;

      const existante = await tx.agentCrmActivity.findFirst({
        where: { clientId: payload.clientId, type: TYPE, dealId: payload.room },
        select: { id: true },
      });
      if (existante) return { id: existante.id, already: true };

      const cree = await tx.agentCrmActivity.create({
        data: {
          clientId: payload.clientId,
          type: TYPE,
          dealId: payload.room,
          status: 'pending',
          content: { payload } as unknown as object,
        },
        select: { id: true },
      });
      return { id: cree.id, already: false };
    });
  }

  /**
   * Réserve UNE ligne et exécute le handler hors transaction.
   *
   * La réservation écrit un jeton de propriétaire (`provider`) : si le
   * bail expire et qu'un autre worker reprend, l'ancien propriétaire ne
   * peut PLUS rien écrire — ni succès ni échec ne chevauchent le nouveau.
   * Le handler reçoit le payload exact de la remontée ; à son retour, la
   * pierre tombale remplace la charge utile (PII effacée). En cas d'échec,
   * le payload SURVIT pour la reprise, avec un recul borné.
   */
  async runOne(id: string, handler: (payload: VoiceCompletionPayload) => Promise<void>): Promise<void> {
    const now = new Date();
    const proprietaire = `vc-${randomUUID()}`;

    const reservation = await prisma.agentCrmActivity.updateMany({
      where: {
        id,
        type: TYPE,
        /* `pending` n'a jamais de bail (null) et est dû immédiatement ;
           `retry` revient quand son recul est écoulé ; `processing` ne se
           reprend que si le bail de 5 minutes a expiré (crash). */
        OR: [
          { status: 'pending', performedAt: null },
          { status: 'retry', performedAt: { lte: now } },
          { status: 'processing', performedAt: { lte: new Date(now.getTime() - LEASE_MS) } },
        ],
      },
      data: { status: 'processing', performedAt: now, provider: proprietaire },
    });
    if (reservation.count === 0) return;

    const ownership = { id, type: TYPE, provider: proprietaire, status: 'processing' };
    const ligne = await prisma.agentCrmActivity.findFirst({
      where: ownership,
      select: { content: true, clientId: true, dealId: true, createdAt: true },
    });
    if (!ligne) return;
    const content = (ligne.content ?? {}) as JobContent;
    const previousAttempts = content.attempts ?? 0;
    const validCounter = Number.isSafeInteger(previousAttempts) && previousAttempts >= 0;
    const attempts = validCounter ? previousAttempts + 1 : MAX_ATTEMPTS + 1;
    const incremented = await prisma.agentCrmActivity.updateMany({
      where: ownership,
      data: { content: { ...content, attempts } as unknown as object },
    });
    if (incremented.count === 0) return;

    /* Une ligne empoisonnée (payload absent ou invalide) ne se retente pas :
       elle meurt ici, sans handler, sans bloquer les autres. */
    let payload: VoiceCompletionPayload;
    try {
      payload = validateVoiceCompletionPayload(content.payload);
      if (payload.clientId !== ligne.clientId || payload.room !== ligne.dealId
        || !validCounter || ligne.createdAt.getTime() <= now.getTime() - PII_TTL_MS) invalid();
    } catch {
      await prisma.agentCrmActivity.updateMany({
        where: { id, provider: proprietaire },
        data: { status: 'dead_letter', content: sansPayload({ ...content, attempts }) as unknown as object },
      });
      return;
    }

    if (attempts > MAX_ATTEMPTS) {
      /* Le cinquième essai a eu lieu et son processus a disparu (crash) :
         la reprise ne lance JAMAIS un sixième handler. */
      await prisma.agentCrmActivity.updateMany({
        where: { id, provider: proprietaire },
        data: { status: 'dead_letter', content: sansPayload({ ...content, attempts }) as unknown as object },
      });
      return;
    }

    try {
      /* Le handler tourne HORS transaction : le bail n'est pas un verrou de
         base, et une analyse de plusieurs secondes ne doit jamais tenir de
         connexion ouverte. */
      await handler(payload);
      await prisma.agentCrmActivity.updateMany({
        where: { id, provider: proprietaire, status: 'processing' },
        data: { status: 'completed', performedAt: null, content: sansPayload({ ...content, attempts }) as unknown as object },
      });
    } catch {
      /* Le message d'erreur du handler peut citer le transcript (« secret
         transcript ») : il ne sort JAMAIS de lui-même. Seul le compte
         d'essais et le recul sont persistés. */
      const mort = attempts + 1 > MAX_ATTEMPTS;
      await prisma.agentCrmActivity.updateMany({
        where: { id, provider: proprietaire, status: 'processing' },
        data: {
          status: mort ? 'dead_letter' : 'retry',
          performedAt: new Date(now.getTime() + RETRY_BASE_MS * attempts),
          content: (mort ? sansPayload({ ...content, attempts }) : { ...content, attempts }) as unknown as object,
        },
      });
      throw new Error('Voice completion handler failed');
    }
  }

  /**
   * Un passage borné : au plus 20 lignes, toutes les tenants confondues, en
   * parallèle — une ligne lente n'arrête pas les suivantes. Avant tout
   * traitement, les lignes de plus de 24 h sont expirées : PII effacée,
   * statut `dead_letter`, `lead_capture` épargné.
   */
  async drain(handler: (payload: VoiceCompletionPayload) => Promise<void>, now = new Date()): Promise<void> {
    const perimees = await prisma.agentCrmActivity.findMany({
      where: {
        type: TYPE, createdAt: { lte: new Date(now.getTime() - PII_TTL_MS) },
        content: { path: ['payload'], not: Prisma.AnyNull },
        OR: [
          { status: { in: ['pending', 'retry', 'dead_letter', 'completed'] } },
          { status: 'processing', performedAt: { lte: new Date(now.getTime() - LEASE_MS) } },
        ],
      },
      select: { id: true, content: true, status: true, provider: true, performedAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    for (const row of perimees) {
      await prisma.agentCrmActivity.updateMany({
        where: { id: row.id, type: TYPE, status: row.status, provider: row.provider,
          performedAt: row.performedAt, content: { equals: row.content as Prisma.InputJsonValue } },
        data: { status: row.status === 'completed' ? 'completed' : 'dead_letter',
          performedAt: null, content: sansPayload((row.content ?? {}) as JobContent) as unknown as object },
      });
    }

    const dues = await prisma.agentCrmActivity.findMany({
      where: {
        type: TYPE,
        OR: [
          { status: 'pending', performedAt: null },
          { status: 'retry', performedAt: { lte: now } },
          { status: 'processing', performedAt: { lte: new Date(now.getTime() - LEASE_MS) } },
        ],
      },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: BATCH,
    });
    await Promise.all(dues.map((row) =>
      this.runOne(row.id, handler).catch((error: unknown) => {
        logger.warn(`[voice-completion] traitement repris plus tard (${row.id}): ${(error as Error).message}`);
      }),
    ));
  }

  /**
   * Le battement de reprise : drain immédiat, puis toutes les 30 s.
   * Sous test, aucune minuterie n'est créée — un drain synchrone suffit.
   * L'intervalle est `unref`'d : il ne retient jamais le processus ouvert,
   * et deux drains ne se chevauchent jamais localement.
   */
  start(handler: (payload: VoiceCompletionPayload) => Promise<void>): () => void {
    let arret = false;
    let actif = false;
    const battement = () => {
      if (arret || actif) return;
      actif = true;
      void Promise.resolve().then(() => (arret ? undefined : this.drain(handler)))
        .catch(() => { logger.warn('[voice-completion] reprise indisponible, nouvel essai au prochain tick'); })
        .finally(() => { actif = false; });
    };
    battement();
    let minuterie: NodeJS.Timeout | undefined;
    if (process.env.NODE_ENV !== 'test') {
      minuterie = setInterval(battement, POLL_MS);
      minuterie.unref?.();
    }
    return () => {
      arret = true;
      if (minuterie) clearInterval(minuterie);
    };
  }
}

export const voiceCompletionInbox = new VoiceCompletionInbox();
