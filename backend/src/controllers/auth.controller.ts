import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../utils/validators';
import { emailService } from '../services/email.service';
import { logger } from '../config/logger';
import { getPlan, PLANS } from '../config/plans';
import { affiliateService } from '../services/affiliate.service';

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
            lang: req.body?.language === 'en' ? 'en' : 'fr',
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

  // ── FORGOT PASSWORD — issue a one-time reset link ────────
  async forgotPassword(req: Request, res: Response) {
    // Generic response in every branch — never reveal whether the email exists.
    const genericMessage = 'Si un compte existe pour cette adresse, un lien de réinitialisation a été envoyé.';
    try {
      const { email, language } = forgotPasswordSchema.parse(req.body);
      const lang: 'fr' | 'en' = language === 'en' ? 'en' : 'fr';
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await prisma.user.update({
          where: { id: user.id },
          data: { resetToken: tokenHash, resetTokenExpiry },
        });
        const frontendUrl = env.FRONTEND_URL.split(',')[0].trim();
        const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
        await emailService.sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl, lang });
        logger.info(`Password reset link issued for ${email}`);
      } else {
        logger.info(`Password reset requested for unknown email: ${email}`);
      }
      return res.json({ message: genericMessage });
    } catch (error: any) {
      // Validation failure (bad email) still returns the generic message to
      // avoid leaking, but log for diagnostics.
      logger.warn('forgotPassword error:', error?.message);
      return res.json({ message: genericMessage });
    }
  }

  // ── RESET PASSWORD — consume token, set new password ─────
  async resetPassword(req: Request, res: Response) {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const user = await prisma.user.findUnique({ where: { resetToken: tokenHash } });

      if (!user || !user.resetTokenExpiry || user.resetTokenExpiry.getTime() < Date.now()) {
        return res.status(400).json({ error: 'Lien invalide ou expiré. Veuillez en demander un nouveau.' });
      }

      const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
      await prisma.user.update({
        where: { id: user.id },
        // One-time use: clear the token so the link cannot be replayed.
        data: { passwordHash, resetToken: null, resetTokenExpiry: null },
      });
      logger.info(`Password reset completed for ${user.email}`);
      return res.json({ message: 'Mot de passe mis à jour. Vous pouvez maintenant vous connecter.' });
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
      }
      logger.error('resetPassword error:', error?.message);
      return res.status(500).json({ error: 'Impossible de réinitialiser le mot de passe.' });
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
        lang: req.body?.language === 'en' ? 'en' : 'fr',
      });

      logger.info(`Confirmation email resent to ${user.email}`);
      res.json({ message: 'Confirmation email sent' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Step 2 of sign-up: pick a plan and register a card.
   *
   * Returns a Stripe Checkout URL. The Client row is not created here — the
   * `checkout.session.completed` webhook does that, so a customer only ever
   * exists once a card actually cleared.
   */
  async startSubscription(req: any, res: Response) {
    try {
      const businessName = String(req.body?.businessName || '').trim();
      const planType = String(req.body?.planType || '').trim();
      const industry = req.body?.industry ? String(req.body.industry).trim() : null;

      if (!businessName || !planType) {
        return res.status(400).json({ error: 'Business name and plan are required' });
      }

      // getPlan falls back to `starter` for anything it does not recognise, so
      // an unknown value would quietly bill a plan the customer never chose.
      if (!Object.prototype.hasOwnProperty.call(PLANS, planType.toLowerCase())) {
        return res.status(400).json({ error: 'unknown_plan' });
      }
      const plan = getPlan(planType);

      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) return res.status(401).json({ error: 'Non authentifié' });

      // Already paying: nothing to buy. Sending them through Checkout again
      // would open a second subscription on the same account.
      const existing = await prisma.client.findUnique({ where: { userId: user.id } });
      if (existing?.stripeSubscriptionId) {
        return res.status(409).json({ error: 'subscription_exists', clientId: existing.id });
      }

      // Kept on the User so the webhook can name the business it creates.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          businessName,
          industry: industry || null,
          website: req.body?.website ? String(req.body.website).trim() : undefined,
          businessPhone: req.body?.businessPhone ? String(req.body.businessPhone).trim() : undefined,
          planType: plan.id,
        },
      });

      // Lazy: importing the Stripe service at module scope builds the Stripe
      // client on load, which breaks every test that touches this controller
      // without a STRIPE_SECRET_KEY.
      const { stripeService } = await import('../services/stripe.service');
      const checkoutUrl = await stripeService.createSelfOnboardingCheckout(
        { id: user.id, email: user.email },
        plan.id,
        businessName,
        industry,
      );
      if (!checkoutUrl) return res.status(502).json({ error: 'checkout_unavailable' });

      res.json({ checkoutUrl });
    } catch (error: any) {
      logger.error('[auth] startSubscription failed', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Final step of sign-up: the receptionist is configured, open the dashboard.
   *
   * Requires a Client that already carries a Stripe subscription, so this can
   * never be the step that hands out access on its own. Setting
   * `onboardingCompleted` here (and only here) is also what keeps existing
   * customers grandfathered: they already have the flag and never come back
   * through this path.
   */
  async onboard(req: any, res: Response) {
    try {
      const { businessName, businessPhone, industry, website } = req.body;

      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) return res.status(401).json({ error: 'Non authentifié' });

      const client = await prisma.client.findUnique({ where: { userId: user.id } });
      if (!client || !client.stripeSubscriptionId) {
        return res.status(402).json({ error: 'payment_required' });
      }

      const planType = client.planType;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          businessName: businessName || user.businessName,
          businessPhone: businessPhone ?? user.businessPhone,
          industry: industry ?? user.industry,
          website: website ?? user.website,
          onboardingCompleted: true,
        },
      });

      // Mirror anything the owner corrected during onboarding onto the Client,
      // which is what the receptionist is actually built from.
      await prisma.client.update({
        where: { id: client.id },
        data: {
          businessName: businessName || client.businessName,
          businessType: industry || client.businessType,
          contactPhone: businessPhone ?? client.contactPhone,
          // Deliberately not touching transferNumber: this field is the
          // business's own line, and the onboarding copy promises forwarding is
          // configured later. Copying it here would make the receptionist
          // transfer callers to the number it answers on.
          onboardingCompletedAt: new Date(),
        },
      });

      const clientId = client.id;

      // Referral attribution, decided once. A bad or missing code is ignored
      // rather than blocking the customer from finishing.
      const referralCode = typeof req.body?.referralCode === 'string' ? req.body.referralCode : null;
      await affiliateService.attribute(clientId, referralCode);

      // Now that there is a real config to build from, provision the assistant.
      // Fire-and-forget: the 5-min retry cron picks up failures.
      void import('../services/onboarding.service').then(({ onboardingService }) =>
        onboardingService.onboardClient(clientId).catch((err: Error) => {
          logger.error(`Async onboarding failed for client ${clientId}: ${err.message}`);
        }),
      );

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
          hasSubscription: true,
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

  async logout(_req: Request, res: Response) {
    // Stateless JWT — client clears token on its side
    res.json({ message: 'Logged out' });
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
          client: { select: { id: true, stripeSubscriptionId: true } },
        },
      });

      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
      // Return a fresh JWT so stale tokens (wrong role) get auto-corrected
      const freshToken = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
      });
      const { client, ...rest } = user;
      res.json({
        ...rest,
        clientId: client?.id || null,
        // Drives the sign-up gate in the router. Existing customers reach the
        // dashboard on `onboardingCompleted` alone, so a legacy client with no
        // Stripe subscription is never bounced back to the card step.
        hasSubscription: !!client?.stripeSubscriptionId,
        token: freshToken,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const authController = new AuthController();
