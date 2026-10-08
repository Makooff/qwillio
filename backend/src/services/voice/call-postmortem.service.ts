/**
 * Le passage qui NOTE chaque appel, et remonte les défauts réparables.
 *
 * Pourquoi un balayage, et pas un branchement dans la fin d'appel :
 *
 * 1. La fin d'appel est sur le chemin chaud. `voice-webhook.controller` a un
 *    commentaire entier sur ce qui a le droit d'y être attendu ; y ajouter un
 *    jugement, même rapide, c'est ajouter une raison de perdre la
 *    transcription, l'analyse, la mémoire et la facturation de l'appel.
 * 2. Il y a DEUX chemins d'écriture — le webhook Vapi et `POST
 *    /api/voice-core/calls` — et ils ne partagent pas les mêmes métriques : les
 *    métriques temps réel du chemin Vapi sont écrites APRÈS la fiche
 *    (`persistMetrics`), donc un jugement posé à la fin de `finalize` ne
 *    verrait rien du chemin voice-core, qui n'écrit pas `metadata.realtime`.
 * 3. Un jugement idempotent qui lit la LIGNE terminée couvre les deux chemins,
 *    survit à un redéploiement et se rejoue. C'est la seule forme qui ne
 *    dépend pas de l'ordre des écritures.
 *
 * Le verdict est rangé dans `metadata.mortem` — donc AUCUNE migration, et le
 * portail peut le lire sans route nouvelle. La forme « je note une fois »
 * tient à un seul test : `metadata.mortem` déjà posé = on ne rejuge pas. Sans
 * lui, chaque passage rejouerait la même alerte et l'alerte perdrait sa valeur.
 */

import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';
import { logger } from '../../config/logger';
import { proposeFix } from '../../config/autofix-store';
import { discordService } from '../discord.service';
import { postMortemOf, type CallPostMortem, type CallSignals } from './call-postmortem';

/**
 * Trois heures, et pas vingt-quatre.
 *
 * Un appel raté doit être réparé le jour où il a eu lieu. La borne existe pour
 * qu'un premier passage sur une base ancienne ne propose pas cent correctifs
 * d'un coup au démarrage ; elle n'est pas là pour rattraper du retard.
 */
const LOOKBACK_MINUTES = 180;

/** Borne de lecture, comme partout ailleurs dans ce dossier. */
const MAX_CALLS = 200;

/** Ce qu'un passage a fait, pour la ligne de journal et les tests. */
export interface MortemSweep {
  examined: number;
  ok: number;
  watch: number;
  broken: number;
  proposed: number;
}

class CallPostmortemService {
  async run(): Promise<MortemSweep> {
    const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);

    const rows = await prisma.clientCall.findMany({
      where: { status: 'completed', isSpam: false, endedAt: { gte: since } },
      orderBy: { endedAt: 'desc' },
      take: MAX_CALLS,
      select: {
        id: true,
        clientId: true,
        vapiCallId: true,
        transcript: true,
        outcome: true,
        callerName: true,
        isLead: true,
        bookingRequested: true,
        durationSeconds: true,
        metadata: true,
      },
    });

    const sweep: MortemSweep = { examined: 0, ok: 0, watch: 0, broken: 0, proposed: 0 };

    for (const row of rows) {
      const metadata = (row.metadata as Record<string, any> | null) ?? null;
      /* Déjà jugé : on ne rejuge pas. C'est la seule chose qui empêche un
         correctif proposé toutes les cinq minutes pour le même appel. */
      if (metadata?.mortem) continue;

      let mortem: CallPostMortem;
      try {
        mortem = postMortemOf(row as CallSignals);
      } catch (error) {
        logger.warn(`[CallPostmortem] verdict impossible pour ${row.id}: ${(error as Error).message}`);
        continue;
      }

      sweep.examined += 1;
      if (mortem.verdict === 'broken') sweep.broken += 1;
      else if (mortem.verdict === 'watch') sweep.watch += 1;
      else sweep.ok += 1;

      await this.persist(row.id, metadata, mortem).catch(error =>
        logger.warn(`[CallPostmortem] verdict non rangé pour ${row.id}: ${(error as Error).message}`),
      );

      if (mortem.verdict === 'broken' && mortem.needsDeveloper) {
        if (await this.escalate(row, mortem)) sweep.proposed += 1;
      }
    }

    if (sweep.broken) {
      logger.warn(
        `[CallPostmortem] ${sweep.examined} appel(s) jugé(s): ${sweep.ok} ok, ` +
          `${sweep.watch} à surveiller, ${sweep.broken} cassé(s), ${sweep.proposed} correctif(s) proposé(s)`,
      );
    }

    return sweep;
  }

  /**
   * Le verdict est écrit EN FUSION, jamais en écrasement.
   *
   * `POST /api/voice-core/calls` réécrit `metadata` entier à la fin de chaque
   * appel voice-core. Un écrivain qui pose `metadata: { mortem }` sans lire
   * l'existant effacerait `latency`, `brain` et `source` du même appel.
   */
  private async persist(
    id: string,
    metadata: Record<string, any> | null,
    mortem: CallPostMortem,
  ): Promise<void> {
    await prisma.clientCall.update({
      where: { id },
      data: { metadata: { ...(metadata ?? {}), mortem } as unknown as Prisma.InputJsonObject },
    });
  }

  /**
   * Un défaut réparable devient une PROPOSITION, pas une réparation.
   *
   * Le chemin est celui qui existe déjà pour les erreurs d'infrastructure :
   * `autofix-store` déduplique par empreinte, Discord porte les liens
   * approuver / rejeter, et un agent local vient chercher ce qui est approuvé.
   * Le réutiliser plutôt qu'en écrire un second fait qu'il n'y a qu'un endroit
   * où l'on décide ce qui a le droit de toucher au code, et un seul endroit
   * où l'on regarde ce qui attend.
   *
   * L'EMPREINTE est par client ET par jeu de codes, jamais par appel : la même
   * panne d'agenda qui touche dix appels du même client est UN problème, et
   * dix propositions pour la même chose se lisent comme du bruit.
   */
  private async escalate(
    row: { id: string; clientId: string; vapiCallId: string | null; outcome: string | null },
    mortem: CallPostMortem,
  ): Promise<boolean> {
    const codes = [...mortem.codes].sort();
    const fingerprint = `call:${row.clientId}:${codes.join('+')}`;

    const clinic = await prisma.client
      .findUnique({ where: { id: row.clientId }, select: { businessName: true } })
      .catch(() => null);

    const fix = proposeFix({
      errorFingerprint: fingerprint,
      errorMessage: mortem.evidence.join(' ; ') || codes.join(', '),
      riskLevel: 'medium',
      title: `Appel ${row.vapiCallId ?? row.id}: ${codes.join(', ')}`,
      reasoning: [
        `Client: ${clinic?.businessName ?? row.clientId}`,
        `Appel: ${row.vapiCallId ?? row.id} (issue « ${row.outcome ?? 'inconnue'} »)`,
        '',
        'Ce qui a été mesuré:',
        ...mortem.evidence.map(e => `- ${e}`),
        '',
        'Le transcript de l\'appel est en base (`ClientCall.transcript`) et le détail des ' +
          'métriques dans `ClientCall.metadata`. Reproduire l\'appel contre ce transcript ' +
          'AVANT de corriger : c\'est la méthode qui a payé sur l\'épellation.',
      ].join('\n'),
    });

    /* `proposeFix` rend la proposition EXISTANTE quand l'empreinte est déjà
       en attente. On ne repropose donc pas, et on ne notifie pas deux fois. */
    const isNew = fix.createdAt.getTime() === fix.updatedAt.getTime();

    if (isNew) {
      await discordService
        .notify(
          `🩺 APPEL CASSÉ — ${clinic?.businessName ?? row.clientId}\n` +
            `${mortem.evidence.map(e => `• ${e}`).join('\n')}\n\n` +
            `Proposition ${fix.id} déposée pour relecture (approuver / rejeter dans le salon).`,
          'alerts',
        )
        .catch(error => logger.warn(`[CallPostmortem] alerte non envoyée: ${(error as Error).message}`));
    }

    return isNew;
  }
}

export const callPostmortemService = new CallPostmortemService();
