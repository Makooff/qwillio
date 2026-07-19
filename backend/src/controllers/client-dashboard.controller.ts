import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { clientDashboardService } from '../services/client-dashboard.service';
import { googleCalendarService } from '../services/google-calendar.service';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { listCharacters, DEFAULT_CHARACTER_FR, DEFAULT_CHARACTER_EN } from '../config/voice-characters';
import { buildVapiConfigPatch } from '../services/client-config.service';

// OAuth state: per-user, signed, short-lived — the callback verifies it was
// minted for the same client that finishes the flow (CSRF protection).
const GCAL_STATE_PREFIX = 'qwillio-gcal.';

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
        isSpam: req.query.isSpam === 'true' ? true : undefined,
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
        isSpam: req.query.isSpam === 'true' ? true : undefined,
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
          monthlyMinutesQuota: true,
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
      const isFrench = (client as any).agentLanguage === 'fr'
        || ['FR', 'BE', 'LU', 'MC', 'CH'].includes(String((client as any).country || '').toUpperCase());
      res.json({
        ...client,
        items:             Array.isArray(cfg.items) ? cfg.items : [],
        hours:             cfg.hours && typeof cfg.hours === 'object' ? cfg.hours : null,
        faq:               cfg.faq               ?? '',
        personalityPreset: cfg.personalityPreset ?? 'warm',
        personalityNotes:  cfg.personalityNotes  ?? cfg.specialNotes ?? '',
        characterId:       cfg.characterId ?? (isFrench ? DEFAULT_CHARACTER_FR : DEFAULT_CHARACTER_EN),
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
        const allowedStatuses = ['pending', 'active', 'inactive', 'failed'];
        if (body.forwardingStatus && !allowedStatuses.includes(body.forwardingStatus)) {
          return res.status(400).json({ error: 'Invalid forwardingStatus' });
        }
        updateData.forwardingStatus = body.forwardingStatus || null;
        // forwardingVerifiedAt is set only by server-side verification, never by the client
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
        body.personalityNotes !== undefined ||
        body.characterId !== undefined;
      if (hasKnowledgeUpdate) {
        const existing = await prisma.client.findUnique({
          where: { id: req.clientId },
          select: { vapiConfig: true },
        });
        const prev = (existing?.vapiConfig as any) || {};
        updateData.vapiConfig = buildVapiConfigPatch(prev, {
          items:             body.items,
          hours:             body.hours,
          faq:               body.faq,
          personalityPreset: body.personalityPreset,
          personalityNotes:  body.personalityNotes,
          characterId:       body.characterId,
        });
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

  // GET /my-dashboard/characters — receptionist character catalog for the picker
  async getCharacters(_req: any, res: Response) {
    try {
      res.json({ characters: listCharacters() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /my-dashboard/assistant/chat — conversational config/onboarding assistant
  async assistantChat(req: any, res: Response) {
    try {
      const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const messages = raw
        .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-20)
        .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
      if (!messages.length) return res.status(400).json({ error: 'messages required' });

      const { assistantChatService } = await import('../services/assistant-chat.service');
      const result = await assistantChatService.chat(req.clientId, messages);
      res.json(result);
    } catch (error: any) {
      logger.error('assistantChat failed:', error);
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

  // ═══ Billing ═══

  // POST /my-dashboard/upgrade
  async upgradeSubscription(req: any, res: Response) {
    try {
      const { planType } = req.body;
      const validPlans = ['solo', 'starter', 'pro', 'enterprise'];
      if (!validPlans.includes(planType)) return res.status(400).json({ error: 'Invalid plan' });

      const client = await prisma.client.findUnique({ where: { id: req.clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });
      if (client.planType === planType) return res.status(400).json({ error: 'Already on this plan' });

      const { stripeService } = await import('../services/stripe.service');
      const checkoutUrl = await stripeService.createUpgradeCheckout(client, planType);
      res.json({ success: true, checkoutUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Agent modules ═══

  // PUT /my-dashboard/agent-modules
  async updateAgentModules(req: any, res: Response) {
    try {
      const { modules } = req.body;
      if (!Array.isArray(modules)) return res.status(400).json({ error: 'modules must be an array' });

      const client = await prisma.client.findUnique({ where: { id: req.clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const current = (client.vapiConfig as Record<string, unknown>) ?? {};
      await prisma.client.update({
        where: { id: req.clientId },
        data: {
          vapiConfig: {
            ...current,
            agentModules: modules.map((m: any) => ({ id: String(m.id || '').slice(0, 64), enabled: Boolean(m.enabled) })),
          },
        },
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Notifications ═══

  // PUT /my-dashboard/notifications
  async updateNotifications(req: any, res: Response) {
    try {
      const { notifEmail, notifWeekly, notifLeads, notifQuota } = req.body;
      const client = await prisma.client.findUnique({ where: { id: req.clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const current = (client.vapiConfig as Record<string, unknown>) ?? {};
      await prisma.client.update({
        where: { id: req.clientId },
        data: {
          vapiConfig: {
            ...current,
            notifications: { notifEmail, notifWeekly, notifLeads, notifQuota },
          },
        },
      });
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
            <p>${message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g, '<br/>')}</p>
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

  // ═══ Google Calendar integration (OAuth) ═══════════════════════════

  // GET /api/my-dashboard/integrations/google-calendar/auth-url
  async getGoogleCalendarAuthUrl(req: any, res: Response) {
    try {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        return res.status(503).json({ error: 'Google OAuth non configuré côté serveur' });
      }
      const state = GCAL_STATE_PREFIX + jwt.sign({ gcal: req.clientId }, env.JWT_SECRET, { expiresIn: '15m' });
      const url = googleCalendarService.getConnectUrl(state);
      res.json({ url });
    } catch (error: any) {
      logger.error('GCal auth-url error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/my-dashboard/integrations/google-calendar/callback  { code, state }
  async connectGoogleCalendar(req: any, res: Response) {
    try {
      const { code, state } = req.body as { code?: string; state?: string };
      if (!code) return res.status(400).json({ error: 'Code OAuth manquant' });
      if (!state || !state.startsWith(GCAL_STATE_PREFIX)) {
        return res.status(400).json({ error: 'State OAuth invalide' });
      }
      let statePayload: any;
      try {
        statePayload = jwt.verify(state.slice(GCAL_STATE_PREFIX.length), env.JWT_SECRET);
      } catch {
        return res.status(400).json({ error: 'State OAuth invalide ou expiré' });
      }
      if (statePayload?.gcal !== req.clientId) {
        return res.status(400).json({ error: 'State OAuth invalide' });
      }

      const refreshToken = await googleCalendarService.exchangeCode(code);
      await prisma.client.update({
        where: { id: req.clientId },
        data: {
          googleCalendarRefreshToken: refreshToken,
          googleCalendarId: 'primary',
        },
      });
      logger.info(`Google Calendar connected for client ${req.clientId}`);
      res.json({ connected: true });
    } catch (error: any) {
      logger.error('GCal connect error:', error);
      res.status(500).json({ error: 'Échec de la connexion Google Calendar' });
    }
  }

  // GET /api/my-dashboard/integrations/google-calendar/status
  async googleCalendarStatus(req: any, res: Response) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { googleCalendarRefreshToken: true, googleCalendarId: true },
      });
      if (!client?.googleCalendarRefreshToken) {
        return res.json({ connected: false });
      }
      try {
        const upcoming = await googleCalendarService.listUpcomingEvents(
          client.googleCalendarRefreshToken,
          client.googleCalendarId || 'primary',
          3,
        );
        res.json({ connected: true, calendarId: client.googleCalendarId || 'primary', upcoming });
      } catch (err: any) {
        // Only treat auth failures as revocation; transient errors keep the
        // integration connected without the events preview.
        const authFailure = /invalid_grant|invalid_rapt|unauthorized|\b40[13]\b/i.test(String(err?.message || ''));
        if (authFailure) {
          res.json({ connected: false, revoked: true });
        } else {
          res.json({ connected: true, calendarId: client.googleCalendarId || 'primary', upcoming: [], previewUnavailable: true });
        }
      }
    } catch (error: any) {
      logger.error('GCal status error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/my-dashboard/integrations/google-calendar
  async disconnectGoogleCalendar(req: any, res: Response) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { googleCalendarRefreshToken: true },
      });
      if (client?.googleCalendarRefreshToken) {
        await googleCalendarService.revokeToken(client.googleCalendarRefreshToken);
      }
      await prisma.client.update({
        where: { id: req.clientId },
        data: { googleCalendarRefreshToken: null, googleCalendarId: null },
      });
      res.json({ connected: false });
    } catch (error: any) {
      logger.error('GCal disconnect error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const clientDashboardController = new ClientDashboardController();
