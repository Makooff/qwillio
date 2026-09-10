import { prisma } from '../../config/database';

/**
 * L'entonnoir de transfert D'UN CLIENT, pour son écran (REL-7).
 *
 * Les compteurs existaient déjà, mais à l'échelle de la FLOTTE, sur
 * `/api/webhooks/vapi/health` — utile à qui exploite la plateforme, inutile au
 * gérant qui demande « pourquoi l'agent ne m'a pas passé l'appel ». Cette
 * lecture-ci répond à cette question-là, et à elle seule.
 *
 * Ce que l'entonnoir NE dit pas, et pourquoi il ne le dit pas: l'étape
 * « ça a sonné ». La ligne de transfert ne porte que trois états — tenté,
 * abouti, échoué — et Vapi ne nous informe d'aucune sonnerie. Afficher un
 * palier intermédiaire demanderait de l'inventer, ce qui rendrait le reste de
 * l'écran suspect. La cause de l'échec le remplace avantageusement: « le poste
 * sonnait occupé » dit qu'il a sonné, et dit en plus quoi faire.
 */

const MAX_ROWS = 500;

export interface TransferFunnel {
  days: number;
  attempted: number;
  completed: number;
  failed: number;
  /** Tentatives dont on n'a jamais eu le dénouement. Voir plus bas. */
  pending: number;
  /** Les causes d'échec, les plus fréquentes d'abord. */
  causes: Array<{ label: string; count: number }>;
}

class TransferReportService {
  async funnel(clientId: string, days = 30): Promise<TransferFunnel> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.callTransfer.findMany({
      where: { clientId, createdAt: { gte: since } },
      select: { transferStatus: true, failedReason: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
    });

    const completed = rows.filter(r => r.transferStatus === 'completed').length;
    const failed = rows.filter(r => r.transferStatus === 'failed').length;

    const byCause = new Map<string, number>();
    for (const row of rows) {
      if (row.transferStatus !== 'failed') continue;
      /* Un échec sans cause reste COMPTÉ, sous un libellé qui le dit. Le taire
         ferait un total de causes inférieur au nombre d'échecs, et c'est
         précisément l'écart qu'un lecteur attentif remarque et n'explique
         pas. */
      const label = row.failedReason?.trim() || 'cause inconnue';
      byCause.set(label, (byCause.get(label) ?? 0) + 1);
    }

    return {
      days,
      attempted: rows.length,
      completed,
      failed,
      /* Ni abouti ni échoué: la tentative est restée ouverte. C'est presque
         toujours un dénouement qu'on n'a pas reçu, et le compter à part vaut
         mieux que de le ranger d'un côté ou de l'autre — un transfert supposé
         réussi qui ne l'était pas est exactement ce qui a fait croire que
         l'agent transférait. */
      pending: rows.length - completed - failed,
      causes: [...byCause.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
    };
  }
}

export const transferReportService = new TransferReportService();
