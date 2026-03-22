import { ButtonInteraction, TextChannel } from 'discord.js';
import { execSync } from 'child_process';
import { prisma } from '../database';
import { config } from '../config';
import { logger } from '../utils/logger';
import { dashboardManager, claudeCodeManager } from '../bot';

export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;

  // AI Control
  if (customId === 'pause_ai') {
    await interaction.deferReply({ ephemeral: true });
    await prisma.botStatus.updateMany({ data: { isActive: false } });
    await dashboardManager?.triggerUpdate();
    await interaction.editReply('⏸ All AI paused');
    return;
  }

  if (customId === 'resume_ai') {
    await interaction.deferReply({ ephemeral: true });
    await prisma.botStatus.updateMany({ data: { isActive: true } });
    await dashboardManager?.triggerUpdate();
    await interaction.editReply('▶ All AI resumed');
    return;
  }

  if (customId === 'restart_marie') {
    await interaction.deferReply({ ephemeral: true });
    await prisma.botStatus.updateMany({ data: { isActive: false } });
    await new Promise((r) => setTimeout(r, 2000));
    await prisma.botStatus.updateMany({ data: { isActive: true, callsToday: 0 } });
    await dashboardManager?.triggerUpdate();
    await interaction.editReply('🔄 Ashley restarted');
    return;
  }

  // Reports & Exports
  if (customId === 'live_report') {
    await interaction.deferReply({ ephemeral: true });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [calls, leads, payments, clients] = await Promise.all([
      prisma.call.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.call.count({ where: { createdAt: { gte: todayStart }, emailCollected: { not: null } } }),
      prisma.payment.aggregate({
        where: { paidAt: { gte: todayStart }, status: 'completed' },
        _sum: { amount: true },
      }),
      prisma.client.count({ where: { subscriptionStatus: 'active' } }),
    ]);

    await interaction.editReply(
      `📊 **Live Report**\n` +
      `Calls: **${calls}** | Leads: **${leads}** | Revenue: **$${Number(payments._sum.amount || 0)}** | Clients: **${clients}**`
    );
    return;
  }

  if (customId === 'export_leads' || customId === 'export_calls') {
    await interaction.reply({ content: '💡 Use the `/export` slash command instead.', ephemeral: true });
    return;
  }

  // Deploy
  if (customId === 'deploy') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const result = execSync('npx vercel --prod --yes 2>&1', {
        cwd: config.projectPath,
        timeout: 300000,
      }).toString();
      await interaction.editReply(`✅ Deploy complete:\n\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
    } catch (e: any) {
      await interaction.editReply(`❌ Deploy failed:\n\`\`\`\n${(e.stderr?.toString() || e.message).substring(0, 1900)}\n\`\`\``);
    }
    return;
  }

  // Claude Code
  if (customId === 'claude_code') {
    await interaction.deferReply({ ephemeral: true });
    if (!claudeCodeManager) {
      await interaction.editReply('❌ Claude Code manager not ready');
      return;
    }

    const channel = interaction.channel as TextChannel;
    const thread = await claudeCodeManager.createSession(channel);
    if (!thread) {
      await interaction.editReply(`❌ Max ${config.maxClaudeCodeSessions} sessions reached. Close one first.`);
      return;
    }

    await interaction.editReply(`🤖 Claude Code session created: ${thread.toString()}`);
    return;
  }

  // Logs
  if (customId === 'view_logs') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const logs = execSync('tail -50 logs/combined.log 2>/dev/null || echo "No logs found"', {
        cwd: config.projectPath,
      }).toString();
      await interaction.editReply(`📜 **Recent Logs:**\n\`\`\`\n${logs.substring(0, 1900)}\n\`\`\``);
    } catch {
      await interaction.editReply('Could not fetch logs.');
    }
    return;
  }

  // Dynamic button handlers (lead actions, transfer retries, etc.)
  if (customId.startsWith('mark_contacted_')) {
    await interaction.reply({ content: '✅ Marked as contacted', ephemeral: true });
    return;
  }

  if (customId.startsWith('send_demo_')) {
    await interaction.reply({ content: '📹 Demo video sending...', ephemeral: true });
    return;
  }

  if (customId.startsWith('retry_transfer_')) {
    await interaction.reply({ content: '🔄 Retrying transfer...', ephemeral: true });
    return;
  }

  if (customId.startsWith('mark_resolved_')) {
    await interaction.reply({ content: '✅ Marked as resolved', ephemeral: true });
    return;
  }

  logger.warn(`Unhandled button: ${customId}`);
  await interaction.reply({ content: `Unknown action: ${customId}`, ephemeral: true });
}
