import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { resend } from '../config/resend';
import { env } from '../config/env';
import { discordService } from './discord.service';
import { Decimal } from '@prisma/client/runtime/library';

const REORDER_COOLDOWN_DAYS = 7;

export class AgentInventoryService {

  // ═══════════════════════════════════════════
  // RECORD USAGE — Decrement stock
  // ═══════════════════════════════════════════

  async recordUsage(inventoryId: string, quantity: number, note?: string) {
    const item = await prisma.agentInventory.findUniqueOrThrow({
      where: { id: inventoryId },
    });

    const currentQty = Number(item.quantity);
    if (quantity > currentQty) {
      throw new Error(
        `Insufficient stock for "${item.productName}": requested ${quantity}, available ${currentQty}`
      );
    }

    const newQty = currentQty - quantity;

    const [updated] = await prisma.$transaction([
      prisma.agentInventory.update({
        where: { id: inventoryId },
        data: { quantity: newQty },
      }),
      prisma.agentInventoryLog.create({
        data: {
          inventoryId,
          clientId: item.clientId,
          changeType: 'usage',
          quantityChange: new Decimal(-quantity),
          quantityAfter: new Decimal(newQty),
          note: note || null,
        },
      }),
    ]);

    return updated;
  }

  // ═══════════════════════════════════════════
  // RECORD RESTOCK — Increment stock
  // ═══════════════════════════════════════════

  async recordRestock(inventoryId: string, quantity: number, note?: string) {
    const item = await prisma.agentInventory.findUniqueOrThrow({
      where: { id: inventoryId },
    });

    const newQty = Number(item.quantity) + quantity;

    const [updated] = await prisma.$transaction([
      prisma.agentInventory.update({
        where: { id: inventoryId },
        data: {
          quantity: newQty,
          lastOrderedAt: new Date(),
        },
      }),
      prisma.agentInventoryLog.create({
        data: {
          inventoryId,
          clientId: item.clientId,
          changeType: 'restock',
          quantityChange: new Decimal(quantity),
          quantityAfter: new Decimal(newQty),
          note: note || null,
        },
      }),
    ]);

    return updated;
  }

  // ═══════════════════════════════════════════
  // CHECK LOW STOCK
  // ═══════════════════════════════════════════

  async checkLowStock(clientId: string) {
    const items = await prisma.agentInventory.findMany({
      where: {
        clientId,
        minThreshold: { not: null },
      },
    });

    return items
      .filter((item) => {
        if (!item.minThreshold) return false;
        return Number(item.quantity) <= Number(item.minThreshold);
      })
      .map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: Number(item.quantity),
        minThreshold: Number(item.minThreshold),
        daysUntilEmpty: item.daysUntilEmpty,
      }));
  }

  // ═══════════════════════════════════════════
  // PROCESS AUTO-REORDERS — CRON entry point
  // ═══════════════════════════════════════════

  async processAutoReorders(): Promise<void> {
    const subscriptions = await prisma.agentSubscription.findMany({
      where: { inventoryAi: true, status: 'active' },
      include: { client: true },
    });

    for (const sub of subscriptions) {
      try {
        await this.processClientReorders(sub.clientId, sub.client.businessName);
      } catch (error) {
        logger.error(`Auto-reorder failed for client ${sub.clientId}:`, error);
      }
    }
  }

  private async processClientReorders(clientId: string, businessName: string): Promise<void> {
    const items = await prisma.agentInventory.findMany({
      where: {
        clientId,
        autoOrder: true,
        supplierEmail: { not: null },
        minThreshold: { not: null },
      },
    });

    const lowStockItems = items.filter(
      (item) => item.minThreshold && Number(item.quantity) <= Number(item.minThreshold)
    );

    for (const item of lowStockItems) {
      try {
        // Guard: skip if a reorder was already sent in the last 7 days
        const cooldownDate = new Date();
        cooldownDate.setDate(cooldownDate.getDate() - REORDER_COOLDOWN_DAYS);

        const recentReorder = await prisma.agentReorderRequest.findFirst({
          where: {
            inventoryId: item.id,
            status: 'sent',
            sentAt: { gte: cooldownDate },
          },
        });

        if (recentReorder) {
          logger.debug(`Skipping reorder for "${item.productName}" — sent ${recentReorder.sentAt.toISOString()}`);
          continue;
        }

        // Calculate suggested reorder quantity (2x threshold or 2x avg daily * 30)
        const suggestedQty = item.minThreshold
          ? Number(item.minThreshold) * 2
          : 10;

        // GPT-4 compose reorder email
        const emailContent = await this.composeReorderEmail({
          businessName,
          productName: item.productName,
          currentStock: Number(item.quantity),
          unit: item.unit || 'units',
          suggestedQty,
        });

        if (!emailContent) {
          logger.error(`Failed to compose reorder email for "${item.productName}"`);
          continue;
        }

        // Send via Resend
        await resend.emails.send({
          from: `${businessName} <noreply@qwillio.com>`,
          to: item.supplierEmail!,
          subject: emailContent.subject,
          html: emailContent.body.replace(/\n/g, '<br>'),
        });

        // Create reorder request record
        await prisma.agentReorderRequest.create({
          data: {
            inventoryId: item.id,
            clientId,
            supplierEmail: item.supplierEmail!,
            quantity: new Decimal(suggestedQty),
            emailBody: emailContent.body,
            status: 'sent',
            sentAt: new Date(),
          },
        });

        await discordService.notify(
          `📦 Auto-reorder sent for **${item.productName}** (${businessName}) → ${item.supplierEmail} — qty: ${suggestedQty} ${item.unit || 'units'}`
        );

        logger.info(`Reorder email sent for "${item.productName}" to ${item.supplierEmail}`);
      } catch (error) {
        logger.error(`Reorder failed for item "${item.productName}":`, error);
      }
    }
  }

  private async composeReorderEmail(params: {
    businessName: string;
    productName: string;
    currentStock: number;
    unit: string;
    suggestedQty: number;
  }): Promise<{ subject: string; body: string } | null> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo',
          messages: [
            {
              role: 'system',
              content: `You are writing a reorder email from ${params.businessName} to a supplier. Product: ${params.productName}, current stock: ${params.currentStock} ${params.unit}, reorder quantity: ${params.suggestedQty}. Write a brief, professional email requesting a reorder. Return JSON: {"subject": "...", "body": "..."}`,
            },
            {
              role: 'user',
              content: 'Compose the reorder email now.',
            },
          ],
          temperature: 0.4,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await response.json() as any;
      const result = JSON.parse(data.choices[0].message.content);
      return { subject: result.subject, body: result.body };
    } catch (error) {
      logger.error('GPT reorder email composition failed:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════
  // FORECAST DEMAND — Per client
  // ═══════════════════════════════════════════

  async forecastDemand(clientId: string): Promise<void> {
    const items = await prisma.agentInventory.findMany({
      where: { clientId },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const item of items) {
      try {
        const usageLogs = await prisma.agentInventoryLog.findMany({
          where: {
            inventoryId: item.id,
            changeType: 'usage',
            createdAt: { gte: thirtyDaysAgo },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (usageLogs.length === 0) {
          await prisma.agentInventory.update({
            where: { id: item.id },
            data: {
              avgDailyUsage: null,
              daysUntilEmpty: null,
            },
          });
          continue;
        }

        // Total usage (quantityChange is negative for usage, take absolute)
        const totalUsage = usageLogs.reduce(
          (sum, log) => sum + Math.abs(Number(log.quantityChange)),
          0
        );

        // Days covered = from first usage log to now
        const firstLog = usageLogs[0];
        const daysCovered = Math.max(
          1,
          (Date.now() - firstLog.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        const avgDailyUsage = totalUsage / daysCovered;
        const currentQty = Number(item.quantity);
        const daysUntilEmpty = avgDailyUsage > 0
          ? Math.floor(currentQty / avgDailyUsage)
          : null;

        await prisma.agentInventory.update({
          where: { id: item.id },
          data: {
            avgDailyUsage: new Decimal(avgDailyUsage.toFixed(2)),
            daysUntilEmpty,
          },
        });
      } catch (error) {
        logger.error(`Forecast failed for item "${item.productName}":`, error);
      }
    }
  }

  // ═══════════════════════════════════════════
  // PROCESS ALL FORECASTS — CRON entry point
  // ═══════════════════════════════════════════

  async processAllForecasts(): Promise<void> {
    const subscriptions = await prisma.agentSubscription.findMany({
      where: { inventoryAi: true, status: 'active' },
      select: { clientId: true },
    });

    for (const sub of subscriptions) {
      try {
        await this.forecastDemand(sub.clientId);
      } catch (error) {
        logger.error(`Forecast processing failed for client ${sub.clientId}:`, error);
      }
    }
  }

  // ═══════════════════════════════════════════
  // INVENTORY REPORT
  // ═══════════════════════════════════════════

  async getInventoryReport(clientId: string) {
    const items = await prisma.agentInventory.findMany({
      where: { clientId },
      orderBy: { productName: 'asc' },
    });

    const report = await Promise.all(
      items.map(async (item) => {
        const reorderHistory = await prisma.agentReorderRequest.findMany({
          where: { inventoryId: item.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        const isBelowThreshold =
          item.minThreshold !== null && Number(item.quantity) <= Number(item.minThreshold);

        return {
          id: item.id,
          productName: item.productName,
          quantity: Number(item.quantity),
          unit: item.unit,
          minThreshold: item.minThreshold ? Number(item.minThreshold) : null,
          avgDailyUsage: item.avgDailyUsage ? Number(item.avgDailyUsage) : null,
          daysUntilEmpty: item.daysUntilEmpty,
          autoOrder: item.autoOrder,
          supplierEmail: item.supplierEmail,
          belowThreshold: isBelowThreshold,
          reorderHistory: reorderHistory.map((r) => ({
            id: r.id,
            quantity: Number(r.quantity),
            status: r.status,
            sentAt: r.sentAt,
            supplierEmail: r.supplierEmail,
          })),
        };
      })
    );

    const alerts = report.filter((item) => item.belowThreshold);

    return { items: report, alerts };
  }

  // ═══════════════════════════════════════════
  // LIST REORDERS — Paginated
  // ═══════════════════════════════════════════

  async listReorders(clientId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [reorders, total] = await prisma.$transaction([
      prisma.agentReorderRequest.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.agentReorderRequest.count({
        where: { clientId },
      }),
    ]);

    return {
      data: reorders.map((r) => ({
        id: r.id,
        inventoryId: r.inventoryId,
        supplierEmail: r.supplierEmail,
        quantity: Number(r.quantity),
        emailBody: r.emailBody,
        status: r.status,
        sentAt: r.sentAt,
        createdAt: r.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const agentInventoryService = new AgentInventoryService();
