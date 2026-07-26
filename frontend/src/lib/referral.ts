/*
 * Referral link capture.
 *
 * A visitor arriving on ?ref=CODE has the code stored locally, and it is sent
 * once when they finish onboarding. Attribution is then fixed server-side for
 * good, so a stale code cannot reassign an existing customer later.
 */

const KEY = 'qwillio-ref';
const WINDOW_DAYS = 90;

interface StoredRef {
  code: string;
  at: number;
}

/** Reads ?ref= off the current URL and stores it. Call once on app start. */
export function captureReferral(search: string = window.location.search): void {
  try {
    const code = new URLSearchParams(search).get('ref');
    if (!code) return;
    const clean = code.trim().toUpperCase().slice(0, 32);
    if (!/^[A-Z0-9]{4,32}$/.test(clean)) return;
    // First link wins: someone already attributed keeps their referrer.
    if (getReferral()) return;
    localStorage.setItem(KEY, JSON.stringify({ code: clean, at: Date.now() } satisfies StoredRef));
  } catch {
    /* private mode / storage disabled — referrals are optional */
  }
}

/** The stored code, or null when absent or older than the attribution window. */
export function getReferral(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRef;
    if (!parsed?.code) return null;
    const ageDays = (Date.now() - parsed.at) / 86_400_000;
    if (ageDays > WINDOW_DAYS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

/** Clears the code once it has been attributed. */
export function clearReferral(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
