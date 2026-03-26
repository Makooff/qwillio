import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { loginSchema, registerSchema } from '../utils/validators';
import { emailService } from '../services/email.service';
import { logger } from '../config/logger';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      if (!user.passwordHash) {
        return res.status(401).json({ error: 'Ce compte utilise Google Sign-In. Connectez-vous avec Google.' });
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
      const token = req.params.token as string;

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
        starter: { setupFee: 0, monthlyFee: 497, callsQuota: 800 },
        pro: { setupFee: 0, monthlyFee: 1297, callsQuota: 2000 },
        enterprise: { setupFee: 0, monthlyFee: 2497, callsQuota: 4000 },
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

      // Create or reuse Client record (idempotent — safe if user retries onboarding)
      let clientId: string | null = null;
      if (user.role === 'client') {
        const existing = await prisma.client.findUnique({ where: { userId: user.id } });
        if (existing) {
          clientId = existing.id;
          logger.info(`Client record already exists for ${user.email} — reusing clientId: ${existing.id}`);
        } else {
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

  async googleAuth(req: Request, res: Response) {
    try {
      const { credential, access_token } = req.body;
      if (!credential && !access_token) {
        return res.status(400).json({ error: 'Google credential required' });
      }

      let payload: { sub: string; email: string; name?: string } | null = null;

      if (credential) {
        // ID token flow (legacy / desktop)
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: env.GOOGLE_CLIENT_ID,
        });
        const p = ticket.getPayload();
        if (!p || !p.email) return res.status(401).json({ error: 'Invalid Google token' });
        payload = { sub: p.sub!, email: p.email, name: p.name };
      } else {
        // Access token flow (mobile / Safari via useGoogleLogin)
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (!userInfoRes.ok) return res.status(401).json({ error: 'Invalid Google access token' });
        const info = await userInfoRes.json() as { sub: string; email: string; name?: string };
        if (!info.email) return res.status(401).json({ error: 'No email from Google' });
        payload = info;
      }

      if (!payload || !payload.email) {
        return res.status(401).json({ error: 'Invalid Google token' });
      }

      // Find existing user by googleId or email
      let user = await prisma.user.findFirst({
        where: { OR: [{ googleId: payload.sub }, { email: payload.email }] },
      });

      if (user) {
        // Link Google ID if not yet linked
        if (!user.googleId) {
          await prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub } });
        }
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            googleId: payload.sub,
            passwordHash: null,
            role: 'client',
            emailConfirmed: true,
            onboardingCompleted: false,
          },
        });
        logger.info(`New Google user registered: ${payload.email}`);
      }

      const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
      });

      const client = user.role === 'client'
        ? await prisma.client.findUnique({ where: { userId: user.id }, select: { id: true } })
        : null;

      res.json({
        token,
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
      logger.error('Google auth error:', error);
      res.status(401).json({ error: 'Google authentication failed' });
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
