import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { quoteService } from '../services/quote.service';

export class QuotesController {
  async list(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;

      const where: any = {};
      if (status) where.status = status;

      const [quotes, total] = await Promise.all([
        prisma.quote.findMany({
          where,
          include: { prospect: { select: { businessName: true, contactName: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.quote.count({ where }),
      ]);

      res.json({
        data: quotes,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const quote = await prisma.quote.findUnique({
        where: { id: req.params.id },
        include: { prospect: true },
      });
      if (!quote) return res.status(404).json({ error: 'Devis non trouvé' });
      res.json(quote);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async sendManual(req: Request, res: Response) {
    try {
      const { prospectId, packageType, email } = req.body;
      const quote = await quoteService.generateAndSendQuote(prospectId, packageType, email);
      res.json({ message: 'Devis envoyé', quote });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export const quotesController = new QuotesController();
