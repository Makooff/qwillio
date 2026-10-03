/**
 * Les identifiants d'un appel, et pourquoi ce n'est PAS le client du trunk.
 *
 * ── LE DÉFAUT, ET IL A COÛTÉ TOUS LES ENREGISTREMENTS ───────────────────────
 *
 * `twilioRecordingService` utilisait `twilioTrunkClient()` — le client RÉGIONAL
 * (région `ie1`, edge `dublin`, clé API créée dans la région). C'est le bon
 * client pour tout ce qui touche au TRUNK : un trunk créé en Irlande n'existe
 * pas pour l'API par défaut, et il faut une clé régionale pour s'y authentifier.
 *
 * Mais un ENREGISTREMENT n'est pas une ressource de trunk. `calls(sid)
 * .recordings.create()` appelle l'API PROGRAMMABLE VOICE, et l'hôte régional ne
 * connaît pas ces appels :
 *
 *     The requested resource /2010-04-01/Accounts/AC2b11ee…/Calls/CA8f62f6…
 *     /Recordings.json was not found
 *
 * Le message accuse le SID, qui était bon — les logs du 02/10 le montrent, le
 * `CA…` venait bien de l'en-tête SIP `X-Twilio-CallSid`. Ce qui était faux,
 * c'est l'ADRESSE depuis laquelle on posait la question : le compte est
 * `us1`, l'appel est `us1`, et on interrogeait l'Irlande.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le trunk se pilote depuis sa région ; les appels et leurs enregistrements se
 * lisent depuis le compte. Deux ressources, deux clients, et les confondre ne
 * produit pas une erreur d'authentification — ce qui serait visible — mais un
 * 404 « ressource introuvable » sur un objet qui existe. Un 404 se lit comme un
 * problème de données, on va chercher le SID, on le trouve bon, et on ne
 * comprend plus.
 *
 * Pas de région ici, donc : c'est l'hôte `api.twilio.com` par défaut, avec
 * l'auth token du compte. C'est ce que veut dire « client ordinaire » dans
 * `twilio-trunk.ts`, et ce fichier rend explicite qu'on en a besoin.
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
