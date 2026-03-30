import { env } from '../config/env';
import { logger } from '../config/logger';

type DiscordChannel = 'default' | 'calls' | 'leads' | 'system' | 'alerts';

const CHANNEL_WEBHOOKS: Record<DiscordChannel, () => string> = {
  default: () => env.DISCORD_WEBHOOK_URL,
  calls:   () => env.DISCORD_WEBHOOK_CALLS || env.DISCORD_WEBHOOK_URL,
  leads:   () => env.DISCORD_WEBHOOK_LEADS || env.DISCORD_WEBHOOK_URL,
  system:  () => env.DISCORD_WEBHOOK_SYSTEM || env.DISCORD_WEBHOOK_URL,
  alerts:  () => env.DISCORD_WEBHOOK_ALERTS || env.DISCORD_WEBHOOK_URL,
};

export class DiscordService {
  async notify(message: string, channel: DiscordChannel = 'default') {
    const url = CHANNEL_WEBHOOKS[channel]();
    if (!url) {
      logger.debug('Discord webhook not configured, skipping notification');
      return;
    }

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });
    } catch (error) {
      logger.error('Discord notification failed:', error);
    }
  }

  // Convenience helpers
  async notifyCalls(message: string)  { return this.notify(message, 'calls'); }
  async notifyLeads(message: string)  { return this.notify(message, 'leads'); }
  async notifySystem(message: string) { return this.notify(message, 'system'); }
  async notifyAlerts(message: string) { return this.notify(message, 'alerts'); }
}

export const discordService = new DiscordService();
