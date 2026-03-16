import { ChatInputCommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { execSync } from 'child_process';
import { prisma } from '../database';
import { config } from '../config';
import { logger } from '../utils/logger';
import { claudeCodeManager, dashboardManager, getUptime } from '../bot';
import { stringify } from 'csv-stringify/sync';
import { maskPhone, maskEmail, formatDuration, formatTimestamp } from '../utils/formatting';

export async function handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName } = interaction;

  switch (commandName) {
    case 'status':
      await handleStatus(interaction);
      break;
    case 'report':
      await handleReport(interaction);
      break;
    case 'export':
      await handleExport(interaction);
      break;
    case 'stop':
    case 'files':
    case 'diff':
    case 'commit':
    case 'push':
    case 'deploy':
    case 'logs':
    case 'rollback':
    case 'clear':
    case 'close':
      await interaction.reply({ content: '💡 Use these commands inside a Claude Code thread.', ephemeral: true });
      break;
    default:
      await interaction.reply({ content: `Unknown command: ${commandName}`, ephemeral: true });
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const uptimeSeconds = getUptime();
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);

  const botStatus = await prisma.botStatus.findFirst();
  const claudeSessions = claudeCodeManager?.getSessionCount() || 0;
  const activeProcess = claudeCodeManager?.getActiveProcess();

  const embed = new EmbedBuilder()
    .setTitle('📊 Bot Status')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Uptime', value: `${hours}h ${minutes}m`, inline: true },
      { name: 'Marie', value: botStatus?.isActive ? '🟢 Active' : '🔴 Paused', inline: true },
      { name: 'Claude Code Sessions', value: `${claudeSessions}/${config.maxClaudeCodeSessions}`, inline: true },
      { name: 'Active Process', value: activeProcess ? '🟢 Running' : '⚪ Idle', inline: true },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleReport(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [callsToday, leadsToday, paymentsToday, activeClients, trialClients] = await Promise.all([
    prisma.call.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.call.count({ where: { createdAt: { gte: todayStart }, emailCollected: { not: null } } }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: todayStart }, status: 'completed' },
      _sum: { amount: true },
    }),
    prisma.client.count({ where: { subscriptionStatus: 'active', isTrial: false } }),
    prisma.client.count({ where: { isTrial: true } }),
  ]);

  const mrr = await prisma.client.aggregate({
    where: { subscriptionStatus: 'active', isTrial: false },
    _sum: { monthlyFee: true },
  });

  const embed = new EmbedBuilder()
    .setTitle('📊 Live Report')
    .setColor(0x00d4aa)
    .addFields(
      { name: 'Calls Today', value: `${callsToday}`, inline: true },
      { name: 'Leads Today', value: `${leadsToday}`, inline: true },
      { name: 'Revenue Today', value: `$${Number(paymentsToday._sum.amount || 0).toLocaleString()}`, inline: true },
      { name: 'MRR', value: `$${Number(mrr._sum.monthlyFee || 0).toLocaleString()}`, inline: true },
      { name: 'Active Clients', value: `${activeClients} paid / ${trialClients} trial`, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: `Generated ${formatTimestamp(now)}` });

  await interaction.editReply({ embeds: [embed] });
}

async function handleExport(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const type = interaction.options.getString('type', true);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    if (type === 'leads') {
      const leads = await prisma.call.findMany({
        where: {
          createdAt: { gte: todayStart },
          emailCollected: { not: null },
        },
        include: { prospect: true },
        orderBy: { createdAt: 'desc' },
      });

      const csvData = leads.map((l) => ({
        date: l.createdAt.toISOString(),
        business: l.prospect?.businessName || '',
        email: l.emailCollected || '',
        phone: l.phoneNumber,
        duration: l.durationSeconds || 0,
        outcome: l.outcome || '',
      }));

      const csv = stringify(csvData, { header: true });
      const buffer = Buffer.from(csv, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `leads_${new Date().toISOString().split('T')[0]}.csv` });

      await interaction.editReply({ content: `📥 ${leads.length} leads exported`, files: [attachment] });
    } else if (type === 'calls') {
      const calls = await prisma.call.findMany({
        where: { createdAt: { gte: todayStart } },
        include: { prospect: true },
        orderBy: { createdAt: 'desc' },
      });

      const csvData = calls.map((c) => ({
        date: c.createdAt.toISOString(),
        phone: maskPhone(c.phoneNumber),
        business: c.prospect?.businessName || '',
        duration: c.durationSeconds || 0,
        status: c.status,
        outcome: c.outcome || '',
        emailCollected: c.emailCollected ? 'yes' : 'no',
      }));

      const csv = stringify(csvData, { header: true });
      const buffer = Buffer.from(csv, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `calls_${new Date().toISOString().split('T')[0]}.csv` });

      await interaction.editReply({ content: `📥 ${calls.length} calls exported`, files: [attachment] });
    }
  } catch (error: any) {
    await interaction.editReply(`❌ Export failed: ${error.message}`);
  }
}
