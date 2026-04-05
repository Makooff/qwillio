import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service';
import { botLoop } from '../jobs/bot-loop';

export class DashboardController {
  async getStats(_req: Request, res: Response) {
    try {
      const [stats, botStatus] = await Promise.all([
        analyticsService.getDashboardV2(),
        botLoop.getStatus(),
      ]);

      const { crons } = botStatus;
      const toSvcStatus = (s: string): 'running' | 'idle' | 'inactive' =>
        s === 'active' ? 'running' : s === 'idle' ? 'idle' : 'inactive';

      res.json({
        ...stats,
        servicesStatus: {
          prospection: toSvcStatus(crons.prospection),
          calling: toSvcStatus(crons.calling),
          reminders: toSvcStatus(crons.reminders),
          analytics: toSvcStatus(crons.analytics),
          dailyReset: toSvcStatus(crons.dailyReset),
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
