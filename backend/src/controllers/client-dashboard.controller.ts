import { Request, Response } from 'express';
import { clientDashboardService } from '../services/client-dashboard.service';

export class ClientDashboardController {

  // GET /api/client-portal/:clientId/overview
  async getOverview(req: Request, res: Response) {
    try {
      const overview = await clientDashboardService.getClientOverview(req.params.clientId);
      res.json(overview);
    } catch (error: any) {
      if (error.message === 'Client not found') {
        return res.status(404).json({ error: 'Client not found' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/client-portal/:clientId/calls
  async getCalls(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filters = {
        status: req.query.status as string | undefined,
        sentiment: req.query.sentiment as string | undefined,
        isLead: req.query.isLead === 'true' ? true : req.query.isLead === 'false' ? false : undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };
      const result = await clientDashboardService.getClientCalls(req.params.clientId, page, limit, filters);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/client-portal/:clientId/bookings
  async getBookings(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const upcoming = req.query.upcoming !== 'false';
      const result = await clientDashboardService.getClientBookings(req.params.clientId, page, limit, upcoming);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/client-portal/:clientId/leads
  async getLeads(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await clientDashboardService.getClientLeads(req.params.clientId, page, limit);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/client-portal/:clientId/analytics
  async getAnalytics(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const result = await clientDashboardService.getClientAnalytics(req.params.clientId, days);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const clientDashboardController = new ClientDashboardController();
