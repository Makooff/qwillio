import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import type { CustomVoice } from '../../config/voice-characters';

/**
 * The client's own voice as stored in `vapiConfig.customVoice` — cloned from
 * their recording, or picked from their ElevenLabs library.
 *
 * Validated field by field rather than cast: this JSON column is written by
 * several code paths over time, and a half-written value here would send an
 * empty voiceId to ElevenLabs on every call of a live tenant.
 */
export function readCustomVoice(raw: unknown): CustomVoice | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.voiceId !== 'string' || v.voiceId.trim() === '') return null;
  return {
    voiceId: v.voiceId,
    name: typeof v.name === 'string' ? v.name : 'Ma voix',
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date(0).toISOString(),
    // Carried through because it changes the tuning: a clone gets style 0 so it
    // sounds like the speaker rather than an impression of them. Dropping the
    // flag here silently gave every clone the character's style back.
    ...(v.cloned === true ? { cloned: true } : {}),
    // Sans ce champ, une voix Cartesia choisie par le client repartirait chez
    // ElevenLabs, où son identifiant ne désigne rien.
    ...(v.provider === 'cartesia' ? { provider: 'cartesia' as const } : {}),
  };
}

/**
 * Real-time context cache (Phase 5).
 *
 * On `call-start` the orchestrator has a few hundred milliseconds to know who
 * the client is, how they want the agent to behave, and whether the caller has
 * phoned before. Two Postgres round-trips against a cold Neon instance can eat
 * that entire budget on their own, so the profile is served from memory and the
 * database is only touched on a miss or an explicit invalidation.
 *
 * The store is deliberately pluggable: a single-process in-memory map is enough
 * for one Render web service, but Render scales by adding processes, and each
 * one would otherwise keep its own copy. If `REDIS_URL` is configured AND the
 * optional `ioredis` dependency is installed, the same interface is served from
 * Redis so every process shares one cache and one invalidation. Neither is
 * required — the module degrades to in-memory silently.
 */

export interface CallerHistory {
  /** How many completed calls this number has made to this client before. */
  previousCalls: number;
  lastCallAt: string | null;
  lastSummary: string | null;
  /** Name we captured on a previous call, so the agent does not re-ask. */
  knownName: string | null;
  hasUpcomingBooking: boolean;
}

export interface ClientVoiceProfile {
  clientId: string;
  businessName: string;
  businessType: string;
  agentName: string;
  language: 'fr' | 'en' | 'nl';
  timezone: string;
  transferNumber: string | null;
  /** Free-text client instructions from onboarding ("never quote prices"). */
  instructions: string | null;
  services: string[];
  openingHours: string | null;
  bookingEnabled: boolean;
  calendarConnected: boolean;
  planType: string;
  /** Voice persona chosen by the client, resolved against the character catalog. */
  characterId: string | null;
  /** The client's own cloned voice, when they made one. Used iff characterId is 'custom'. */
  customVoice: CustomVoice | null;
  /** Drives the Belgian French voice override. */
  country: string | null;
  /**
   * Custom-LLM path. On by default (see VOICE_CUSTOM_LLM_DEFAULT); a client can
   * still be pinned off with `vapiConfig.customLlm === false`.
   */
  customLlm: boolean;
  /**
   * Le mode de voix, par client.
   *
   * `auto` suit le réglage global (`VOICE_SPEECH_TO_SPEECH`). Les deux autres
   * l'emportent, dans un sens comme dans l'autre. C'est ce qui permet de
   * comparer les deux chaînes sur un compte sans engager la production
   * entière, et plus tard d'attacher le mode au plan payé.
   */
  voiceMode: 'auto' | 'realtime' | 'classic';
  /**
   * Quelle SYNTHÈSE sert ce client, en mode classique.
   *
   * Absent = le réglage global de la plateforme. Posé par client pour pouvoir
   * comparer ElevenLabs et Cartesia à l'oreille, sur le même compte, sans
   * basculer toute la flotte ni redéployer entre deux appels.
   */
  ttsProvider?: '11labs' | 'cartesia';
  /** Whether any active knowledge entry exists — gates the lookup tool. */
  hasKnowledgeBase: boolean;
  /**
   * L'appel est-il enregistré ? Historiquement `disableRecordingNotice`
   * supprimait la notice tout en laissant l'enregistrement actif — c'est-à-dire
   * un enregistrement sans information, illégal en UE. La sémantique est
   * inversée: refuser la notice, c'est refuser l'enregistrement. Le choix reste
   * au client; la légalité n'est plus une option.
   */
  recordCalls: boolean;
}

/**
 * Un profil encore en cache d'avant ce champ vaut « enregistré » (et donc
 * « notice prononcée »): le défaut sûr des deux côtés de la loi.
 */
export function shouldRecord(profile: Pick<ClientVoiceProfile, 'recordCalls'>): boolean {
  return profile.recordCalls !== false;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** Minimal surface we need from a Redis client, so `ioredis` stays optional. */
interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'PX', ttl: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

const PROFILE_TTL_MS = env.VOICE_CONTEXT_TTL_MS;
const HISTORY_TTL_MS = 60_000;
const MAX_LOCAL_ENTRIES = 500;

class RealtimeContextService {
  private local = new Map<string, CacheEntry<unknown>>();
  private redis: RedisLike | null = null;
  private redisReady: Promise<void> | null = null;

  // ── Store plumbing ──────────────────────────────────────────────────────

  /**
   * Resolve a shared store once, lazily. `ioredis` is imported dynamically so
   * the build does not require it; any failure pins the service to in-memory
   * for the rest of the process rather than retrying on every call.
   */
  private async store(): Promise<RedisLike | null> {
    if (!env.REDIS_URL) return null;
    if (this.redis) return this.redis;
    if (this.redisReady) {
      await this.redisReady;
      return this.redis;
    }
    this.redisReady = (async () => {
      try {
        // Indirect specifier: `ioredis` is an optional peer, so the module must
        // not be resolved at build time on installs that do not ship it.
        const specifier = 'ioredis';
        const mod: any = await import(specifier).catch(() => null);
        if (!mod) {
          logger.info('[VoiceContext] REDIS_URL set but ioredis not installed — using in-memory cache');
          return;
        }
        const Redis = mod.default || mod;
        this.redis = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 1 });
        logger.info('[VoiceContext] Shared Redis cache active');
      } catch (err) {
        logger.warn('[VoiceContext] Redis unavailable, falling back to in-memory:', err);
        this.redis = null;
      }
    })();
    await this.redisReady;
    return this.redis;
  }

  private localGet<T>(key: string): T | null {
    const hit = this.local.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.local.delete(key);
      return null;
    }
    return hit.value as T;
  }

  private localSet<T>(key: string, value: T, ttlMs: number): void {
    // Cheap bound: the cache is a latency shortcut, not a source of truth, so
    // dropping the oldest insert on overflow is fine.
    if (this.local.size >= MAX_LOCAL_ENTRIES) {
      const oldest = this.local.keys().next().value;
      if (oldest) this.local.delete(oldest);
    }
    this.local.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  private async get<T>(key: string): Promise<T | null> {
    const local = this.localGet<T>(key);
    if (local) return local;
    const redis = await this.store();
    if (!redis) return null;
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as T;
      this.localSet(key, parsed, HISTORY_TTL_MS);
      return parsed;
    } catch {
      return null;
    }
  }

  private async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.localSet(key, value, ttlMs);
    const redis = await this.store();
    if (!redis) return;
    try {
      await redis.set(key, JSON.stringify(value), 'PX', ttlMs);
    } catch {
      /* cache write failures never block a call */
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Client profile for the assistant. Served from cache in the common case;
   * a miss costs one indexed primary-key read.
   */
  async getClientProfile(clientId: string): Promise<ClientVoiceProfile | null> {
    const key = `voice:profile:${clientId}`;
    const cached = await this.get<ClientVoiceProfile>(key);
    if (cached) return cached;

    const [client, knowledgeCount] = await Promise.all([
      prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        agentName: true,
        agentLanguage: true,
        country: true,
        transferNumber: true,
        planType: true,
        onboardingData: true,
        googleCalendarRefreshToken: true,
        vapiConfig: true,
      },
      }),
      prisma.businessKnowledge.count({ where: { clientId, isActive: true } }),
    ]);
    if (!client) return null;

    const onboarding = (client.onboardingData as Record<string, any> | null) || {};
    const vapiConfig = (client.vapiConfig as Record<string, any> | null) || {};
    /* Le néerlandais est un OPT-IN explicite (`agentLanguage: 'nl'`), jamais
       une déduction: la Belgique reste par défaut en français — la moitié des
       clients belges attend l'inverse, et ce choix-là appartient au client,
       pas à une règle par pays. */
    const language: 'fr' | 'en' | 'nl' =
      client.agentLanguage === 'nl'
        ? 'nl'
        : client.agentLanguage === 'fr' || ['FR', 'BE', 'LU', 'CH', 'MC'].includes(client.country)
          ? 'fr'
          : 'en';

    const profile: ClientVoiceProfile = {
      clientId: client.id,
      businessName: client.businessName,
      businessType: client.businessType,
      agentName: client.agentName || (language === 'fr' ? 'Camille' : language === 'nl' ? 'Lotte' : 'Ashley'),
      language,
      timezone: onboarding.timezone || (language === 'fr' ? 'Europe/Paris' : 'America/New_York'),
      transferNumber: client.transferNumber,
      instructions: onboarding.specialInstructions || onboarding.instructions || null,
      services: Array.isArray(onboarding.services) ? onboarding.services.slice(0, 12) : [],
      openingHours: onboarding.openingHours || onboarding.hours || null,
      bookingEnabled: onboarding.bookingEnabled !== false,
      calendarConnected: Boolean(client.googleCalendarRefreshToken),
      planType: client.planType,
      characterId: typeof vapiConfig.characterId === 'string' ? vapiConfig.characterId : null,
      customVoice: readCustomVoice(vapiConfig.customVoice),
      country: client.country,
      // An explicit per-client false wins over the global default, so one
      // problematic tenant can be pinned back to Vapi's own OpenAI path.
      customLlm: vapiConfig.customLlm === false ? false : vapiConfig.customLlm === true || env.VOICE_CUSTOM_LLM_DEFAULT,
      // Toute valeur inconnue vaut `auto`: un réglage mal orthographié ne doit
      // pas décider en silence de la voix que l'appelant entend.
      voiceMode: ['realtime', 'classic'].includes(vapiConfig.voiceMode) ? vapiConfig.voiceMode : 'auto',
      // Liste fermée: une valeur inconnue retombe sur le réglage global plutôt
      // que de décider en silence de ce que l'appelant entend.
      ttsProvider: ['11labs', 'cartesia'].includes(vapiConfig.ttsProvider) ? vapiConfig.ttsProvider : undefined,
      hasKnowledgeBase: knowledgeCount > 0,
      recordCalls: vapiConfig.disableRecordingNotice !== true && vapiConfig.recordCalls !== false,
    };

    await this.set(key, profile, PROFILE_TTL_MS);
    return profile;
  }

  /**
   * What we already know about this caller. Short TTL: a caller who hangs up
   * and rings back within the minute should still be recognised, but the data
   * must not go stale across a shift.
   */
  async getCallerHistory(clientId: string, callerNumber: string | null): Promise<CallerHistory> {
    const empty: CallerHistory = {
      previousCalls: 0,
      lastCallAt: null,
      lastSummary: null,
      knownName: null,
      hasUpcomingBooking: false,
    };
    if (!callerNumber) return empty;

    const key = `voice:caller:${clientId}:${callerNumber}`;
    const cached = await this.get<CallerHistory>(key);
    if (cached) return cached;

    const [memory, calls, booking] = await Promise.all([
      prisma.callerMemory.findUnique({
        where: { clientId_callerNumber: { clientId, callerNumber } },
        select: { knownName: true, profileSummary: true, lastSummary: true, lastCallAt: true, totalCalls: true },
      }),
      prisma.clientCall.findMany({
        where: { clientId, callerNumber, status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { createdAt: true, summary: true, nameCollected: true, callerName: true },
      }),
      prisma.clientBooking.findFirst({
        where: {
          clientId,
          customerPhone: callerNumber,
          status: 'confirmed',
          bookingDate: { gte: new Date() },
        },
        select: { id: true },
      }),
    ]);

    // CallerMemory is the collapsed, authoritative view when it exists; the
    // ClientCall scan is the fallback for callers who rang before this table.
    const history: CallerHistory = {
      previousCalls: memory?.totalCalls ?? calls.length,
      lastCallAt: (memory?.lastCallAt ?? calls[0]?.createdAt)?.toISOString() ?? null,
      lastSummary: memory?.profileSummary ?? memory?.lastSummary ?? calls[0]?.summary ?? null,
      knownName:
        memory?.knownName
        ?? calls.find(c => c.nameCollected)?.nameCollected
        ?? calls.find(c => c.callerName)?.callerName
        ?? null,
      hasUpcomingBooking: Boolean(booking),
    };

    await this.set(key, history, HISTORY_TTL_MS);
    return history;
  }

  /**
   * Everything the orchestrator needs at `call-start`, in one await. The two
   * reads are independent, so they run concurrently — the profile is usually a
   * cache hit and the history is the only one that can reach Postgres.
   */
  async getCallContext(clientId: string, callerNumber: string | null) {
    const [profile, caller] = await Promise.all([
      this.getClientProfile(clientId),
      this.getCallerHistory(clientId, callerNumber),
    ]);
    return { profile, caller };
  }

  /**
   * Drop a client's cached profile. Called whenever onboarding data, the
   * transfer number, or the agent config changes — otherwise the agent would
   * keep introducing itself with the old name for up to the TTL.
   */
  async invalidateClient(clientId: string): Promise<void> {
    const key = `voice:profile:${clientId}`;
    this.local.delete(key);
    const redis = await this.store();
    if (redis) {
      try {
        await redis.del(key);
      } catch {
        /* non-fatal */
      }
    }
  }

  /**
   * Drop every cached profile. For changes that are not one client's — a new
   * voice assignment applies to all of them at once, and waiting out the TTL
   * would mean callers hearing the old voices for minutes afterwards.
   */
  async invalidateAll(): Promise<void> {
    for (const key of [...this.local.keys()]) {
      if (key.startsWith('voice:profile:')) this.local.delete(key);
    }
    const redis = await this.store();
    if (!redis) return;
    try {
      // The local map holds the keys this process knows about; a second worker
      // will expire on its own TTL, which is the accepted cost of not scanning
      // the whole keyspace on a shared Redis.
      await redis.del('voice:profile:*');
    } catch { /* non-fatal */ }
  }

  /** Drop a caller's cached history after their memory row changes. */
  async invalidateCaller(clientId: string, callerNumber: string): Promise<void> {
    const key = `voice:caller:${clientId}:${callerNumber}`;
    this.local.delete(key);
    const redis = await this.store();
    if (redis) {
      try {
        await redis.del(key);
      } catch {
        /* non-fatal */
      }
    }
  }

  /**
   * Warm the profile ahead of the first call of the day. Errors are swallowed:
   * pre-warming is an optimisation, never a dependency.
   */
  async prewarm(clientIds: string[]): Promise<void> {
    await Promise.all(
      clientIds.map(id =>
        this.getClientProfile(id).catch(err =>
          logger.debug(`[VoiceContext] prewarm failed for ${id}: ${(err as Error).message}`)
        )
      )
    );
  }

  /** Test seam — drops every locally cached entry. */
  resetLocal(): void {
    this.local.clear();
  }
}

export const realtimeContextService = new RealtimeContextService();
