// @ts-nocheck
import { Router, Request, Response } from 'express';
import { authMiddleware, clientMiddleware } from '../middleware/auth.middleware';
import { prisma } from '../config/database';

const router = Router();

// All routes require JWT auth + client role (clientId is set by clientMiddleware)
router.use(authMiddleware);
router.use(clientMiddleware);

// ─── Contacts ────────────────────────────────────────────

// GET /api/crm/contacts — list contacts (with search, filter, pagination)
router.get('/contacts', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const {
      search,
      status,
      niche,
      tag,
      page = '1',
      limit = '50',
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100); // cap at 100

    const where: any = { clientId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (niche) where.niche = niche;
    if (tag) where.tags = { has: tag };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({
      contacts,
      pagination: {
        total,
        page: parseInt(page),
        limit: take,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// POST /api/crm/contacts/deduplicate — check for duplicates before creating
// Must be declared BEFORE /contacts/:id to avoid route collision
router.post('/contacts/deduplicate', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { email, phone, name } = req.body;

    const conditions: any[] = [];
    if (email) conditions.push({ email: { equals: email, mode: 'insensitive' } });
    if (phone) conditions.push({ phone });
    if (name) conditions.push({ name: { equals: name, mode: 'insensitive' } });

    if (conditions.length === 0) {
      return res.json({ duplicates: [] });
    }

    const duplicates = await prisma.contact.findMany({
      where: {
        clientId,
        OR: conditions,
      },
      select: { id: true, name: true, email: true, phone: true, status: true },
    });

    res.json({ duplicates });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to check duplicates' });
  }
});

// POST /api/crm/contacts — create contact
router.post('/contacts', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { name, email, phone, address, niche, leadScore, status, tags, notes, externalIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const contact = await prisma.contact.create({
      data: {
        clientId,
        name,
        email: email ?? null,
        phone: phone ?? null,
        address: address ?? null,
        niche: niche ?? null,
        leadScore: leadScore ?? null,
        status: status ?? 'new',
        tags: tags ?? [],
        notes: notes ?? null,
        externalIds: externalIds ?? null,
      },
    });

    res.status(201).json(contact);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// GET /api/crm/contacts/:id — get contact detail with activities
router.get('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const id = req.params.id as string;

    const contact = await prisma.contact.findFirst({
      where: { id, clientId },
      include: {
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        deals: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// PUT /api/crm/contacts/:id — update contact
router.put('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const id = req.params.id as string;
    const { name, email, phone, address, niche, leadScore, status, tags, notes, externalIds, enrichedData } = req.body;

    const existing = await prisma.contact.findFirst({ where: { id, clientId } });
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(niche !== undefined && { niche }),
        ...(leadScore !== undefined && { leadScore }),
        ...(status !== undefined && { status }),
        ...(tags !== undefined && { tags }),
        ...(notes !== undefined && { notes }),
        ...(externalIds !== undefined && { externalIds }),
        ...(enrichedData !== undefined && { enrichedData }),
      },
    });

    res.json(contact);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /api/crm/contacts/:id — delete contact
router.delete('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const id = req.params.id as string;

    const existing = await prisma.contact.findFirst({ where: { id, clientId } });
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await prisma.contact.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// ─── Deals ───────────────────────────────────────────────

// GET /api/crm/deals — list deals (filterable by stage)
router.get('/deals', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { stage, contactId } = req.query as Record<string, string>;

    const where: any = { clientId };
    if (stage) where.stage = stage;
    if (contactId) where.contactId = contactId;

    const deals = await prisma.deal.findMany({
      where,
      include: {
        contact: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(deals);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// POST /api/crm/deals — create deal
router.post('/deals', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { contactId, title, stage, value, probability, closeDate } = req.body;

    if (!contactId || !title) {
      return res.status(400).json({ error: 'contactId and title are required' });
    }

    // Verify contact belongs to this client
    const contact = await prisma.contact.findFirst({ where: { id: contactId, clientId } });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const deal = await prisma.deal.create({
      data: {
        clientId,
        contactId,
        title,
        stage: stage ?? 'new',
        value: value ?? null,
        probability: probability ?? null,
        closeDate: closeDate ? new Date(closeDate) : null,
      },
      include: {
        contact: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    res.status(201).json(deal);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// PUT /api/crm/deals/:id — update deal (including stage change for kanban)
router.put('/deals/:id', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { id } = req.params;
    const { title, stage, value, probability, closeDate } = req.body;

    const existing = await prisma.deal.findFirst({ where: { id, clientId } });
    if (!existing) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(stage !== undefined && { stage }),
        ...(value !== undefined && { value }),
        ...(probability !== undefined && { probability }),
        ...(closeDate !== undefined && { closeDate: closeDate ? new Date(closeDate) : null }),
      },
      include: {
        contact: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

// DELETE /api/crm/deals/:id — delete deal
router.delete('/deals/:id', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { id } = req.params;

    const existing = await prisma.deal.findFirst({ where: { id, clientId } });
    if (!existing) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    await prisma.deal.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

// ─── Activities ──────────────────────────────────────────

// GET /api/crm/activities — list activities (filterable by type, contact)
router.get('/activities', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { type, contactId, page = '1', limit = '50' } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);

    const where: any = { clientId };
    if (type) where.type = type;
    if (contactId) where.contactId = contactId;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: {
          contact: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.activity.count({ where }),
    ]);

    res.json({
      activities,
      pagination: {
        total,
        page: parseInt(page),
        limit: take,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// POST /api/crm/activities — create activity
router.post('/activities', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { contactId, type, description, callId } = req.body;

    if (!contactId || !type) {
      return res.status(400).json({ error: 'contactId and type are required' });
    }

    // Verify contact belongs to this client
    const contact = await prisma.contact.findFirst({ where: { id: contactId, clientId } });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const activity = await prisma.activity.create({
      data: {
        clientId,
        contactId,
        type,
        description: description ?? null,
        callId: callId ?? null,
      },
      include: {
        contact: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json(activity);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

// ─── CRM Integrations ────────────────────────────────────

// GET /api/crm/integrations — list connected integrations
router.get('/integrations', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;

    const integrations = await prisma.crmIntegration.findMany({
      where: { clientId },
      select: {
        id: true,
        clientId: true,
        provider: true,
        config: true,
        lastSync: true,
        syncStatus: true,
        createdAt: true,
        // Omit raw tokens
        accessToken: false,
        refreshToken: false,
      },
    });

    // Add connected flag
    const result = integrations.map((i) => ({ ...i, connected: true }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// POST /api/crm/integrations/:provider/connect — initiate OAuth / store token
router.post('/integrations/:provider/connect', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { provider } = req.params;
    const { accessToken, refreshToken, config } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'accessToken is required' });
    }

    const integration = await prisma.crmIntegration.upsert({
      where: { clientId_provider: { clientId, provider } },
      create: {
        clientId,
        provider,
        accessToken,
        refreshToken: refreshToken ?? null,
        config: config ?? null,
        syncStatus: 'connected',
      },
      update: {
        accessToken,
        ...(refreshToken !== undefined && { refreshToken }),
        ...(config !== undefined && { config }),
        syncStatus: 'connected',
      },
      select: {
        id: true,
        clientId: true,
        provider: true,
        config: true,
        lastSync: true,
        syncStatus: true,
        createdAt: true,
      },
    });

    res.json({ connected: true, integration });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to connect integration' });
  }
});

// POST /api/crm/integrations/:provider/disconnect — revoke + cleanup
router.post('/integrations/:provider/disconnect', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { provider } = req.params;

    const existing = await prisma.crmIntegration.findUnique({
      where: { clientId_provider: { clientId, provider } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    await prisma.crmIntegration.delete({
      where: { clientId_provider: { clientId, provider } },
    });

    res.json({ disconnected: true, provider });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to disconnect integration' });
  }
});

// POST /api/crm/integrations/:provider/sync — trigger manual sync (records attempt)
router.post('/integrations/:provider/sync', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { provider } = req.params;

    const integration = await prisma.crmIntegration.findUnique({
      where: { clientId_provider: { clientId, provider } },
    });

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Update sync timestamp and status
    const updated = await prisma.crmIntegration.update({
      where: { clientId_provider: { clientId, provider } },
      data: {
        lastSync: new Date(),
        syncStatus: 'syncing',
      },
      select: {
        id: true,
        provider: true,
        lastSync: true,
        syncStatus: true,
      },
    });

    // Log the sync attempt
    await prisma.syncLog.create({
      data: {
        clientId,
        provider,
        direction: 'bidirectional',
        entity: 'contacts',
        status: 'initiated',
      },
    });

    res.json({ syncing: true, integration: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

export default router;
