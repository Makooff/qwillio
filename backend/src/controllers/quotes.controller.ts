import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { quoteService } from '../services/quote.service';
import { docuSignService } from '../services/docusign.service';

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
        where: { id: req.params.id as string },
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

  async getContractStatus(req: Request, res: Response) {
    try {
      const status = await docuSignService.getContractStatus(req.params.id as string);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async resendContract(req: Request, res: Response) {
    try {
      const sent = await docuSignService.resendContract(req.params.id as string);
      if (sent) {
        res.json({ message: 'Contract resent via DocuSign' });
      } else {
        res.status(400).json({ error: 'Could not resend contract (already signed or DocuSign not configured)' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const quotesController = new QuotesController();
