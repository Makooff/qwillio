/**
 * Central source of truth for all transactional & marketing SMS bodies.
 * Production senders AND the admin test panel pull from this module so
 * the preview always matches what real prospects/customers receive.
 *
 * Style rules (mirror the Qwillio email brand):
 *   - Plain text only. No emojis. No "Powered by Qwillio".
 *   - Short, professional, one clear CTA.
 *   - Marketing/post-call SMS end with "Reply STOP to opt out." (TCPA).
 *   - Transactional booking SMS skip STOP (not marketing).
 */

const STOP = 'Reply STOP to opt out.';

export const smsTemplates = {
  /** Standard follow-up after a qualified call (admin test "welcome"). */
  welcome: (d: { firstName: string; agentName: string; registrationLink: string }) =>
    `Hi ${d.firstName}, it's ${d.agentName} from Qwillio. Start your free 30-day trial: ${d.registrationLink}. No commitment. ${STOP}`,

  /** Bot dropped to voicemail — leave a written follow-up. */
  voicemail: (d: { niche: string; registrationLink: string }) =>
    `Hi, I left you a voicemail about Qwillio — AI receptionist for ${d.niche} businesses. Start your free 30-day trial: ${d.registrationLink}. ${STOP}`,

  /** Outcome "interested" / "qualified" on a live call. */
  interested: (d: { firstName: string; agentName: string; registrationLink: string }) =>
    `Hi ${d.firstName}, thanks for chatting with ${d.agentName} from Qwillio. Start your free 30-day trial: ${d.registrationLink}. No commitment, cancel anytime. ${STOP}`,

  /** Outcome "callback_later". */
  callback: (d: { firstName: string; agentName: string }) =>
    `Hi ${d.firstName}, ${d.agentName} from Qwillio here. Sorry we couldn't connect today — we'll follow up soon. Learn more: qwillio.com. ${STOP}`,

  /** Outcome "voicemail" or "no-answer". */
  noanswer: (d: { firstName: string; agentName: string; businessName: string }) =>
    `Hi ${d.firstName}, ${d.agentName} from Qwillio tried to reach you about ${d.businessName}. We help businesses never miss a call. Learn more: qwillio.com. ${STOP}`,

  /** Email bounced — fallback to SMS asking for a correct address. */
  emailBounce: (d: { firstName: string; agentName: string; businessName: string }) =>
    `Hi ${d.firstName}, ${d.agentName} from Qwillio. I tried sending the demo for ${d.businessName} but the email bounced. Could you reply with your correct email? Thanks.`,

  /** Email sent but never opened — fallback nudge. */
  emailNoOpen: (d: { firstName: string; agentName: string; businessName: string }) =>
    `Hi ${d.firstName}, ${d.agentName} from Qwillio. I sent a demo for ${d.businessName} yesterday — looks like it may have hit spam. Reply with your email and I'll resend. Thanks.`,

  /** callAttempts >= 3 with no contact — final outreach. */
  exhausted: (d: { firstName: string; agentName: string; businessName: string }) =>
    `Hi ${d.firstName}, ${d.agentName} from Qwillio. Tried reaching you about ${d.businessName} a couple times. No worries — if you're curious how AI helps you never miss a call, here's a 2-min video: qwillio.com/demo.`,

  /** Booking just confirmed — sent to the customer. */
  bookingConfirm: (d: { firstName: string; businessName: string; date: string; time: string; service: string }) =>
    `Hi ${d.firstName}, your appointment at ${d.businessName} is confirmed for ${d.date}${d.time}${d.service}. To reschedule or cancel, contact ${d.businessName} directly.`,

  /** 24h reminder before booking. */
  bookingReminder: (d: { firstName: string; businessName: string; time: string; service: string }) =>
    `Reminder: Hi ${d.firstName}, your appointment at ${d.businessName} is${d.time}${d.service}. See you soon.`,
};

export type SmsTemplateKey = keyof typeof smsTemplates;
