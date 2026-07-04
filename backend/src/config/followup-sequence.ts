// ═══════════════════════════════════════════════════════════
// AUTOMATED FOLLOW-UP SEQUENCE
// Defines the multi-channel follow-up timeline after a call
// ═══════════════════════════════════════════════════════════

export interface FollowUpStep {
  type: 'sms' | 'email';
  reminderType: string;
  delayMs: number;
  description: string;
  condition?: 'quote_not_viewed' | 'quote_not_accepted' | 'always';
}

// Sequence triggered after a QUALIFIED/INTERESTED call
export const INTERESTED_FOLLOWUP_SEQUENCE: FollowUpStep[] = [
  {
    type: 'sms',
    reminderType: 'sms_post_call',
    delayMs: 0, // Immediately after call
    description: 'SMS with quote link',
    condition: 'always',
  },
  {
    type: 'email',
    reminderType: 'email_video',
    delayMs: 5 * 60 * 1000, // T+5 minutes
    description: 'Email with Loom video link',
    condition: 'always',
  },
  {
    type: 'email',
    reminderType: 'email_reminder_24h',
    delayMs: 24 * 60 * 60 * 1000, // T+24 hours
    description: 'Reminder if quote not viewed',
    condition: 'quote_not_viewed',
  },
  {
    type: 'email',
    reminderType: 'email_dashboard_48h',
    delayMs: 48 * 60 * 60 * 1000, // T+48 hours
    description: 'Dashboard preview + testimonial',
    condition: 'quote_not_accepted',
  },
];

// Callback retry schedule for no-answer/voicemail calls
export const CALLBACK_RETRY_DELAYS = [
  2 * 60 * 60 * 1000,    // +2 hours
  24 * 60 * 60 * 1000,   // +24 hours
  72 * 60 * 60 * 1000,   // +72 hours
];

// Niche-specific preferred send hours for email follow-ups
export const NICHE_SEND_TIMES: Record<string, number> = {
  plumber: 8,
  hvac: 8,
  dental: 9,
  salon: 10,
  law: 11,
  restaurant: 14,
  garage: 8,
  hotel: 14,
  auto: 8,
  medical: 9,
  default: 9,
};

// MAX_CALL_ATTEMPTS is the single source of truth in scheduling.ts
// Re-export for backwards compatibility
export { MAX_CALL_ATTEMPTS } from './scheduling';
