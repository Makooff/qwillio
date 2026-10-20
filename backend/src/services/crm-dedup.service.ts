import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { ANONYMOUS_NAMES, normalizeLeadPhone } from './lead-identity';

/**
 * CRM Contact Deduplication Service
 * Before creating any contact anywhere, check for duplicates.
 * 1. Phone (E.164 normalized, country-aware, strict)
 * 2. Email
 * 3. Name + company fuzzy match (Levenshtein < 0.15)
 *
 * HARDENING (lead grouping work):
 *  - `country` may come from `data.country` (chosen signature for the analysis
 *    pipeline) or the optional third argument; legacy calls without either
 *    keep the historical BE default.
 *  - Phone normalization is STRICT (`normalizeLeadPhone`): unparseable junk
 *    returns null and is never written, never matched, never merged.
 *  - A stored row in a legacy format (« 0475 12 34 56 ») IS the same person as
 *    the E.164 equivalent: the exact-match miss falls back to a normalized
 *    scan of the tenant's numbers, so no duplicate is created.
 *  - A fuzzy NAME match is refused when a valid phone number was supplied but
 *    matched nothing (a number is a stronger identity than a name — two
 *    different numbers are two people even if both are called Marie), and
 *    anonymous placeholders (« Appelant inconnu ») are never name-matched in
 *    either direction.
 *  - find-or-create runs inside a transaction guarded by a PostgreSQL
 *    advisory xact lock keyed on (tenant, normalized phone). A plain
 *    transaction alone does NOT guarantee uniqueness under concurrency; the
 *    lock serializes two simultaneous creations of the same number. (The
 *    airtight fix is a partial unique index — out of scope here, no schema
 *    migration.)
 */

export interface CrmDedupData {
  matchByName?: boolean;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  niche?: string | null;
  tags?: string[];
  notes?: string | null;
  leadScore?: number | null;
  /** Tenant country for national-format parsing. Preferred source. */
  country?: string | null;
}

export interface CrmDedupOptions {
  /** Tenant country (falls back to `data.country`, then legacy BE). */
  country?: string | null;
}

// The transaction client shape this service needs (prisma itself satisfies it).
type Db = typeof prisma;

export class CrmDedupService {
  /**
   * Find existing contact by phone, email, or fuzzy name match.
   * Returns existing contact ID if found, null if no duplicate.
   */
  async findDuplicate(clientId: string, data: {
    phone?: string | null;
    email?: string | null;
    name?: string | null;
    /**
     * Chercher aussi par ressemblance de nom. Vrai par defaut, comme avant.
     *
     * Le pipeline d'appels le met a faux quand il n'a PAS de prenom et se
     * rabat sur le numero pour remplir la colonne `name`, qui est obligatoire.
     * Sans cela, deux numeros voisins (+32477012345 et +32477012346) ont une
     * distance de 1 sur 12, soit 0,083, donc sous le seuil de 0,15: deux
     * appelants differents fusionnaient en un seul contact.
     */
    matchByName?: boolean;
    /** Tenant country; legacy callers omit it and get the BE default. */
    country?: string | null;
  }): Promise<string | null> {
    const phoneNorm = data.phone ? this.normalizePhone(data.phone, data.country ?? null) : null;
    return this.findDuplicateInner(clientId, data, data.country ?? null, phoneNorm, prisma);
  }

  private async findDuplicateInner(
    clientId: string,
    data: { phone?: string | null; email?: string | null; name?: string | null; matchByName?: boolean },
    country: string | null,
    phoneNorm: string | null,
    db: Db,
  ): Promise<string | null> {
    // 1. Check by phone (E.164 normalized, country-aware)
    if (phoneNorm) {
      const byPhone = await db.contact.findFirst({
        where: { clientId, phone: phoneNorm },
        select: { id: true },
      });
      if (byPhone) {
        logger.debug(`Dedup match by phone: ${phoneNorm}`);
        return byPhone.id;
      }

      /* Legacy rows written before strict E.164 (« 0475 12 34 56 », digits
         only, « 00 » prefix…) hold the SAME person under another writing.
         Normalizing each stored number and comparing is exact — no fuzzy
         digits-suffix merge — so two genuinely different numbers never fuse. */
      const stored = await db.contact.findMany({
        where: { clientId, phone: { not: null } },
        select: { id: true, phone: true },
      });
      const legacy = stored.find(c => c.phone && normalizeLeadPhone(c.phone, country) === phoneNorm);
      if (legacy) {
        logger.debug(`Dedup match by legacy phone format: "${legacy.phone}" = ${phoneNorm}`);
        return legacy.id;
      }
    }

    // 2. Check by email
    if (data.email) {
      const normalizedEmail = data.email.toLowerCase().trim();
      const byEmail = await db.contact.findFirst({
        where: { clientId, email: normalizedEmail },
        select: { id: true },
      });
      if (byEmail) {
        logger.debug(`Dedup match by email: ${normalizedEmail}`);
        return byEmail.id;
      }
    }

    /* 3. Check by name fuzzy match — under strict conditions.
       A supplied-but-unmatched valid phone is decisive evidence of a DIFFERENT
       person: names repeat, numbers don't. And placeholder names (« Appelant
       inconnu ») carry no identity at all, in either direction. */
    const name = data.name?.trim();
    const nameIsAnonymous = !name || ANONYMOUS_NAMES.has(name.toLowerCase());
    if (name && !nameIsAnonymous && !phoneNorm && data.matchByName !== false) {
      /* Pas de filtre `name: { not: null }`: la colonne est obligatoire au
         schéma, le filtre ne retirait donc jamais rien et faisait seulement
         croire à une protection. Ce qui existe vraiment, c'est le nom VIDE,
         écrit quand l'IA n'a pas saisi de prénom. */
      const contacts = await db.contact.findMany({
        where: { clientId, name: { not: '' } },
        select: { id: true, name: true },
      });

      for (const contact of contacts) {
        if (!contact.name || ANONYMOUS_NAMES.has(contact.name.trim().toLowerCase())) continue;
        const distance = this.levenshteinRatio(
          name.toLowerCase(),
          contact.name.toLowerCase()
        );
        if (distance < 0.15) {
          logger.debug(`Dedup match by name: "${name}" = "${contact.name}" (distance: ${distance.toFixed(3)})`);
          return contact.id;
        }
      }
    }

    return null;
  }

  /**
   * Create or merge contact — never duplicates.
   *
   * The whole find-or-create runs in ONE transaction, and when a valid phone
   * is involved a PostgreSQL advisory xact lock keyed on (tenant, phone)
   * serializes concurrent creators. Without the lock, two simultaneous calls
   * both see « no duplicate » and both insert — a plain transaction does not
   * prevent that.
   */
  async createOrMerge(clientId: string, data: CrmDedupData, opts?: CrmDedupOptions): Promise<string> {
    const country = opts?.country ?? data.country ?? null;

    return prisma.$transaction(async (tx) => {
      const phoneNorm = data.phone ? this.normalizePhone(data.phone, country) : null;
      const validScore = typeof data.leadScore === 'number' && Number.isInteger(data.leadScore) && data.leadScore >= 0 && data.leadScore <= 10;
      const incomingName = data.name?.trim();
      const realName = incomingName && !ANONYMOUS_NAMES.has(incomingName.toLowerCase()) && !this.normalizePhone(incomingName, country) ? incomingName : null;
      if (phoneNorm) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${clientId}:${phoneNorm}`}))::text`;
      }

      const existingId = await this.findDuplicateInner(clientId, data, country, phoneNorm, tx as Db);

      if (existingId) {
        // Merge: update existing with new data (don't overwrite with nulls)
        const updateData: any = {};
        if (realName) updateData.name = realName;
        if (data.email) updateData.email = data.email.toLowerCase().trim();
        /* The E.164 form wins: a legacy-formatted row is upgraded on merge. */
        if (phoneNorm) updateData.phone = phoneNorm;
        if (data.niche) updateData.niche = data.niche;
        if (validScore) updateData.leadScore = data.leadScore;
        if (data.notes) {
          const existing = await tx.contact.findUnique({ where: { id: existingId }, select: { notes: true } });
          updateData.notes = [existing?.notes, data.notes].filter(Boolean).join('\n---\n');
        }
        if (data.tags && data.tags.length > 0) {
          const existing = await tx.contact.findUnique({ where: { id: existingId }, select: { tags: true } });
          updateData.tags = [...new Set([...(existing?.tags || []), ...data.tags])];
        }

        await tx.contact.update({
          where: { id: existingId, clientId },
          data: updateData,
        });

        logger.info(`Contact merged: ${existingId}`);
        return existingId;
      }

      // Create new
      const contact = await tx.contact.create({
        data: {
          clientId,
          /* `name` est obligatoire au schéma, et l'appelant peut ne rien avoir:
             l'IA ne récupère pas toujours un prénom. Sans ce repli, Prisma
             refusait la création au moment de l'appel — donc le contact était
             perdu, en silence, dans un bloc best-effort. Le numéro est un bien
             meilleur repli qu'une absence de fiche: le client reconnaît son
             appelant et corrigera le nom lui-même. */
          name: realName || phoneNorm || 'Contact inconnu',
          email: data.email ? data.email.toLowerCase().trim() : null,
          /* STRICT: an unparseable phone is stored as null, not as a junk
             string that would never dedup and would poison the legacy scan. */
          phone: phoneNorm,
          niche: data.niche,
          tags: data.tags || [],
          notes: data.notes,
          leadScore: validScore ? data.leadScore : null,
          status: 'new',
        },
      });

      logger.info(`Contact created: ${contact.id}`);
      return contact.id;
    });
  }

  /**
   * Normalize phone to E.164, strictly.
   *
   * `normalizeLeadPhone` (libphonenumber) rather than the old loose
   * `toE164`-then-strip fallback: that fallback kept unparseable junk like
   * « +abc32477… » as an identity, which then could fuzzy-collide with real
   * numbers. Junk now returns null and the caller treats it as « no phone ».
   * The country comes from the tenant; the legacy default stays BE.
   */
  private normalizePhone(phone: string, country?: string | null): string | null {
    return normalizeLeadPhone(phone, country ?? 'BE');
  }

  /**
   * Levenshtein distance ratio (0 = identical, 1 = completely different)
   */
  private levenshteinRatio(a: string, b: string): number {
    const distance = this.levenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    return maxLen === 0 ? 0 : distance / maxLen;
  }

  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }

    return dp[m][n];
  }
}

export const crmDedupService = new CrmDedupService();
