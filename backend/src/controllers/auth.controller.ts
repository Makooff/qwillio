import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { loginSchema, registerSchema } from '../utils/validators';
import { emailService } from '../services/email.service';
import { logger } from '../config/logger';

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
      });

      const refreshToken = jwt.sign({ id: user.id }, env.JWT_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      });

      // Look up linked Client for client-role users
      const client = user.role === 'client'
        ? await prisma.client.findUnique({ where: { userId: user.id }, select: { id: true } })
        : null;

      res.json({
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailConfirmed: user.emailConfirmed,
          onboardingCompleted: user.onboardingCompleted,
          clientId: client?.id || null,
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async register(req: Request, res: Response) {
    try {
      const { email, password, name } = registerSchema.parse(req.body);

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
      }

      const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
      const confirmationToken = crypto.randomUUID();

      // Auto-confirm email when using Resend test domain (can only deliver to verified address)
      const isTestEmail = env.RESEND_FROM_EMAIL.includes('resend.dev');
      const autoConfirm = isTestEmail;

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: 'client',
          confirmationToken: autoConfirm ? null : confirmationToken,
          emailConfirmed: autoConfirm,
          onboardingCompleted: false,
        },
      });

      const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
      });

      // Send confirmation email (skip if auto-confirmed)
      if (!autoConfirm) {
        const frontendUrl = env.FRONTEND_URL.split(',')[0].trim();
        const confirmUrl = `${frontendUrl}/auth/confirm?token=${confirmationToken}`;
        try {
          await emailService.sendConfirmationEmail({
            to: email,
            name,
            confirmUrl,
          });
          logger.info(`Confirmation email sent to ${email}`);
        } catch (emailErr) {
          logger.error('Failed to send confirmation email:', emailErr);
        }
      } else {
        logger.info(`Auto-confirmed email for ${email} (Resend test domain)`);
      }

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailConfirmed: user.emailConfirmed,
          onboardingCompleted: false,
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async confirmEmail(req: Request, res: Response) {
    try {
      const { token } = req.params;

      const user = await prisma.user.findUnique({
        where: { confirmationToken: token },
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired confirmation token' });
      }

      if (user.emailConfirmed) {
        // Already confirmed — just return a JWT so they can proceed
        const jwtToken = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
          expiresIn: env.JWT_EXPIRES_IN,
        });
        return res.json({
          message: 'Email already confirmed',
          token: jwtToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            emailConfirmed: true,
            onboardingCompleted: user.onboardingCompleted,
          },
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailConfirmed: true,
        },
      });

      const jwtToken = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
      });

      logger.info(`Email confirmed for user ${user.email}`);

      res.json({
        message: 'Email confirmed successfully',
        token: jwtToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailConfirmed: true,
          onboardingCompleted: user.onboardingCompleted,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async resendConfirmation(req: any, res: Response) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.emailConfirmed) {
        return res.json({ message: 'Email already confirmed' });
      }

      // Generate new token if none exists
      const confirmationToken = user.confirmationToken || crypto.randomUUID();
      if (!user.confirmationToken) {
        await prisma.user.update({
          where: { id: user.id },
          data: { confirmationToken },
        });
      }

      const frontendUrl = env.FRONTEND_URL.split(',')[0].trim();
      const confirmUrl = `${frontendUrl}/auth/confirm?token=${confirmationToken}`;
      await emailService.sendConfirmationEmail({
        to: user.email,
        name: user.name,
        confirmUrl,
      });

      logger.info(`Confirmation email resent to ${user.email}`);
      res.json({ message: 'Confirmation email sent' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async onboard(req: any, res: Response) {
    try {
      const { businessName, businessPhone, industry, website, planType } = req.body;

      if (!businessName || !planType) {
        return res.status(400).json({ error: 'Business name and plan are required' });
      }

      const PLAN_PRICING: Record<string, { setupFee: number; monthlyFee: number; callsQuota: number }> = {
        starter: { setupFee: 697, monthlyFee: 197, callsQuota: 200 },
        pro: { setupFee: 997, monthlyFee: 347, callsQuota: 500 },
        enterprise: { setupFee: 1497, monthlyFee: 497, callsQuota: 1000 },
      };

      const user = await prisma.user.update({
        where: { id: req.userId },
        data: {
          businessName,
          businessPhone: businessPhone || null,
          industry: industry || null,
          website: website || null,
          planType,
          onboardingCompleted: true,
        },
      });

      // Create a Client record for client-role users
      let clientId: string | null = null;
      if (user.role === 'client') {
        const dashboardToken = crypto.randomBytes(32).toString('hex');
        const pricing = PLAN_PRICING[planType] || PLAN_PRICING.pro;
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);

        const client = await prisma.client.create({
          data: {
            userId: user.id,
            businessName,
            businessType: industry || 'other',
            contactName: user.name,
            contactEmail: user.email,
            contactPhone: businessPhone || null,
            country: 'US',
            planType,
            setupFee: pricing.setupFee,
            monthlyFee: pricing.monthlyFee,
            currency: 'USD',
            dashboardToken,
            onboardingStatus: 'completed',
            subscriptionStatus: 'active',
            isTrial: true,
            trialStartDate: new Date(),
            trialEndDate: trialEnd,
            monthlyCallsQuota: pricing.callsQuota,
          },
        });
        clientId = client.id;
        logger.info(`Client record created for ${user.email} — clientId: ${client.id}`);
      }

      logger.info(`Onboarding completed for user ${user.email} — plan: ${planType}`);

      // Issue a fresh JWT with the correct role from DB
      const freshToken = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
      });

      res.json({
        message: 'Onboarding completed',
        token: freshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailConfirmed: user.emailConfirmed,
          onboardingCompleted: true,
          clientId,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async me(req: any, res: Response) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          emailConfirmed: true,
          onboardingCompleted: true,
          client: { select: { id: true } },
        },
      });

      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
      // Return a fresh JWT so stale tokens (wrong role) get auto-corrected
      const freshToken = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
      });
      const { client, ...rest } = user;
      res.json({ ...rest, clientId: client?.id || null, token: freshToken });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const authController = new AuthController();
