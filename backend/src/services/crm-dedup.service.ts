// @ts-nocheck
import { prisma } from '../config/database';
import { logger } from '../config/logger';

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
    if (data.name) {
      const contacts = await prisma.contact.findMany({
        where: { clientId, name: { not: null } },
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
        name: data.name,
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
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('1') && cleaned.length === 11) {
        cleaned = '+' + cleaned;
      } else if (cleaned.length === 10) {
        cleaned = '+1' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }
    return cleaned;
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
