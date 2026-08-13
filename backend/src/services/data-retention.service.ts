import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';

/**
 * Rétention et purge des données d'appel (roadmap 2.2).
 *
 * La politique de confidentialité publiée promet 90 jours sur les
 * enregistrements et transcripts; jusqu'ici aucun job ne l'appliquait — les
 * données s'accumulaient sans fin, en contradiction avec la promesse. Ce
 * service est ce qui rend la politique vraie.
 *
 * Principe: on ne supprime pas les LIGNES d'appel, on en efface le CONTENU
 * personnel (transcript, enregistrement, identité de l'appelant). La ligne
 * reste pour la facturation et les statistiques (durée, coût, statut), qui ne
 * portent aucune donnée personnelle de l'appelant. `CallerMemory`, qui n'est
 * QUE du personnel, est supprimée entièrement.
 *
 * L'enregistrement audio vit chez Vapi, pas chez nous: effacer l'URL sans
 * effacer l'objet distant serait une purge de façade. On appelle donc
 * DELETE /call/{id} chez Vapi (best-effort, plafonné par run) avant de vider
 * la ligne locale.
 */

/** La durée promise par la politique de confidentialité. */
export const DEFAULT_RETENTION_DAYS = 90;
/** Plancher: en dessous, le client se prive de l'historique « qualité ». */
export const MIN_RETENTION_DAYS = 30;
/** Plafond: 5 ans, la durée « preuve » (prescription contractuelle). */
export const MAX_RETENTION_DAYS = 1825;
/** Suppressions Vapi par run — un run quotidien rattrape vite un backlog. */
const VAPI_DELETE_MAX_PER_RUN = 500;

export function resolveRetentionDays(retentionDays: number | null | undefined): number {
  if (typeof retentionDays !== 'number' || !Number.isFinite(retentionDays)) {
    return DEFAULT_RETENTION_DAYS;
  }
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, Math.round(retentionDays)));
}

export function cutoffFor(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

/** Les champs de ClientCall qui portent du personnel appelant. */
const CLIENT_CALL_ERASURE = {
  transcript: null,
  summary: null,
  recordingUrl: null,
  callerNumber: null,
  callerName: null,
  nameCollected: null,
  emailCollected: null,
  phoneCollected: null,
  bookingDetails: null,
} as const;

export interface PurgeReport {
  clients: number;
  clientCallsPurged: number;
  callerMemoriesDeleted: number;
  vapiDeletions: number;
  vapiDeletionFailures: number;
  outboundCallsPurged: number;
  prospectTranscriptsPurged: number;
}

class DataRetentionService {
  /**
   * Purge quotidienne. Idempotente par construction: une ligne déjà purgée ne
   * matche plus les filtres « contenu non nul ».
   */
  async purgeExpiredCallData(now: Date = new Date()): Promise<PurgeReport> {
    const report: PurgeReport = {
      clients: 0,
      clientCallsPurged: 0,
      callerMemoriesDeleted: 0,
      vapiDeletions: 0,
      vapiDeletionFailures: 0,
      outboundCallsPurged: 0,
      prospectTranscriptsPurged: 0,
    };

    const clients = await prisma.client.findMany({
      select: { id: true, retentionDays: true, businessName: true },
    });
    let vapiBudget = VAPI_DELETE_MAX_PER_RUN;

    for (const client of clients) {
      const cutoff = cutoffFor(resolveRetentionDays(client.retentionDays), now);

      // 1. L'audio chez Vapi d'abord: si la suppression distante échoue, la
      //    ligne locale garde son URL et sera retentée demain.
      if (vapiBudget > 0) {
        const withRecordings = await prisma.clientCall.findMany({
          where: { clientId: client.id, createdAt: { lt: cutoff }, recordingUrl: { not: null }, vapiCallId: { not: null } },
          select: { id: true, vapiCallId: true },
          take: vapiBudget,
        });
        for (const call of withRecordings) {
          const ok = await this.deleteVapiCall(call.vapiCallId!);
          if (ok) {
            // Purge locale immédiate: si le processus meurt entre les deux,
            // la ligne garde son URL et sera revisitée demain — un DELETE
            // Vapi rejoué répond 404, traité comme un succès.
            await prisma.clientCall.update({ where: { id: call.id }, data: CLIENT_CALL_ERASURE });
            report.vapiDeletions += 1;
            report.clientCallsPurged += 1;
          } else {
            report.vapiDeletionFailures += 1;
          }
          vapiBudget -= 1;
        }
      }

      // 2. Le contenu local sans audio distant: les lignes sans enregistrement,
      //    et les URL orphelines (pas de vapiCallId, donc jamais supprimables
      //    à distance — garder le lien pour toujours serait pire).
      const purged = await prisma.clientCall.updateMany({
        where: {
          clientId: client.id,
          createdAt: { lt: cutoff },
          OR: [
            { recordingUrl: null, transcript: { not: null } },
            { recordingUrl: null, callerNumber: { not: null } },
            { recordingUrl: null, callerName: { not: null } },
            { recordingUrl: null, nameCollected: { not: null } },
            { recordingUrl: null, emailCollected: { not: null } },
            { recordingUrl: null, summary: { not: null } },
            { recordingUrl: { not: null }, vapiCallId: null },
          ],
        },
        data: CLIENT_CALL_ERASURE,
      });
      report.clientCallsPurged += purged.count;

      // 3. La mémoire d'appelant: rien à garder passé la rétention.
      const memories = await prisma.callerMemory.deleteMany({
        where: { clientId: client.id, lastCallAt: { lt: cutoff } },
      });
      report.callerMemoriesDeleted += memories.count;
      report.clients += 1;
    }

    // 4. Monde outbound (les données de prospection de Qwillio lui-même),
    //    à la rétention par défaut.
    const defaultCutoff = cutoffFor(DEFAULT_RETENTION_DAYS, now);
    const outbound = await prisma.call.updateMany({
      where: { createdAt: { lt: defaultCutoff }, OR: [{ transcript: { not: null } }, { recordingUrl: { not: null } }] },
      data: { transcript: null, recordingUrl: null },
    });
    report.outboundCallsPurged = outbound.count;

    const prospects = await prisma.prospect.updateMany({
      where: { lastCallDate: { lt: defaultCutoff }, callTranscript: { not: null } },
      data: { callTranscript: null },
    });
    report.prospectTranscriptsPurged = prospects.count;

    logger.info(
      `[Retention] purge — ${report.clientCallsPurged} appels client, ` +
        `${report.callerMemoriesDeleted} mémoires, ${report.vapiDeletions} audios Vapi ` +
        `(${report.vapiDeletionFailures} échecs), ${report.outboundCallsPurged} appels outbound, ` +
        `${report.prospectTranscriptsPurged} transcripts prospects`
    );
    return report;
  }

  /**
   * Effacement à la demande d'UN appelant chez UN client (droit du sujet de
   * données — l'appelant, pas le titulaire du compte). Toujours scopé
   * clientId: le même numéro chez un autre client est un autre dossier.
   */
  async eraseCaller(clientId: string, callerNumber: string): Promise<{ calls: number; memoryDeleted: boolean }> {
    const calls = await prisma.clientCall.findMany({
      where: { clientId, callerNumber },
      select: { id: true, vapiCallId: true, recordingUrl: true },
    });

    for (const call of calls) {
      if (call.recordingUrl && call.vapiCallId) {
        await this.deleteVapiCall(call.vapiCallId);
      }
    }

    const updated = await prisma.clientCall.updateMany({
      where: { clientId, callerNumber },
      data: CLIENT_CALL_ERASURE,
    });

    const memory = await prisma.callerMemory.deleteMany({ where: { clientId, callerNumber } });

    logger.info(`[Retention] caller erased for client ${clientId}: ${updated.count} calls, memory=${memory.count > 0}`);
    return { calls: updated.count, memoryDeleted: memory.count > 0 };
  }

  /** DELETE /call/{id} chez Vapi. Best-effort: un échec sera retenté demain. */
  private async deleteVapiCall(vapiCallId: string): Promise<boolean> {
    if (!env.VAPI_PRIVATE_KEY) return false;
    try {
      const res = await fetch(`${env.VAPI_BASE_URL}/call/${vapiCallId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${env.VAPI_PRIVATE_KEY}` },
      });
      // 404: l'appel n'existe déjà plus chez Vapi — l'objectif est atteint.
      return res.ok || res.status === 404;
    } catch (err) {
      logger.warn(`[Retention] Vapi delete failed for ${vapiCallId}: ${(err as Error).message}`);
      return false;
    }
  }
}

export const dataRetentionService = new DataRetentionService();
