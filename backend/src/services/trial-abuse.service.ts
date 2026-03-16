import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

const SALT = 'qwillio_trial_v1_';

interface SignupSignals {
  email: string;
  phone?: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  cardFingerprint?: string;
  ipCountry?: string;
  phoneCountry?: string;
  vpnDetected?: boolean;
  formSubmitTime?: number; // seconds spent on form
  honeypotFilled?: boolean;
}

interface AbuseCheckResult {
  allowed: boolean;
  blocked: boolean;
  reason?: string;
  suspiciousSignals: number;
  requiresCaptcha: boolean;
  matchedSignals: string[];
}

function hashValue(value: string): string {
  return crypto.createHash('sha256').update(SALT + value.toLowerCase().trim()).digest('hex');
}

// List of disposable email domain patterns
const DISPOSABLE_PATTERNS = [
  'tempmail', 'throwaway', 'mailinator', 'guerrillamail', 'yopmail',
  'sharklasers', 'grr.la', 'guerrillamailblock', 'pokemail', 'spam4.me',
  'bccto.me', 'dispostable', 'mailnesia', 'maildrop', 'discard.email',
  'temp-mail', 'fakeinbox', 'tempail', 'trashmail', 'mailcatch',
  '10minutemail', 'minutemail', 'getnada', 'emailondeck', 'moakt',
];

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_PATTERNS.some((p) => domain.includes(p));
}

function isSuspiciousEmail(email: string): boolean {
  const [user] = email.split('@');
  if (!user) return false;

  // All numbers username
  if (/^\d+$/.test(user)) return true;

  // Random-looking string (high entropy, no real words)
  if (user.length > 12 && /^[a-z0-9]{12,}$/.test(user)) return true;

  // Very short username
  if (user.length < 3) return true;

  return false;
}

export class TrialAbuseService {
  /**
   * Check all signals against existing records before allowing signup.
   * Call this BEFORE creating the account.
   */
  async checkSignals(signals: SignupSignals): Promise<AbuseCheckResult> {
    const matchedSignals: string[] = [];
    let suspiciousSignals = 0;

    // Signal 1: Phone number lock
    if (signals.phone) {
      const phoneHash = hashValue(signals.phone);
      const existing = await prisma.trialFingerprint.findFirst({
        where: { phoneHash, usedTrial: true },
      });
      if (existing) {
        return {
          allowed: false,
          blocked: true,
          reason: 'A free trial has already been used with this phone number.',
          suspiciousSignals: 1,
          requiresCaptcha: false,
          matchedSignals: ['phone'],
        };
      }

      // Check account deletions
      const deleted = await prisma.accountDeletion.findFirst({
        where: { phoneHash, hadActiveTrial: true },
      });
      if (deleted) {
        return {
          allowed: false,
          blocked: true,
          reason: 'A free trial has already been used with this phone number.',
          suspiciousSignals: 1,
          requiresCaptcha: false,
          matchedSignals: ['phone_deleted_account'],
        };
      }
    }

    // Signal 2: Email domain analysis
    if (isDisposableEmail(signals.email)) {
      return {
        allowed: false,
        blocked: true,
        reason: 'Disposable email addresses are not allowed. Please use a permanent email.',
        suspiciousSignals: 1,
        requiresCaptcha: false,
        matchedSignals: ['disposable_email'],
      };
    }

    if (isSuspiciousEmail(signals.email)) {
      suspiciousSignals++;
      matchedSignals.push('suspicious_email');
    }

    const emailHash = hashValue(signals.email);
    const existingEmail = await prisma.trialFingerprint.findFirst({
      where: { emailHash, usedTrial: true },
    });
    if (existingEmail) {
      return {
        allowed: false,
        blocked: true,
        reason: 'A free trial has already been used with this email address.',
        suspiciousSignals: 1,
        requiresCaptcha: false,
        matchedSignals: ['email'],
      };
    }

    // Check 48h cooldown on deleted accounts
    const deletedEmail = await prisma.accountDeletion.findFirst({
      where: {
        emailHash,
        cooldownUntil: { gt: new Date() },
      },
    });
    if (deletedEmail) {
      return {
        allowed: false,
        blocked: true,
        reason: 'This email was recently associated with a deleted account. Please wait 48 hours before creating a new account.',
        suspiciousSignals: 1,
        requiresCaptcha: false,
        matchedSignals: ['email_cooldown'],
      };
    }

    // Signal 3: Device fingerprint
    if (signals.deviceFingerprint) {
      const fpHash = hashValue(signals.deviceFingerprint);
      const existingFp = await prisma.trialFingerprint.findFirst({
        where: { deviceFingerprintHash: fpHash, usedTrial: true },
      });
      if (existingFp) {
        return {
          allowed: false,
          blocked: true,
          reason: 'A free trial has already been used on this device.',
          suspiciousSignals: 1,
          requiresCaptcha: false,
          matchedSignals: ['device_fingerprint'],
        };
      }
    }

    // Signal 4: IP address tracking
    if (signals.ipAddress) {
      const ipHash = hashValue(signals.ipAddress);
      const ipCount = await prisma.trialFingerprint.count({
        where: { ipHash },
      });
      if (ipCount >= 2) {
        suspiciousSignals++;
        matchedSignals.push('ip_multiple_accounts');
        if (ipCount >= 3) {
          return {
            allowed: false,
            blocked: true,
            reason: 'Too many accounts have been created from this IP address.',
            suspiciousSignals: ipCount,
            requiresCaptcha: false,
            matchedSignals: ['ip_blocked'],
          };
        }
      }

      // VPN detection
      if (signals.vpnDetected) {
        suspiciousSignals++;
        matchedSignals.push('vpn_detected');
      }

      // Country mismatch
      if (signals.ipCountry && signals.phoneCountry && signals.ipCountry !== signals.phoneCountry) {
        suspiciousSignals++;
        matchedSignals.push('country_mismatch');
      }
    }

    // Signal 5: Credit card fingerprint (checked later after Stripe)
    if (signals.cardFingerprint) {
      const existingCard = await prisma.trialFingerprint.findFirst({
        where: { cardFingerprint: signals.cardFingerprint, usedTrial: true },
      });
      if (existingCard) {
        return {
          allowed: false,
          blocked: true,
          reason: 'A free trial has already been used with this payment method.',
          suspiciousSignals: 1,
          requiresCaptcha: false,
          matchedSignals: ['card_fingerprint'],
        };
      }
    }

    // Signal 6: Behavioral analysis
    if (signals.honeypotFilled) {
      return {
        allowed: false,
        blocked: true,
        reason: 'Automated signup detected.',
        suspiciousSignals: 1,
        requiresCaptcha: false,
        matchedSignals: ['honeypot'],
      };
    }

    if (signals.formSubmitTime !== undefined && signals.formSubmitTime < 5) {
      suspiciousSignals++;
      matchedSignals.push('fast_submission');
    }

    return {
      allowed: true,
      blocked: false,
      suspiciousSignals,
      requiresCaptcha: suspiciousSignals >= 2,
      matchedSignals,
    };
  }

  /**
   * Record all signals after account is successfully created.
   */
  async recordSignals(accountId: string, signals: SignupSignals): Promise<void> {
    try {
      await prisma.trialFingerprint.create({
        data: {
          accountId,
          emailHash: hashValue(signals.email),
          phoneHash: signals.phone ? hashValue(signals.phone) : null,
          deviceFingerprintHash: signals.deviceFingerprint ? hashValue(signals.deviceFingerprint) : null,
          ipHash: signals.ipAddress ? hashValue(signals.ipAddress) : null,
          cardFingerprint: signals.cardFingerprint || null,
          ipCountry: signals.ipCountry || null,
          phoneCountry: signals.phoneCountry || null,
          vpnDetected: signals.vpnDetected || false,
          suspiciousSignals: 0,
          usedTrial: false,
          blocked: false,
        },
      });
      logger.info(`Trial fingerprint recorded for account ${accountId}`);
    } catch (error) {
      logger.error('Failed to record trial fingerprint:', error);
    }
  }

  /**
   * Mark trial as used when trial converts to paid or expires.
   */
  async markTrialUsed(accountId: string): Promise<void> {
    try {
      await prisma.trialFingerprint.updateMany({
        where: { accountId },
        data: { usedTrial: true },
      });
      logger.info(`Trial marked as used for account ${accountId}`);
    } catch (error) {
      logger.error('Failed to mark trial as used:', error);
    }
  }

  /**
   * Record account deletion for abuse prevention.
   */
  async recordDeletion(accountId: string, email: string, phone?: string): Promise<void> {
    try {
      const fingerprint = await prisma.trialFingerprint.findFirst({
        where: { accountId },
      });

      const cooldownUntil = new Date();
      cooldownUntil.setHours(cooldownUntil.getHours() + 48);

      await prisma.accountDeletion.create({
        data: {
          originalAccountId: accountId,
          emailHash: hashValue(email),
          phoneHash: phone ? hashValue(phone) : null,
          deviceFingerprintHash: fingerprint?.deviceFingerprintHash || null,
          ipHash: fingerprint?.ipHash || null,
          cardFingerprint: fingerprint?.cardFingerprint || null,
          hadActiveTrial: fingerprint?.usedTrial || false,
          hadPaidSubscription: false, // Set by caller
          cooldownUntil,
        },
      });

      // Mark all fingerprints as used
      if (fingerprint) {
        await prisma.trialFingerprint.updateMany({
          where: { accountId },
          data: { usedTrial: true, deletedAt: new Date() },
        });
      }

      logger.info(`Account deletion recorded for ${accountId}`);
    } catch (error) {
      logger.error('Failed to record account deletion:', error);
    }
  }

  /**
   * Update card fingerprint after Stripe payment setup.
   */
  async updateCardFingerprint(accountId: string, cardFingerprint: string): Promise<void> {
    try {
      await prisma.trialFingerprint.updateMany({
        where: { accountId },
        data: { cardFingerprint },
      });
    } catch (error) {
      logger.error('Failed to update card fingerprint:', error);
    }
  }

  /**
   * Get abuse stats for admin dashboard.
   */
  async getAbuseStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalBlocked, deletedAccounts, vpnAttempts, topReasons] = await Promise.all([
      prisma.trialFingerprint.count({
        where: { blocked: true, createdAt: { gte: monthStart } },
      }),
      prisma.accountDeletion.count({
        where: { deletedAt: { gte: monthStart } },
      }),
      prisma.trialFingerprint.count({
        where: { vpnDetected: true, createdAt: { gte: monthStart } },
      }),
      prisma.trialFingerprint.groupBy({
        by: ['blockReason'],
        where: { blocked: true, createdAt: { gte: monthStart }, blockReason: { not: null } },
        _count: true,
        orderBy: { _count: { blockReason: 'desc' } },
        take: 5,
      }),
    ]);

    return { totalBlocked, deletedAccounts, vpnAttempts, topReasons };
  }

  /**
   * Get flagged attempts for admin review.
   */
  async getFlaggedAttempts(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.trialFingerprint.findMany({
        where: {
          OR: [
            { blocked: true },
            { suspiciousSignals: { gte: 2 } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.trialFingerprint.count({
        where: {
          OR: [
            { blocked: true },
            { suspiciousSignals: { gte: 2 } },
          ],
        },
      }),
    ]);

    return { items, total, page, limit };
  }
}

export const trialAbuseService = new TrialAbuseService();
