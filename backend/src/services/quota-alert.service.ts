import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { discordService } from './discord.service';

// Monthly call quota per plan, matching the sticker tiers on /pricing.
// Kept in this file (not schema) because it changes at pricing-strategy
// tempo (quarters), not schema-migration tempo.
const PLAN_QUOTAS: Record<string, number> = {
  solo:       300,
  starter:    800,
  pro:      2_000,
  enterprise: 4_000,
};

// Notify at these usage thresholds. Values are exclusive lower bounds:
// a client at 80.5 % triggers the 80 % notice once, then 95 % once, then
// 100 % once. State is stored on the client record so a run can not
// double-fire on retry or restart.
const THRESHOLDS = [80, 95, 100] as const;
type Threshold = typeof THRESHOLDS[number];

interface QuotaAlertState {
  month: string;                 // YYYY-MM key
  firedAt: Partial<Record<Threshold, string>>;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function loadState(client: any, key: string): QuotaAlertState {
  const cfg = (client.vapiConfig as any) || {};
  const raw = cfg.quotaAlert as QuotaAlertState | undefined;
  if (raw && raw.month === key) return raw;
  return { month: key, firedAt: {} };
}

export class QuotaAlertService {
  // Iterate active clients, count calls used this month, notify on threshold.
  // Safe to call from a cron every hour: state is persisted per client so we
  // never double-fire, and clients under 80 % are a no-op.
  async runOnce(now: Date = new Date()): Promise<{ scanned: number; notified: number }> {
    const key = monthKey(now);
    const monthStart = startOfMonthUtc(now);

    const clients = await prisma.client.findMany({
      where: {
        onboardingStatus: 'completed',
        subscriptionStatus: { not: 'cancelled' },
      },
      select: {
        id: true,
        businessName: true,
        contactEmail: true,
        contactName: true,
        planType: true,
        agentLanguage: true,
        country: true,
        monthlyCallsQuota: true,
        vapiConfig: true,
      },
    });

    let notified = 0;

    for (const client of clients) {
      const plan = (client.planType || '').toLowerCase();
      const quota = client.monthlyCallsQuota ?? PLAN_QUOTAS[plan];
      if (!quota) continue;

      const used = await prisma.clientCall.count({
        where: {
          clientId: client.id,
          startedAt: { gte: monthStart },
        },
      });

      const pct = Math.floor((used / quota) * 100);
      const state = loadState(client, key);

      for (const t of THRESHOLDS) {
        if (pct < t) continue;
        if (state.firedAt[t]) continue;

        await this.notifyThreshold({
          clientId: client.id,
          businessName: client.businessName,
          contactEmail: client.contactEmail,
          contactName: client.contactName || 'there',
          language: this.clientLanguage(client),
          plan,
          quota,
          used,
          threshold: t,
        });

        state.firedAt[t] = new Date().toISOString();
        notified += 1;
      }

      // Persist state only if something changed to avoid useless writes.
      // Re-read the latest vapiConfig immediately before writing so we do
      // not clobber concurrent updates from other services touching the
      // same JSON column between the initial select and this write.
      const prevState = ((client.vapiConfig as any)?.quotaAlert) as QuotaAlertState | undefined;
      const changed =
        !prevState ||
        prevState.month !== state.month ||
        JSON.stringify(prevState.firedAt) !== JSON.stringify(state.firedAt);
      if (changed) {
        const fresh = await prisma.client.findUnique({
          where: { id: client.id },
          select: { vapiConfig: true },
        });
        const freshCfg = (fresh?.vapiConfig as any) || {};
        await prisma.client.update({
          where: { id: client.id },
          data: { vapiConfig: { ...freshCfg, quotaAlert: state } },
        });
      }
    }

    logger.info(`quota-alert: scanned ${clients.length} clients, notified ${notified}`);
    return { scanned: clients.length, notified };
  }

  // A client's notification language: prefer their agent language, then
  // country default (BE/FR/LU/MC/CH → fr, else en).
  private clientLanguage(client: { agentLanguage?: string | null; country?: string | null }): 'fr' | 'en' {
    if (client.agentLanguage === 'fr') return 'fr';
    if (client.agentLanguage === 'en') return 'en';
    const country = (client.country || '').toUpperCase();
    return ['FR', 'BE', 'LU', 'MC', 'CH'].includes(country) ? 'fr' : 'en';
  }

  private async notifyThreshold(params: {
    clientId: string;
    businessName: string;
    contactEmail: string;
    contactName: string;
    language: 'fr' | 'en';
    plan: string;
    quota: number;
    used: number;
    threshold: Threshold;
  }): Promise<void> {
    const { businessName, contactEmail, contactName, language, plan, quota, used, threshold } = params;

    const upgradeUrl = 'https://qwillio.com/pricing';
    const dashboardUrl = 'https://qwillio.com/client-dashboard';

    const isFr = language === 'fr';
    const subject = isFr
      ? threshold === 100
        ? `Quota d'appels atteint pour ${businessName}`
        : `${threshold}% de votre quota d'appels utilisé`
      : threshold === 100
        ? `Call quota reached for ${businessName}`
        : `${threshold}% of your call quota used`;

    const body = isFr
      ? this.emailBodyFr({ contactName, plan, quota, used, threshold, upgradeUrl, dashboardUrl })
      : this.emailBodyEn({ contactName, plan, quota, used, threshold, upgradeUrl, dashboardUrl });

    try {
      await emailService.send({
        to: contactEmail,
        subject,
        html: body,
      });
    } catch (err) {
      logger.error(`quota-alert: failed to email ${contactEmail}`, err);
    }

    try {
      await discordService.notify(
        `📊 Quota ${threshold}% — ${businessName} (${plan}) — ${used}/${quota} calls`,
      );
    } catch (err) {
      logger.warn(`quota-alert: discord notify failed for ${businessName}`, err);
    }
  }

  private emailBodyFr(p: {
    contactName: string;
    plan: string;
    quota: number;
    used: number;
    threshold: Threshold;
    upgradeUrl: string;
    dashboardUrl: string;
  }): string {
    const { contactName, plan, quota, used, threshold, upgradeUrl, dashboardUrl } = p;
    const intro = threshold === 100
      ? `Vous avez atteint votre quota mensuel d'appels sur le plan <strong>${plan}</strong>.`
      : `Vous êtes à <strong>${threshold}%</strong> de votre quota mensuel d'appels sur le plan <strong>${plan}</strong>.`;
    const overage = threshold === 100
      ? `Les appels supplémentaires sont désormais facturés au tarif overage indiqué dans votre pricing.`
      : `Il vous reste ${quota - used} appels avant d'atteindre la limite.`;
    return `
      <p>Bonjour ${contactName},</p>
      <p>${intro}</p>
      <p>Consommation ce mois : ${used} appels sur ${quota}.</p>
      <p>${overage}</p>
      <p>
        <a href="${dashboardUrl}">Voir votre tableau de bord</a> ·
        <a href="${upgradeUrl}">Passer au plan supérieur</a>
      </p>
      <p>— L'équipe Qwillio</p>
    `.trim();
  }

  private emailBodyEn(p: {
    contactName: string;
    plan: string;
    quota: number;
    used: number;
    threshold: Threshold;
    upgradeUrl: string;
    dashboardUrl: string;
  }): string {
    const { contactName, plan, quota, used, threshold, upgradeUrl, dashboardUrl } = p;
    const intro = threshold === 100
      ? `You have reached your monthly call quota on the <strong>${plan}</strong> plan.`
      : `You are at <strong>${threshold}%</strong> of your monthly call quota on the <strong>${plan}</strong> plan.`;
    const overage = threshold === 100
      ? `Additional calls will now be billed at the overage rate shown on your pricing page.`
      : `You have ${quota - used} calls left before hitting the limit.`;
    return `
      <p>Hi ${contactName},</p>
      <p>${intro}</p>
      <p>Usage this month: ${used} of ${quota} calls.</p>
      <p>${overage}</p>
      <p>
        <a href="${dashboardUrl}">View your dashboard</a> ·
        <a href="${upgradeUrl}">Upgrade your plan</a>
      </p>
      <p>— The Qwillio team</p>
    `.trim();
  }
}

export const quotaAlertService = new QuotaAlertService();
