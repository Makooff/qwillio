import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service';
import { botLoop } from '../jobs/bot-loop';
import { prisma } from '../config/database';

export class DashboardController {
  // 7-day calls history, normalized so days with zero calls still appear
  async getCallsChart(_req: Request, res: Response) {
    try {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const rows = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT DATE_TRUNC('day', "startedAt") AS day, COUNT(*)::bigint AS count
        FROM "Call"
        WHERE "startedAt" >= ${start} AND "startedAt" <= ${end}
        GROUP BY 1
        ORDER BY 1 ASC
      `;
      const byDay = new Map<string, number>();
      for (const r of rows) {
        const key = r.day.toISOString().slice(0, 10);
        byDay.set(key, Number(r.count));
      }
      const data: Array<{ date: string; calls: number }> = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        data.push({ date: key, calls: byDay.get(key) ?? 0 });
      }
      res.json({ data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getStats(_req: Request, res: Response) {
    try {
      const [stats, botStatus] = await Promise.all([
        analyticsService.getDashboardStats(),
        botLoop.getStatus(),
      ]);

      const { crons } = botStatus;
      const toSvcStatus = (cronKey: string): 'running' | 'idle' | 'inactive' => {
        const s = (crons as Record<string, string>)[cronKey] ?? 'inactive';
        return s === 'active' ? 'running' : s === 'idle' ? 'idle' : 'inactive';
      };

      res.json({
        ...stats,
        servicesStatus: {
          prospection: toSvcStatus('prospection'),
          calling: toSvcStatus('calling'),
          reminders: toSvcStatus('reminders'),
          analytics: toSvcStatus('analytics'),
          dailyReset: toSvcStatus('dailyReset'),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getRevenueHistory(req: Request, res: Response) {
    try {
      const months = parseInt(req.query.months as string) || 6;
      const history = await analyticsService.getRevenueHistory(months);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getRecentActivity(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const activity = await analyticsService.getRecentActivity(limit);
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getCalls(req: Request, res: Response) {
    try {
      const { page = '1', limit = '25', outcome, minScore, search } = req.query as Record<string, string>;
      const result = await analyticsService.getCalls({
        page: parseInt(page),
        limit: parseInt(limit),
        outcome: outcome || undefined,
        minScore: minScore ? parseInt(minScore) : undefined,
        search: search || undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getLeads(req: Request, res: Response) {
    try {
      const { minScore = '6', limit = '50' } = req.query as Record<string, string>;
      const result = await analyticsService.getLeads({
        minScore: parseInt(minScore),
        limit: parseInt(limit),
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const dashboardController = new DashboardController();
