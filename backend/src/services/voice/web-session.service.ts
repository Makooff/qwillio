import { randomUUID } from 'node:crypto';
import { AccessToken, TrackSource, RoomConfiguration, RoomAgentDispatch } from 'livekit-server-sdk';
import { env } from '../../config/env';
import { issueSetupTicket } from './web-setup-ticket';

/* Sessions navigateur signées (`qwillioWeb`) — émission côté pont.
 *
 * Le SEUL détenteur d'autorité est le JSON signé dans le `metadata` du
 * dispatch agent (`roomConfig.agents[].metadata`, posé par le serveur) :
 * les métadonnées du participant ne sont JAMAIS écrites, et un navigateur ne
 * peut pas se fabriquer un profil — il ne présente que ce que le serveur a
 * signé. Le worker core (`qwillio-voice-core/src/voice_core/session_web.py`)
 * valide cette charge de façon bornée et stricte ; toute charge malformée y
 * est un refus ferme (room supprimée), jamais un repli.
 *
 * Contrat (version 1, figé avec le worker) :
 *   {qwillioWeb: {version, sessionId, mode, participantIdentity,
 *                 maxDurationSeconds, expiresAt, profile, knowledge}}
 * et, uniquement en mode `setup` :
 *   {qwillioWeb: {…, setupMode, setupTicket}}
 *
 * Ce module ne fait aucun appel réseau et ne consomme aucun quota : la
 * réservation de budget démo reste dans la route, l'application de la durée
 * dans le worker (suppression de room). */

export const WEB_SESSION_VERSION = 1;
export const WEB_SESSION_MAX_DURATION_SECONDS = 120;
export const WEB_SESSION_TOKEN_TTL_SECONDS = 60;

export type WebSessionMode = 'public-demo' | 'client-test' | 'setup';
export type WebSessionSetupMode = 'config' | 'onboarding';

const SESSION_MODES: ReadonlySet<WebSessionMode> = new Set(['public-demo', 'client-test', 'setup']);
const LANGUAGES: ReadonlySet<string> = new Set(['fr', 'en', 'nl']);

/* Bornes du parseur core — les mêmes chiffres, posés deux fois volontairement:
 * ce module PRODUIT la charge que le worker CONSOMME, et les deux doivent se
 * tenir sans se téléphoner. `session_web.py` est la référence. */
const FIELD_MAX = 2000;
const SMALL_MAX = 256;
const MAX_SERVICES = 100;
const MAX_KNOWLEDGE = 200;

export type WebSessionErrorCode =
  | 'livekit_not_configured'
  | 'insecure_livekit_url'
  | 'invalid_mode'
  | 'profile_business_missing'
  | 'setup_requires_tenant'
  | 'setup_requires_mode';

export class WebSessionError extends Error {
  readonly code: WebSessionErrorCode;
  constructor(code: WebSessionErrorCode, message: string) {
    super(message);
    this.name = 'WebSessionError';
    this.code = code;
  }
}

export interface WebSessionVoiceInput {
  voiceId?: string;
  provider?: string;
  cloned?: boolean;
  name?: string;
}

export interface WebSessionProfileInput {
  /** Nom d'affichage du commerce — obligatoire (le core le refuse sinon). */
  business: string;
  agent?: string;
  language?: string;
  /** Ignoré en public-demo : une démo ne porte AUCUN identifiant locataire. */
  clientId?: string;
  businessType?: string;
  greeting?: string;
  notes?: string;
  openingHours?: Record<string, unknown>;
  openingHoursSpoken?: string;
  services?: string[];
  voice?: WebSessionVoiceInput | null;
}

export type WebSessionKnowledgeInput = Array<
  | string
  | { question?: string; title?: string; answer?: string; content?: string; keywords?: string[] }
>;

export interface IssueWebSessionInput {
  mode: WebSessionMode;
  profile: WebSessionProfileInput;
  knowledge?: WebSessionKnowledgeInput;
  /** 1..120, appliquée serveur par suppression de room. Défaut 120. */
  maxDurationSeconds?: number;
  /** Requis quand mode === 'setup'. Choisi par le contrôleur, jamais par le corps de la requête. */
  setupMode?: WebSessionSetupMode;
}

export interface WebSessionResult {
  provider: 'livekit';
  url: string;
  token: string;
  roomName: string;
  participantIdentity: string;
  sessionId: string;
  mode: WebSessionMode;
  maxDurationSeconds: number;
  expiresAt: number;
}

interface QwillioWebPayload {
  version: number;
  sessionId: string;
  mode: WebSessionMode;
  participantIdentity: string;
  maxDurationSeconds: number;
  expiresAt: number;
  profile: Record<string, unknown>;
  knowledge: unknown[];
  setupMode?: WebSessionSetupMode;
  setupTicket?: string;
}

/** La config LiveKit est-elle utilisable ? L'URL ne peut être que `wss://`. */
export function assertLiveKitConfigured(): void {
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    throw new WebSessionError('livekit_not_configured', 'LIVEKIT_URL/API_KEY/API_SECRET are not all set');
  }
  if (!/^wss:\/\//i.test(env.LIVEKIT_URL)) {
    throw new WebSessionError('insecure_livekit_url', 'LIVEKIT_URL must be a secure wss:// URL');
  }
}

function bounded(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\x00-\x1f]/g, ' ').trim().slice(0, max);
}

function sanitizeProfile(input: WebSessionProfileInput, mode: WebSessionMode): Record<string, unknown> {
  const business = bounded(input?.business, FIELD_MAX);
  if (!business) throw new WebSessionError('profile_business_missing', 'profile.business is required');
  const language = (bounded(input.language, 8) || 'fr').toLowerCase();
  const services = Array.isArray(input.services)
    ? input.services.map((s) => bounded(s, 200)).filter(Boolean).slice(0, MAX_SERVICES)
    : [];
  const voice = input.voice && typeof input.voice.voiceId === 'string' && input.voice.voiceId.trim()
    ? {
        voiceId: bounded(input.voice.voiceId, SMALL_MAX),
        provider: bounded(input.voice.provider, 40) || undefined,
        cloned: input.voice.cloned === true,
        name: bounded(input.voice.name, 120),
      }
    : undefined;

  return {
    business,
    agent: bounded(input.agent, SMALL_MAX) || 'Léa',
    language: LANGUAGES.has(language) ? language : 'fr',
    /* Une session navigateur n'écrit jamais et ne transfère jamais : le core
       re-verrouille ces champs, on les pose déjà à leur valeur effective. */
    clientId: mode === 'public-demo' ? '' : bounded(input.clientId, SMALL_MAX),
    businessType: bounded(input.businessType, SMALL_MAX),
    greeting: bounded(input.greeting, FIELD_MAX),
    notes: bounded(input.notes, FIELD_MAX),
    openingHours: input.openingHours && typeof input.openingHours === 'object' && !Array.isArray(input.openingHours)
      ? input.openingHours
      : {},
    openingHoursSpoken: bounded(input.openingHoursSpoken, FIELD_MAX),
    services,
    voice,
    bookingEnabled: false,
    enregistrement: false,
  };
}

function sanitizeKnowledge(input: WebSessionKnowledgeInput | undefined): unknown[] {
  if (!Array.isArray(input)) return [];
  const out: unknown[] = [];
  for (const raw of input.slice(0, MAX_KNOWLEDGE)) {
    if (typeof raw === 'string') {
      const s = bounded(raw, FIELD_MAX);
      if (s) out.push(s);
      continue;
    }
    if (!raw || typeof raw !== 'object') continue;
    const question = bounded(raw.question ?? raw.title, FIELD_MAX);
    const answer = bounded(raw.answer ?? raw.content, FIELD_MAX);
    if (!question || !answer) continue;
    const keywords = Array.isArray(raw.keywords)
      ? raw.keywords.map((k) => bounded(k, 100)).filter(Boolean).slice(0, 20)
      : [];
    out.push({ question, answer, ...(keywords.length ? { keywords } : {}) });
  }
  return out;
}

/**
 * Émet une session navigateur signée : jeton de room micro-seul à durée de
 * vie courte, et charge `qwillioWeb` scellée dans le dispatch de l'agent.
 *
 * Le jeton est émis AU DÉMARRAGE de l'appel par l'utilisateur (TTL 60 s),
 * jamais au montage ni au préchauffage : une émission anticipée ferait
 * expirer le jeton avant la connexion, et consommerait le budget démo sans
 * appel.
 */
export async function issueWebSession(input: IssueWebSessionInput): Promise<WebSessionResult> {
  assertLiveKitConfigured();
  if (!input || !SESSION_MODES.has(input.mode)) {
    throw new WebSessionError('invalid_mode', `mode must be one of ${[...SESSION_MODES].join(', ')}`);
  }
  const mode = input.mode;
  if (mode === 'setup') {
    if (!input.profile?.clientId) {
      throw new WebSessionError('setup_requires_tenant', 'setup sessions require an authenticated tenant clientId');
    }
    if (input.setupMode !== 'config' && input.setupMode !== 'onboarding') {
      throw new WebSessionError('setup_requires_mode', "setupMode must be 'config' or 'onboarding'");
    }
  }

  const profile = sanitizeProfile(input.profile, mode);
  const knowledge = sanitizeKnowledge(input.knowledge);
  const maxDurationSeconds = Math.min(
    WEB_SESSION_MAX_DURATION_SECONDS,
    Math.max(1, Math.floor(input.maxDurationSeconds ?? WEB_SESSION_MAX_DURATION_SECONDS)),
  );

  const sessionId = randomUUID();
  /* Le core lie strictement participantIdentity au participant de la room :
     imprimable, sans espace. */
  const participantIdentity = `web-${sessionId}`;
  const roomName = `qwillio-web-${sessionId}`;
  const expiresAt = Math.floor(Date.now() / 1000) + maxDurationSeconds;

  const qwillioWeb: QwillioWebPayload = {
    version: WEB_SESSION_VERSION,
    sessionId,
    mode,
    participantIdentity,
    maxDurationSeconds,
    expiresAt,
    profile,
    knowledge,
  };
  if (mode === 'setup') {
    /* Le ticket est la capacité opaque que le worker présente au pont sur
       /api/voice-core/web-setup/chat ; le corps de la requête ne peut ni le
       forger ni en changer le mode. */
    qwillioWeb.setupMode = input.setupMode;
    qwillioWeb.setupTicket = issueSetupTicket({
      sessionId,
      clientId: String(profile.clientId),
      mode: input.setupMode!,
    });
  }

  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: participantIdentity,
    ttl: WEB_SESSION_TOKEN_TTL_SECONDS,
  });
  /* Room-only join, microphone-only publish, souscription autorisée. AUCUN
     droit d'admin, AUCUNE publication de données (le worker pousse les
     paquets `qwillio.config`, le navigateur n'en envoie pas), AUCUNE
     mise à jour de ses propres métadonnées, AUCUN grant SIP. */
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishSources: [TrackSource.MICROPHONE],
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  token.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({
      agentName: env.LIVEKIT_AGENT_NAME || 'inbound-agent-eu',
      metadata: JSON.stringify({ qwillioWeb }),
    })],
  });

  return {
    provider: 'livekit',
    url: env.LIVEKIT_URL,
    token: await token.toJwt(),
    roomName,
    participantIdentity,
    sessionId,
    mode,
    maxDurationSeconds,
    expiresAt,
  };
}
