import dotenv from 'dotenv';
import path from 'path';
import type { StringValue } from 'ms';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ─── Fix deleted VAPI assistant IDs (Render env var has stale value) ───
const DELETED_ASSISTANT_ID = 'd98364c2-8ca4-4efb-af00-8534af00fa06';
const CORRECT_ASSISTANT_ID_EN = 'e583a22d-0b73-4bb1-95c8-8de334f06089';
const CORRECT_ASSISTANT_ID_FR = '327fa4b1-e3b7-4de7-bd06-906d2d42d7dd';

function resolveAssistantId(envVal: string | undefined, correctVal: string): string {
  if (!envVal || envVal === DELETED_ASSISTANT_ID || !/^[0-9a-f]{8}-/.test(envVal)) return correctVal;
  return envVal;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  FRONTEND_URL: (process.env.FRONTEND_URL || 'http://localhost:5173,https://frontend-orcin-psi-81.vercel.app').replace(/\\n/g, '').trim(),
  API_BASE_URL: process.env.API_BASE_URL || 'https://qwillio.onrender.com',

  DATABASE_URL: process.env.DATABASE_URL!,

  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_EXPIRES_IN: (process.env.JWT_EXPIRES_IN || '24h') as StringValue,
  JWT_REFRESH_EXPIRES_IN: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as StringValue,
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),

  VAPI_PUBLIC_KEY: process.env.VAPI_PUBLIC_KEY || '',
  VAPI_PRIVATE_KEY: process.env.VAPI_PRIVATE_KEY || '',
  VAPI_ASSISTANT_ID: resolveAssistantId(process.env.VAPI_ASSISTANT_ID, CORRECT_ASSISTANT_ID_EN),
  VAPI_ASSISTANT_ID_FR: resolveAssistantId(process.env.VAPI_ASSISTANT_ID_FR, CORRECT_ASSISTANT_ID_FR),
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
  VAPI_SILENCE_TIMEOUT: Math.max(10, parseInt(process.env.VAPI_SILENCE_TIMEOUT || '10', 10)),
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
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'Qwillio <hello@qwillio.com>',
  RESEND_FROM_NAME: process.env.RESEND_FROM_NAME || 'Qwillio',
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

  TZ: process.env.TZ || 'Europe/Brussels',

  // ─── Apify (Google Maps scraping) ────────────────────────
  APIFY_API_KEY: process.env.APIFY_API_KEY || '',
  APIFY_ACTOR_ID: process.env.APIFY_ACTOR_ID || 'compass~crawler-google-places',

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
