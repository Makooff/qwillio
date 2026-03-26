import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  // Discord
  botToken: process.env.DISCORD_BOT_TOKEN || '',
  guildId: process.env.DISCORD_GUILD_ID || '',
  ownerId: process.env.DISCORD_OWNER_USER_ID || '',

  // Channel IDs
  channels: {
    dashboard: process.env.DISCORD_DASHBOARD_CHANNEL_ID || '',
    calls: process.env.DISCORD_CALLS_CHANNEL_ID || '',
    leads: process.env.DISCORD_LEADS_CHANNEL_ID || '',
    transfers: process.env.DISCORD_TRANSFERS_CHANNEL_ID || '',
    alerts: process.env.DISCORD_ALERTS_CHANNEL_ID || '',
    billing: process.env.DISCORD_BILLING_CHANNEL_ID || '',
    system: process.env.DISCORD_SYSTEM_CHANNEL_ID || '',
  },

  // Claude Code channel bridge
  claudeCodeChannelId: process.env.DISCORD_CLAUDE_CODE_CHANNEL_ID || '1458454372647440578',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Webhook Server
  webhookPort: parseInt(process.env.WEBHOOK_PORT || '3001', 10),

  // External APIs
  vapiPrivateKey: process.env.VAPI_PRIVATE_KEY || '',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  vapiWebhookSecret: process.env.VAPI_WEBHOOK_SECRET || '',

  // Project
  projectPath: process.env.PROJECT_PATH || 'C:\\Users\\matpo\\Documents\\Pulse',

  // Limits
  maxClaudeCodeSessions: 3,
  claudeCodeAutoArchiveHours: 4,
  dashboardUpdateIntervalMs: 30_000,
  healthCheckIntervalMs: 30_000,
};
