import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { createCampaignSchema } from '../utils/validators';
import { emailService } from '../services/email.service';
import { logger } from '../config/logger';
import { Prisma } from '@prisma/client';

export class CampaignsController {
  async list(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const [campaigns, total] = await Promise.all([
        prisma.campaign.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.campaign.count(),
      ]);

      res.json({
        data: campaigns,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req: any, res: Response) {
    try {
      const data = createCampaignSchema.parse(req.body);

      const campaign = await prisma.campaign.create({
        data: {
          name: data.name,
          type: data.type,
          targetBusinessTypes: data.targetBusinessTypes || [],
          targetCities: data.targetCities || [],
          targetMinScore: data.targetMinScore,
          targetMaxScore: data.targetMaxScore,
          targetStatuses: data.targetStatuses || [],
          subjectLine: data.subjectLine,
          messageTemplate: data.messageTemplate,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
          status: data.scheduledDate ? 'scheduled' : 'draft',
          createdByUserId: req.userId,
        },
      });

      res.status(201).json(campaign);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id as string },
        include: {
          sends: {
            include: { prospect: { select: { businessName: true, email: true } } },
            take: 100,
          },
        },
      });

      if (!campaign) return res.status(404).json({ error: 'Campagne non trouvée' });
      res.json(campaign);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async launch(req: Request, res: Response) {
    try {
      const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id as string } });
      if (!campaign) return res.status(404).json({ error: 'Campagne non trouvée' });

      // Build prospect query based on targeting
      const where: Prisma.ProspectWhereInput = { email: { not: null } };

      if (campaign.targetBusinessTypes.length > 0) {
        where.businessType = { in: campaign.targetBusinessTypes };
      }
      if (campaign.targetCities.length > 0) {
        where.city = { in: campaign.targetCities };
      }
      if (campaign.targetMinScore) {
        where.score = { ...((where.score as any) || {}), gte: campaign.targetMinScore };
      }
      if (campaign.targetMaxScore) {
        where.score = { ...((where.score as any) || {}), lte: campaign.targetMaxScore };
      }
      if (campaign.targetStatuses.length > 0) {
        where.status = { in: campaign.targetStatuses };
      }

      const prospects = await prisma.prospect.findMany({ where });

      // Update campaign status
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'running' },
      });

      let sentCount = 0;

      for (const prospect of prospects) {
        if (!prospect.email) continue;

        try {
          // Replace template variables
          const html = campaign.messageTemplate
            .replace(/\{\{business_name\}\}/g, prospect.businessName)
            .replace(/\{\{contact_name\}\}/g, prospect.contactName || prospect.businessName)
            .replace(/\{\{city\}\}/g, prospect.city || '')
            .replace(/\{\{business_type\}\}/g, prospect.businessType);

          const subject = (campaign.subjectLine || 'Special offer from Qwillio')
            .replace(/\{\{business_name\}\}/g, prospect.businessName);

          // Create send record
          await prisma.campaignSend.create({
            data: {
              campaignId: campaign.id,
              prospectId: prospect.id,
              status: 'sent',
              sentAt: new Date(),
            },
          });

          sentCount++;
        } catch (err) {
          logger.error(`Campaign send error for ${prospect.email}:`, err);
        }
      }

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: 'completed',
          sentCount,
          completedAt: new Date(),
        },
      });

      res.json({ message: `Campagne lancée: ${sentCount} emails envoyés`, sentCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await prisma.campaign.delete({ where: { id: req.params.id as string } });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export const campaignsController = new CampaignsController();
