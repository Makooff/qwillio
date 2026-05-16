import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';

// ─── Apify actor names (adjust if needed) ───────────────────────────────────
// Profile scraper: try "bebity/linkedin-profile-scraper" first, fallback noted below.
// Connection sender: "curious_coder/linkedin-connection-sender"
// If these actors are not available in your Apify account, store records as
// "pending" and use PhantomBuster or Waalaxy to send the actual requests.
const ACTOR_PROFILE_SCRAPER = 'bebity/linkedin-profile-scraper';
const ACTOR_CONNECTION_SENDER = 'curious_coder/linkedin-connection-sender';

// ─── Decision-maker title keywords (French) ─────────────────────────────────
const DECISION_MAKER_TITLES = [
  'Directeur', 'Gérant', 'CEO', 'Fondateur', 'PDG',
  'Manager', 'Responsable', 'Co-fondateur', 'Dirigeant',
  'Président', 'Associé', 'Partner',
];

// ─── Connection note templates per niche (< 300 chars each) ─────────────────
const CONNECTION_NOTES: Record<string, string> = {
  cabinet_dentaire:
    'Bonjour [Prénom], je travaille avec des cabinets dentaires sur la gestion des appels manqués. Un sujet qui revient souvent. Curieux d\'avoir votre point de vue si vous êtes ouvert(e) à échanger.',
  agence_marketing:
    'Bonjour [Prénom], je travaille sur un outil IA pour les agences qui cherchent à automatiser la prospection client. Quelques idées qui pourraient vous intéresser — ouvert(e) à un échange rapide ?',
  cabinet_avocat:
    'Bonjour [Prénom], je travaille avec des cabinets sur la gestion des appels entrants hors heures d\'ouverture. Un sujet sensible pour beaucoup. Curieux(se) d\'avoir votre avis si vous avez 5 minutes.',
  agence_immobiliere:
    'Bonjour [Prénom], je travaille avec des agences immobilières sur la réactivité aux appels entrants — souvent décisive pour ne pas perdre un acquéreur. Vous êtes ouvert(e) à en discuter 5 min ?',
  cabinet_comptable:
    'Bonjour [Prénom], je travaille avec des cabinets comptables sur la gestion des pics d\'appels en période fiscale. Beaucoup y perdent des clients. Curieux(se) d\'avoir votre retour si vous avez le temps.',
  agence_web:
    'Bonjour [Prénom], je travaille avec des agences web sur un outil IA qui gère les appels prospects en dehors des heures de bureau. Ça résonne avec vous ? Je serais ravi(e) d\'en parler.',
  cabinet_rh:
    'Bonjour [Prénom], je travaille avec des cabinets RH sur la disponibilité téléphonique vis-à-vis des candidats. Un sujet clé pour l\'image employeur. Ouvert(e) à échanger quelques minutes ?',
  coach:
    'Bonjour [Prénom], je travaille avec des coachs business sur la gestion des demandes entrantes quand ils sont en session. Un vrai sujet pour ne rien laisser passer. Disponible pour en discuter ?',
  formation:
    'Bonjour [Prénom], je travaille avec des organismes de formation sur la réactivité aux appels de futurs apprenants. Les délais de réponse font souvent la différence. Ouvert(e) à en parler ?',
  restaurant:
    'Bonjour [Prénom], je travaille avec des restaurateurs sur la gestion des réservations par téléphone pendant le service. Beaucoup de couverts se perdent ainsi. Vous avez 5 min pour en discuter ?',
  clinique:
    'Bonjour [Prénom], je travaille avec des cliniques et centres de santé sur les appels manqués hors heures. Un sujet qui impacte directement la satisfaction patient. Curieux(se) d\'avoir votre avis ?',
  artisan:
    'Bonjour [Prénom], je travaille avec des artisans sur la gestion des appels entrants quand ils sont en chantier. Beaucoup de devis ne se font jamais faute de décrocher. Disponible pour en parler ?',
  agence_voyage:
    'Bonjour [Prénom], je travaille avec des agences de voyage sur la réactivité téléphonique en dehors des heures d\'ouverture. Cela fait souvent la différence avec le client. Ouvert(e) à un échange ?',
};

// ─── Message templates ───────────────────────────────────────────────────────
const MESSAGE_1_TEMPLATE = `Bonjour [Prénom],

Merci pour la connexion !

Je voulais juste partager pourquoi j'avais demandé à vous contacter : on travaille avec des [niche_label] qui perdent des clients à cause d'appels manqués — souvent sans s'en rendre compte.

On a construit un assistant IA qui répond 24h/24, réserve des rendez-vous et transfère les urgences. Le tout en moins de 48h.

Si ça résonne avec une problématique que vous avez, je serais ravi(e) de vous montrer ça en 15 minutes.

Pas de pression — juste curieux(se) de savoir si c'est pertinent pour vous.

Marie`;

const MESSAGE_2_TEMPLATE = `Bonjour [Prénom],

Je reviens vers vous une dernière fois — j'ai un cas client dans votre secteur qui pourrait vous intéresser.

Un cabinet comme le vôtre a réduit ses appels manqués de 80% en un mois. Je peux vous envoyer les chiffres si vous voulez.

Sinon, pas de souci — bonne continuation !

Marie`;

// ─── Human-readable niche labels ────────────────────────────────────────────
const NICHE_LABELS: Record<string, string> = {
  cabinet_dentaire: 'cabinets dentaires',
  agence_marketing: 'agences marketing',
  cabinet_avocat: 'cabinets d\'avocats',
  agence_immobiliere: 'agences immobilières',
  cabinet_comptable: 'cabinets comptables',
  agence_web: 'agences web',
  cabinet_rh: 'cabinets RH',
  coach: 'coachs business',
  formation: 'organismes de formation',
  restaurant: 'restaurants',
  clinique: 'cliniques',
  artisan: 'artisans',
  agence_voyage: 'agences de voyage',
  // Aliases from linkedin-scraping.service.ts
  marketing_agency: 'agences marketing',
  recruitment: 'cabinets de recrutement',
  real_estate: 'agences immobilières',
  accountant: 'cabinets comptables',
  web_agency: 'agences web',
  law_firm: 'cabinets d\'avocats',
  training: 'organismes de formation',
};

export interface Profile {
  linkedinUrl: string;
  firstName: string;
  fullName: string;
  title: string;
  companyName: string;
}

export class LinkedInOutreachService {
  private readonly apifyToken: string;

  constructor() {
    this.apifyToken = env.APIFY_API_KEY || '';
  }

  // ─── Private Apify helper (same pattern as linkedin-scraping.service.ts) ───
  private async _callApifyActor<TInput, TResult>(
    actorId: string,
    input: TInput,
    timeoutMs = 120_000,
  ): Promise<TResult[]> {
    if (!this.apifyToken) {
      logger.warn(`[LinkedIn Outreach] No APIFY_API_KEY — skipping actor ${actorId}`);
      return [];
    }

    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId.replace('/', '~')}/runs?token=${this.apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!runRes.ok) {
      const body = await runRes.text();
      throw new Error(`Apify run failed (${runRes.status}): ${body}`);
    }

    const run = await runRes.json() as { data: { id: string } };
    const runId = run.data?.id;
    if (!runId) throw new Error('Apify did not return a run ID');

    // Poll for completion (up to timeoutMs)
    const deadline = Date.now() + timeoutMs;
    let datasetId: string | null = null;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5_000));
      const statusRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${this.apifyToken}`,
      );
      const status = await statusRes.json() as { data: { status: string; defaultDatasetId: string } };

      if (status.data?.status === 'SUCCEEDED') {
        datasetId = status.data.defaultDatasetId;
        break;
      }
      if (status.data?.status === 'FAILED') {
        throw new Error(`Apify actor ${actorId} run FAILED`);
      }
    }

    if (!datasetId) throw new Error(`Apify actor ${actorId} timed out`);

    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${this.apifyToken}&limit=100`,
    );
    return itemsRes.json() as Promise<TResult[]>;
  }

  // ─── 1. Find decision-maker profiles at a company ────────────────────────
  async findDecisionMakerProfiles(
    companyLinkedInUrl: string,
    niche: string,
  ): Promise<Profile[]> {
    try {
      type RawProfile = {
        linkedInUrl?: string;
        url?: string;
        firstName?: string;
        fullName?: string;
        name?: string;
        headline?: string;
        title?: string;
        companyName?: string;
        company?: string;
      };

      const items = await this._callApifyActor<object, RawProfile>(
        ACTOR_PROFILE_SCRAPER,
        {
          startUrls: [{ url: companyLinkedInUrl }],
          searchType: 'people',
          cookie: env.LINKEDIN_COOKIES ? JSON.parse(env.LINKEDIN_COOKIES) : undefined,
        },
      );

      const profiles: Profile[] = [];

      for (const item of items) {
        const title = item.headline ?? item.title ?? '';
        const isDecisionMaker = DECISION_MAKER_TITLES.some(kw =>
          title.toLowerCase().includes(kw.toLowerCase()),
        );
        if (!isDecisionMaker) continue;

        const linkedinUrl = item.linkedInUrl ?? item.url ?? '';
        if (!linkedinUrl) continue;

        const fullName = item.fullName ?? item.name ?? '';
        const firstName = item.firstName ?? fullName.split(' ')[0] ?? 'vous';

        profiles.push({
          linkedinUrl,
          firstName,
          fullName,
          title,
          companyName: item.companyName ?? item.company ?? '',
        });
      }

      logger.info(
        `[LinkedIn Outreach] Found ${profiles.length} decision-maker(s) at ${companyLinkedInUrl}`,
      );
      return profiles;
    } catch (err) {
      logger.error('[LinkedIn Outreach] findDecisionMakerProfiles error:', err);
      return [];
    }
  }

  // ─── 2. Send connection requests ─────────────────────────────────────────
  async sendConnectionRequests(
    limit: number = env.LINKEDIN_DAILY_LIMIT,
  ): Promise<{ sent: number; skipped: number }> {
    let sent = 0;
    let skipped = 0;

    // Count how many we already sent today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sentToday = await prisma.linkedInOutreach.count({
      where: { connectionRequestAt: { gte: todayStart } },
    });

    const remaining = limit - sentToday;
    if (remaining <= 0) {
      logger.info(`[LinkedIn Outreach] Daily limit reached (${limit})`);
      return { sent: 0, skipped: 0 };
    }

    // Find prospects with a niche and no existing LinkedInOutreach
    const prospects = await prisma.prospect.findMany({
      where: {
        niche: { not: null },
        linkedInOutreach: { none: {} },
        website: { not: null },
      },
      take: remaining * 3, // over-fetch to account for profiles not found
      orderBy: { priorityScore: 'desc' },
    });

    for (const prospect of prospects) {
      if (sent >= remaining) break;

      const niche = prospect.niche!;

      // Try to find a LinkedIn profile for this company
      // We use the company website as search hint if no LinkedIn URL exists
      let profiles: Profile[] = [];

      if (prospect.website) {
        try {
          // Use profile scraper with company name + niche as search query
          type SearchResult = {
            linkedInUrl?: string;
            url?: string;
            firstName?: string;
            fullName?: string;
            name?: string;
            headline?: string;
            title?: string;
            companyName?: string;
          };

          const searchResults = await this._callApifyActor<object, SearchResult>(
            ACTOR_PROFILE_SCRAPER,
            {
              searchQuery: `${prospect.businessName} ${NICHE_LABELS[niche] ?? niche}`,
              country: 'FR',
              cookie: env.LINKEDIN_COOKIES ? JSON.parse(env.LINKEDIN_COOKIES) : undefined,
            },
          );

          for (const item of searchResults.slice(0, 5)) {
            const title = item.headline ?? '';
            const isDecisionMaker = DECISION_MAKER_TITLES.some(kw =>
              title.toLowerCase().includes(kw.toLowerCase()),
            );
            if (!isDecisionMaker) continue;

            const linkedinUrl = item.linkedInUrl ?? item.url ?? '';
            if (!linkedinUrl) continue;

            const fullName = item.fullName ?? item.name ?? '';
            profiles.push({
              linkedinUrl,
              firstName: item.firstName ?? fullName.split(' ')[0] ?? 'vous',
              fullName,
              title,
              companyName: item.companyName ?? prospect.businessName,
            });
          }
        } catch (err) {
          logger.warn(
            `[LinkedIn Outreach] Profile search failed for ${prospect.businessName}:`,
            err,
          );
        }
      }

      if (profiles.length === 0) {
        skipped++;
        continue;
      }

      const profile = profiles[0];

      // Check for existing record (race condition guard)
      const existing = await prisma.linkedInOutreach.findUnique({
        where: { linkedinUrl: profile.linkedinUrl },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const note = this._buildConnectionNote(profile.firstName, niche);

      // Attempt to send via Apify actor
      let connectionSent = false;

      if (env.LINKEDIN_COOKIES) {
        try {
          await this._callApifyActor(
            ACTOR_CONNECTION_SENDER,
            {
              profileUrls: [profile.linkedinUrl],
              message: note,
              cookie: JSON.parse(env.LINKEDIN_COOKIES),
            },
            60_000,
          );
          connectionSent = true;
        } catch (err) {
          // Actor may not be available — fall back to storing as pending
          logger.warn(
            `[LinkedIn Outreach] Connection sender actor unavailable, storing as pending. Error: ${(err as Error).message}`,
          );
        }
      } else {
        logger.warn(
          '[LinkedIn Outreach] LINKEDIN_COOKIES not set — storing profile as pending for manual outreach (PhantomBuster / Waalaxy).',
        );
      }

      await prisma.linkedInOutreach.create({
        data: {
          prospectId: prospect.id,
          linkedinUrl: profile.linkedinUrl,
          profileName: profile.fullName,
          profileTitle: profile.title,
          companyName: profile.companyName,
          niche,
          connectionStatus: connectionSent ? 'requested' : 'pending',
          connectionRequestAt: connectionSent ? new Date() : null,
        },
      });

      if (connectionSent) {
        sent++;
        logger.info(
          `[LinkedIn Outreach] Connection request sent to ${profile.fullName} (${profile.companyName})`,
        );
      } else {
        skipped++;
        logger.info(
          `[LinkedIn Outreach] Stored ${profile.fullName} as pending — manual outreach required`,
        );
      }

      // Rate limit between requests
      await new Promise(r => setTimeout(r, 2_000));
    }

    logger.info(
      `[LinkedIn Outreach] sendConnectionRequests complete — sent: ${sent}, skipped: ${skipped}`,
    );
    return { sent, skipped };
  }

  // ─── 3. Process follow-ups ────────────────────────────────────────────────
  async processFollowUps(): Promise<{ followed: number }> {
    let followed = 0;

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    // ── Message 1: connected ≥ 2 days ago, no message 1 yet ──────────────
    const needsMessage1 = await prisma.linkedInOutreach.findMany({
      where: {
        connectionStatus: 'connected',
        message1SentAt: null,
        connectedAt: { lte: twoDaysAgo },
      },
    });

    for (const record of needsMessage1) {
      const firstName = this._extractFirstName(record.profileName);
      const nicheLabel = NICHE_LABELS[record.niche ?? ''] ?? (record.niche ?? 'votre secteur');
      const message = MESSAGE_1_TEMPLATE
        .replace('[Prénom]', firstName)
        .replace('[niche_label]', nicheLabel);

      let messageSent = false;

      if (env.LINKEDIN_COOKIES) {
        try {
          await this._callApifyActor(
            ACTOR_CONNECTION_SENDER,
            {
              profileUrls: [record.linkedinUrl],
              message,
              cookie: JSON.parse(env.LINKEDIN_COOKIES),
            },
            60_000,
          );
          messageSent = true;
        } catch (err) {
          logger.warn(
            `[LinkedIn Outreach] Message 1 send failed for ${record.profileName}: ${(err as Error).message}`,
          );
        }
      } else {
        logger.warn(
          '[LinkedIn Outreach] LINKEDIN_COOKIES not set — message 1 stored as pending',
        );
      }

      if (messageSent) {
        await prisma.linkedInOutreach.update({
          where: { id: record.id },
          data: {
            connectionStatus: 'message1_sent',
            message1SentAt: new Date(),
          },
        });
        followed++;
        logger.info(`[LinkedIn Outreach] Message 1 sent to ${record.profileName}`);
      }

      await new Promise(r => setTimeout(r, 1_500));
    }

    // ── Message 2: message1 sent ≥ 5 days ago, no message 2 yet ─────────
    const needsMessage2 = await prisma.linkedInOutreach.findMany({
      where: {
        connectionStatus: 'message1_sent',
        message2SentAt: null,
        message1SentAt: { lte: fiveDaysAgo },
      },
    });

    for (const record of needsMessage2) {
      const firstName = this._extractFirstName(record.profileName);
      const message = MESSAGE_2_TEMPLATE.replace('[Prénom]', firstName);

      let messageSent = false;

      if (env.LINKEDIN_COOKIES) {
        try {
          await this._callApifyActor(
            ACTOR_CONNECTION_SENDER,
            {
              profileUrls: [record.linkedinUrl],
              message,
              cookie: JSON.parse(env.LINKEDIN_COOKIES),
            },
            60_000,
          );
          messageSent = true;
        } catch (err) {
          logger.warn(
            `[LinkedIn Outreach] Message 2 send failed for ${record.profileName}: ${(err as Error).message}`,
          );
        }
      } else {
        logger.warn(
          '[LinkedIn Outreach] LINKEDIN_COOKIES not set — message 2 stored as pending',
        );
      }

      if (messageSent) {
        await prisma.linkedInOutreach.update({
          where: { id: record.id },
          data: {
            connectionStatus: 'message2_sent',
            message2SentAt: new Date(),
          },
        });
        followed++;
        logger.info(`[LinkedIn Outreach] Message 2 sent to ${record.profileName}`);
      }

      await new Promise(r => setTimeout(r, 1_500));
    }

    logger.info(`[LinkedIn Outreach] processFollowUps complete — ${followed} message(s) sent`);
    return { followed };
  }

  // ─── 4. Stats for admin dashboard ────────────────────────────────────────
  async getStats(): Promise<Record<string, unknown>> {
    const [
      total,
      pending,
      requested,
      connected,
      message1Sent,
      message2Sent,
      replied,
      qualified,
      notInterested,
      byNiche,
    ] = await Promise.all([
      prisma.linkedInOutreach.count(),
      prisma.linkedInOutreach.count({ where: { connectionStatus: 'pending' } }),
      prisma.linkedInOutreach.count({ where: { connectionStatus: 'requested' } }),
      prisma.linkedInOutreach.count({ where: { connectionStatus: 'connected' } }),
      prisma.linkedInOutreach.count({ where: { connectionStatus: 'message1_sent' } }),
      prisma.linkedInOutreach.count({ where: { connectionStatus: 'message2_sent' } }),
      prisma.linkedInOutreach.count({ where: { connectionStatus: 'replied' } }),
      prisma.linkedInOutreach.count({ where: { connectionStatus: 'qualified' } }),
      prisma.linkedInOutreach.count({ where: { connectionStatus: 'not_interested' } }),
      prisma.linkedInOutreach.groupBy({
        by: ['niche'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sentToday = await prisma.linkedInOutreach.count({
      where: { connectionRequestAt: { gte: todayStart } },
    });

    const connectionRate = requested + connected + message1Sent + message2Sent + replied + qualified > 0
      ? Math.round(
          ((connected + message1Sent + message2Sent + replied + qualified) /
            (requested + connected + message1Sent + message2Sent + replied + qualified)) *
            100,
        )
      : 0;

    return {
      total,
      sentToday,
      dailyLimit: env.LINKEDIN_DAILY_LIMIT,
      connectionRate: `${connectionRate}%`,
      byStatus: {
        pending,
        requested,
        connected,
        message1_sent: message1Sent,
        message2_sent: message2Sent,
        replied,
        qualified,
        not_interested: notInterested,
      },
      byNiche: byNiche.map(n => ({ niche: n.niche, count: n._count.id })),
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private _buildConnectionNote(firstName: string, niche: string): string {
    const template =
      CONNECTION_NOTES[niche] ??
      `Bonjour [Prénom], je travaille avec des entreprises sur la gestion des appels entrants grâce à l'IA. Un sujet qui peut faire une vraie différence. Curieux(se) d'avoir votre point de vue si vous êtes disponible.`;

    const note = template.replace('[Prénom]', firstName);

    // Enforce 300-char hard limit (LinkedIn requirement)
    return note.length > 300 ? note.slice(0, 297) + '...' : note;
  }

  private _extractFirstName(profileName: string | null): string {
    if (!profileName) return 'vous';
    return profileName.trim().split(' ')[0] ?? 'vous';
  }
}

export const linkedInOutreachService = new LinkedInOutreachService();
