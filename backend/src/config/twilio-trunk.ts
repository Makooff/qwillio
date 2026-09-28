/**
 * Le client Twilio des appels de TRUNKING, qui n'est pas celui des numéros.
 *
 * Deux choses le distinguent du client par défaut, et elles ont coûté cher à
 * découvrir le 28/09/2026 — d'où ce fichier unique plutôt qu'une copie par
 * script.
 *
 * ── L'ADRESSE ───────────────────────────────────────────────────────────────
 *
 * Un trunk créé dans une région n'existe PAS pour l'API par défaut, qui répond
 * « Invalid SIP Trunk SID provided » en rendant le SID qu'on vient de lui
 * donner — un message qui accuse la valeur alors que le problème est l'adresse.
 *
 * Et la région seule ne suffit pas: le SDK compose `<produit>.<edge>.<région>`,
 * donc sans edge il fabrique `trunking.ie1.twilio.com`, un nom qui existe dans
 * le DNS mais dont le certificat ne couvre que les `console.*`. L'échec est
 * alors une erreur TLS qui ressemble à une panne réseau. L'hôte réel de
 * l'Irlande est `trunking.dublin.ie1.twilio.com`.
 *
 * ── LES IDENTIFIANTS ────────────────────────────────────────────────────────
 *
 * L'auth token du compte est un identifiant us1: l'hôte régional le refuse par
 * un 401 « Authenticate ». Il faut une clé API créée DANS la région, et c'est
 * la seule différence restante entre un trunk régional joignable et un trunk
 * régional qui répond toujours non.
 *
 * Sans région, rien de tout cela ne s'applique et on rend le client ordinaire.
 */
import { env } from './env';

export function twilioTrunkClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN manquants.');
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require('twilio');

  const region = env.TWILIO_TRUNK_REGION.trim();
  const edge = env.TWILIO_TRUNK_EDGE.trim();
  const keySid = env.TWILIO_TRUNK_KEY_SID.trim();
  const keySecret = env.TWILIO_TRUNK_KEY_SECRET.trim();

  if (!region) return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

  if (!edge) {
    throw new Error(
      `TWILIO_TRUNK_REGION=${region} sans TWILIO_TRUNK_EDGE: l'hote regional serait injoignable. ` +
        'Poser TWILIO_TRUNK_EDGE (dublin pour ie1, sydney pour au1, frankfurt pour de1).',
    );
  }
  if (!keySid || !keySecret) {
    throw new Error(
      `TWILIO_TRUNK_REGION=${region} sans cle API regionale: l'hote repondra 401 Authenticate. ` +
        'Creer une cle API dans la region (console Twilio, selecteur de region, Account > API keys & tokens) ' +
        'et poser TWILIO_TRUNK_KEY_SID / TWILIO_TRUNK_KEY_SECRET.',
    );
  }

  return twilio(keySid, keySecret, { accountSid: env.TWILIO_ACCOUNT_SID, region, edge });
}
