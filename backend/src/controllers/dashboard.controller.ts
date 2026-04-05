import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service';
import { botLoop } from '../jobs/bot-loop';

export class DashboardController {
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

      // Override the statically-computed servicesStatus with real cron states
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
}

export const dashboardController = new DashboardController();
