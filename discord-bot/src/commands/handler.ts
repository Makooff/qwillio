import { ChatInputCommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { execSync } from 'child_process';
import { prisma } from '../database';
import { config } from '../config';
import { logger } from '../utils/logger';
import { claudeCodeManager, claudeChannelBridge, dashboardManager, getUptime } from '../bot';
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
    case 'contracts':
      await handleContracts(interaction);
      break;
    case 'export':
      await handleExport(interaction);
      break;
    case 'ask':
      await handleAsk(interaction);
      break;
    case 'stop':
      await handleStop(interaction);
      break;
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

  const bridgeStatus = claudeChannelBridge?.getStatus();
  const bridgeValue = bridgeStatus?.isRunning
    ? `🟢 Running (${bridgeStatus.durationSeconds}s)\n\`${bridgeStatus.currentTask}\``
    : '⚪ Idle';

  const embed = new EmbedBuilder()
    .setTitle('📊 Bot Status')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Uptime', value: `${hours}h ${minutes}m`, inline: true },
      { name: 'Ashley', value: botStatus?.isActive ? '🟢 Active' : '🔴 Paused', inline: true },
      { name: 'Claude Code Sessions', value: `${claudeSessions}/${config.maxClaudeCodeSessions}`, inline: true },
      { name: 'Thread Process', value: activeProcess ? '🟢 Running' : '⚪ Idle', inline: true },
      { name: 'Channel Bridge', value: bridgeValue, inline: false },
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

async function handleContracts(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  try {
    const quotes = await prisma.quote.findMany({
      include: { prospect: true },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    if (quotes.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('📄 Contracts')
        .setColor(0x5865f2)
        .setDescription('No contracts found yet. Contracts are created when quotes are sent to prospects.')
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const contractLines = quotes.map((q) => {
      const prospect = q.prospect?.businessName || q.prospect?.contactName || 'Unknown';
      const pkg = q.packageType.charAt(0).toUpperCase() + q.packageType.slice(1);
      const monthly = Number(q.monthlyFee);
      const setup = Number(q.setupFee);

      let status = '⚪ Draft';
      if (q.contractSignedAt) {
        status = '✅ Signed';
      } else if (q.docusignEnvelopeId) {
        status = '⏳ Pending Signature';
      } else if (q.status === 'sent') {
        status = '📤 Sent';
      } else if (q.status === 'accepted') {
        status = '🟢 Accepted';
      } else if (q.status === 'expired') {
        status = '🔴 Expired';
      }

      const signedDate = q.contractSignedAt
        ? ` — Signed ${q.contractSignedAt.toLocaleDateString()}`
        : '';

      return `**${prospect}** — ${pkg}\n` +
        `  💰 $${monthly}/mo + $${setup} setup | ${status}${signedDate}`;
    });

    // Stats
    const total = quotes.length;
    const signed = quotes.filter(q => q.contractSignedAt).length;
    const pending = quotes.filter(q => q.docusignEnvelopeId && !q.contractSignedAt).length;
    const totalMRR = quotes
      .filter(q => q.contractSignedAt)
      .reduce((sum, q) => sum + Number(q.monthlyFee), 0);

    const embed = new EmbedBuilder()
      .setTitle('📄 Contracts & DocuSign Status')
      .setColor(0x5865f2)
      .setDescription(contractLines.join('\n\n'))
      .addFields(
        { name: 'Total', value: `${total}`, inline: true },
        { name: 'Signed', value: `${signed} ✅`, inline: true },
        { name: 'Pending', value: `${pending} ⏳`, inline: true },
        { name: 'Signed MRR', value: `$${totalMRR.toLocaleString()}/mo`, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: 'Last 15 contracts shown' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    logger.error('Contracts command error:', error);
    await interaction.editReply(`❌ Failed to fetch contracts: ${error.message}`);
  }
}

async function handleAsk(interaction: ChatInputCommandInteraction): Promise<void> {
  const prompt = interaction.options.getString('prompt', true);

  if (!config.claudeCodeChannelId) {
    await interaction.reply({
      content: '⚠️ `DISCORD_CLAUDE_CODE_CHANNEL_ID` is not configured. Set it in your env vars.',
      ephemeral: true,
    });
    return;
  }

  const bridge = claudeChannelBridge;
  if (!bridge) {
    await interaction.reply({ content: '⚠️ Channel bridge not initialized yet.', ephemeral: true });
    return;
  }

  const status = bridge.getStatus();
  if (status.isRunning) {
    await interaction.reply({
      content: `⏳ Claude Code is already running (${status.durationSeconds}s): \`${status.currentTask}\`\nUse \`/stop\` to cancel.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({ content: `📨 Sent to Claude Code channel: \`${prompt.slice(0, 100)}\``, ephemeral: true });

  // Execute in background — output goes to the dedicated channel
  bridge.execute(prompt).catch((err) => logger.error('handleAsk execute error:', err));
}

async function handleStop(interaction: ChatInputCommandInteraction): Promise<void> {
  // Try channel bridge first, then thread sessions
  const bridgeStopped = claudeChannelBridge?.stop();

  if (bridgeStopped) {
    await interaction.reply({ content: '⏹ Channel bridge process stopped.', ephemeral: true });
    return;
  }

  const activeProcess = claudeCodeManager?.getActiveProcess();
  if (activeProcess?.process) {
    activeProcess.process.kill('SIGTERM');
    await interaction.reply({ content: '⏹ Claude Code thread process stopped.', ephemeral: true });
    return;
  }

  await interaction.reply({ content: 'No active Claude Code process to stop.', ephemeral: true });
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
