import { env } from '../config/env';

// Returns true if the email is on the TEST_ACCOUNT_EMAILS allowlist.
// Used to bypass Stripe payment while keeping every feature fully functional
// (for owner-led customer-experience testing).
export function isTestAccount(email?: string | null): boolean {
  if (!email) return false;
  const list = env.TEST_ACCOUNT_EMAILS
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
