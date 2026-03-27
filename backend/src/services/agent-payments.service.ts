import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { resend } from '../config/resend';
import { env } from '../config/env';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface CreateInvoiceData {
  customerName: string;
  customerEmail: string;
  amount: number;
  taxAmount?: number;
  currency?: string;
  dueDate: Date;
  lineItems: LineItem[];
  notes?: string;
}

interface RevenueReport {
  totalDraft: number;
  totalSent: number;
  totalPaid: number;
  totalOverdue: number;
  countDraft: number;
  countSent: number;
  countPaid: number;
  countOverdue: number;
  grandTotal: number;
}

// Reminder schedule: days overdue -> reminder number
const REMINDER_SCHEDULE = [3, 7, 14] as const;

export class AgentPaymentsService {

  // ═══════════════════════════════════════════
  // CREATE INVOICE
  // ═══════════════════════════════════════════

  async createInvoice(clientId: string, data: CreateInvoiceData) {
    try {
      const invoiceNumber = await this.generateInvoiceNumber();
      const taxAmount = data.taxAmount ?? 0;
      const totalAmount = data.amount + taxAmount;

      const invoice = await prisma.agentInvoice.create({
        data: {
          clientId,
          invoiceNumber,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          amount: new Prisma.Decimal(data.amount),
          taxAmount: new Prisma.Decimal(taxAmount),
          totalAmount: new Prisma.Decimal(totalAmount),
          currency: data.currency ?? 'USD',
          status: 'draft',
          dueDate: data.dueDate,
          lineItems: data.lineItems as unknown as Prisma.InputJsonValue,
          notes: data.notes,
        },
      });

      logger.info(`Invoice ${invoiceNumber} created for client ${clientId}`);
      return invoice;
    } catch (error) {
      logger.error('Failed to create invoice:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════
  // SEND INVOICE
  // ═══════════════════════════════════════════

  async sendInvoice(invoiceId: string) {
    try {
      const invoice = await prisma.agentInvoice.findUnique({
        where: { id: invoiceId },
        include: { client: true },
      });

      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      const lineItems = invoice.lineItems as unknown as LineItem[];
      const html = this.renderInvoiceEmail({
        businessName: invoice.client.businessName ?? 'Qwillio Client',
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        date: invoice.createdAt,
        dueDate: invoice.dueDate,
        lineItems,
        amount: Number(invoice.amount),
        taxAmount: Number(invoice.taxAmount),
        totalAmount: Number(invoice.totalAmount),
        currency: invoice.currency,
        notes: invoice.notes,
      });

      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: invoice.customerEmail,
        subject: `Invoice ${invoice.invoiceNumber} from ${invoice.client.businessName ?? 'Qwillio'}`,
        html,
        replyTo: env.RESEND_REPLY_TO,
        tags: [
          { name: 'campaign', value: 'invoice' },
          { name: 'invoice', value: invoice.invoiceNumber },
        ],
      });

      const updated = await prisma.agentInvoice.update({
        where: { id: invoiceId },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });

      logger.info(`Invoice ${invoice.invoiceNumber} sent to ${invoice.customerEmail}`);
      return updated;
    } catch (error) {
      logger.error(`Failed to send invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════
  // MARK PAID
  // ═══════════════════════════════════════════

  async markPaid(invoiceId: string) {
    try {
      const invoice = await prisma.agentInvoice.update({
        where: { id: invoiceId },
        data: {
          status: 'paid',
          paidAt: new Date(),
        },
      });

      logger.info(`Invoice ${invoice.invoiceNumber} marked as paid`);
      return invoice;
    } catch (error) {
      logger.error(`Failed to mark invoice ${invoiceId} as paid:`, error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════
  // PROCESS OVERDUE INVOICES (CRON)
  // ═══════════════════════════════════════════

  async processOverdueInvoices(): Promise<void> {
    try {
      const now = new Date();

      // Find all sent invoices past due date
      const overdueInvoices = await prisma.agentInvoice.findMany({
        where: {
          status: { in: ['sent', 'overdue'] },
          dueDate: { lt: now },
        },
        include: { client: true },
      });

      for (const invoice of overdueInvoices) {
        try {
          // Guard: check that the client has paymentsAi enabled
          const subscription = await prisma.agentSubscription.findUnique({
            where: { clientId: invoice.clientId },
          });

          if (!subscription?.paymentsAi) {
            logger.info(`Skipping overdue processing for invoice ${invoice.invoiceNumber}: paymentsAi not enabled`);
            continue;
          }

          // Update status to overdue if still 'sent'
          if (invoice.status === 'sent') {
            await prisma.agentInvoice.update({
              where: { id: invoice.id },
              data: { status: 'overdue' },
            });
          }

          // Calculate days overdue
          const daysOverdue = Math.floor(
            (now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Determine which reminder to send based on graduated schedule
          const nextReminderIndex = invoice.remindersSent;
          if (nextReminderIndex >= REMINDER_SCHEDULE.length) {
            continue; // All reminders already sent
          }

          const reminderThreshold = REMINDER_SCHEDULE[nextReminderIndex];
          if (daysOverdue >= reminderThreshold) {
            await this.sendPaymentReminder(invoice.id, daysOverdue);
          }
        } catch (error) {
          logger.error(`Error processing overdue invoice ${invoice.invoiceNumber}:`, error);
        }
      }

      logger.info(`Processed ${overdueInvoices.length} overdue invoices`);
    } catch (error) {
      logger.error('Failed to process overdue invoices:', error);
    }
  }

  // ═══════════════════════════════════════════
  // SEND PAYMENT REMINDER
  // ═══════════════════════════════════════════

  async sendPaymentReminder(invoiceId: string, daysOverdue: number): Promise<void> {
    try {
      const invoice = await prisma.agentInvoice.findUnique({
        where: { id: invoiceId },
        include: { client: true },
      });

      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      const { subject, urgencyLevel } = this.getReminderTone(daysOverdue, invoice.invoiceNumber);
      const html = this.renderReminderEmail({
        businessName: invoice.client.businessName ?? 'Qwillio Client',
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: Number(invoice.totalAmount),
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        daysOverdue,
        urgencyLevel,
      });

      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: invoice.customerEmail,
        subject,
        html,
        replyTo: env.RESEND_REPLY_TO,
        tags: [
          { name: 'campaign', value: 'payment_reminder' },
          { name: 'invoice', value: invoice.invoiceNumber },
          { name: 'urgency', value: urgencyLevel },
        ],
      });

      await prisma.agentInvoice.update({
        where: { id: invoiceId },
        data: {
          remindersSent: { increment: 1 },
          lastReminderAt: new Date(),
        },
      });

      logger.info(`Payment reminder (${urgencyLevel}) sent for invoice ${invoice.invoiceNumber} (${daysOverdue} days overdue)`);
    } catch (error) {
      logger.error(`Failed to send payment reminder for invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════
  // REVENUE REPORT
  // ═══════════════════════════════════════════

  async getRevenueReport(clientId: string, startDate: Date, endDate: Date): Promise<RevenueReport> {
    try {
      const invoices = await prisma.agentInvoice.findMany({
        where: {
          clientId,
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      const report: RevenueReport = {
        totalDraft: 0,
        totalSent: 0,
        totalPaid: 0,
        totalOverdue: 0,
        countDraft: 0,
        countSent: 0,
        countPaid: 0,
        countOverdue: 0,
        grandTotal: 0,
      };

      for (const inv of invoices) {
        const total = Number(inv.totalAmount);
        report.grandTotal += total;

        switch (inv.status) {
          case 'draft':
            report.totalDraft += total;
            report.countDraft++;
            break;
          case 'sent':
            report.totalSent += total;
            report.countSent++;
            break;
          case 'paid':
            report.totalPaid += total;
            report.countPaid++;
            break;
          case 'overdue':
            report.totalOverdue += total;
            report.countOverdue++;
            break;
        }
      }

      return report;
    } catch (error) {
      logger.error(`Failed to generate revenue report for client ${clientId}:`, error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════
  // LIST INVOICES
  // ═══════════════════════════════════════════

  async listInvoices(
    clientId: string,
    status?: string,
    page: number = 1,
    limit: number = 20
  ) {
    try {
      const where: Prisma.AgentInvoiceWhereInput = { clientId };
      if (status) {
        where.status = status;
      }

      const [invoices, total] = await Promise.all([
        prisma.agentInvoice.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.agentInvoice.count({ where }),
      ]);

      return {
        invoices,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error(`Failed to list invoices for client ${clientId}:`, error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const lastInvoice = await prisma.agentInvoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
    });

    let nextNumber = 1;
    if (lastInvoice) {
      const lastNumber = parseInt(lastInvoice.invoiceNumber.replace(prefix, ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
  }

  private getReminderTone(daysOverdue: number, invoiceNumber: string): {
    subject: string;
    urgencyLevel: 'friendly' | 'firm' | 'final';
  } {
    if (daysOverdue >= 14) {
      return {
        subject: `Final notice: Invoice ${invoiceNumber} requires immediate attention`,
        urgencyLevel: 'final',
      };
    } else if (daysOverdue >= 7) {
      return {
        subject: `Second reminder: Invoice ${invoiceNumber} is ${daysOverdue} days overdue`,
        urgencyLevel: 'firm',
      };
    } else {
      return {
        subject: `Friendly reminder: Invoice ${invoiceNumber} is overdue`,
        urgencyLevel: 'friendly',
      };
    }
  }

  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  // ═══════════════════════════════════════════
  // EMAIL TEMPLATES
  // ═══════════════════════════════════════════

  private renderInvoiceEmail(data: {
    businessName: string;
    invoiceNumber: string;
    customerName: string;
    date: Date;
    dueDate: Date;
    lineItems: LineItem[];
    amount: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
    notes: string | null;
  }): string {
    const lineItemsHtml = data.lineItems
      .map(
        (item) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;">${item.description}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center;">${item.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:right;">${this.formatCurrency(item.unitPrice, data.currency)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:right;">${this.formatCurrency(item.total, data.currency)}</td>
        </tr>`
      )
      .join('');

    const notesSection = data.notes
      ? `<div style="margin-top:24px;padding:16px;background:#f8f9fa;border-radius:6px;">
           <p style="margin:0;font-size:13px;color:#555;"><strong>Notes:</strong> ${data.notes}</p>
         </div>`
      : '';

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:#1a1a2e;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600;">${data.businessName}</h1>
      <p style="margin:8px 0 0;color:#a0a0c0;font-size:13px;">Invoice</p>
    </div>

    <!-- Invoice Details -->
    <div style="padding:32px 40px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
        <div>
          <p style="margin:0 0 4px;font-size:13px;color:#888;">Invoice Number</p>
          <p style="margin:0;font-size:16px;font-weight:600;color:#1a1a2e;">${data.invoiceNumber}</p>
        </div>
      </div>

      <div style="margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:13px;color:#888;">Bill To</p>
        <p style="margin:0;font-size:15px;color:#333;">${data.customerName}</p>
      </div>

      <div style="display:flex;gap:40px;margin-bottom:32px;">
        <div>
          <p style="margin:0 0 4px;font-size:13px;color:#888;">Date Issued</p>
          <p style="margin:0;font-size:14px;color:#333;">${this.formatDate(data.date)}</p>
        </div>
        <div>
          <p style="margin:0 0 4px;font-size:13px;color:#888;">Due Date</p>
          <p style="margin:0;font-size:14px;color:#333;font-weight:600;">${this.formatDate(data.dueDate)}</p>
        </div>
      </div>

      <!-- Line Items Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f8f9fa;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Unit Price</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
        </tbody>
      </table>

      <!-- Totals -->
      <div style="border-top:2px solid #eee;padding-top:16px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:14px;color:#666;">Subtotal</span>
          <span style="font-size:14px;color:#333;">${this.formatCurrency(data.amount, data.currency)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="font-size:14px;color:#666;">Tax</span>
          <span style="font-size:14px;color:#333;">${this.formatCurrency(data.taxAmount, data.currency)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid #eee;">
          <span style="font-size:18px;font-weight:700;color:#1a1a2e;">Total Due</span>
          <span style="font-size:18px;font-weight:700;color:#1a1a2e;">${this.formatCurrency(data.totalAmount, data.currency)}</span>
        </div>
      </div>

      ${notesSection}

      <!-- Payment Instructions -->
      <div style="margin-top:32px;padding:20px;background:#f0f4ff;border-radius:6px;border-left:4px solid #4f46e5;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1a1a2e;">Payment Instructions</p>
        <p style="margin:0;font-size:13px;color:#555;line-height:1.5;">
          Please remit payment by the due date shown above. For questions regarding this invoice, reply directly to this email.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 40px;background:#f8f9fa;text-align:center;">
      <p style="margin:0;font-size:12px;color:#999;">Powered by Qwillio</p>
    </div>
  </div>
</body>
</html>`;
  }

  private renderReminderEmail(data: {
    businessName: string;
    customerName: string;
    invoiceNumber: string;
    totalAmount: number;
    currency: string;
    dueDate: Date;
    daysOverdue: number;
    urgencyLevel: 'friendly' | 'firm' | 'final';
  }): string {
    const urgencyStyles: Record<string, { headerBg: string; accentColor: string; borderColor: string }> = {
      friendly: { headerBg: '#1a1a2e', accentColor: '#4f46e5', borderColor: '#4f46e5' },
      firm: { headerBg: '#92400e', accentColor: '#d97706', borderColor: '#d97706' },
      final: { headerBg: '#991b1b', accentColor: '#dc2626', borderColor: '#dc2626' },
    };

    const style = urgencyStyles[data.urgencyLevel];

    const messageMap: Record<string, string> = {
      friendly: `This is a friendly reminder that invoice <strong>${data.invoiceNumber}</strong> was due on <strong>${this.formatDate(data.dueDate)}</strong> and is now overdue. We would appreciate your prompt attention to this matter.`,
      firm: `This is our second reminder regarding invoice <strong>${data.invoiceNumber}</strong>, which is now <strong>${data.daysOverdue} days past due</strong>. Please arrange payment at your earliest convenience to avoid any disruption to your services.`,
      final: `This is our final notice regarding invoice <strong>${data.invoiceNumber}</strong>, which is now <strong>${data.daysOverdue} days past due</strong>. Immediate payment is required. If payment has already been made, please disregard this notice and let us know so we can update our records.`,
    };

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:${style.headerBg};padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600;">${data.businessName}</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Payment Reminder</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px;">
      <p style="margin:0 0 16px;font-size:15px;color:#333;">Dear ${data.customerName},</p>
      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">${messageMap[data.urgencyLevel]}</p>

      <!-- Amount Box -->
      <div style="padding:20px;background:#f8f9fa;border-radius:6px;border-left:4px solid ${style.borderColor};margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;">Amount Due</p>
            <p style="margin:0;font-size:24px;font-weight:700;color:${style.accentColor};">${this.formatCurrency(data.totalAmount, data.currency)}</p>
          </div>
          <div style="text-align:right;">
            <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;">Days Overdue</p>
            <p style="margin:0;font-size:24px;font-weight:700;color:${style.accentColor};">${data.daysOverdue}</p>
          </div>
        </div>
      </div>

      <p style="margin:0;font-size:13px;color:#888;line-height:1.5;">
        If you have any questions about this invoice, please reply directly to this email. If payment has already been sent, we apologize for the reminder and kindly ask you to let us know.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 40px;background:#f8f9fa;text-align:center;">
      <p style="margin:0;font-size:12px;color:#999;">Powered by Qwillio</p>
    </div>
  </div>
</body>
</html>`;
  }
}

export const agentPaymentsService = new AgentPaymentsService();
