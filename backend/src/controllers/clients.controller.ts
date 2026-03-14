import { Request, Response } from 'express';
import { prisma } from '../config/database';

export class ClientsController {
  async list(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const planType = req.query.planType as string;

      const where: any = {};
      if (status) where.subscriptionStatus = status;
      if (planType) where.planType = planType;

      const [clients, total] = await Promise.all([
        prisma.client.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.client.count({ where }),
      ]);

      res.json({
        data: clients,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.params.id as string },
        include: {
          payments: { orderBy: { createdAt: 'desc' }, take: 20 },
          quote: true,
        },
      });

      if (!client) return res.status(404).json({ error: 'Client not found' });
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const client = await prisma.client.update({
        where: { id: req.params.id as string },
        data: req.body,
      });
      res.json(client);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getStats(_req: Request, res: Response) {
    try {
      const [total, active, trialing, trialExpired, byPlan, mrr] = await Promise.all([
        prisma.client.count(),
        prisma.client.count({ where: { subscriptionStatus: 'active' } }),
        prisma.client.count({ where: { subscriptionStatus: 'trialing' } }),
        prisma.client.count({ where: { subscriptionStatus: 'trial_expired' } }),
        prisma.client.groupBy({ by: ['planType'], where: { subscriptionStatus: { in: ['active', 'trialing'] } }, _count: { id: true } }),
        prisma.client.aggregate({ where: { subscriptionStatus: 'active' }, _sum: { monthlyFee: true } }),
      ]);

      res.json({
        total,
        active,
        trialing,
        trialExpired,
        byPlan,
        mrr: Number(mrr._sum.monthlyFee || 0),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const clientsController = new ClientsController();
