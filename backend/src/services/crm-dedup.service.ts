import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { toE164 } from '../utils/phone';

/**
 * CRM Contact Deduplication Service
 * Before creating any contact anywhere, check for duplicates.
 * 1. Phone (E.164 normalized)
 * 2. Email
 * 3. Name + company fuzzy match (Levenshtein < 0.15)
 */

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
     * Sans cela, deux numeros voisins (+32470123456 et +32470123457) ont une
     * distance de 1 sur 12, soit 0,083, donc sous le seuil de 0,15: deux
     * appelants differents fusionnaient en un seul contact.
     */
    matchByName?: boolean;
  }): Promise<string | null> {
    // 1. Check by phone (E.164 normalized)
    if (data.phone) {
      const normalized = this.normalizePhone(data.phone);
      const byPhone = await prisma.contact.findFirst({
        where: { clientId, phone: normalized },
        select: { id: true },
      });
      if (byPhone) {
        logger.debug(`Dedup match by phone: ${normalized}`);
        return byPhone.id;
      }
    }

    // 2. Check by email
    if (data.email) {
      const normalizedEmail = data.email.toLowerCase().trim();
      const byEmail = await prisma.contact.findFirst({
        where: { clientId, email: normalizedEmail },
        select: { id: true },
      });
      if (byEmail) {
        logger.debug(`Dedup match by email: ${normalizedEmail}`);
        return byEmail.id;
      }
    }

    // 3. Check by name fuzzy match
    if (data.name && data.matchByName !== false) {
      /* Pas de filtre `name: { not: null }`: la colonne est obligatoire au
         schéma, le filtre ne retirait donc jamais rien et faisait seulement
         croire à une protection. Ce qui existe vraiment, c'est le nom VIDE,
         écrit quand l'IA n'a pas saisi de prénom. */
      const contacts = await prisma.contact.findMany({
        where: { clientId, name: { not: '' } },
        select: { id: true, name: true },
      });

      for (const contact of contacts) {
        if (!contact.name) continue;
        const distance = this.levenshteinRatio(
          data.name.toLowerCase(),
          contact.name.toLowerCase()
        );
        if (distance < 0.15) {
          logger.debug(`Dedup match by name: "${data.name}" ≈ "${contact.name}" (distance: ${distance.toFixed(3)})`);
          return contact.id;
        }
      }
    }

    return null;
  }

  /**
   * Create or merge contact — never duplicates
   */
  async createOrMerge(clientId: string, data: {
    matchByName?: boolean;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    niche?: string | null;
    tags?: string[];
    notes?: string | null;
    leadScore?: number | null;
  }): Promise<string> {
    const existingId = await this.findDuplicate(clientId, data);

    if (existingId) {
      // Merge: update existing with new data (don't overwrite with nulls)
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.email) updateData.email = data.email.toLowerCase().trim();
      if (data.phone) updateData.phone = this.normalizePhone(data.phone);
      if (data.niche) updateData.niche = data.niche;
      if (data.leadScore) updateData.leadScore = data.leadScore;
      if (data.notes) {
        const existing = await prisma.contact.findUnique({ where: { id: existingId }, select: { notes: true } });
        updateData.notes = [existing?.notes, data.notes].filter(Boolean).join('\n---\n');
      }
      if (data.tags && data.tags.length > 0) {
        const existing = await prisma.contact.findUnique({ where: { id: existingId }, select: { tags: true } });
        updateData.tags = [...new Set([...(existing?.tags || []), ...data.tags])];
      }

      await prisma.contact.update({
        where: { id: existingId },
        data: updateData,
      });

      logger.info(`Contact merged: ${existingId}`);
      return existingId;
    }

    // Create new
    const contact = await prisma.contact.create({
      data: {
        clientId,
        /* `name` est obligatoire au schéma, et l'appelant peut ne rien avoir:
           l'IA ne récupère pas toujours un prénom. Sans ce repli, Prisma
           refusait la création au moment de l'appel — donc le contact était
           perdu, en silence, dans un bloc best-effort. Le numéro est un bien
           meilleur repli qu'une absence de fiche: le client reconnaît son
           appelant et corrigera le nom lui-même. */
        name: data.name || data.phone || 'Contact inconnu',
        email: data.email ? data.email.toLowerCase().trim() : null,
        phone: data.phone ? this.normalizePhone(data.phone) : null,
        niche: data.niche,
        tags: data.tags || [],
        notes: data.notes,
        leadScore: data.leadScore,
        status: 'new',
      },
    });

    logger.info(`Contact created: ${contact.id}`);
    return contact.id;
  }

  /**
   * Normalize phone to E.164 format
   */
  private normalizePhone(phone: string): string {
    // `toE164` plutot que la normalisation maison qui vivait ici: celle-ci
    // prefixait en +1 tout numero de dix chiffres, donc un 0470 12 34 56 belge
    // saisi a la main devenait +10470123456 et ne dedupliquait jamais contre le
    // +32470123456 que le telephone remonte. Le marche est BE/FR.
    return toE164(phone, 'BE') || toE164(phone) || phone.replace(/[\s\-().]/g, '');
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
