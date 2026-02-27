import { env } from '../config/env';
import { logger } from '../config/logger';

export class DiscordService {
  async notify(message: string) {
    if (!env.DISCORD_WEBHOOK_URL) {
      logger.debug('Discord webhook not configured, skipping notification');
      return;
    }

    try {
      await fetch(env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });
    } catch (error) {
      logger.error('Discord notification failed:', error);
    }
  }
}

export const discordService = new DiscordService();
