import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Le registre des consentements à l'appel sortant.
 *
 * L'opt-out livré le 13/08 (`utils/call-optout.ts`) répond à « cette personne
 * a-t-elle demandé à ne plus être appelée ? ». Depuis le 11/08/2026 la loi
 * française pose la question inverse, et bien plus exigeante: « cette personne
 * a-t-elle **positivement accepté** d'être appelée, et pouvez-vous le
 * prouver ? ». Un opt-out vide ne vaut pas un opt-in.
 *
 * Ce service ne décide pas s'il faut le consentement — c'est le rôle de
 * `outbound-legal.ts`, qui dépend du pays. Il répond seulement, pour un
 * numéro donné, s'il existe une preuve valide à cet instant.
 */

export type ConsentSource = 'web_form' | 'inbound_call' | 'contract' | 'import';

export interface RecordConsentInput {
  phone: string;
  countryCode: string;
  source: ConsentSource;
  /** Le libellé exact accepté. Refusé s'il est vide: sans lui, pas de preuve. */
  statement: string;
  ipAddress?: string | null;
  evidenceUrl?: string | null;
  expiresAt?: Date | null;
}

/**
 * Durée de conservation minimale de la preuve.
 *
 * Trois ans est la borne retenue par la roadmap. Elle est ici pour être citée
 * par la purge de rétention, qui doit épargner cette table: un consentement
 * effacé est un consentement qu'on ne peut plus produire, donc un appel qu'on
 * ne peut plus justifier.
 */
export const CONSENT_RETENTION_YEARS = 3;

class CallConsentService {
  /**
   * Existe-t-il, à `at`, un consentement valide pour ce numéro ?
   *
   * Valide veut dire: non révoqué ET non périmé. Une révocation postérieure à
   * la collecte l'emporte toujours, quelle que soit la date d'expiration.
   */
  async hasValidConsent(phone: string, at: Date = new Date()): Promise<boolean> {
    if (!phone?.trim()) return false;
    const found = await prisma.callConsent.findFirst({
      where: {
        phone: phone.trim(),
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
      },
      select: { id: true },
    });
    return !!found;
  }

  /**
   * Enregistre un consentement. Le libellé est obligatoire: accepter un
   * consentement sans savoir à quoi la personne a dit oui reviendrait à
   * fabriquer une preuve creuse.
   */
  async record(input: RecordConsentInput) {
    const phone = input.phone?.trim();
    const statement = input.statement?.trim();
    if (!phone) return { error: 'phone is required' };
    if (!statement) return { error: 'statement is required (le libellé exact accepté)' };

    const consent = await prisma.callConsent.create({
      data: {
        phone,
        countryCode: (input.countryCode || '').toUpperCase().slice(0, 10),
        source: input.source,
        statement,
        ipAddress: input.ipAddress ?? null,
        evidenceUrl: input.evidenceUrl ?? null,
        expiresAt: input.expiresAt ?? null,
      },
      select: { id: true, phone: true, collectedAt: true },
    });
    logger.info(`[Consent] consentement enregistré pour ${phone} (source: ${input.source})`);
    return consent;
  }

  /**
   * Révoque tous les consentements en cours pour un numéro.
   *
   * On ne supprime rien: la trace du retrait a la même valeur probante que
   * celle de l'accord, et c'est elle qui justifie d'avoir cessé d'appeler.
   */
  async revoke(phone: string, source: string, at: Date = new Date()) {
    const result = await prisma.callConsent.updateMany({
      where: { phone: phone.trim(), revokedAt: null },
      data: { revokedAt: at, revokedSource: source.slice(0, 50) },
    });
    if (result.count > 0) {
      logger.info(`[Consent] ${result.count} consentement(s) révoqué(s) pour ${phone} (source: ${source})`);
    }
    return { revoked: result.count };
  }

  /** L'historique complet d'un numéro, pour répondre à une mise en demeure. */
  async history(phone: string) {
    return prisma.callConsent.findMany({
      where: { phone: phone.trim() },
      orderBy: { collectedAt: 'desc' },
    });
  }
}

export const callConsentService = new CallConsentService();
