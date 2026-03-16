import { config } from './config';
import { logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './database';
import { startBot, client } from './bot';
import { startWebhookServer } from './webhooks/server';

async function main(): Promise<void> {
  logger.info('Starting Qwillio Discord Bot...');

  // Validate required config
  if (!config.botToken) {
    logger.error('DISCORD_BOT_TOKEN is required');
    process.exit(1);
  }
  if (!config.guildId) {
    logger.error('DISCORD_GUILD_ID is required');
    process.exit(1);
  }
  if (!config.ownerId) {
    logger.error('DISCORD_OWNER_USER_ID is required');
    process.exit(1);
  }

  // Connect to database
  await connectDatabase();

  // Start webhook server
  startWebhookServer();

  // Start Discord bot
  await startBot();

  logger.info('Qwillio Discord Bot fully started');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  client.destroy();
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  client.destroy();
  await disconnectDatabase();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
});

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
