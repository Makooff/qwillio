import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma, basePrisma } from '../config/database';
import { env } from '../config/env';
import { loginSchema, registerSchema } from '../utils/validators';
import { emailService } from '../services/email.service';
import { logger } from '../config/logger';
import { stripe } from '../config/stripe';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

function isColdStartError(error: any): boolean {
  const msg: string = error?.message || '';
  return (
    msg.includes("Can't reach database") ||
    msg.includes('neon.tech') ||
    msg.includes('P1001') ||
    msg.includes('P1008') ||
    msg.includes('Connection refused') ||
    msg.includes('ECONNRESET') ||
    error?.constructor?.name === 'PrismaClientInitializationError'
  );
}

function sanitizeError(error: any): string {
  if (isColdStartError(error)) {
    return 'Service temporairement indisponible. Réessayez dans quelques secondes.';
  }
  return error?.message || '';
}

function withDbTimeout<T>(promise: Promise<T>, ms = 80000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB_TIMEOUT')), ms)
    ),
  ]);
}

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await withDbTimeout(prisma.user.findUnique({ where: { email } }));
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

      const client = user.role === 'client'
        ? await withDbTimeout(prisma.client.findUnique({ where: { userId: user.id }, select: { id: true } }))
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
      const isCold = isColdStartError(error) || error?.message === 'DB_TIMEOUT';
      const status = isCold ? 503 : 400;
      res.status(status).json({ error: isCold ? 'Service en démarrage. Reconnexion automatique...' : sanitizeError(error) });
    }
  }

  async register(req: Request, res: Response) {
    try {
      const { email, password, name } = registerSchema.parse(req.body);

      const existing = await basePrisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
      }

      const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
      const confirmationToken = crypto.randomUUID();

      // Auto-confirm email when using Resend test domain (can only deliver to verified address)
      const isTestEmail = env.RESEND_FROM_EMAIL.includes('resend.dev');
      const autoConfirm = isTestEmail;

      const user = await basePrisma.user.create({
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
      res.status(400).json({ error: sanitizeError(error) });
    }
  }

  async confirmEmail(req: Request, res: Response) {
    try {
      const token = req.params.token as string;

      const user = await basePrisma.user.findUnique({
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

      await basePrisma.user.update({
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
      res.status(500).json({ error: sanitizeError(error) });
    }
  }

  async resendConfirmation(req: any, res: Response) {
    try {
      const user = await basePrisma.user.findUnique({
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
        await basePrisma.user.update({
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
      res.status(500).json({ error: sanitizeError(error) });
    }
  }

  async onboard(req: any, res: Response) {
    try {
      const { businessName, businessPhone, industry, website, planType } = req.body;

      if (!businessName || !planType) {
        return res.status(400).json({ error: 'Business name and plan are required' });
      }

      const PLAN_PRICING: Record<string, { monthlyFee: number; callsQuota: number; stripePriceMonthly: string }> = {
        starter:    { monthlyFee: 197, callsQuota: 200,  stripePriceMonthly: env.STRIPE_PRICE_BASIC_MONTHLY },
        pro:        { monthlyFee: 347, callsQuota: 500,  stripePriceMonthly: env.STRIPE_PRICE_PRO_MONTHLY },
        enterprise: { monthlyFee: 497, callsQuota: 1000, stripePriceMonthly: env.STRIPE_PRICE_ENTERPRISE_MONTHLY },
      };

      // Check if Client already exists (user retrying onboarding after Stripe payment)
      const existingClient = await basePrisma.client.findUnique({ where: { userId: req.userId } });
      let clientId: string | null = existingClient?.id || null;

      const user = await basePrisma.user.update({
        where: { id: req.userId },
        data: {
          businessName,
          businessPhone: businessPhone || null,
          industry: industry || null,
          website: website || null,
          planType,
          // Only mark onboarding complete if Client already exists (Stripe already paid)
          // Otherwise, onboarding completes after Stripe checkout webhook creates the Client
          onboardingCompleted: !!existingClient,
        },
      });

      logger.info(`Onboarding info saved for user ${user.email} — plan: ${planType}, hasClient: ${!!existingClient}`);

      // Issue a fresh JWT with the correct role from DB
      const freshToken = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
      });

      // If Client already exists, skip Stripe — go straight to dashboard
      let checkoutUrl: string | null = null;

      if (!existingClient) {
        // Create Stripe Checkout Session — 30-day free trial, then monthly price
        const pricing = PLAN_PRICING[planType] || PLAN_PRICING.pro;

        if (pricing.stripePriceMonthly && env.STRIPE_SECRET_KEY) {
          try {
            const frontendUrl = env.FRONTEND_URL.split(',')[0].trim();

            const sessionParams: any = {
              mode: 'subscription',
              customer_email: user.email,
              client_reference_id: user.id,
              line_items: [{ price: pricing.stripePriceMonthly, quantity: 1 }],
              success_url: `${frontendUrl}/dashboard?payment=success`,
              cancel_url: `${frontendUrl}/onboard?payment=cancelled`,
              subscription_data: {
                trial_period_days: 30,
                metadata: {
                  userId: user.id,
                  planType,
                },
              },
              metadata: {
                userId: user.id,
                planType,
                businessName,
                businessPhone: businessPhone || '',
                industry: industry || '',
                website: website || '',
                source: 'self-onboarding',
              },
            };

            const session = await stripe.checkout.sessions.create(sessionParams);
            checkoutUrl = session.url;
            logger.info(`Stripe checkout created for ${user.email} — session: ${session.id}`);
          } catch (stripeErr: any) {
            logger.warn(`Stripe checkout creation failed for ${user.email}: ${stripeErr.message}`);
          }
        }
      }

      res.json({
        message: checkoutUrl ? 'Redirecting to payment' : 'Onboarding completed',
        token: freshToken,
        checkoutUrl,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailConfirmed: user.emailConfirmed,
          onboardingCompleted: user.onboardingCompleted,
          clientId,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
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
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: env.GOOGLE_CLIENT_ID,
        });
        const p = ticket.getPayload();
        if (!p || !p.email) return res.status(401).json({ error: 'Invalid Google token' });
        payload = { sub: p.sub!, email: p.email, name: p.name };
      } else {
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

      let user = await withDbTimeout(prisma.user.findFirst({
        where: { OR: [{ googleId: payload.sub }, { email: payload.email }] },
      }));

      if (user) {
        if (!user.googleId) {
          await withDbTimeout(prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub } }));
        }
      } else {
        user = await withDbTimeout(prisma.user.create({
          data: {
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            googleId: payload.sub,
            passwordHash: null,
            role: 'client',
            emailConfirmed: true,
            onboardingCompleted: false,
          },
        }));
        logger.info(`New Google user registered: ${payload.email}`);
      }

      const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
      });

      const client = user.role === 'client'
        ? await withDbTimeout(prisma.client.findUnique({ where: { userId: user.id }, select: { id: true } }))
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
      const isCold = isColdStartError(error) || error?.message === 'DB_TIMEOUT';
      if (isCold) {
        logger.warn('Google auth: DB not ready, returning 503');
        return res.status(503).json({ error: 'Service en démarrage. Reconnexion automatique...' });
      }
      logger.error('Google auth error:', error?.message || error);
      res.status(500).json({ error: sanitizeError(error) || 'Google authentication failed' });
    }
  }

  async logout(_req: Request, res: Response) {
    // Stateless JWT — client clears token on its side
    res.json({ message: 'Logged out' });
  }

  async me(req: any, res: Response) {
    try {
      const user = await basePrisma.user.findUnique({
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
      res.status(500).json({ error: sanitizeError(error) });
    }
  }
}

export const authController = new AuthController();
