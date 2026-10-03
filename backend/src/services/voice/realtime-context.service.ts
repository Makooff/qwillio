import { parseWeekHours, describeHours, DEFAULT_WEEK_HOURS, type WeekHours } from '../../utils/opening-hours';
import { prisma } from '../../config/database';
import { clientLocale } from '../../utils/client-locale';
import { businessTimezone } from '../../utils/zoned-time';
import { knowledgeFieldsBlock } from '../../config/knowledge-presets';
import { namesMatch } from '../../utils/name-match';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { readTierId, type VoiceTierId } from './voice-tiers';
import { superagentAllowed } from '../../config/plan-features';
import type { CustomVoice } from '../../config/voice-characters';
import { phoneForms } from '../../utils/phone-forms';

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
  /**
   * LES PRÉFÉRENCES STABLES DE CE NUMÉRO, EN CLAIR.
   *
   * La colonne `preferences` de `CallerMemory` était ÉCRITE depuis toujours
   * (`mergePreferences`, jusqu'à 6 entrées) et jamais lue par personne. Elle
   * servait de journal à personne : l'agent redemandait à chaque appel ce qu'il
   * avait déjà appris — « toujours la même personne », « préfère le matin ».
   *
   * Elles arrivent ici et pas par un appel d'outil, pour la même raison que
   * `upcomingBookings` : demander au modèle d'appeler un outil pour savoir ce
   * qu'on sait déjà de l'appelant est une marche de trop en parole-à-parole, et
   * il l'oublie.
   */
  preferences: string[];
  /**
   * L'ADRESSE DÉJÀ CONNUE, pour ne pas la redemander.
   *
   * `CallerMemory.email` est renseigné par `persistMemory` à chaque appel où
   * l'adresse a été captée, et n'était relu nulle part : l'agent la réclamait
   * de nouveau à un habitué qui l'avait donnée la veille. Redemander une
   * information qu'on possède est le premier signe qu'une réceptionniste ne
   * reconnaît pas son interlocuteur.
   */
  knownEmail: string | null;
  hasUpcomingBooking: boolean;
  /**
   * LES RENDEZ-VOUS À VENIR DE CE NUMÉRO, en clair (17/09/2026).
   *
   * « Tu as mon numéro de téléphone, tu as simplement à aller chercher dans ta
   * base de données », dit par l'appelant au milieu d'un appel de 161 s où
   * `lookupBooking` n'a JAMAIS été appelé. Il a raison: la ligne existe, sous
   * son numéro, et rien n'obligeait le modèle à aller la chercher.
   *
   * En parole-à-parole le modèle est plus faible sur l'appel d'outils, et lui
   * demander d'en appeler un pour savoir QUI appelle est une marche de trop:
   * on le lui dit à l'ouverture, par le brief. L'outil reste, pour chercher
   * sous un autre nom ou pour un appelant non reconnu.
   *
   * Dates en `YYYY-MM-DD`: cet objet passe par le cache, donc il se
   * sérialise; une `Date` en reviendrait en chaîne sans que rien ne le dise.
   */
  upcomingBookings: Array<{ name: string; date: string; time: string | null; service: string | null }>;
}

export interface ClientVoiceProfile {
  clientId: string;
  businessName: string;
  businessType: string;
  agentName: string;
  language: 'fr' | 'en' | 'nl';
  timezone: string;
  transferNumber: string | null;
  /**
   * Quand l'agent a le droit de transférer: `always` (historique), `hours`
   * (seulement pendant les heures d'ouverture), `never` (message toujours).
   */
  transferMode?: 'always' | 'hours' | 'never';
  /**
   * Les numéros de CE client qui aboutissent à la réceptionniste.
   *
   * Portés sur le profil et non relus au moment du transfert: `buildVoiceTools`
   * est synchrone et sur le chemin critique de l'appel. Ils servent à refuser un
   * transfert qui BOUCLERAIT, c'est-à-dire vers une ligne qui renvoie vers nous.
   */
  inboundNumber?: string | null;
  inboundLines?: Array<{ number: string }>;
  /** Le type de renvoi posé par le client: un renvoi conditionnel autorise son propre mobile en transfert. */
  forwardingType?: string | null;
  /** Free-text client instructions from onboarding ("never quote prices"). */
  instructions: string | null;
  services: string[];
  openingHours: string | null;
  /** Les horaires du portail, jour par jour: l'agenda et la réservation les lisent. */
  weekHours: WeekHours | null;
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
   * Le NIVEAU vendu: `base` (la chaîne classique) ou `superagent`
   * (parole-à-parole). Absent = rien de choisi, et `voiceMode` fait alors
   * repli, puis le réglage global. La résolution vit dans `voice-tiers.ts`,
   * qui est seul à la lire: voir `requestedTier`.
   */
  voiceTier?: VoiceTierId | null;
  /**
   * Ce client a-t-il DROIT au Superagent ?
   *
   * Inclus à partir de Pro, acheté en option en dessous. Posé sur le profil
   * parce que c'est le profil que l'appel lit: un droit vérifié seulement à
   * l'écriture laisserait servir un moteur dix fois plus cher à un compte qui
   * a changé de forfait entre-temps, et la facture arriverait sans personne
   * pour la voir venir.
   */
  superagentAllowed: boolean;
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
   * Les champs nommés du métier, déjà rendus avec leurs LIBELLÉS.
   *
   * Rendus ici et pas à l'appel: ils vivent dans `vapiConfig`, que ce profil est
   * seul à lire, et le libellé demande le preset du métier. Les recalculer plus
   * loin ferait relire la fiche client à chaque tour de parole.
   *
   * Ils ne sont PAS dans `businessKnowledge`: ce sont deux magasins, et
   * l'assistant enregistré lisait le premier pendant que ce chemin-ci ne lisait
   * que le second. Un client remplissait « Mutuelles acceptées » et l'agent
   * répondait qu'il ne savait pas.
   */
  knowledgeFields: string;
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
        // Les lignes qui aboutissent à la réceptionniste, pour refuser un
        // transfert qui bouclerait vers elle. Voir `transfer-loop.ts`.
        vapiPhoneNumber: true,
        forwardingType: true,
        phoneNumbers: { where: { isActive: true }, select: { number: true } },
        planType: true,
        // Le droit ACHETÉ au Superagent, lu avec le forfait: `superagentAllowed`
        // répond avec les deux, et c'est la seule lecture.
        superagentOption: true,
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
    /* UNE règle, `clientLocale`: le choix du client d'abord, le pays en repli.
       L'ancienne forme laissait le pays renverser un `'en'` explicite, donc un
       client belge ne pouvait jamais passer son agent en anglais depuis ses
       paramètres: l'écran disait enregistré, l'appel restait en français. */
    const language: 'fr' | 'en' | 'nl' = clientLocale(client);

    /* DEUX écritures, UNE lecture — et elles ne se rencontraient pas.

       Le parcours guidé enregistre dans `onboardingData`. L'assistant
       d'inscription et l'écran Réceptionniste, eux, écrivent dans
       `vapiConfig` (voir `applyConfigPatch`, qui ne touche que cette colonne).
       Ce profil ne lisait que la première: tout ce qu'un client dictait à
       l'assistant pendant son inscription — ses horaires, ses services, son
       ton — restait dans l'autre colonne et n'arrivait JAMAIS à la
       réceptionniste, qui retombait sur lundi-vendredi 9 h-18 h et une carte
       vide. Pire: `setup-completeness` note son score sur `vapiConfig`, donc
       la case passait au vert pendant que le téléphone ne savait rien — et
       l'agent inventait, ce que ce module dit justement vouloir empêcher.

       La forme est la MÊME des deux côtés (`{ monday: { open, from, to } }`),
       donc une lecture en repli suffit, et elle soigne les comptes déjà
       créés sans migration. `onboardingData` garde la priorité: c'est la
       saisie explicite du parcours guidé. */
    const weekHours = parseWeekHours(onboarding.hours)
      ?? parseWeekHours(vapiConfig.hours)
      ?? DEFAULT_WEEK_HOURS;
    const profile: ClientVoiceProfile = {
      clientId: client.id,
      businessName: client.businessName,
      businessType: client.businessType,
      agentName: client.agentName || (language === 'fr' ? 'Camille' : language === 'nl' ? 'Lotte' : 'Ashley'),
      language,
      // UNE règle de fuseau, partagée avec l'agenda et les créneaux.
      timezone: businessTimezone(client),
      transferNumber: client.transferNumber,
      inboundNumber: client.vapiPhoneNumber,
      inboundLines: client.phoneNumbers ?? [],
      forwardingType: client.forwardingType,
      transferMode: ['always', 'hours', 'never'].includes(String(vapiConfig.transferMode))
        ? (vapiConfig.transferMode as 'always' | 'hours' | 'never')
        : 'always',
      /* `personalityNotes` en dernier repli: c'est le champ où l'assistant et
         l'écran Réceptionniste rangent les consignes de ton (« ne donnez
         jamais de prix »). Il n'était lu que par le mode test au clavier:
         l'essai respectait la consigne, l'appel réel l'ignorait. */
      instructions: onboarding.specialInstructions
        || onboarding.instructions
        || (typeof vapiConfig.personalityNotes === 'string' && vapiConfig.personalityNotes.trim()
          ? vapiConfig.personalityNotes.trim()
          : null),
      services: readServices(onboarding.services, vapiConfig.items),
      /* Les horaires du portail sont un OBJET (`hours`, jour par jour). Les
         mettre dans une chaîne donnait « Horaires: [object Object] » dans le
         prompt: l'agent ne savait pas que le dimanche est fermé (12/09/2026). */
      openingHours: typeof onboarding.openingHours === 'string' && onboarding.openingHours.trim()
        ? onboarding.openingHours
        : describeHours(weekHours, language),
      weekHours,
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
      // Même règle que ci-dessus: une valeur inconnue vaut « rien de choisi »,
      // pas un niveau. Un réglage mal orthographié ne doit pas décider en
      // silence du moteur, ni d'un supplément.
      voiceTier: readTierId(vapiConfig.voiceTier),
      superagentAllowed: superagentAllowed(client),
      // Liste fermée: une valeur inconnue retombe sur le réglage global plutôt
      // que de décider en silence de ce que l'appelant entend.
      ttsProvider: ['11labs', 'cartesia'].includes(vapiConfig.ttsProvider) ? vapiConfig.ttsProvider : undefined,
      hasKnowledgeBase: knowledgeCount > 0,
      /* Les champs nommés du métier, PLUS la connaissance libre que le client
         a tapée. `vapiConfig.faq` et `vapiConfig.faqEntries` n'avaient aucun
         lecteur côté appel: le gérant écrivait les questions qu'on lui pose
         le plus, et sa réceptionniste ne les avait jamais vues. */
      knowledgeFields: [
        knowledgeFieldsBlock(vapiConfig.knowledge, client.businessType),
        readFaqBlock(vapiConfig.faq, vapiConfig.faqEntries),
      ].filter(Boolean).join('\n\n'),
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
      preferences: [],
      knownEmail: null,
      hasUpcomingBooking: false,
      upcomingBookings: [],
    };
    if (!callerNumber) return empty;

    const key = `voice:caller:${clientId}:${callerNumber}`;
    const cached = await this.get<CallerHistory>(key);
    if (cached) return cached;

    const [memory, calls, bookings] = await Promise.all([
      /* Par ses ÉCRITURES ici aussi, et pas seulement sur les réservations
         (19/09/2026). Les lignes écrites avant la normalisation de
         `callerMemoryService.remember` portent un « + » (un numéro de rappel
         DICTÉ arrive en E.164), et une clé unique ne se cherche que par
         égalité: elles étaient donc perdues pour toujours. `findFirst` sur les
         deux écritures les récupère, et la plus récemment touchée gagne si les
         deux existent. */
      prisma.callerMemory.findFirst({
        where: { clientId, callerNumber: { in: phoneForms(callerNumber) } },
        orderBy: { lastCallAt: 'desc' },
        select: { knownName: true, profileSummary: true, lastSummary: true, lastCallAt: true, totalCalls: true,
                  /* Lues enfin. `preferences` était écrite et jetée; `email`
                     aussi. Deux requêtes vers la même table, autant demander
                     les colonnes qu'on va afficher. */
                  preferences: true, email: true },
      }),
      prisma.clientCall.findMany({
        where: { clientId, callerNumber, status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { createdAt: true, summary: true, nameCollected: true, callerName: true },
      }),
      prisma.clientBooking.findMany({
        where: {
          clientId,
          /* Par ses ÉCRITURES, jamais par égalité (17/09/2026). Le numéro est
             stocké tantôt « 32483620980 » (clé posée par `normalizeNumber`),
             tantôt « +32… » selon la source, et une égalité ratait donc le
             même numéro en silence. Même correctif que `findCallerBookings`,
             et il faut les deux: cette lecture-ci décide de ce que l'agent
             SAIT, l'autre de ce qu'il TROUVE. */
          customerPhone: { in: phoneForms(callerNumber) },
          status: 'confirmed',
          /* Sans borne haute, pour la raison de `findCallerBookings`: un
             contrôle à six mois est la norme du métier, et le rendez-vous que
             l'appelant veut déplacer était à dix-huit. */
          bookingDate: { gte: new Date() },
        },
        /* La plus récemment TOUCHÉE d'abord, et non la première rendue par la
           base: sans tri, c'était une vieille réservation de test (« Paul
           Matthieu ») qui nommait l'appelant, et l'agent l'a appelé ainsi
           pendant tout l'appel (13/09/2026, 16:52). */
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { customerName: true, bookingDate: true, bookingTime: true, serviceType: true },
      }),
    ]);

    /* Un numéro peut réserver pour PLUSIEURS personnes (un parent pour ses
       enfants, un cabinet de test pour trois prénoms). Si les réservations à
       venir ne portent pas le même nom, aucune ne dit qui appelle: on ne
       nomme personne plutôt que de nommer le mauvais. */
    const bookingNames = bookings.map(b => b.customerName?.trim() ?? '').filter(Boolean);
    const bookingName = bookingNames.length && bookingNames.every(n => namesMatch(n, bookingNames[0]))
      ? bookingNames[0]
      : null;

    // CallerMemory is the collapsed, authoritative view when it exists; the
    // ClientCall scan is the fallback for callers who rang before this table.
    /* Le nom d'une réservation CONFIRMÉE prime sur la mémoire d'appelant:
       la réservation a été relue et épelée pendant l'appel, la mémoire porte
       ce que le transcripteur a entendu (« Jean Lucas » pour « Jean-Luc »,
       13/09/2026). Même ordre que `knownCallerName` en fin d'appel, pour que
       l'agent en ligne et la fiche du portail disent le même nom. */
    const history: CallerHistory = {
      previousCalls: memory?.totalCalls ?? calls.length,
      lastCallAt: (memory?.lastCallAt ?? calls[0]?.createdAt)?.toISOString() ?? null,
      lastSummary: memory?.profileSummary ?? memory?.lastSummary ?? calls[0]?.summary ?? null,
      knownName:
        bookingName
        || memory?.knownName
        || calls.find(c => c.nameCollected)?.nameCollected
        || calls.find(c => c.callerName)?.callerName
        || null,
      hasUpcomingBooking: bookings.length > 0,
      /* Les préférences passent TELLES QUELLES, bornées à six — c'est déjà la
         limite d'écriture de `mergePreferences`, on ne la rejoue pas ici. Une
         préférence vide ou blanche n'apprend rien et encombrerait le prompt. */
      preferences: (memory?.preferences ?? []).map(p => p.trim()).filter(Boolean).slice(0, 6),
      knownEmail: memory?.email?.trim() || null,
      /* Une ligne sans date est écartée, jamais levée: cette lecture est sur le
         chemin de l'appel, et une exception ici coûterait TOUTE la
         reconnaissance de l'appelant pour une colonne bancale. */
      upcomingBookings: bookings.slice(0, 3).flatMap(b => {
        const at = b.bookingDate instanceof Date ? b.bookingDate : null;
        return at ? [{
          name: b.customerName?.trim() || '',
          date: at.toISOString().slice(0, 10),
          time: b.bookingTime ?? null,
          service: b.serviceType ?? null,
        }] : [];
      }),
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

/**
 * Les services que la réceptionniste peut citer, d'où qu'ils viennent.
 *
 * Le parcours guidé écrit `onboardingData.services`, une liste de chaînes.
 * L'assistant d'inscription écrit `vapiConfig.items`, des objets
 * `{ name, price }`. Les deux décrivent la même carte et l'appel n'en lisait
 * qu'une. Le libellé reprend EXACTEMENT celui du mode test
 * (`assistant-chat.service.ts`), pour que l'essai au clavier et l'appel réel
 * énoncent les mêmes prix.
 */
export function readServices(fromOnboarding: unknown, fromConfig: unknown): string[] {
  const guided = Array.isArray(fromOnboarding)
    ? fromOnboarding.filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    : [];
  if (guided.length) return guided.slice(0, 12);

  if (!Array.isArray(fromConfig)) return [];
  return fromConfig
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object' && !Array.isArray(i))
    .map(i => {
      const name = typeof i.name === 'string' ? i.name.trim() : '';
      const price = typeof i.price === 'string' ? i.price.trim() : '';
      if (!name) return '';
      return price ? `${name} (${price})` : name;
    })
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * La connaissance libre du client, en un bloc lisible par le prompt.
 *
 * Deux formes coexistent, écrites par deux écrans: `faq`, une chaîne, et
 * `faqEntries`, des paires question/réponse. Les deux sont rendues, les paires
 * d'abord parce qu'elles portent leur propre question. Borné à 2 000
 * caractères: c'est un prompt d'appel, pas une base de connaissances — celle-là
 * vit dans `businessKnowledge` et a son propre outil.
 */
export function readFaqBlock(faq: unknown, faqEntries: unknown): string {
  const lines: string[] = [];

  if (Array.isArray(faqEntries)) {
    for (const entry of faqEntries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const e = entry as Record<string, unknown>;
      const q = typeof e.q === 'string' ? e.q.trim() : '';
      const a = typeof e.a === 'string' ? e.a.trim() : '';
      if (q && a) lines.push(`- ${q} — ${a}`);
    }
  }
  if (typeof faq === 'string' && faq.trim()) lines.push(faq.trim());

  if (!lines.length) return '';
  return `BUSINESS KNOWLEDGE:\n${lines.join('\n').slice(0, 2000)}`;
}
