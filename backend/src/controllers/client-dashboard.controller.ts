import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { clientDashboardService } from '../services/client-dashboard.service';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class ClientDashboardController {

  // GET /api/client-portal/:clientId/overview
  async getOverview(req: Request, res: Response) {
    try {
      const overview = await clientDashboardService.getClientOverview(req.params.clientId as string);
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
      const result = await clientDashboardService.getClientCalls(req.params.clientId as string, page, limit, filters);
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
      const result = await clientDashboardService.getClientBookings(req.params.clientId as string, page, limit, upcoming);
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
      const result = await clientDashboardService.getClientLeads(req.params.clientId as string, page, limit);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/client-portal/:clientId/analytics
  async getAnalytics(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const result = await clientDashboardService.getClientAnalytics(req.params.clientId as string, days);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ JWT-protected endpoints (use req.clientId from clientMiddleware) ═══

  async getMyOverview(req: any, res: Response) {
    try {
      const overview = await clientDashboardService.getClientOverview(req.clientId);
      res.json(overview);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMyCalls(req: any, res: Response) {
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
      const result = await clientDashboardService.getClientCalls(req.clientId, page, limit, filters);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMyBookings(req: any, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const upcoming = req.query.upcoming !== 'false';
      const result = await clientDashboardService.getClientBookings(req.clientId, page, limit, upcoming);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMyLeads(req: any, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await clientDashboardService.getClientLeads(req.clientId, page, limit);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMyAnalytics(req: any, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const result = await clientDashboardService.getClientAnalytics(req.clientId, days);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Lead management ═══

  // PUT /my-dashboard/leads/:id/status
  async updateLeadStatus(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      // Verify the call belongs to this client
      const call = await prisma.clientCall.findFirst({
        where: { id, clientId: req.clientId },
      });
      if (!call) return res.status(404).json({ error: 'Lead not found' });

      const statusValues = ['new', 'contacted', 'converted', 'lost'];
      await prisma.clientCall.update({
        where: { id },
        data: { tags: { set: [...(call.tags || []).filter((t: string) => !statusValues.includes(t)), status] } },
      });
      res.json({ success: true, status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /my-dashboard/leads/:id/notes
  async updateLeadNotes(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const call = await prisma.clientCall.findFirst({
        where: { id, clientId: req.clientId },
      });
      if (!call) return res.status(404).json({ error: 'Lead not found' });

      await prisma.clientCall.update({
        where: { id },
        data: {
          metadata: {
            ...(typeof call.metadata === 'object' && call.metadata !== null ? call.metadata as Record<string, unknown> : {}),
            clientNotes: notes,
          },
        },
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Settings ═══

  // GET /my-dashboard/settings
  async getMySettings(req: any, res: Response) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: {
          businessName: true,
          businessType: true,
          sector: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          address: true,
          city: true,
          postalCode: true,
          country: true,
          transferNumber: true,
          vapiPhoneNumber: true,
          vapiConfig: true,
          vapiAssistantId: true,
          subscriptionStatus: true,
          planType: true,
          isTrial: true,
          trialEndDate: true,
          agentLanguage: true,
          agentName: true,
          forwardingStatus: true,
          forwardingType: true,
          forwardingVerifiedAt: true,
          monthlyCallsQuota: true,
          totalCallsMade: true,
          lastCallDate: true,
          activationDate: true,
          loomVideoUrl: true,
          googleCalendarId: true,
        },
      });
      if (!client) return res.status(404).json({ error: 'Client not found' });
      // Surface JSON-held knowledge fields at top level so the UI can bind
      // directly (items, hours, faq, personalityPreset, personalityNotes).
      const cfg = (client.vapiConfig as any) || {};
      res.json({
        ...client,
        items:             Array.isArray(cfg.items) ? cfg.items : [],
        hours:             cfg.hours && typeof cfg.hours === 'object' ? cfg.hours : null,
        faq:               cfg.faq               ?? '',
        personalityPreset: cfg.personalityPreset ?? 'warm',
        personalityNotes:  cfg.personalityNotes  ?? cfg.specialNotes ?? '',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /my-dashboard/settings
  async updateMySettings(req: any, res: Response) {
    try {
      const body = req.body;
      const updateData: any = {};
      if (body.transferNumber !== undefined) updateData.transferNumber = body.transferNumber || null;
      if (body.businessName !== undefined) updateData.businessName = body.businessName || null;
      if (body.businessType !== undefined) updateData.businessType = body.businessType || null;
      if (body.vapiPhoneNumber !== undefined) updateData.vapiPhoneNumber = body.vapiPhoneNumber || null;
      if (body.vapiConfig !== undefined) updateData.vapiConfig = body.vapiConfig;
      if (body.agentLanguage !== undefined) updateData.agentLanguage = body.agentLanguage;
      if (body.agentName !== undefined) updateData.agentName = body.agentName || null;
      if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone || null;
      if (body.address !== undefined) updateData.address = body.address || null;
      if (body.city !== undefined) updateData.city = body.city || null;
      if (body.postalCode !== undefined) updateData.postalCode = body.postalCode || null;
      if (body.forwardingType !== undefined) updateData.forwardingType = body.forwardingType || null;
      if (body.forwardingStatus !== undefined) {
        updateData.forwardingStatus = body.forwardingStatus || null;
        if (body.forwardingStatus === 'verified') {
          updateData.forwardingVerifiedAt = new Date();
        }
      }
      if (body.loomVideoUrl !== undefined) updateData.loomVideoUrl = body.loomVideoUrl || null;
      if (body.googleCalendarId !== undefined) updateData.googleCalendarId = body.googleCalendarId || null;

      // Merge knowledge-base fields into vapiConfig JSON so the IA has context.
      // - items  : structured list [{ category, name, price }]
      // - hours  : weekly schedule { monday: { open, from, to }, ... }
      // - faq    : free text (Q/A pairs)
      // - specialNotes : free text
      const hasKnowledgeUpdate =
        body.items !== undefined ||
        body.hours !== undefined ||
        body.faq !== undefined ||
        body.personalityPreset !== undefined ||
        body.personalityNotes !== undefined;
      if (hasKnowledgeUpdate) {
        const existing = await prisma.client.findUnique({
          where: { id: req.clientId },
          select: { vapiConfig: true },
        });
        const prev = (existing?.vapiConfig as any) || {};
        const next: any = { ...prev };
        // Drop legacy free-text keys that the new structured UI replaces.
        delete next.priceList;
        delete next.services;
        if (body.items !== undefined) {
          const arr = Array.isArray(body.items) ? body.items : [];
          next.items = arr.slice(0, 200).map((it: any) => ({
            id:       String(it?.id || Math.random().toString(36).slice(2, 10)),
            category: String(it?.category || 'service').slice(0, 40),
            name:     String(it?.name || '').slice(0, 200),
            price:    String(it?.price || '').slice(0, 80),
          }));
        }
        if (body.hours !== undefined) {
          if (body.hours && typeof body.hours === 'object' && !Array.isArray(body.hours)) {
            next.hours = body.hours;
          } else {
            next.hours = null;
          }
        }
        if (body.faq !== undefined) {
          next.faq = typeof body.faq === 'string' ? body.faq.slice(0, 8000) : '';
        }
        if (body.personalityPreset !== undefined) {
          const allowed = new Set(['warm','professional','casual','energetic','luxury','caring']);
          const v = String(body.personalityPreset || '');
          next.personalityPreset = allowed.has(v) ? v : 'warm';
        }
        if (body.personalityNotes !== undefined) {
          next.personalityNotes = typeof body.personalityNotes === 'string' ? body.personalityNotes.slice(0, 4000) : '';
          delete next.specialNotes;  // legacy key superseded
        }
        updateData.vapiConfig = next;
      }

      const client = await prisma.client.update({
        where: { id: req.clientId },
        data: updateData,
      });

      // Auto-sync VAPI assistant within 60s of settings change
      if (client.vapiAssistantId) {
        try {
          const { onboardingService } = await import('../services/onboarding.service');
          await onboardingService.syncVapiAssistant(client.id);
          logger.info(`VAPI assistant synced for client ${client.id}`);
        } catch (err) {
          logger.warn(`Failed to sync VAPI assistant for client ${client.id}:`, err);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /my-dashboard/pause
  async pauseAgent(req: any, res: Response) {
    try {
      await prisma.client.update({
        where: { id: req.clientId },
        data: { subscriptionStatus: 'paused' },
      });
      res.json({ success: true, status: 'paused' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /my-dashboard/resume
  async resumeAgent(req: any, res: Response) {
    try {
      const client = await prisma.client.findUnique({ where: { id: req.clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });
      const status = client.isTrial ? 'trialing' : 'active';
      await prisma.client.update({
        where: { id: req.clientId },
        data: { subscriptionStatus: status },
      });
      res.json({ success: true, status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Account ═══

  // PUT /my-dashboard/profile
  async updateProfile(req: any, res: Response) {
    try {
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

      await prisma.user.update({
        where: { id: req.userId },
        data: { name: name.trim() },
      });

      // Also update client contact name
      await prisma.client.update({
        where: { id: req.clientId },
        data: { contactName: name.trim() },
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /my-dashboard/password
  async changePassword(req: any, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Both passwords required' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (!user.passwordHash) return res.status(401).json({ error: 'Password not set. Please use Google login or reset your password.' });
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });

      const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
      await prisma.user.update({
        where: { id: req.userId },
        data: { passwordHash },
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /my-dashboard/billing
  async getBilling(req: any, res: Response) {
    try {
      const payments = await prisma.payment.findMany({
        where: { clientId: req.clientId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /my-dashboard/cancel
  async cancelSubscription(req: any, res: Response) {
    try {
      await prisma.client.update({
        where: { id: req.clientId },
        data: {
          subscriptionStatus: 'cancelled',
          cancellationDate: new Date(),
        },
      });
      logger.info(`[CANCEL] Client ${req.clientId} cancelled subscription`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Support ═══

  // POST /my-dashboard/support
  async sendSupport(req: any, res: Response) {
    try {
      const { subject, message } = req.body;
      if (!subject?.trim() || !message?.trim()) {
        return res.status(400).json({ error: 'Subject and message are required' });
      }

      // Get user + client info
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      const client = await prisma.client.findUnique({ where: { id: req.clientId } });

      // Log the support request (email sending may fail if Resend not configured with custom domain)
      logger.info(`[SUPPORT] From ${user?.email} (${client?.businessName}): ${subject}`);

      // Try to send email via Resend
      try {
        const { emailService } = await import('../services/email.service');
        await (emailService as any).sendRaw?.({
          to: env.RESEND_REPLY_TO || 'contact@qwillio.com',
          subject: `[Support] ${subject} — ${client?.businessName || user?.email}`,
          html: `
            <h3>Support request from ${user?.name} (${user?.email})</h3>
            <p><strong>Business:</strong> ${client?.businessName}</p>
            <p><strong>Plan:</strong> ${client?.planType}</p>
            <hr/>
            <p>${message.replace(/\n/g, '<br/>')}</p>
          `,
        });
      } catch {
        // Email sending is best-effort; the request is logged above
        logger.warn('[SUPPORT] Email sending failed — support request still logged');
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const clientDashboardController = new ClientDashboardController();
