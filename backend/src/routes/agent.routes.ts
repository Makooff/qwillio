import { Router, Request, Response } from 'express';
import { authMiddleware, clientMiddleware } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { agentPaymentsService } from '../services/agent-payments.service';
import { agentAccountingService } from '../services/agent-accounting.service';
import { agentInventoryService } from '../services/agent-inventory.service';
import { agentEmailService } from '../services/agent-email.service';

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
    const id = req.params.id as string as string;
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
    const id = req.params.id as string as string;

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

// ─── Payments AI ─────────────────────────────────────────

router.post('/payments/invoices', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const invoice = await agentPaymentsService.createInvoice(clientId, req.body);
    res.status(201).json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create invoice' });
  }
});

router.get('/payments/invoices', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { status, page, limit } = req.query;
    const result = await agentPaymentsService.listInvoices(clientId, status as string, Number(page) || 1, Number(limit) || 20);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list invoices' });
  }
});

router.post('/payments/invoices/:id/send', async (req: Request, res: Response) => {
  try {
    const invoice = await agentPaymentsService.sendInvoice(req.params.id as string);
    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to send invoice' });
  }
});

router.post('/payments/invoices/:id/mark-paid', async (req: Request, res: Response) => {
  try {
    const invoice = await agentPaymentsService.markPaid(req.params.id as string);
    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to mark paid' });
  }
});

router.get('/payments/report', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { startDate, endDate } = req.query;
    const report = await agentPaymentsService.getRevenueReport(
      clientId,
      startDate ? new Date(startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
      endDate ? new Date(endDate as string) : new Date()
    );
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get revenue report' });
  }
});

// ─── Accounting AI ───────────────────────────────────────

router.post('/accounting/expenses', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const expense = await agentAccountingService.addExpense(clientId, req.body);
    res.status(201).json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to add expense' });
  }
});

router.get('/accounting/expenses', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { startDate, endDate, category, page, limit } = req.query;
    const result = await agentAccountingService.listExpenses(clientId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      category: category as string,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list expenses' });
  }
});

router.post('/accounting/income', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const income = await agentAccountingService.addIncome(clientId, req.body);
    res.status(201).json(income);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to add income' });
  }
});

router.get('/accounting/income', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { startDate, endDate, page, limit } = req.query;
    const result = await agentAccountingService.listIncome(clientId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list income' });
  }
});

router.get('/accounting/summary', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { startDate, endDate } = req.query;
    const summary = await agentAccountingService.getFinancialSummary(
      clientId,
      startDate ? new Date(startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
      endDate ? new Date(endDate as string) : new Date()
    );
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

router.get('/accounting/reports', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const reports = await agentAccountingService.listReports(clientId);
    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

router.post('/accounting/reports/generate', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { year, month } = req.body;
    const report = await agentAccountingService.generateMonthlyReport(clientId, year, month);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

// ─── Inventory AI (extended) ─────────────────────────────

router.post('/inventory/:id/usage', async (req: Request, res: Response) => {
  try {
    const { quantity, note } = req.body;
    const item = await agentInventoryService.recordUsage(req.params.id as string, quantity, note);
    res.json(item);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to record usage' });
  }
});

router.post('/inventory/:id/restock', async (req: Request, res: Response) => {
  try {
    const { quantity, note } = req.body;
    const item = await agentInventoryService.recordRestock(req.params.id as string, quantity, note);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to record restock' });
  }
});

router.get('/inventory/alerts', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const alerts = await agentInventoryService.checkLowStock(clientId);
    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to check stock alerts' });
  }
});

router.get('/inventory/report', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const report = await agentInventoryService.getInventoryReport(clientId);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get inventory report' });
  }
});

router.get('/inventory/reorders', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { page, limit } = req.query;
    const result = await agentInventoryService.listReorders(clientId, Number(page) || 1, Number(limit) || 20);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list reorders' });
  }
});

// ─── Inventory AI: QR code scan ─────────────────────────

// QR code scan — accepts product barcode/QR data and matches to inventory
router.post('/inventory/scan', async (req: any, res) => {
  try {
    const clientId = req.clientId;
    const { barcode, action } = req.body; // action: 'usage' or 'restock'

    if (!barcode) return res.status(400).json({ error: 'Barcode data required' });

    // Try to find inventory item by product name or barcode match
    const item = await prisma.agentInventory.findFirst({
      where: { clientId, productName: { contains: barcode, mode: 'insensitive' } },
    });

    if (!item) {
      return res.status(404).json({ error: 'Product not found', barcode });
    }

    if (action === 'usage') {
      await prisma.agentInventory.update({
        where: { id: item.id },
        data: { quantity: { decrement: 1 } },
      });
    } else if (action === 'restock') {
      const qty = req.body.quantity || 1;
      await prisma.agentInventory.update({
        where: { id: item.id },
        data: { quantity: { increment: qty } },
      });
    }

    const updated = await prisma.agentInventory.findUnique({ where: { id: item.id } });
    res.json({ product: updated, action: action || 'lookup' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Email AI (extended) ─────────────────────────────────

router.get('/email/oauth/url', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const url = agentEmailService.getOAuthUrl(clientId);
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

router.put('/email/business-context', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { businessContext, followUpEnabled, followUpDelayHours } = req.body;
    const config = await prisma.agentEmailConfig.upsert({
      where: { clientId },
      create: { clientId, businessContext, followUpEnabled: followUpEnabled ?? false, followUpDelayHours: followUpDelayHours ?? 24 },
      update: {
        ...(businessContext !== undefined && { businessContext }),
        ...(followUpEnabled !== undefined && { followUpEnabled }),
        ...(followUpDelayHours !== undefined && { followUpDelayHours }),
      },
    });
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update business context' });
  }
});

router.post('/email/sync', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const count = await agentEmailService.syncEmails(clientId);
    res.json({ synced: count });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to sync emails' });
  }
});

router.get('/email/inbox', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { classification, page, limit } = req.query;
    const result = await agentEmailService.listEmails(clientId, {
      classification: classification as string,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list emails' });
  }
});

router.get('/email/dashboard', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const dashboard = await agentEmailService.getEmailDashboard(clientId);
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get email dashboard' });
  }
});

export default router;
