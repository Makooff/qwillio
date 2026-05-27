import { Router, Request, Response } from 'express';
import { authMiddleware, clientMiddleware } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { agentPaymentsService } from '../services/agent-payments.service';
import { agentAccountingService } from '../services/agent-accounting.service';
import { agentInventoryService } from '../services/agent-inventory.service';
import { agentEmailService } from '../services/agent-email.service';
import { agentMarketingService } from '../services/agent-marketing.service';
import { agentReputationService } from '../services/agent-reputation.service';
import { agentSchedulingService } from '../services/agent-scheduling.service';
import { agentSupportService } from '../services/agent-support.service';
import { agentCrmService } from '../services/agent-crm.service';
import { agentDocumentService } from '../services/agent-document.service';
import { agentLocalSeoService } from '../services/agent-local-seo.service';
import { agentLeadGenService } from '../services/agent-lead-gen.service';
import { agentAnalyticsService } from '../services/agent-analytics.service';

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
    const { emailAi, paymentsAi, accountingAi, inventoryAi, marketingAi, reputationAi, schedulingAi, supportAi, crmAi, documentAi, localSeoAi, leadGenAi, analyticsAi, bundle, stripeSubscriptionId, status } = req.body;

    // Trial guard: modules are not available during the 14-day trial.
    const requestedAny = [
      emailAi, paymentsAi, accountingAi, inventoryAi,
      marketingAi, reputationAi, schedulingAi, supportAi,
      crmAi, documentAi, localSeoAi, leadGenAi, analyticsAi,
      bundle,
    ].some(v => v === true);
    if (requestedAny) {
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (client?.isTrial) {
        return res.status(402).json({ error: 'Agent modules are not included in the trial. Upgrade to activate.' });
      }
    }

    const subscription = await prisma.agentSubscription.upsert({
      where: { clientId },
      create: {
        clientId,
        emailAi: emailAi ?? false,
        paymentsAi: paymentsAi ?? false,
        accountingAi: accountingAi ?? false,
        inventoryAi: inventoryAi ?? false,
        marketingAi: marketingAi ?? false,
        reputationAi: reputationAi ?? false,
        schedulingAi: schedulingAi ?? false,
        supportAi: supportAi ?? false,
        crmAi: crmAi ?? false,
        documentAi: documentAi ?? false,
        localSeoAi: localSeoAi ?? false,
        leadGenAi: leadGenAi ?? false,
        analyticsAi: analyticsAi ?? false,
        bundle: bundle ?? false,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        status: status ?? 'active',
      },
      update: {
        ...(emailAi !== undefined && { emailAi }),
        ...(paymentsAi !== undefined && { paymentsAi }),
        ...(accountingAi !== undefined && { accountingAi }),
        ...(inventoryAi !== undefined && { inventoryAi }),
        ...(marketingAi !== undefined && { marketingAi }),
        ...(reputationAi !== undefined && { reputationAi }),
        ...(schedulingAi !== undefined && { schedulingAi }),
        ...(supportAi !== undefined && { supportAi }),
        ...(crmAi !== undefined && { crmAi }),
        ...(documentAi !== undefined && { documentAi }),
        ...(localSeoAi !== undefined && { localSeoAi }),
        ...(leadGenAi !== undefined && { leadGenAi }),
        ...(analyticsAi !== undefined && { analyticsAi }),
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

// ─── Marketing AI ──────────────────────────────────────
router.get('/marketing/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentMarketingService.getConfig(clientId));
  } catch { res.status(500).json({ error: 'Failed to load marketing config' }); }
});
router.put('/marketing/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentMarketingService.updateConfig(clientId, req.body ?? {}));
  } catch { res.status(500).json({ error: 'Failed to update marketing config' }); }
});
router.post('/marketing/generate', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { contentType, topic, channel, language } = req.body ?? {};
    if (!contentType || !topic || !channel) return res.status(400).json({ error: 'contentType, topic, channel required' });
    res.json(await agentMarketingService.generate({ clientId, contentType, topic, channel, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/marketing/activity', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const limit = parseInt(String(req.query.limit ?? '50'));
    res.json(await agentMarketingService.listActivity(clientId, limit));
  } catch { res.status(500).json({ error: 'Failed to list activity' }); }
});
router.post('/marketing/approve/:activityId', async (req: Request, res: Response) => {
  try { res.json(await agentMarketingService.approve(req.params.activityId as string)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/marketing/dashboard', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentMarketingService.getDashboard(clientId));
  } catch { res.status(500).json({ error: 'Failed to load dashboard' }); }
});

// ─── Reputation AI ─────────────────────────────────────
router.get('/reputation/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentReputationService.getConfig(clientId));
  } catch { res.status(500).json({ error: 'Failed to load reputation config' }); }
});
router.put('/reputation/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentReputationService.updateConfig(clientId, req.body ?? {}));
  } catch { res.status(500).json({ error: 'Failed to update reputation config' }); }
});
router.post('/reputation/draft', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { platform, rating, reviewText, reviewId, language } = req.body ?? {};
    if (!platform || typeof rating !== 'number' || !reviewText) return res.status(400).json({ error: 'platform, rating, reviewText required' });
    res.json(await agentReputationService.draftReply({ clientId, platform, rating, reviewText, reviewId, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/reputation/reviews', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const limit = parseInt(String(req.query.limit ?? '50'));
    res.json(await agentReputationService.listReviews(clientId, limit));
  } catch { res.status(500).json({ error: 'Failed to list reviews' }); }
});
router.post('/reputation/send/:activityId', async (req: Request, res: Response) => {
  try { res.json(await agentReputationService.send(req.params.activityId as string)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/reputation/dashboard', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentReputationService.getDashboard(clientId));
  } catch { res.status(500).json({ error: 'Failed to load dashboard' }); }
});

// ─── Scheduling AI ─────────────────────────────────────
router.get('/scheduling/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentSchedulingService.getConfig(clientId));
  } catch { res.status(500).json({ error: 'Failed to load scheduling config' }); }
});
router.put('/scheduling/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentSchedulingService.updateConfig(clientId, req.body ?? {}));
  } catch { res.status(500).json({ error: 'Failed to update scheduling config' }); }
});
router.post('/scheduling/optimize', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { date, slotCount, language } = req.body ?? {};
    if (!date) return res.status(400).json({ error: 'date required' });
    res.json(await agentSchedulingService.optimize({ clientId, date, slotCount, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/scheduling/activity', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const limit = parseInt(String(req.query.limit ?? '50'));
    res.json(await agentSchedulingService.listActivity(clientId, limit));
  } catch { res.status(500).json({ error: 'Failed to list activity' }); }
});
router.get('/scheduling/dashboard', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentSchedulingService.getDashboard(clientId));
  } catch { res.status(500).json({ error: 'Failed to load dashboard' }); }
});

// ─── Support AI ────────────────────────────────────────
router.get('/support/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentSupportService.getConfig(clientId));
  } catch { res.status(500).json({ error: 'Failed to load support config' }); }
});
router.put('/support/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentSupportService.updateConfig(clientId, req.body ?? {}));
  } catch { res.status(500).json({ error: 'Failed to update support config' }); }
});
router.post('/support/classify', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { channel, ticketText, ticketId, language } = req.body ?? {};
    if (!channel || !ticketText) return res.status(400).json({ error: 'channel, ticketText required' });
    res.json(await agentSupportService.classify({ clientId, channel, ticketText, ticketId, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/support/tickets', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const limit = parseInt(String(req.query.limit ?? '50'));
    res.json(await agentSupportService.listTickets(clientId, limit));
  } catch { res.status(500).json({ error: 'Failed to list tickets' }); }
});
router.post('/support/send/:activityId', async (req: Request, res: Response) => {
  try { res.json(await agentSupportService.sendReply(req.params.activityId as string)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/support/dashboard', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentSupportService.getDashboard(clientId));
  } catch { res.status(500).json({ error: 'Failed to load dashboard' }); }
});

// ─── CRM AI ────────────────────────────────────────────
router.get('/crm/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentCrmService.getConfig(clientId));
  } catch { res.status(500).json({ error: 'Failed to load crm config' }); }
});
router.put('/crm/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentCrmService.updateConfig(clientId, req.body ?? {}));
  } catch { res.status(500).json({ error: 'Failed to update crm config' }); }
});
router.post('/crm/sync', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentCrmService.syncAll(clientId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/crm/progress', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { dealId, newStage, notes } = req.body ?? {};
    if (!dealId || !newStage) return res.status(400).json({ error: 'dealId and newStage required' });
    res.json(await agentCrmService.progressDeal({ clientId, dealId, newStage, notes }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/crm/forecast', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { periodMonths, language } = req.body ?? {};
    res.json(await agentCrmService.forecastRevenue({ clientId, periodMonths, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/crm/analyze-lost', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { dealId, lostReason, language } = req.body ?? {};
    res.json(await agentCrmService.analyzeLostDeal({ clientId, dealId, lostReason, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/crm/relance/:dealId', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { language } = req.body ?? {};
    res.json(await agentCrmService.generateRelance({ clientId, dealId: req.params.dealId as string, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/crm/activity', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const limit = parseInt(String(req.query.limit ?? '50'));
    res.json(await agentCrmService.listActivity(clientId, limit));
  } catch { res.status(500).json({ error: 'Failed to list activity' }); }
});
router.get('/crm/dashboard', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentCrmService.getDashboard(clientId));
  } catch { res.status(500).json({ error: 'Failed to load dashboard' }); }
});

// ─── Document AI ───────────────────────────────────────
router.get('/document/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentDocumentService.getConfig(clientId));
  } catch { res.status(500).json({ error: 'Failed to load document config' }); }
});
router.put('/document/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentDocumentService.updateConfig(clientId, req.body ?? {}));
  } catch { res.status(500).json({ error: 'Failed to update document config' }); }
});
router.post('/document/generate', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { docType, items, customerInfo, language, notes } = req.body ?? {};
    if (!docType || !Array.isArray(items) || !customerInfo) return res.status(400).json({ error: 'docType, items, customerInfo required' });
    res.json(await agentDocumentService.generate({ clientId, docType, items, customerInfo, language, notes }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/document/send/:activityId', async (req: Request, res: Response) => {
  try { res.json(await agentDocumentService.sendForSignature(req.params.activityId as string)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/document/sign/:activityId', async (req: Request, res: Response) => {
  try { res.json(await agentDocumentService.markSigned(req.params.activityId as string)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/document/list', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const documentType = req.query.documentType ? String(req.query.documentType) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const limit = parseInt(String(req.query.limit ?? '50'));
    res.json(await agentDocumentService.listDocuments(clientId, { documentType, status, limit }));
  } catch { res.status(500).json({ error: 'Failed to list documents' }); }
});
router.get('/document/dashboard', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentDocumentService.getDashboard(clientId));
  } catch { res.status(500).json({ error: 'Failed to load dashboard' }); }
});

// ─── Local SEO AI ──────────────────────────────────────
router.get('/local-seo/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentLocalSeoService.getConfig(clientId));
  } catch { res.status(500).json({ error: 'Failed to load local-seo config' }); }
});
router.put('/local-seo/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentLocalSeoService.updateConfig(clientId, req.body ?? {}));
  } catch { res.status(500).json({ error: 'Failed to update local-seo config' }); }
});
router.post('/local-seo/gmb-post', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { topic, eventDate, offerDetails, language } = req.body ?? {};
    if (!topic) return res.status(400).json({ error: 'topic required' });
    res.json(await agentLocalSeoService.generateGmbPost({ clientId, topic, eventDate, offerDetails, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/local-seo/keywords', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { count, language } = req.body ?? {};
    res.json(await agentLocalSeoService.suggestKeywords({ clientId, count, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/local-seo/audit', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { listing, language } = req.body ?? {};
    if (!listing) return res.status(400).json({ error: 'listing required' });
    res.json(await agentLocalSeoService.auditListing({ clientId, listing, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/local-seo/ranking', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { keyword, location, language } = req.body ?? {};
    if (!keyword || !location) return res.status(400).json({ error: 'keyword and location required' });
    res.json(await agentLocalSeoService.trackRanking({ clientId, keyword, location, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/local-seo/activity', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const limit = parseInt(String(req.query.limit ?? '50'));
    res.json(await agentLocalSeoService.listActivity(clientId, limit));
  } catch { res.status(500).json({ error: 'Failed to list activity' }); }
});
router.get('/local-seo/dashboard', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentLocalSeoService.getDashboard(clientId));
  } catch { res.status(500).json({ error: 'Failed to load dashboard' }); }
});

// ─── Lead Gen AI ───────────────────────────────────────
router.get('/lead-gen/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentLeadGenService.getConfig(clientId));
  } catch { res.status(500).json({ error: 'Failed to load lead-gen config' }); }
});
router.put('/lead-gen/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentLeadGenService.updateConfig(clientId, req.body ?? {}));
  } catch { res.status(500).json({ error: 'Failed to update lead-gen config' }); }
});
router.post('/lead-gen/discover', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { niches, cities, count } = req.body ?? {};
    res.json(await agentLeadGenService.discover({ clientId, niches, cities, count }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/lead-gen/sequence/:prospectId', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { channel, tone, stepCount, language } = req.body ?? {};
    res.json(await agentLeadGenService.generateSequence({ clientId, prospectId: req.params.prospectId as string, channel, tone, stepCount, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/lead-gen/send/:activityId', async (req: Request, res: Response) => {
  try { res.json(await agentLeadGenService.sendNextStep(req.params.activityId as string)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/lead-gen/stats', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentLeadGenService.getCampaignStats(clientId));
  } catch { res.status(500).json({ error: 'Failed to load stats' }); }
});
router.get('/lead-gen/activity', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const limit = parseInt(String(req.query.limit ?? '50'));
    res.json(await agentLeadGenService.listActivity(clientId, limit));
  } catch { res.status(500).json({ error: 'Failed to list activity' }); }
});
router.get('/lead-gen/dashboard', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentLeadGenService.getDashboard(clientId));
  } catch { res.status(500).json({ error: 'Failed to load dashboard' }); }
});

// ─── Analytics AI ──────────────────────────────────────
router.get('/analytics/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentAnalyticsService.getConfig(clientId));
  } catch { res.status(500).json({ error: 'Failed to load analytics config' }); }
});
router.put('/analytics/config', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentAnalyticsService.updateConfig(clientId, req.body ?? {}));
  } catch { res.status(500).json({ error: 'Failed to update analytics config' }); }
});
router.post('/analytics/digest', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { language } = req.body ?? {};
    res.json(await agentAnalyticsService.generateWeeklyDigest({ clientId, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/analytics/anomalies', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { windowDays, language } = req.body ?? {};
    res.json(await agentAnalyticsService.detectAnomalies({ clientId, windowDays, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/analytics/forecast', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { metric, periodDays, language } = req.body ?? {};
    if (!metric) return res.status(400).json({ error: 'metric required (calls|bookings|revenue)' });
    res.json(await agentAnalyticsService.forecast({ clientId, metric, periodDays, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/analytics/recommend', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const { language } = req.body ?? {};
    res.json(await agentAnalyticsService.recommend({ clientId, language }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.get('/analytics/history', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    const limit = parseInt(String(req.query.limit ?? '12'));
    res.json(await agentAnalyticsService.getDigestHistory(clientId, limit));
  } catch { res.status(500).json({ error: 'Failed to load history' }); }
});
router.get('/analytics/dashboard', async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId as string;
    res.json(await agentAnalyticsService.getDashboard(clientId));
  } catch { res.status(500).json({ error: 'Failed to load dashboard' }); }
});

export default router;
