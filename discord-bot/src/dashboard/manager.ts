import {
  Client,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
} from 'discord.js';
import { config } from '../config';
import { prisma } from '../database';
import { logger } from '../utils/logger';
import {
  maskPhone,
  relativeTime,
  formatDuration,
  statusEmoji,
  percentChange,
  formatTimestamp,
} from '../utils/formatting';
import { getUptime } from '../bot';

interface DashboardMessages {
  operations?: Message;
  revenue?: Message;
  activity?: Message;
  alerts?: Message;
  health?: Message;
  buttons?: Message;
}

export class DashboardManager {
  private client: Client;
  private messages: DashboardMessages = {};
  private updateInterval: NodeJS.Timeout | null = null;
  private channel: TextChannel | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  async initialize(): Promise<void> {
    try {
      const ch = await this.client.channels.fetch(config.channels.dashboard);
      if (!ch || !ch.isTextBased()) {
        logger.warn('Dashboard channel not found or not text-based');
        return;
      }
      this.channel = ch as TextChannel;

      // Clear old bot messages and create fresh embeds
      await this.clearOldMessages();
      await this.createDashboard();

      // Start update loop
      this.updateInterval = setInterval(() => this.update(), config.dashboardUpdateIntervalMs);
      logger.info('Dashboard initialized');
    } catch (error) {
      logger.error('Dashboard initialization failed:', error);
    }
  }

  private async clearOldMessages(): Promise<void> {
    if (!this.channel) return;
    try {
      const messages = await this.channel.messages.fetch({ limit: 20 });
      const botMessages = messages.filter((m) => m.author.id === this.client.user?.id);
      for (const msg of botMessages.values()) {
        await msg.delete().catch(() => {});
      }
    } catch (error) {
      logger.warn('Could not clear old messages:', error);
    }
  }

  private async createDashboard(): Promise<void> {
    if (!this.channel) return;

    const data = await this.fetchData();

    this.messages.operations = await this.channel.send({ embeds: [this.buildOperationsEmbed(data)] });
    this.messages.revenue = await this.channel.send({ embeds: [this.buildRevenueEmbed(data)] });
    this.messages.activity = await this.channel.send({ embeds: [this.buildActivityEmbed(data)] });
    this.messages.alerts = await this.channel.send({ embeds: [this.buildAlertsEmbed(data)] });
    this.messages.health = await this.channel.send({ embeds: [this.buildHealthEmbed(data)] });
    this.messages.buttons = await this.channel.send({ components: this.buildButtons() });
  }

  async update(): Promise<void> {
    try {
      const data = await this.fetchData();

      if (this.messages.operations) {
        await this.messages.operations.edit({ embeds: [this.buildOperationsEmbed(data)] }).catch(() => {});
      }
      if (this.messages.revenue) {
        await this.messages.revenue.edit({ embeds: [this.buildRevenueEmbed(data)] }).catch(() => {});
      }
      if (this.messages.activity) {
        await this.messages.activity.edit({ embeds: [this.buildActivityEmbed(data)] }).catch(() => {});
      }
      if (this.messages.alerts) {
        await this.messages.alerts.edit({ embeds: [this.buildAlertsEmbed(data)] }).catch(() => {});
      }
      if (this.messages.health) {
        await this.messages.health.edit({ embeds: [this.buildHealthEmbed(data)] }).catch(() => {});
      }
    } catch (error) {
      logger.error('Dashboard update failed:', error);
    }
  }

  // Trigger immediate update (called from webhook handlers)
  async triggerUpdate(): Promise<void> {
    await this.update();
  }

  private async fetchData() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    // Adjust last month "same period" to same day of month
    const lastMonthSamePeriod = new Date(lastMonthStart);
    lastMonthSamePeriod.setDate(Math.min(now.getDate(), lastMonthEnd.getDate()));

    const [
      botStatus,
      callsToday,
      callsThisMonth,
      callsLastMonthSamePeriod,
      lastCall,
      activeClients,
      trialClients,
      leadsToday,
      leadsThisMonth,
      leadsLastMonthSamePeriod,
      paymentsToday,
      recentCalls,
      recentAlerts,
    ] = await Promise.all([
      prisma.botStatus.findFirst(),
      prisma.call.findMany({ where: { createdAt: { gte: todayStart } } }),
      prisma.call.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.call.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthSamePeriod } } }),
      prisma.call.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.client.count({ where: { subscriptionStatus: 'active', isTrial: false } }),
      prisma.client.count({ where: { isTrial: true, subscriptionStatus: { in: ['active', 'trialing'] } } }),
      prisma.call.findMany({
        where: { createdAt: { gte: todayStart }, emailCollected: { not: null } },
      }),
      prisma.call.count({
        where: { createdAt: { gte: monthStart }, emailCollected: { not: null } },
      }),
      prisma.call.count({
        where: {
          createdAt: { gte: lastMonthStart, lte: lastMonthSamePeriod },
          emailCollected: { not: null },
        },
      }),
      prisma.payment.findMany({
        where: { paidAt: { gte: todayStart }, status: 'completed' },
      }),
      prisma.call.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { prospect: true },
      }),
      // For alerts: check consecutive missed calls
      prisma.call.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { status: true, outcome: true, createdAt: true },
      }),
    ]);

    const answeredToday = callsToday.filter((c) => c.status === 'completed' || c.outcome === 'answered').length;
    const missedToday = callsToday.filter((c) => c.outcome === 'missed' || c.outcome === 'no-answer').length;
    const transferredToday = callsToday.filter((c) => c.outcome === 'transferred').length;
    const leadsContactedToday = leadsToday.filter((l) => l.status === 'completed').length;

    // Calculate MRR
    const mrr = await prisma.client.aggregate({
      where: { subscriptionStatus: 'active', isTrial: false },
      _sum: { monthlyFee: true },
    });

    // Revenue today
    const revenueToday = paymentsToday.reduce((sum, p) => sum + Number(p.amount), 0);

    // Consecutive missed calls
    let consecutiveMissed = 0;
    for (const c of recentAlerts) {
      if (c.outcome === 'missed' || c.outcome === 'no-answer') consecutiveMissed++;
      else break;
    }

    return {
      botStatus,
      callsToday: callsToday.length,
      answeredToday,
      missedToday,
      transferredToday,
      callsThisMonth,
      callsLastMonthSamePeriod,
      lastCall,
      activeClients,
      trialClients,
      leadsToday: leadsToday.length,
      leadsContactedToday,
      leadsThisMonth,
      leadsLastMonthSamePeriod,
      mrr: Number(mrr._sum.monthlyFee || 0),
      revenueToday,
      recentCalls,
      consecutiveMissed,
      now,
    };
  }

  private buildOperationsEmbed(data: any): EmbedBuilder {
    const marieStatus = data.botStatus?.isActive ? 'ACTIVE' : 'PAUSED';
    const marieColor = data.botStatus?.isActive ? '🟢' : '🟡';

    return new EmbedBuilder()
      .setTitle('⚡ Live Operations')
      .setColor(data.botStatus?.isActive ? 0x00ff00 : 0xffaa00)
      .addFields(
        { name: 'Ashley Status', value: `${marieColor} **${marieStatus}**`, inline: true },
        { name: 'Calls Today', value: `**${data.callsToday}** total\n✅ ${data.answeredToday} answered\n❌ ${data.missedToday} missed\n🔀 ${data.transferredToday} transferred`, inline: true },
        { name: 'Calls This Month', value: `**${data.callsThisMonth}** ${percentChange(data.callsThisMonth, data.callsLastMonthSamePeriod)} vs last month`, inline: true },
        { name: 'Last Call', value: data.lastCall ? relativeTime(data.lastCall.createdAt) : 'No calls yet', inline: true },
        { name: 'Daily Quota', value: `${data.botStatus?.callsToday || 0}/${data.botStatus?.callsQuotaDaily || 50}`, inline: true },
      )
      .setFooter({ text: `Updated ${formatTimestamp(data.now)}` });
  }

  private buildRevenueEmbed(data: any): EmbedBuilder {
    const conversionRate = data.callsToday > 0
      ? ((data.leadsToday / data.callsToday) * 100).toFixed(1)
      : '0';

    return new EmbedBuilder()
      .setTitle('💰 Revenue & Leads')
      .setColor(0x00d4aa)
      .addFields(
        { name: 'MRR', value: `**$${data.mrr.toLocaleString()}**`, inline: true },
        { name: 'Active Clients', value: `**${data.activeClients}** paid\n**${data.trialClients}** trial`, inline: true },
        { name: 'Revenue Today', value: `**$${data.revenueToday.toLocaleString()}**`, inline: true },
        { name: 'Leads Today', value: `**${data.leadsToday}** captured\n${data.leadsContactedToday} contacted`, inline: true },
        { name: 'Leads This Month', value: `**${data.leadsThisMonth}** ${percentChange(data.leadsThisMonth, data.leadsLastMonthSamePeriod)} vs last month`, inline: true },
        { name: 'Conversion Rate', value: `**${conversionRate}%**`, inline: true },
      )
      .setFooter({ text: `Updated ${formatTimestamp(data.now)}` });
  }

  private buildActivityEmbed(data: any): EmbedBuilder {
    const lines = data.recentCalls.map((call: any) => {
      const time = call.createdAt ? `<t:${Math.floor(call.createdAt.getTime() / 1000)}:t>` : '?';
      const phone = maskPhone(call.phoneNumber);
      const duration = formatDuration(call.durationSeconds);
      const status = statusEmoji(call.outcome || call.status);
      const lead = call.emailCollected ? '📧' : '';
      return `${time} | ${phone} | ${duration} | ${status} ${call.outcome || call.status} ${lead}`;
    });

    return new EmbedBuilder()
      .setTitle('📋 Live Activity Feed')
      .setColor(0x5865f2)
      .setDescription(lines.length > 0 ? lines.join('\n') : 'No recent calls')
      .setFooter({ text: `Last 8 calls | Updated ${formatTimestamp(data.now)}` });
  }

  private buildAlertsEmbed(data: any): EmbedBuilder {
    const alerts: string[] = [];

    if (data.consecutiveMissed >= 3) {
      alerts.push(`🔴 **CRITICAL**: ${data.consecutiveMissed} consecutive missed calls`);
    }
    if (data.botStatus && !data.botStatus.isActive) {
      alerts.push('🟡 **WARNING**: AI is currently paused');
    }
    if (data.leadsToday > 0) {
      alerts.push(`🟡 **INFO**: ${data.leadsToday} new lead(s) captured today`);
    }

    return new EmbedBuilder()
      .setTitle('🚨 Active Alerts')
      .setColor(alerts.some((a) => a.includes('CRITICAL')) ? 0xff0000 : alerts.length > 0 ? 0xffaa00 : 0x00ff00)
      .setDescription(alerts.length > 0 ? alerts.join('\n') : '✅ No active alerts')
      .setFooter({ text: `Updated ${formatTimestamp(data.now)}` });
  }

  private buildHealthEmbed(data: any): EmbedBuilder {
    const uptimeSeconds = getUptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    return new EmbedBuilder()
      .setTitle('🏥 System Health')
      .setColor(0x5865f2)
      .addFields(
        { name: 'Bot Uptime', value: `${hours}h ${minutes}m`, inline: true },
        { name: 'Database', value: '🟢 Operational', inline: true },
        { name: 'Discord API', value: `🟢 ${Math.round(this.client.ws.ping)}ms`, inline: true },
      )
      .setFooter({ text: `Updated ${formatTimestamp(data.now)}` });
  }

  private buildButtons(): ActionRowBuilder<ButtonBuilder>[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('pause_ai').setLabel('⏸ Pause All AI').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('resume_ai').setLabel('▶ Resume All AI').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('restart_marie').setLabel('🔄 Restart Ashley').setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('live_report').setLabel('📊 Live Report').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('export_leads').setLabel('📥 Export Leads').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('export_calls').setLabel('📥 Export Calls').setStyle(ButtonStyle.Secondary),
    );

    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('deploy').setLabel('🚀 Deploy').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('claude_code').setLabel('🤖 Claude Code').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('view_logs').setLabel('📜 Logs').setStyle(ButtonStyle.Secondary),
    );

    return [row1, row2, row3];
  }
}
