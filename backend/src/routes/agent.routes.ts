import { Router, Request, Response } from 'express';
import { authMiddleware, clientMiddleware } from '../middleware/auth.middleware';
import { prisma } from '../config/database';

const router = Router();

// All routes require JWT auth + client role (clientId is set by clientMiddleware)
router.use(authMiddleware);
router.use(clientMiddleware);

// ─── Agent Subscription ──────────────────────────────────

// GET /api/agent/subscription — get client's agent subscription
router.get('/subscription', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const subscription = await prisma.agentSubscription.findUnique({
      where: { clientId },
    });
    res.json(subscription ?? null);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch agent subscription' });
  }
});

// POST /api/agent/subscription — create or update agent subscription
router.post('/subscription', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { emailAi, paymentsAi, accountingAi, inventoryAi, bundle, stripeSubscriptionId, status } = req.body;

    const subscription = await prisma.agentSubscription.upsert({
      where: { clientId },
      create: {
        clientId,
        emailAi: emailAi ?? false,
        paymentsAi: paymentsAi ?? false,
        accountingAi: accountingAi ?? false,
        inventoryAi: inventoryAi ?? false,
        bundle: bundle ?? false,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        status: status ?? 'active',
      },
      update: {
        ...(emailAi !== undefined && { emailAi }),
        ...(paymentsAi !== undefined && { paymentsAi }),
        ...(accountingAi !== undefined && { accountingAi }),
        ...(inventoryAi !== undefined && { inventoryAi }),
        ...(bundle !== undefined && { bundle }),
        ...(stripeSubscriptionId !== undefined && { stripeSubscriptionId }),
        ...(status !== undefined && { status }),
      },
    });

    res.json(subscription);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to upsert agent subscription' });
  }
});

// ─── Email AI Config ─────────────────────────────────────

// GET /api/agent/email/config — get email AI config
router.get('/email/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const config = await prisma.agentEmailConfig.findUnique({
      where: { clientId },
      // Omit raw tokens from the response for security
      select: {
        id: true,
        clientId: true,
        autoReply: true,
        replyTone: true,
        blockedSenders: true,
        templates: true,
        active: true,
        createdAt: true,
        // Expose only whether tokens exist, not the tokens themselves
        gmailToken: false,
        outlookToken: false,
      },
    });

    if (!config) {
      return res.status(404).json({ error: 'Email config not found' });
    }

    // Return config but indicate connection status instead of raw tokens
    const rawConfig = await prisma.agentEmailConfig.findUnique({
      where: { clientId },
      select: { gmailToken: true, outlookToken: true },
    });

    res.json({
      ...config,
      gmailConnected: rawConfig?.gmailToken != null,
      outlookConnected: rawConfig?.outlookToken != null,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch email config' });
  }
});

// PUT /api/agent/email/config — update email AI config
router.put('/email/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { autoReply, replyTone, blockedSenders, templates, active } = req.body;

    const config = await prisma.agentEmailConfig.upsert({
      where: { clientId },
      create: {
        clientId,
        autoReply: autoReply ?? false,
        replyTone: replyTone ?? 'professional',
        blockedSenders: blockedSenders ?? [],
        templates: templates ?? null,
        active: active ?? true,
      },
      update: {
        ...(autoReply !== undefined && { autoReply }),
        ...(replyTone !== undefined && { replyTone }),
        ...(blockedSenders !== undefined && { blockedSenders }),
        ...(templates !== undefined && { templates }),
        ...(active !== undefined && { active }),
      },
      select: {
        id: true,
        clientId: true,
        autoReply: true,
        replyTone: true,
        blockedSenders: true,
        templates: true,
        active: true,
        createdAt: true,
      },
    });

    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update email config' });
  }
});

// ─── Payments Config ─────────────────────────────────────

// GET /api/agent/payments/config — get payments config
// Payments config is derived from the client's Stripe connection + agent subscription
router.get('/payments/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;

    const [subscription, client] = await Promise.all([
      prisma.agentSubscription.findUnique({
        where: { clientId },
        select: { paymentsAi: true, status: true },
      }),
      prisma.client.findUnique({
        where: { id: clientId },
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          subscriptionStatus: true,
        },
      }),
    ]);

    res.json({
      enabled: subscription?.paymentsAi ?? false,
      subscriptionStatus: subscription?.status ?? null,
      stripeConnected: client?.stripeCustomerId != null,
      stripeCustomerId: client?.stripeCustomerId ?? null,
      stripeSubscriptionStatus: client?.subscriptionStatus ?? null,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch payments config' });
  }
});

// ─── Accounting Config ────────────────────────────────────

// GET /api/agent/accounting/config — get accounting config
router.get('/accounting/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const accounting = await prisma.agentAccounting.findUnique({
      where: { clientId },
      select: {
        id: true,
        clientId: true,
        stripeConnected: true,
        autoInvoice: true,
        invoiceTemplate: true,
        taxRate: true,
        createdAt: true,
        // Do not expose raw OAuth tokens
        quickbooksToken: false,
        waveToken: false,
      },
    });

    if (!accounting) {
      return res.status(404).json({ error: 'Accounting config not found' });
    }

    const raw = await prisma.agentAccounting.findUnique({
      where: { clientId },
      select: { quickbooksToken: true, waveToken: true },
    });

    res.json({
      ...accounting,
      quickbooksConnected: raw?.quickbooksToken != null,
      waveConnected: raw?.waveToken != null,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch accounting config' });
  }
});

// PUT /api/agent/accounting/config — update accounting config
router.put('/accounting/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { stripeConnected, autoInvoice, invoiceTemplate, taxRate } = req.body;

    const accounting = await prisma.agentAccounting.upsert({
      where: { clientId },
      create: {
        clientId,
        stripeConnected: stripeConnected ?? false,
        autoInvoice: autoInvoice ?? false,
        invoiceTemplate: invoiceTemplate ?? null,
        taxRate: taxRate ?? 0,
      },
      update: {
        ...(stripeConnected !== undefined && { stripeConnected }),
        ...(autoInvoice !== undefined && { autoInvoice }),
        ...(invoiceTemplate !== undefined && { invoiceTemplate }),
        ...(taxRate !== undefined && { taxRate }),
      },
      select: {
        id: true,
        clientId: true,
        stripeConnected: true,
        autoInvoice: true,
        invoiceTemplate: true,
        taxRate: true,
        createdAt: true,
      },
    });

    res.json(accounting);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update accounting config' });
  }
});

// ─── Inventory ───────────────────────────────────────────

// GET /api/agent/inventory — list inventory items
router.get('/inventory', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const items = await prisma.agentInventory.findMany({
      where: { clientId },
      orderBy: { productName: 'asc' },
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// POST /api/agent/inventory — add inventory item
router.post('/inventory', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { productName, quantity, unit, minThreshold, supplierEmail, autoOrder } = req.body;

    if (!productName || quantity === undefined) {
      return res.status(400).json({ error: 'productName and quantity are required' });
    }

    const item = await prisma.agentInventory.create({
      data: {
        clientId,
        productName,
        quantity,
        unit: unit ?? null,
        minThreshold: minThreshold ?? null,
        supplierEmail: supplierEmail ?? null,
        autoOrder: autoOrder ?? false,
      },
    });

    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
});

// PUT /api/agent/inventory/:id — update inventory item
router.put('/inventory/:id', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const id = req.params.id as string;
    const { productName, quantity, unit, minThreshold, supplierEmail, autoOrder } = req.body;

    // Verify ownership
    const existing = await prisma.agentInventory.findFirst({
      where: { id, clientId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const item = await prisma.agentInventory.update({
      where: { id },
      data: {
        ...(productName !== undefined && { productName }),
        ...(quantity !== undefined && { quantity }),
        ...(unit !== undefined && { unit }),
        ...(minThreshold !== undefined && { minThreshold }),
        ...(supplierEmail !== undefined && { supplierEmail }),
        ...(autoOrder !== undefined && { autoOrder }),
      },
    });

    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

// DELETE /api/agent/inventory/:id — delete inventory item
router.delete('/inventory/:id', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const id = req.params.id as string;

    // Verify ownership
    const existing = await prisma.agentInventory.findFirst({
      where: { id, clientId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    await prisma.agentInventory.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
});

export default router;
