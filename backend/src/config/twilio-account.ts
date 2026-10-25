/**
 * Client US1 explicite pour les ressources qui y vivent (notamment les
 * enregistrements historiques dont l'URL porte api.twilio.com).
 *
 * Ne pas en déduire que tous les appels sont US1 : un appel traité en IE1
 * et son enregistrement se créent et se relisent dans cette région avec sa
 * clé régionale. Le service d'enregistrement suit twilio-trunk.ts pour les
 * nouveaux appels et la région de l'URL persistée pour les anciens médias.
 */
import { env } from './env';

export function twilioAccountClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN manquants.');
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require('twilio');
  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}
