import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { maskPhone, maskEmail, formatDuration, formatTimestamp } from '../utils/formatting';

export class ChannelManager {
  private client: Client;
  private channels: Map<string, TextChannel> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  private async getChannel(name: keyof typeof config.channels): Promise<TextChannel | null> {
    const id = config.channels[name];
    if (!id) return null;

    if (this.channels.has(name)) return this.channels.get(name)!;

    try {
      const ch = await this.client.channels.fetch(id);
      if (ch && ch.isTextBased()) {
        this.channels.set(name, ch as TextChannel);
        return ch as TextChannel;
      }
    } catch (error) {
      logger.warn(`Could not fetch channel ${name}:`, error);
    }
    return null;
  }

  // ═══════════════════════════════════════════════════
  // #qwillio-calls
  // ═══════════════════════════════════════════════════
  async postCallStarted(data: {
    phoneNumber: string;
    vapiCallId?: string;
  }): Promise<string | null> {
    const ch = await this.getChannel('calls');
    if (!ch) return null;

    const embed = new EmbedBuilder()
      .setTitle('📞 Call In Progress')
      .setColor(0x5865f2)
      .setDescription(`**${maskPhone(data.phoneNumber)}** — started just now`)
      .setTimestamp();

    const msg = await ch.send({ embeds: [embed] });
    return msg.id;
  }

  async editCallEnded(messageId: string, data: {
    phoneNumber: string;
    duration: number | null;
    outcome: string;
    emailCollected?: string | null;
    hasRecording?: boolean;
    callId?: string;
  }): Promise<void> {
    const ch = await this.getChannel('calls');
    if (!ch) return;

    try {
      const msg = await ch.messages.fetch(messageId);
      const color = data.emailCollected ? 0x00ff00 : data.outcome === 'transferred' ? 0x5865f2 : data.outcome === 'missed' ? 0xff0000 : 0x808080;

      const embed = new EmbedBuilder()
        .setTitle(`📞 Call ${data.outcome === 'missed' ? 'Missed' : 'Completed'}`)
        .setColor(color)
        .addFields(
          { name: 'Number', value: maskPhone(data.phoneNumber), inline: true },
          { name: 'Duration', value: formatDuration(data.duration), inline: true },
          { name: 'Outcome', value: data.outcome || 'unknown', inline: true },
        )
        .setTimestamp();

      if (data.emailCollected) {
        embed.addFields({ name: 'Lead', value: `📧 ${maskEmail(data.emailCollected)}`, inline: true });
      }

      const components: ActionRowBuilder<ButtonBuilder>[] = [];
      if (data.emailCollected || data.hasRecording) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        if (data.emailCollected) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`view_lead_${data.callId}`)
              .setLabel('View Lead')
              .setStyle(ButtonStyle.Primary)
          );
        }
        if (data.hasRecording) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`listen_recording_${data.callId}`)
              .setLabel('Listen')
              .setStyle(ButtonStyle.Secondary)
          );
        }
        components.push(row);
      }

      await msg.edit({ embeds: [embed], components });
    } catch (error) {
      logger.warn('Could not edit call message:', error);
    }
  }

  async postCall(data: {
    phoneNumber: string;
    duration: number | null;
    outcome: string;
    emailCollected?: string | null;
    hasRecording?: boolean;
    callId?: string;
  }): Promise<void> {
    const ch = await this.getChannel('calls');
    if (!ch) return;

    const color = data.emailCollected ? 0x00ff00 : data.outcome === 'transferred' ? 0x5865f2 : data.outcome === 'missed' ? 0xff0000 : 0x808080;

    const embed = new EmbedBuilder()
      .setTitle(`📞 Call ${data.outcome === 'missed' ? 'Missed' : 'Completed'}`)
      .setColor(color)
      .addFields(
        { name: 'Number', value: maskPhone(data.phoneNumber), inline: true },
        { name: 'Duration', value: formatDuration(data.duration), inline: true },
        { name: 'Outcome', value: data.outcome || 'unknown', inline: true },
      )
      .setTimestamp();

    if (data.emailCollected) {
      embed.addFields({ name: 'Lead', value: `📧 ${maskEmail(data.emailCollected)}`, inline: true });
    }

    await ch.send({ embeds: [embed] });
  }

  // ═══════════════════════════════════════════════════
  // #qwillio-leads
  // ═══════════════════════════════════════════════════
  async postLead(data: {
    businessName?: string;
    email: string;
    phone?: string;
    niche?: string;
    callDuration?: number;
    callId?: string;
  }): Promise<void> {
    const ch = await this.getChannel('leads');
    if (!ch) return;

    const embed = new EmbedBuilder()
      .setTitle('🎯 New Lead Captured')
      .setColor(0xffd700)
      .addFields(
        { name: 'Business', value: data.businessName || 'Unknown', inline: true },
        { name: 'Email', value: maskEmail(data.email), inline: true },
        { name: 'Phone', value: data.phone ? maskPhone(data.phone) : 'N/A', inline: true },
        { name: 'Niche', value: data.niche || 'Unknown', inline: true },
        { name: 'Call Duration', value: formatDuration(data.callDuration || 0), inline: true },
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`mark_contacted_${data.callId}`).setLabel('Mark Contacted').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`send_demo_${data.callId}`).setLabel('Send Demo Video').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`delete_lead_${data.callId}`).setLabel('Delete').setStyle(ButtonStyle.Danger),
    );

    await ch.send({ embeds: [embed], components: [row] });
  }

  // ═══════════════════════════════════════════════════
  // #qwillio-transfers
  // ═══════════════════════════════════════════════════
  async postTransfer(data: {
    niche?: string;
    reason: string;
    triggerPhrase?: string;
    status: string;
    transferId?: string;
  }): Promise<void> {
    const ch = await this.getChannel('transfers');
    if (!ch) return;

    const color = data.status === 'completed' ? 0x00ff00 : data.status === 'failed' ? 0xff0000 : 0x5865f2;

    const embed = new EmbedBuilder()
      .setTitle(`🔀 Transfer ${data.status === 'completed' ? 'Success' : data.status === 'failed' ? 'Failed' : 'Initiated'}`)
      .setColor(color)
      .addFields(
        { name: 'Niche', value: data.niche || 'Unknown', inline: true },
        { name: 'Reason', value: data.reason, inline: true },
      )
      .setTimestamp();

    if (data.triggerPhrase) {
      embed.addFields({ name: 'Trigger', value: `"${data.triggerPhrase}"`, inline: false });
    }

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (data.status === 'failed') {
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`retry_transfer_${data.transferId}`).setLabel('Retry Transfer').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`mark_resolved_${data.transferId}`).setLabel('Mark Resolved').setStyle(ButtonStyle.Success),
        )
      );
    }

    await ch.send({ embeds: [embed], components });
  }

  // ═══════════════════════════════════════════════════
  // #qwillio-alerts
  // ═══════════════════════════════════════════════════
  async postAlert(data: {
    level: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    buttonId?: string;
    buttonLabel?: string;
  }): Promise<void> {
    const ch = await this.getChannel('alerts');
    if (!ch) return;

    const colors = { critical: 0xff0000, warning: 0xffaa00, info: 0x5865f2 };
    const icons = { critical: '🔴', warning: '🟡', info: '🔵' };

    const embed = new EmbedBuilder()
      .setTitle(`${icons[data.level]} ${data.title}`)
      .setColor(colors[data.level])
      .setDescription(data.description)
      .setTimestamp();

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (data.buttonId && data.buttonLabel) {
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(data.buttonId).setLabel(data.buttonLabel).setStyle(ButtonStyle.Primary),
        )
      );
    }

    await ch.send({ embeds: [embed], components });
  }

  // ═══════════════════════════════════════════════════
  // #qwillio-billing
  // ═══════════════════════════════════════════════════
  async postBilling(data: {
    type: 'subscription' | 'payment' | 'failed' | 'cancelled' | 'upgrade';
    clientName: string;
    plan?: string;
    amount?: number;
    details?: string;
  }): Promise<void> {
    const ch = await this.getChannel('billing');
    if (!ch) return;

    const colors: Record<string, number> = {
      subscription: 0x00ff00,
      payment: 0x00d4aa,
      failed: 0xff0000,
      cancelled: 0xff6600,
      upgrade: 0x5865f2,
    };

    const icons: Record<string, string> = {
      subscription: '🆕',
      payment: '💳',
      failed: '❌',
      cancelled: '🚫',
      upgrade: '⬆️',
    };

    const embed = new EmbedBuilder()
      .setTitle(`${icons[data.type]} ${data.type.charAt(0).toUpperCase() + data.type.slice(1)}`)
      .setColor(colors[data.type] || 0x808080)
      .addFields(
        { name: 'Client', value: data.clientName, inline: true },
      )
      .setTimestamp();

    if (data.plan) embed.addFields({ name: 'Plan', value: data.plan, inline: true });
    if (data.amount !== undefined) embed.addFields({ name: 'Amount', value: `$${data.amount}`, inline: true });
    if (data.details) embed.setDescription(data.details);

    await ch.send({ embeds: [embed] });
  }

  // ═══════════════════════════════════════════════════
  // #qwillio-system
  // ═══════════════════════════════════════════════════
  async postSystem(message: string, level: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    const ch = await this.getChannel('system');
    if (!ch) return;

    const colors = { info: 0x5865f2, warning: 0xffaa00, error: 0xff0000 };

    const embed = new EmbedBuilder()
      .setColor(colors[level])
      .setDescription(message)
      .setTimestamp();

    await ch.send({ embeds: [embed] });
  }
}
