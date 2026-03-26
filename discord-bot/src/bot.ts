import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  SlashCommandBuilder,
  Events,
} from 'discord.js';
import { config } from './config';
import { logger } from './utils/logger';
import { handleInteraction } from './commands/handler';
import { handleButtonInteraction } from './buttons/handler';
import { DashboardManager } from './dashboard/manager';
import { ChannelManager } from './channels/manager';
import { ClaudeCodeManager } from './claude-code/manager';
import { ClaudeChannelBridge } from './claude-code/channel-bridge';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

export let dashboardManager: DashboardManager;
export let channelManager: ChannelManager;
export let claudeCodeManager: ClaudeCodeManager;
export let claudeChannelBridge: ClaudeChannelBridge;

const startTime = Date.now();
export function getUptime(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

export async function startBot(): Promise<void> {
  // Register slash commands
  const commands = [
    new SlashCommandBuilder()
      .setName('status')
      .setDescription('Show bot and Claude Code status'),
    new SlashCommandBuilder()
      .setName('report')
      .setDescription('Generate a live report of all metrics'),
    new SlashCommandBuilder()
      .setName('export')
      .setDescription('Export data as CSV')
      .addStringOption((opt) =>
        opt
          .setName('type')
          .setDescription('What to export')
          .setRequired(true)
          .addChoices(
            { name: 'Leads', value: 'leads' },
            { name: 'Calls', value: 'calls' }
          )
      ),
    new SlashCommandBuilder()
      .setName('stop')
      .setDescription('Stop current Claude Code process'),
    new SlashCommandBuilder()
      .setName('files')
      .setDescription('Show last 10 modified files'),
    new SlashCommandBuilder()
      .setName('diff')
      .setDescription('Show git diff of uncommitted changes'),
    new SlashCommandBuilder()
      .setName('commit')
      .setDescription('Commit all changes')
      .addStringOption((opt) =>
        opt.setName('message').setDescription('Commit message').setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('push')
      .setDescription('Push to main branch'),
    new SlashCommandBuilder()
      .setName('deploy')
      .setDescription('Deploy to Vercel'),
    new SlashCommandBuilder()
      .setName('logs')
      .setDescription('Show recent application logs'),
    new SlashCommandBuilder()
      .setName('rollback')
      .setDescription('Rollback to previous Vercel deployment'),
    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Clear Claude Code conversation context'),
    new SlashCommandBuilder()
      .setName('close')
      .setDescription('Archive current Claude Code thread'),
    new SlashCommandBuilder()
      .setName('contracts')
      .setDescription('Show all contracts and their DocuSign status'),
    new SlashCommandBuilder()
      .setName('ask')
      .setDescription('Send a prompt to Claude Code via the dedicated channel')
      .addStringOption((opt) =>
        opt.setName('prompt').setDescription('The instruction for Claude Code').setRequired(true)
      ),
  ];

  const rest = new REST({ version: '10' }).setToken(config.botToken);

  try {
    logger.info('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(client.application?.id || '', config.guildId), {
      body: commands.map((c) => c.toJSON()),
    });
    logger.info('Slash commands registered');
  } catch (error) {
    logger.warn('Could not register slash commands (will retry on ready):', error);
  }

  // Event handlers
  client.on(Events.ClientReady, async (readyClient) => {
    logger.info(`Bot logged in as ${readyClient.user.tag}`);

    // Register commands now that we have application ID
    try {
      await rest.put(
        Routes.applicationGuildCommands(readyClient.application.id, config.guildId),
        { body: commands.map((c) => c.toJSON()) }
      );
      logger.info('Slash commands registered successfully');
    } catch (error) {
      logger.error('Failed to register slash commands:', error);
    }

    // Initialize managers
    dashboardManager = new DashboardManager(readyClient);
    channelManager = new ChannelManager(readyClient);
    claudeCodeManager = new ClaudeCodeManager(readyClient);
    claudeChannelBridge = new ClaudeChannelBridge(readyClient);

    // Start dashboard and channel bridge
    await dashboardManager.initialize();
    await claudeChannelBridge.initialize();

    // Post system notification
    await channelManager.postSystem('🟢 **Qwillio Bot** started successfully');
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      // Owner-only check
      if (interaction.user.id !== config.ownerId) {
        if (interaction.isRepliable()) {
          await interaction.reply({ content: '⛔ Access denied.', ephemeral: true });
        }
        return;
      }

      if (interaction.isChatInputCommand()) {
        await handleInteraction(interaction);
      } else if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
      }
    } catch (error) {
      logger.error('Interaction error:', error);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
      }
    }
  });

  // Handle Claude Code thread messages and dedicated channel bridge
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.author.id !== config.ownerId) return;

    // Dedicated #qwillio-claude-code channel bridge
    if (claudeChannelBridge && claudeChannelBridge.isChannelMessage(message)) {
      await claudeChannelBridge.handleMessage(message);
      return;
    }

    // Claude Code thread sessions
    if (message.channel.isThread() && claudeCodeManager && message.channel.name.startsWith('Claude Code')) {
      await claudeCodeManager.handleMessage(message);
    }
  });

  client.on(Events.Error, (error) => {
    logger.error('Discord client error:', error);
  });

  // Login
  await client.login(config.botToken);
}
