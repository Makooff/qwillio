/**
 * L'ENREGISTREMENT D'APPEL, PAR APPEL ET JAMAIS PAR TRUNK.
 *
 * Le trunk Elastic SIP sait enregistrer tout seul — `Dual Record from answer`,
 * une case à cocher dans la console. C'est précisément ce qu'il ne faut pas
 * faire, et la raison tient en une phrase: un réglage de trunk vaut pour TOUS
 * les clients qui passent par lui.
 *
 * Qwillio laisse chaque client couper l'enregistrement (`recordCalls`), le
 * prompt annonce l'enregistrement quand il a lieu, et la purge de rétention
 * efface l'audio à l'échéance. Un enregistrement décidé au niveau du trunk
 * passe sous les trois: il enregistre le client qui a dit non, sans que
 * l'appelant en soit informé, et il reste chez Twilio indéfiniment parce que
 * la purge ne sait pas qu'il existe. Effacer après coup n'est pas un
 * consentement — pour le client qui a coupé, l'enregistrement ne doit jamais
 * avoir existé.
 *
 * D'où ce service: on démarre l'enregistrement APPEL PAR APPEL, au décroché,
 * et seulement pour un client qui l'accepte.
 *
 * LA RÉGION. Le trunk vit en Irlande, donc l'appel entrant aussi, et la
 * ressource `Call` qui le porte n'existe pas pour l'API par défaut — même
 * histoire que le trunk lui-même le 28/09. On passe donc par le client
 * régional, celui qui sait composer `api.dublin.ie1.twilio.com`.
 *
 * RIEN ICI NE DOIT FAIRE ÉCHOUER UN APPEL. Un enregistrement raté est un
 * enregistrement manquant; un appel raté est un client perdu. Toutes les
 * méthodes rendent null ou false plutôt que de lever.
 */
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { twilioAccountClient } from '../../config/twilio-account';

/**
 * L'hôte qui SERT le média d'un enregistrement.
 *
 * ── IL SUIVAIT LA RÉGION DU TRUNK, ET C'ÉTAIT FAUX AUSSI ────────────────────
 *
 * Cette fonction rendait `https://api.dublin.ie1.twilio.com` dès que la région
 * du trunk était renseignée, en supposant qu'un enregistrement créé en Irlande
 * se relit en Irlande. C'est le même raisonnement que celui qui a fait échouer
 * le démarrage, et il mène au même 404.
 *
 * L'enregistrement est une ressource du COMPTE : il se crée et se relit sur
 * l'hôte par défaut. Twilio rend d'ailleurs un `uri` relatif, et le préfixer
 * par l'hôte du compte est ce que fait la documentation.
 *
 * Le garde-fou est conservé tel quel dans l'esprit : on ne compose PAS l'URL à
 * la main ailleurs, on passe par ici — c'est ce qui garantit que l'hôte qui
 * sert le média est celui qui a créé la ressource.
 */
function hoteMedia(): string {
  return 'https://api.twilio.com';
}

/**
 * Les identifiants qui ouvrent une URL de média, en Basic.
 *
 * A2: le média est servi par `api.twilio.com`, l'hôte du compte — c'est ce
 * que dit `hoteMedia()` et c'est ce que fait `twilioAccountClient`. L'auth
 * qui y a droit est donc celle du COMPTE (sid + token), exactement comme le
 * client qui crée et relit l'enregistrement. La clé API régionale reste en
 * repli pour une installation où le compte ne serait pas configuré: elle
 * répond 403 sur l'hôte du compte, et ce 403 se lisait au portail comme un
 * 502 « enregistrement indisponible ».
 */
export function enteteAuthTwilio(): string | null {
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    return 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
  }
  const keySid = env.TWILIO_TRUNK_KEY_SID.trim();
  const keySecret = env.TWILIO_TRUNK_KEY_SECRET.trim();
  if (keySid && keySecret) {
    return 'Basic ' + Buffer.from(`${keySid}:${keySecret}`).toString('base64');
  }
  return null;
}

/** Le motif d'une URL de média Twilio, qui sert aussi à la reconnaître à la purge. */
const URL_TWILIO = /^https:\/\/api(?:\.[a-z0-9-]+)*\.twilio\.com\/2010-04-01\/Accounts\/AC[0-9a-f]{32}\/Recordings\/(RE[0-9a-f]{32})/i;

export interface EnregistrementTwilio {
  /** Le `RE...` de Twilio. */
  sid: string;
  /** L'URL du média, telle qu'on la range en base. */
  url: string;
}

/**
 * Le SID d'enregistrement porté par une URL, ou null.
 *
 * La purge en a besoin: elle ne connaît des lignes que leur `recordingUrl`, et
 * doit pouvoir dire « celui-ci est chez Twilio, je sais l'effacer » sans
 * stocker une colonne de plus.
 */
export function sidDepuisUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = URL_TWILIO.exec(url);
  return m ? m[1] : null;
}

class TwilioRecordingService {
  /**
   * Démarre l'enregistrement d'un appel EN COURS, et rend son SID.
   *
   * `recordingChannels: 'dual'` sépare l'appelant et l'agent sur deux canaux:
   * c'est ce qui rend un transcript relisible, et ça ne coûte rien de plus.
   * `trim: 'do-not-trim'` garde le début — l'annonce d'enregistrement est dans
   * les premières secondes, et une preuve de consentement rognée ne prouve
   * plus rien.
   */
  async demarrer(callSid: string): Promise<string | null> {
    if (!/^CA[0-9a-f]{32}$/i.test(callSid)) {
      logger.warn(`[Enregistrement] SID d'appel invalide, enregistrement non démarré: ${callSid}`);
      return null;
    }
    try {
      const rec = await twilioAccountClient()
        .calls(callSid)
        .recordings.create({ recordingChannels: 'dual', trim: 'do-not-trim' });
      logger.info(`[Enregistrement] démarré ${rec.sid} sur l'appel ${callSid}`);
      return String(rec.sid);
    } catch (error) {
      logger.error(`[Enregistrement] non démarré sur ${callSid}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * L'enregistrement d'un appel terminé, par son `CA...`.
   *
   * On redemande à Twilio plutôt que de garder le `RE...` du démarrage, parce
   * que la durée et l'état ne sont connus qu'à la fin — et qu'un enregistrement
   * démarré peut avoir échoué entre-temps. `completed` seulement: une ligne
   * `processing` n'a pas encore de média, et une URL qui rend 404 au portail
   * est pire qu'une absence d'URL, qui elle au moins se dit.
   */
  async delAppel(callSid: string): Promise<EnregistrementTwilio | null> {
    if (!/^CA[0-9a-f]{32}$/i.test(callSid)) return null;
    try {
      const recs = await twilioAccountClient().recordings.list({ callSid, limit: 5 });
      const fini = recs.find((r: { status?: string }) => r.status === 'completed') ?? recs[0];
      if (!fini) return null;
      if (fini.status !== 'completed') {
        logger.warn(`[Enregistrement] ${fini.sid} encore en ${fini.status}, laissé de côté`);
        return null;
      }
      return { sid: String(fini.sid), url: `${hoteMedia()}${fini.uri.replace(/\.json$/, '.mp3')}` };
    } catch (error) {
      logger.error(`[Enregistrement] introuvable pour ${callSid}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Efface l'enregistrement CHEZ TWILIO. Vrai aussi quand il n'y était plus.
   *
   * Un 404 est un succès: la purge est rejouable, et la seule chose qui
   * compte est qu'à la sortie l'audio n'existe plus. Le traiter en échec
   * bloquerait la ligne locale sur un audio déjà parti, indéfiniment.
   */
  async supprimer(recordingSid: string): Promise<boolean> {
    if (!/^RE[0-9a-f]{32}$/i.test(recordingSid)) return false;
    try {
      await twilioAccountClient().recordings(recordingSid).remove();
      return true;
    } catch (error) {
      const e = error as { status?: number; message?: string };
      if (e.status === 404) return true;
      logger.error(`[Enregistrement] suppression de ${recordingSid} refusée: ${e.message}`);
      return false;
    }
  }
}

export const twilioRecordingService = new TwilioRecordingService();
