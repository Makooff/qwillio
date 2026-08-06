import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { apiKeyAuth, requirePermission, type ApiKeyRequest } from '../middleware/api-key.middleware';

/**
 * API publique Qwillio, version 1.
 *
 * En LECTURE seulement, et c'est délibéré: ce que le forfait Enterprise
 * annonce, c'est de pouvoir sortir ses données (appels, leads, rendez-vous)
 * vers un entrepôt ou un CRM maison. Écrire dans un agenda ou déclencher un
 * appel depuis l'extérieur ouvre une surface bien plus large, qui mérite son
 * propre travail plutôt qu'un ajout discret ici.
 *
 * Toutes les réponses sont paginées et bornées: sans plafond, un `limit=100000`
 * suffirait à faire tomber la base pour tout le monde.
 */

const router = Router();

/* Budget par clé, pas par IP: deux clients derrière le même NAT ne se volent
   pas leur quota, et une clé qui s'emballe ne pénalise qu'elle-même. */
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  keyGenerator: (req: any) => req.header('x-api-key') || req.ip,
  message: { error: 'rate_limited', message: 'Too many requests, retry in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(apiLimiter);
router.use(apiKeyAuth);

const MAX_LIMIT = 200;

function page(req: ApiKeyRequest) {
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  return { limit, offset };
}

/** Fenêtre temporelle optionnelle, ignorée si la date est illisible. */
function since(req: ApiKeyRequest): Date | undefined {
  const raw = req.query.since;
  if (typeof raw !== 'string') return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// ── Le compte qui porte la clé ────────────────────────────────────────────
router.get('/me', requirePermission('read'), async (req: ApiKeyRequest, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.apiClientId! },
    select: {
      id: true, businessName: true, businessType: true, planType: true,
      subscriptionStatus: true, vapiPhoneNumber: true, agentLanguage: true,
      monthlyMinutesQuota: true, createdAt: true,
    },
  });
  res.json({ data: client });
});

// ── Appels ────────────────────────────────────────────────────────────────
router.get('/calls', requirePermission('read'), async (req: ApiKeyRequest, res) => {
  try {
    const { limit, offset } = page(req);
    const from = since(req);
    /* Le spam est exclu par défaut: il n'est pas facturé, il n'a pas à polluer
       un entrepôt de données. `?includeSpam=true` le rend visible pour qui
       veut auditer le bouclier. */
    const where = {
      clientId: req.apiClientId!,
      ...(req.query.includeSpam === 'true' ? {} : { isSpam: false }),
      ...(from ? { startedAt: { gte: from } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.clientCall.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true, callerNumber: true, callerName: true, direction: true,
          startedAt: true, endedAt: true, durationSeconds: true, status: true,
          summary: true, sentiment: true, outcome: true, transcript: true,
          recordingUrl: true, isLead: true, leadScore: true, isSpam: true, tags: true,
        },
      }),
      prisma.clientCall.count({ where }),
    ]);

    res.json({ data: rows, pagination: { total, limit, offset } });
  } catch (error) {
    logger.error('[API] /calls a échoué:', error);
    res.status(500).json({ error: 'query_failed' });
  }
});

// ── Leads ─────────────────────────────────────────────────────────────────
router.get('/leads', requirePermission('read'), async (req: ApiKeyRequest, res) => {
  try {
    const { limit, offset } = page(req);
    const from = since(req);
    const where = {
      clientId: req.apiClientId!,
      isLead: true,
      isSpam: false,
      ...(from ? { startedAt: { gte: from } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.clientCall.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true, callerName: true, callerNumber: true, emailCollected: true,
          startedAt: true, leadScore: true, summary: true, outcome: true, tags: true,
        },
      }),
      prisma.clientCall.count({ where }),
    ]);

    res.json({ data: rows, pagination: { total, limit, offset } });
  } catch (error) {
    logger.error('[API] /leads a échoué:', error);
    res.status(500).json({ error: 'query_failed' });
  }
});

// ── Rendez-vous ───────────────────────────────────────────────────────────
router.get('/bookings', requirePermission('read'), async (req: ApiKeyRequest, res) => {
  try {
    const { limit, offset } = page(req);
    const from = since(req);
    const where = {
      clientId: req.apiClientId!,
      ...(from ? { bookingDate: { gte: from } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.clientBooking.findMany({
        where,
        orderBy: { bookingDate: 'asc' },
        take: limit,
        skip: offset,
        select: {
          id: true, customerName: true, customerPhone: true, customerEmail: true,
          bookingDate: true, bookingTime: true, serviceType: true, partySize: true,
          status: true, specialRequests: true, createdAt: true,
        },
      }),
      prisma.clientBooking.count({ where }),
    ]);

    res.json({ data: rows, pagination: { total, limit, offset } });
  } catch (error) {
    logger.error('[API] /bookings a échoué:', error);
    res.status(500).json({ error: 'query_failed' });
  }
});

export default router;
