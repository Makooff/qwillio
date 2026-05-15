import { prisma } from '../config/database';
import { resend } from '../config/resend';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class RoiDigestService {
  async sendAllDigests(): Promise<void> {
    const clients = await prisma.client.findMany({
      where: { subscriptionStatus: 'active' },
      include: { user: { select: { email: true, name: true } } },
    });

    for (const client of clients) {
      try {
        await this.sendClientDigest(client.id);
      } catch (err) {
        logger.error(`[RoiDigest] Failed for client ${client.id}`, err);
      }
    }
    logger.info(`[RoiDigest] Sent digests to ${clients.length} clients`);
  }

  async sendClientDigest(clientId: string): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const client = await prisma.client.findUniqueOrThrow({
      where: { id: clientId },
      include: { user: { select: { email: true, name: true } } },
    });

    const calls = await prisma.clientCall.findMany({
      where: {
        clientId,
        createdAt: { gte: sevenDaysAgo },
        status: { not: 'in-progress' },
      },
      select: { status: true, outcome: true, leadScore: true, sentiment: true, isLead: true },
    });

    const totalCalls = calls.length;
    const answeredCalls = calls.filter(c => c.status === 'completed').length;
    const voicemails = calls.filter(c => c.outcome === 'voicemail').length;
    const interestedLeads = calls.filter(c => (c.leadScore ?? 0) >= 7).length;
    const hotLeads = calls.filter(c => (c.leadScore ?? 0) >= 9).length;
    const answerRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0;
    const estimatedPipelineValue = interestedLeads * 300;

    const prevWeekStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const prevCalls = await prisma.clientCall.count({
      where: { clientId, createdAt: { gte: prevWeekStart, lte: sevenDaysAgo } },
    });
    const callTrend: 'up' | 'down' = totalCalls >= prevCalls ? 'up' : 'down';
    const callTrendPct = prevCalls > 0 ? Math.abs(Math.round(((totalCalls - prevCalls) / prevCalls) * 100)) : 0;

    if (!client.user?.email) return;

    const html = buildRoiEmailHtml({
      clientName: client.businessName || client.user.name || 'Votre entreprise',
      totalCalls,
      answeredCalls,
      voicemails,
      answerRate,
      interestedLeads,
      hotLeads,
      estimatedPipelineValue,
      callTrend,
      callTrendPct,
    });

    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: client.user.email,
      subject: `📊 Votre rapport Qwillio — semaine du ${new Date(sevenDaysAgo).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`,
      html,
    });

    logger.info(`[RoiDigest] Sent to ${client.user.email}: ${totalCalls} calls, ${interestedLeads} leads`);
  }
}

interface DigestData {
  clientName: string;
  totalCalls: number;
  answeredCalls: number;
  voicemails: number;
  answerRate: number;
  interestedLeads: number;
  hotLeads: number;
  estimatedPipelineValue: number;
  callTrend: 'up' | 'down';
  callTrendPct: number;
}

function buildRoiEmailHtml(d: DigestData): string {
  const trendArrow = d.callTrend === 'up' ? '↑' : '↓';
  const trendColor = d.callTrend === 'up' ? '#22C55E' : '#EF4444';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden;">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#7B5CF0,#9B7DF8);padding:32px;text-align:center;">
        <p style="margin:0 0 4px;color:rgba(255,255,255,0.75);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">RAPPORT HEBDOMADAIRE</p>
        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.02em;">${d.clientName}</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">7 derniers jours • Propulsé par Qwillio</p>
      </div>

      <!-- KPIs -->
      <div style="padding:24px;display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
        <div style="background:#F9FAFB;border-radius:12px;border:1px solid #E5E7EB;padding:20px;text-align:center;">
          <p style="margin:0;font-size:36px;font-weight:700;color:#111827;letter-spacing:-0.03em;">${d.totalCalls}</p>
          <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Appels passés</p>
          <p style="margin:4px 0 0;font-size:11px;color:${trendColor};font-weight:600;">${trendArrow} ${d.callTrendPct}% vs semaine passée</p>
        </div>
        <div style="background:#F9FAFB;border-radius:12px;border:1px solid #E5E7EB;padding:20px;text-align:center;">
          <p style="margin:0;font-size:36px;font-weight:700;color:#111827;letter-spacing:-0.03em;">${d.answerRate}%</p>
          <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Taux de réponse</p>
          <p style="margin:4px 0 0;font-size:11px;color:#9CA3AF;">${d.answeredCalls} réponses · ${d.voicemails} messageries</p>
        </div>
        <div style="background:linear-gradient(135deg,rgba(123,92,240,0.08),rgba(123,92,240,0.04));border-radius:12px;border:1px solid rgba(123,92,240,0.15);padding:20px;text-align:center;">
          <p style="margin:0;font-size:36px;font-weight:700;color:#7B5CF0;letter-spacing:-0.03em;">${d.interestedLeads}</p>
          <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#7B5CF0;text-transform:uppercase;letter-spacing:0.06em;">Leads intéressés</p>
          <p style="margin:4px 0 0;font-size:11px;color:#9CA3AF;">${d.hotLeads} leads chauds (score 9+)</p>
        </div>
        <div style="background:linear-gradient(135deg,rgba(34,197,94,0.08),rgba(34,197,94,0.04));border-radius:12px;border:1px solid rgba(34,197,94,0.15);padding:20px;text-align:center;">
          <p style="margin:0;font-size:36px;font-weight:700;color:#22C55E;letter-spacing:-0.03em;">€${d.estimatedPipelineValue.toLocaleString('fr-FR')}</p>
          <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#22C55E;text-transform:uppercase;letter-spacing:0.06em;">Pipeline estimé</p>
          <p style="margin:4px 0 0;font-size:11px;color:#9CA3AF;">Basé sur ${d.interestedLeads} leads × 300€/mois moy.</p>
        </div>
      </div>

      <!-- CTA -->
      <div style="padding:0 24px 32px;text-align:center;">
        <a href="https://qwillio.com/dashboard" style="display:inline-block;background:linear-gradient(135deg,#7B5CF0,#9B7DF8);color:#fff;font-weight:600;font-size:14px;padding:12px 32px;border-radius:10px;text-decoration:none;">Voir le dashboard complet</a>
        <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;">Ce rapport est envoyé chaque lundi matin. <a href="#" style="color:#7B5CF0;">Se désinscrire</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export const roiDigestService = new RoiDigestService();
