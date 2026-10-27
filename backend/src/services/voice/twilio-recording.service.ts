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
import { twilioApiLocation, twilioTrunkClient, twilioTrunkConnection } from '../../config/twilio-trunk';

/** Strictly parse an API recording URL before selecting credentials. The host
 * must be a known public Twilio API location, never an arbitrary subdomain. */
function recordingLocation(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) return null;
    const path = /^\/2010-04-01\/Accounts\/(AC[0-9a-f]{32})\/Recordings\/(RE[0-9a-f]{32})(?:\.(?:mp3|wav|json))?$/i.exec(url.pathname);
    if (!path) return null;
    let location;
    if (url.hostname === 'api.twilio.com' || url.hostname === 'api.us1.twilio.com') {
      location = twilioApiLocation('', '');
    } else {
      const host = /^api\.([a-z-]+)\.([a-z0-9]+)\.twilio\.com$/.exec(url.hostname);
      if (!host) return null;
      location = twilioApiLocation(host[2], host[1]);
    }
    return { ...location, accountSid: path[1], sid: path[2] };
  } catch { return null; }
}

function connectionForRecording(url: string) {
  const location = recordingLocation(url);
  if (!location || location.accountSid !== env.TWILIO_ACCOUNT_SID) {
    throw new Error('URL d’enregistrement Twilio invalide ou compte différent.');
  }
  // A stored IE1 URL may use another edge, but never another region's key.
  if (location.region && location.region !== 'us1' && location.region !== env.TWILIO_TRUNK_REGION.trim()) {
    throw new Error('Identifiants indisponibles pour la région de cet enregistrement.');
  }
  return { ...location, ...twilioTrunkConnection(location.region, location.edge) };
}

/** The URL, not the current call region, selects media Basic auth. No URL means
 * no authorization; missing IE1 credentials must never fall back to US1. */
export function enteteAuthTwilio(url: string): string | null {
  try {
    const { username, password } = connectionForRecording(url);
    return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  } catch { return null; }
}

/** Follow media redirects explicitly. Only the original validated API URL gets
 * credentials; a storage/CDN redirect never receives Twilio Basic auth. */
export async function fetchMediaTwilio(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const auth = enteteAuthTwilio(url);
  if (!auth) throw new Error('Identifiants indisponibles pour cet enregistrement Twilio.');
  const mediaHeaders = new Headers(headers);
  mediaHeaders.delete('Authorization');
  let target = url;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const requestHeaders = new Headers(mediaHeaders);
    if (redirects === 0) requestHeaders.set('Authorization', auth);
    const response = await fetch(target, { headers: requestHeaders, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new Error('Redirection du média Twilio sans destination.');
    const next = new URL(location, target);
    if (next.protocol !== 'https:' || next.username || next.password) throw new Error('Redirection du média Twilio refusée.');
    target = next.href;
  }
  throw new Error('Trop de redirections du média Twilio.');
}

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
  return recordingLocation(url)?.sid ?? null;
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
      const rec = await twilioTrunkClient()
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
      const connection = twilioTrunkConnection();
      const recs = await twilioTrunkClient(connection.region, connection.edge).recordings.list({ callSid, limit: 5 });
      const fini = recs.find((r: { status?: string }) => r.status === 'completed') ?? recs[0];
      if (!fini) return null;
      if (fini.status !== 'completed') {
        logger.warn(`[Enregistrement] ${fini.sid} encore en ${fini.status}, laissé de côté`);
        return null;
      }
      const url = `${connection.origin}${fini.uri.replace(/\.json$/, '.mp3')}`;
      if (connectionForRecording(url).sid !== String(fini.sid)) return null;
      return { sid: String(fini.sid), url };
    } catch (error) {
      logger.error(`[Enregistrement] introuvable pour ${callSid}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * LE SID TWILIO D'UN APPEL EN COURS, quand le pont ne l'a pas fourni.
   *
   * POURQUOI CETTE RECHERCHE EXISTE (27/10/2026). Le pont lit le SID dans les
   * attributs SIP de LiveKit (`sip.twilio.callSid`). Quand l'attribut manque —
   * trunk qui n'est pas reconnu comme Twilio côté LiveKit — il n'envoie rien,
   * l'enregistrement ne démarre pas, et RIEN ne le dit: `demarrer` n'est jamais
   * appelé. Résultat observé en prod: plus aucun enregistrement depuis le
   * passage au pont (28/09), alors que le client l'avait activé et que le
   * prompt annonçait « cet appel est enregistré ». Le portail n'avait donc
   * aucun audio à jouer, et l'option d'écoute disparaissait.
   *
   * On retrouve l'appel par ce qu'on sait déjà: l'appelant et l'instant. Le
   * `From` d'un appel entrant est son numéro, et la ressource `Call` du trunk
   * vit en cours d'appel. Fenêtre courte (2 min) et appel le plus récent:
   * au-delà, on préfère ne rien enregistrer plutôt que d'attacher à ce client
   * l'audio d'un autre appelant.
   */
  async sidEnCours(caller: string, trunkNumber?: string): Promise<string | null> {
    if (!/^\+?[0-9]{6,}$/.test(caller)) return null;
    try {
      const connection = twilioTrunkConnection();
      const appels = await twilioTrunkClient(connection.region, connection.edge).calls.list({
        from: caller,
        status: 'in-progress',
        limit: 10,
      });
      const limite = Date.now() - 120_000;
      const cible = appels
        .filter((c: { dateCreated?: Date }) => new Date(c.dateCreated ?? 0).getTime() >= limite)
        .filter((c: { to?: string }) => !trunkNumber || String(c.to ?? '').includes(trunkNumber.replace(/^\+/, '')))
        .sort((a: { dateCreated?: Date }, b: { dateCreated?: Date }) =>
          new Date(b.dateCreated ?? 0).getTime() - new Date(a.dateCreated ?? 0).getTime())[0];
      if (!cible) {
        logger.warn(`[Enregistrement] aucun appel en cours pour ${caller} — SID introuvable côté Twilio.`);
        return null;
      }
      logger.info(`[Enregistrement] SID retrouvé par recherche: ${cible.sid} pour ${caller}`);
      return String(cible.sid);
    } catch (error) {
      logger.error(`[Enregistrement] recherche du SID pour ${caller} impossible: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Un enregistrement par son `RE...`, quand on n'a plus le `CA...`.
   *
   * La fin d'appel reçoit le SID d'appel du pont; quand il est vide, la seule
   * trace qui reste est le `recordingSid` rangé au démarrage. Sans cette
   * lecture, l'audio existe chez Twilio et n'arrive jamais au portail.
   */
  async parSid(recordingSid: string): Promise<EnregistrementTwilio | null> {
    if (!/^RE[0-9a-f]{32}$/i.test(recordingSid)) return null;
    try {
      const connection = twilioTrunkConnection();
      const rec = await twilioTrunkClient(connection.region, connection.edge).recordings(recordingSid).fetch();
      if (rec.status !== 'completed') {
        logger.warn(`[Enregistrement] ${recordingSid} encore en ${rec.status}, laissé de côté`);
        return null;
      }
      const url = `${connection.origin}${rec.uri.replace(/\.json$/, '.mp3')}`;
      if (connectionForRecording(url).sid !== String(rec.sid)) return null;
      return { sid: String(rec.sid), url };
    } catch (error) {
      logger.error(`[Enregistrement] ${recordingSid} illisible: ${(error as Error).message}`);
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
  async supprimer(recordingSid: string, recordingUrl: string): Promise<boolean> {
    if (!/^RE[0-9a-f]{32}$/i.test(recordingSid)) return false;
    try {
      const connection = connectionForRecording(recordingUrl);
      if (connection.sid !== recordingSid) return false;
      await twilioTrunkClient(connection.region, connection.edge).recordings(recordingSid).remove();
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
