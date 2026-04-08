import dotenv from 'dotenv';
import path from 'path';
import type { StringValue } from 'ms';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173,https://frontend-orcin-psi-81.vercel.app',
  API_BASE_URL: process.env.API_BASE_URL || 'https://qwillio.onrender.com',

  DATABASE_URL: process.env.DATABASE_URL!,

  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_EXPIRES_IN: (process.env.JWT_EXPIRES_IN || '24h') as StringValue,
  JWT_REFRESH_EXPIRES_IN: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as StringValue,
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),

  VAPI_PUBLIC_KEY: process.env.VAPI_PUBLIC_KEY || '',
  VAPI_PRIVATE_KEY: process.env.VAPI_PRIVATE_KEY || '',
  VAPI_ASSISTANT_ID: process.env.VAPI_ASSISTANT_ID || '',
  VAPI_PHONE_NUMBER: process.env.VAPI_PHONE_NUMBER || '',
  VAPI_PHONE_NUMBER_ID: process.env.VAPI_PHONE_NUMBER_ID || '',
  VAPI_BASE_URL: process.env.VAPI_BASE_URL || 'https://api.vapi.ai',
  VAPI_MODEL: process.env.VAPI_MODEL || 'gpt-4-turbo',
  VAPI_VOICE_ID: process.env.VAPI_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', // Rachel (ElevenLabs)
  VAPI_VOICE_FALLBACK_1: process.env.VAPI_VOICE_FALLBACK_1 || 'MF3mGyEYCl7XYWbV9V6O', // Elli
  VAPI_VOICE_FALLBACK_2: process.env.VAPI_VOICE_FALLBACK_2 || 'EXAVITQu4vr4xnSDxMaL', // Bella
  VAPI_STABILITY: parseFloat(process.env.VAPI_STABILITY || '0.45'),
  VAPI_SIMILARITY_BOOST: parseFloat(process.env.VAPI_SIMILARITY_BOOST || '0.82'),
  VAPI_STYLE: parseFloat(process.env.VAPI_STYLE || '0.35'),
  VAPI_OPTIMIZE_LATENCY: parseInt(process.env.VAPI_OPTIMIZE_LATENCY || '4', 10),
  VAPI_INTERRUPTION_THRESHOLD: parseInt(process.env.VAPI_INTERRUPTION_THRESHOLD || '200', 10),
  VAPI_SILENCE_TIMEOUT: parseInt(process.env.VAPI_SILENCE_TIMEOUT || '8', 10),
  VAPI_MAX_DURATION: parseInt(process.env.VAPI_MAX_DURATION || '480', 10), // 8 minutes
  VAPI_WEBHOOK_SECRET: process.env.VAPI_WEBHOOK_SECRET || '',

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_LINK_BASIC: process.env.STRIPE_LINK_BASIC || '',
  STRIPE_LINK_PRO: process.env.STRIPE_LINK_PRO || '',
  STRIPE_LINK_ENTERPRISE: process.env.STRIPE_LINK_ENTERPRISE || '',
  STRIPE_PRICE_BASIC_SETUP: process.env.STRIPE_PRICE_BASIC_SETUP || '',
  STRIPE_PRICE_BASIC_MONTHLY: process.env.STRIPE_PRICE_BASIC_MONTHLY || '',
  STRIPE_PRICE_PRO_SETUP: process.env.STRIPE_PRICE_PRO_SETUP || '',
  STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  STRIPE_PRICE_ENTERPRISE_SETUP: process.env.STRIPE_PRICE_ENTERPRISE_SETUP || '',
  STRIPE_PRICE_ENTERPRISE_MONTHLY: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '',

  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'Qwillio <noreply@qwillio.com>',
  RESEND_REPLY_TO: process.env.RESEND_REPLY_TO || 'contact@qwillio.com',

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || '',

  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL || '',

  // Twilio (SMS + Phone Validation)
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_API_KEY_SID: process.env.TWILIO_API_KEY_SID || '',
  TWILIO_API_KEY_SECRET: process.env.TWILIO_API_KEY_SECRET || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
  SMS_ENABLED: process.env.SMS_ENABLED === 'true',

  CALLS_PER_DAY: parseInt(process.env.CALLS_PER_DAY || '50', 10),
  AUTOMATION_START_HOUR: parseInt(process.env.AUTOMATION_START_HOUR || '9', 10),
  AUTOMATION_END_HOUR: parseInt(process.env.AUTOMATION_END_HOUR || '19', 10),
  AUTOMATION_DAYS: (process.env.AUTOMATION_DAYS || '1,2,3,4,5').split(',').map(Number),
  CALL_INTERVAL_MINUTES: parseInt(process.env.CALL_INTERVAL_MINUTES || '20', 10),
  PROSPECTION_DAILY_QUOTA: parseInt(process.env.PROSPECTION_DAILY_QUOTA || '30', 10),
  PROSPECTION_RADIUS_METERS: parseInt(process.env.PROSPECTION_RADIUS_METERS || '5000', 10),
  PROSPECTION_CITIES: (process.env.PROSPECTION_CITIES || 'Bruxelles,Anvers,Gand').split(','),

  SENTRY_DSN: process.env.SENTRY_DSN || '',

  // DocuSign (eSignature)
  DOCUSIGN_INTEGRATION_KEY: process.env.DOCUSIGN_INTEGRATION_KEY || '',
  DOCUSIGN_USER_ID: process.env.DOCUSIGN_USER_ID || '',
  DOCUSIGN_ACCOUNT_ID: process.env.DOCUSIGN_ACCOUNT_ID || '',
  DOCUSIGN_PRIVATE_KEY: process.env.DOCUSIGN_PRIVATE_KEY || '', // base64-encoded RSA private key
  DOCUSIGN_AUTH_SERVER: process.env.DOCUSIGN_AUTH_SERVER || 'account-d.docusign.com', // sandbox default
  DOCUSIGN_WEBHOOK_SECRET: process.env.DOCUSIGN_WEBHOOK_SECRET || '',

  TZ: process.env.TZ || 'Europe/Brussels',

  // ─── Apify (Google Maps scraping) ────────────────────────
  APIFY_API_KEY: process.env.APIFY_API_KEY || '',
  APIFY_ACTOR_ID: process.env.APIFY_ACTOR_ID || 'compass~crawler-google-places', // correct actor name

  // ─── Claude API (script self-learning) ───────────────────
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  // ─── Discord multi-channel webhooks ──────────────────────
  DISCORD_WEBHOOK_CALLS: process.env.DISCORD_WEBHOOK_CALLS || '',
  DISCORD_WEBHOOK_LEADS: process.env.DISCORD_WEBHOOK_LEADS || '',
  DISCORD_WEBHOOK_SYSTEM: process.env.DISCORD_WEBHOOK_SYSTEM || '',
  DISCORD_WEBHOOK_ALERTS: process.env.DISCORD_WEBHOOK_ALERTS || '',

  // ─── Demo links (used in follow-up SMS/email) ────────────
  DEMO_LINK_EN: process.env.DEMO_LINK_EN || 'https://qwillio.com/demo',
  DEMO_LINK_FR: process.env.DEMO_LINK_FR || 'https://qwillio.com/demo-fr',

  // ─── Prospecting engine config ───────────────────────────
  MIN_PRIORITY_SCORE: parseInt(process.env.MIN_PRIORITY_SCORE || '10', 10),

  // ─── Admin access control ─────────────────────────────────
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'makho.off@gmail.com',
  ADMIN_SECRET: process.env.ADMIN_SECRET || '',
};
