import { env } from '../config/env';

/**
 * Ce qu'il faut pour qu'un SMS PARTE vraiment.
 *
 * « Je n'ai pas reçu de SMS de confirmation » (appel réel, 12/09/2026): l'agent
 * promettait le SMS dès que `SMS_ENABLED` était vrai, et `sendSMS` rendait
 * `false` en silence quand le numéro d'envoi ou les identifiants Twilio
 * manquaient. La promesse se fait sur la même règle que l'envoi, et le docteur
 * la relit.
 */
export function smsReadiness(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!env.SMS_ENABLED) missing.push('SMS_ENABLED');
  const auth = (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) || (env.TWILIO_API_KEY_SID && env.TWILIO_API_KEY_SECRET);
  if (!auth) missing.push('TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN');
  if (!env.TWILIO_PHONE_NUMBER) missing.push('TWILIO_PHONE_NUMBER');
  return { ok: missing.length === 0, missing };
}
