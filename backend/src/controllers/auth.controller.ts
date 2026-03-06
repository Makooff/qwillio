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

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: 'admin',
          confirmationToken,
          emailConfirmed: false,
          onboardingCompleted: false,
        },
      });

      const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
      });

      // Send confirmation email
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
        // Don't fail registration if email fails — user can resend
      }

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailConfirmed: false,
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

      logger.info(`Onboarding completed for user ${user.email} — plan: ${planType}`);

      res.json({
        message: 'Onboarding completed',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailConfirmed: user.emailConfirmed,
          onboardingCompleted: true,
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
        },
      });

      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const authController = new AuthController();
