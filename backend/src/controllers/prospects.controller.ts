import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { prospectQuerySchema } from '../utils/validators';
import { Prisma } from '@prisma/client';

export class ProspectsController {
  async list(req: Request, res: Response) {
    try {
      const query = prospectQuerySchema.parse(req.query);
      const where: Prisma.ProspectWhereInput = {};

      if (query.status) where.status = query.status;
      if (query.businessType) where.businessType = query.businessType;
      if (query.city) where.city = query.city;
      if (query.minScore !== undefined) where.score = { ...((where.score as any) || {}), gte: query.minScore };
      if (query.maxScore !== undefined) where.score = { ...((where.score as any) || {}), lte: query.maxScore };
      if (query.search) {
        where.OR = [
          { businessName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { contactName: { contains: query.search, mode: 'insensitive' } },
          { city: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const [prospects, total] = await Promise.all([
        prisma.prospect.findMany({
          where,
          orderBy: { [query.sortBy]: query.sortOrder },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.prospect.count({ where }),
      ]);

      res.json({
        data: prospects,
        pagination: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const prospect = await prisma.prospect.findUnique({
        where: { id: req.params.id },
        include: {
          calls: { orderBy: { createdAt: 'desc' }, take: 10 },
          quotes: { orderBy: { createdAt: 'desc' } },
        },
      });

      if (!prospect) return res.status(404).json({ error: 'Prospect non trouvé' });
      res.json(prospect);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const prospect = await prisma.prospect.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json(prospect);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await prisma.prospect.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getStats(_req: Request, res: Response) {
    try {
      const [total, byStatus, byCity, byType] = await Promise.all([
        prisma.prospect.count(),
        prisma.prospect.groupBy({ by: ['status'], _count: { id: true } }),
        prisma.prospect.groupBy({ by: ['city'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
        prisma.prospect.groupBy({ by: ['businessType'], _count: { id: true } }),
      ]);

      res.json({ total, byStatus, byCity, byType });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const prospectsController = new ProspectsController();
