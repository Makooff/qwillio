import { Resend } from 'resend';
import { env } from './env';

/**
 * Resend throws if constructed with an empty key, which crashes any module
 * import chain that touches email code in environments without the secret
 * (CI test runs). Fall back to a placeholder so imports never throw; actual
 * sends still require the real key and fail at the API call instead.
 */
export const resend = new Resend(env.RESEND_API_KEY || 're_placeholder_missing_key');
