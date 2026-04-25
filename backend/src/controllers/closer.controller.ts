import { Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AuthRequest } from '../middleware/auth.middleware';
import { followUpSequencesService } from '../services/follow-up-sequences.service';

const ALLOWED_STATUSES = new Set([
  'new', 'contacted', 'interested', 'qualified', 'converted', 'lost',
]);

const ALLOWED_FOLLOWUP_TYPES = new Set(['sms', 'email', 'call']);

const prospectSelect = {
  id: true,
  businessName: true,
  contactName: true,
  phone: true,
  email: true,
  city: true,
  state: true,
  sector: true,
  niche: true,
  score: true,
  priorityScore: true,
  status: true,
  notes: true,
  interestLevel: true,
  painPoints: true,
  callAttempts: true,
  lastCallDate: true,
  lastContactDate: true,
  nextAction: true,
  nextActionDate: true,
  assignedToUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** GET /api/closer/stats — KPIs for the current closer */
export async function getStats(req: AuthRequest, res: Response) {
  try {
    const closerId = String(req.userId);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [mine, todayContacted, interested, qualified, converted, pendingFollowups] =
      await Promise.all([
        prisma.prospect.count({ where: { assignedToUserId: closerId } }),
        prisma.prospect.count({
          where: { assignedToUserId: closerId, lastContactDate: { gte: startOfDay } },
        }),
        prisma.prospect.count({
          where: { assignedToUserId: closerId, status: 'interested' },
        }),
        prisma.prospect.count({
          where: { assignedToUserId: closerId, status: 'qualified' },
        }),
        prisma.prospect.count({
          where: { assignedToUserId: closerId, status: 'converted' },
        }),
        prisma.followUpSequence.count({
          where: {
            sentAt: null,
            prospect: { assignedToUserId: closerId },
          },
        }),
      ]);

    res.json({
      claimed: mine,
      contactedToday: todayContacted,
      interested,
      qualified,
      converted,
      pendingFollowups,
    });
  } catch (err: any) {
    logger.error('[closer] getStats failed:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/closer/prospects — list prospects the closer can work.
 *
 * Query params:
 *   - scope=mine|pool|all (default: all)
 *   - status=new,contacted,...
 *   - search=text
 *   - limit (default 50, max 200)
 *   - offset
 */
export async function listProspects(req: AuthRequest, res: Response) {
  try {
    const closerId = String(req.userId);
    const scope = String(req.query.scope || 'all');
    const status = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim();
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const offset = parseInt(String(req.query.offset || '0'), 10) || 0;

    const where: any = {
      phone: { not: null },
    };

    if (scope === 'mine') {
      where.assignedToUserId = closerId;
    } else if (scope === 'pool') {
      where.assignedToUserId = null;
    } else {
      // all: unclaimed + mine
      where.OR = [
        { assignedToUserId: null },
        { assignedToUserId: closerId },
      ];
    }

    if (status) {
      const parts = status.split(',').map(s => s.trim()).filter(s => ALLOWED_STATUSES.has(s));
      if (parts.length) where.status = { in: parts };
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { businessName: { contains: search, mode: 'insensitive' } },
            { contactName:  { contains: search, mode: 'insensitive' } },
            { phone:        { contains: search } },
            { city:         { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.prospect.findMany({
        where,
        select: prospectSelect,
        orderBy: [
          { assignedToUserId: 'desc' },   // mine first
          { priorityScore: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.prospect.count({ where }),
    ]);

    res.json({ items, total, limit, offset });
  } catch (err: any) {
    logger.error('[closer] listProspects failed:', err);
    res.status(500).json({ error: err.message });
  }
}

/** GET /api/closer/prospects/:id — detail */
export async function getProspect(req: AuthRequest, res: Response) {
  try {
    const closerId = String(req.userId);
    const id = String(req.params.id);
    const prospect = await prisma.prospect.findUnique({
      where: { id },
      select: {
        ...prospectSelect,
        callDuration: true,
        callTranscript: true,
        callSentiment: true,
        needsIdentified: true,
        followUpSequences: {
          orderBy: { scheduledAt: 'desc' },
          take: 20,
          select: {
            id: true, type: true, step: true, scheduledAt: true,
            sentAt: true, opened: true, clicked: true, replied: true,
          },
        },
      },
    });

    if (!prospect) return res.status(404).json({ error: 'Prospect introuvable' });

    const isMine = prospect.assignedToUserId === closerId;
    const isPool = prospect.assignedToUserId === null;
    if (!isMine && !isPool) {
      return res.status(403).json({ error: 'Prospect attribué à un autre agent' });
    }
    res.json(prospect);
  } catch (err: any) {
    logger.error('[closer] getProspect failed:', err);
    res.status(500).json({ error: err.message });
  }
}

/** POST /api/closer/prospects/:id/claim — take ownership (bot stops calling) */
export async function claimProspect(req: AuthRequest, res: Response) {
  try {
    const closerId = String(req.userId);
    const id = String(req.params.id);
    const existing = await prisma.prospect.findUnique({
      where: { id },
      select: { assignedToUserId: true },
    });
    if (!existing) return res.status(404).json({ error: 'Prospect introuvable' });
    if (existing.assignedToUserId && existing.assignedToUserId !== closerId) {
      return res.status(409).json({ error: 'Déjà pris par un autre agent' });
    }

    const updated = await prisma.prospect.update({
      where: { id },
      data: { assignedToUserId: closerId, eligibleForCall: false },
      select: prospectSelect,
    });
    res.json(updated);
  } catch (err: any) {
    logger.error('[closer] claimProspect failed:', err);
    res.status(500).json({ error: err.message });
  }
}

/** POST /api/closer/prospects/:id/release — give back to the pool */
export async function releaseProspect(req: AuthRequest, res: Response) {
  try {
    const closerId = String(req.userId);
    const id = String(req.params.id);
    const existing = await prisma.prospect.findUnique({
      where: { id },
      select: { assignedToUserId: true },
    });
    if (!existing) return res.status(404).json({ error: 'Prospect introuvable' });
    if (existing.assignedToUserId !== closerId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Non attribué à vous' });
    }
    const updated = await prisma.prospect.update({
      where: { id },
      data: { assignedToUserId: null, eligibleForCall: true },
      select: prospectSelect,
    });
    res.json(updated);
  } catch (err: any) {
    logger.error('[closer] releaseProspect failed:', err);
    res.status(500).json({ error: err.message });
  }
}

/** PUT /api/closer/prospects/:id — update status / notes / interest */
export async function updateProspect(req: AuthRequest, res: Response) {
  try {
    const closerId = String(req.userId);
    const id = String(req.params.id);
    const existing = await prisma.prospect.findUnique({
      where: { id },
      select: { assignedToUserId: true },
    });
    if (!existing) return res.status(404).json({ error: 'Prospect introuvable' });
    if (existing.assignedToUserId !== closerId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Prospect non attribué à vous' });
    }

    const body = req.body || {};
    const data: any = {};

    if (typeof body.status === 'string' && ALLOWED_STATUSES.has(body.status)) {
      data.status = body.status;
      data.lastContactDate = new Date();
    }
    if (typeof body.notes === 'string') {
      data.notes = body.notes.slice(0, 4000);
    }
    if (typeof body.interestLevel === 'number') {
      data.interestLevel = Math.max(0, Math.min(10, body.interestLevel));
    }
    if (typeof body.nextAction === 'string') {
      data.nextAction = body.nextAction.slice(0, 500);
    }
    if (body.nextActionDate) {
      const d = new Date(body.nextActionDate);
      if (!isNaN(d.getTime())) data.nextActionDate = d;
    }
    // Contact details — closer can fix missing data on the fly so emails / SMS
    // can actually be sent.
    if (typeof body.email === 'string') {
      const e = body.email.trim();
      if (e === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        data.email = e || null;
        if (e) {
          // Touching the email re-enables future communications.
          data.emailUnsubscribed = false;
          data.emailBounced = false;
        }
      } else {
        return res.status(400).json({ error: 'Email invalide' });
      }
    }
    if (typeof body.phone === 'string') {
      const p = body.phone.trim();
      data.phone = p || null;
    }
    if (typeof body.contactName === 'string') {
      data.contactName = body.contactName.trim().slice(0, 200) || null;
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: 'Aucun champ valide' });
    }

    const updated = await prisma.prospect.update({
      where: { id },
      data,
      select: prospectSelect,
    });
    res.json(updated);
  } catch (err: any) {
    logger.error('[closer] updateProspect failed:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/closer/prospects/:id/followup
 * Body: { type: 'sms' | 'email' | 'call', delayHours?: number, scheduledAt?: ISO }
 * Creates a FollowUpSequence row. Processed by the existing cron.
 */
export async function scheduleFollowUp(req: AuthRequest, res: Response) {
  try {
    const closerId = String(req.userId);
    const prospectId = String(req.params.id);

    const existing = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { assignedToUserId: true },
    });
    if (!existing) return res.status(404).json({ error: 'Prospect introuvable' });
    if (existing.assignedToUserId !== closerId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Prospect non attribué à vous' });
    }

    const type = String(req.body?.type || '').toLowerCase();
    if (!ALLOWED_FOLLOWUP_TYPES.has(type)) {
      return res.status(400).json({ error: 'Type invalide (sms|email|call)' });
    }

    let scheduledAt: Date;
    if (req.body?.scheduledAt) {
      const d = new Date(req.body.scheduledAt);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'scheduledAt invalide' });
      scheduledAt = d;
    } else {
      const hours = Math.max(0, Number(req.body?.delayHours ?? 24));
      scheduledAt = new Date(Date.now() + hours * 3600_000);
    }

    const lastStep = await prisma.followUpSequence.findFirst({
      where: { prospectId },
      orderBy: { step: 'desc' },
      select: { step: true },
    });

    const created = await prisma.followUpSequence.create({
      data: {
        prospectId,
        type,
        step: (lastStep?.step ?? 0) + 1,
        scheduledAt,
      },
    });
    res.status(201).json(created);
  } catch (err: any) {
    logger.error('[closer] scheduleFollowUp failed:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/closer/prospects/:id/send-now
 * Body: { type: 'sms' | 'email' }
 * Sends the standard follow-up SMS/email RIGHT NOW (creates a
 * FollowUpSequence row scheduled to "now" and immediately processes
 * the queue so the cron tick latency is bypassed).
 */
export async function sendFollowUpNow(req: AuthRequest, res: Response) {
  try {
    const closerId = String(req.userId);
    const prospectId = String(req.params.id);
    const type = String(req.body?.type || '').toLowerCase();
    if (type !== 'sms' && type !== 'email') {
      return res.status(400).json({ error: 'Type invalide (sms|email)' });
    }

    const existing = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: {
        assignedToUserId: true,
        phone: true,
        email: true,
        smsOptedOut: true,
        emailUnsubscribed: true,
      },
    });
    if (!existing) return res.status(404).json({ error: 'Prospect introuvable' });
    if (existing.assignedToUserId !== closerId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Prospect non attribué à vous' });
    }
    if (type === 'sms' && (!existing.phone || existing.smsOptedOut)) {
      return res.status(400).json({ error: 'Pas de numéro de téléphone ou prospect désinscrit des SMS' });
    }
    if (type === 'email' && (!existing.email || existing.emailUnsubscribed)) {
      return res.status(400).json({ error: 'Pas d\'email ou prospect désinscrit' });
    }

    // Reuse the FollowUpSequence pipeline so tracking + sentAt stays
    // consistent with scheduled follow-ups.
    const lastStep = await prisma.followUpSequence.findFirst({
      where: { prospectId },
      orderBy: { step: 'desc' },
      select: { step: true },
    });
    await prisma.followUpSequence.create({
      data: {
        prospectId,
        type,
        step: (lastStep?.step ?? 0) + 1,
        scheduledAt: new Date(),
      },
    });

    // Process the queue right now (picks up the row we just created).
    await followUpSequencesService.processDue();

    // Refetch the just-sent row so the UI knows whether it actually went out.
    const sentRow = await prisma.followUpSequence.findFirst({
      where: { prospectId, type },
      orderBy: { id: 'desc' },
      select: { id: true, sentAt: true },
    });

    res.status(201).json({
      ok: !!sentRow?.sentAt,
      sentAt: sentRow?.sentAt ?? null,
    });
  } catch (err: any) {
    logger.error('[closer] sendFollowUpNow failed:', err);
    res.status(500).json({ error: err.message });
  }
}

/** GET /api/closer/followups — list all follow-ups for the closer's prospects */
export async function listFollowUps(req: AuthRequest, res: Response) {
  try {
    const closerId = String(req.userId);
    const pending = String(req.query.pending || 'false') === 'true';
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500);

    const items = await prisma.followUpSequence.findMany({
      where: {
        ...(pending ? { sentAt: null } : {}),
        prospect: { assignedToUserId: closerId },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
      include: {
        prospect: {
          select: {
            id: true, businessName: true, contactName: true, phone: true, status: true,
          },
        },
      },
    });

    res.json({ items });
  } catch (err: any) {
    logger.error('[closer] listFollowUps failed:', err);
    res.status(500).json({ error: err.message });
  }
}

/** DELETE /api/closer/followups/:id — cancel a pending follow-up */
export async function cancelFollowUp(req: AuthRequest, res: Response) {
  try {
    const closerId = String(req.userId);
    const id = String(req.params.id);
    const fu = await prisma.followUpSequence.findUnique({
      where: { id },
      include: { prospect: { select: { assignedToUserId: true } } },
    });
    if (!fu) return res.status(404).json({ error: 'Follow-up introuvable' });
    if (fu.sentAt) return res.status(400).json({ error: 'Déjà envoyé' });
    if (fu.prospect.assignedToUserId !== closerId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Non attribué à vous' });
    }
    await prisma.followUpSequence.delete({ where: { id } });
    res.status(204).end();
  } catch (err: any) {
    logger.error('[closer] cancelFollowUp failed:', err);
    res.status(500).json({ error: err.message });
  }
}
