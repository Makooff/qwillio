import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { discordService } from '../discord.service';

/**
 * LE CANARI DE LA PANNE EN AMONT (19/09/2026).
 *
 * ── Ce qui l'a rendu nécessaire ────────────────────────────────────────────
 *
 * Le solde Vapi est tombé à -0,06 en pleine production. Vapi a alors décroché
 * chaque appel, dit à l'appelant que la balance était vide, et raccroché. Deux
 * clients avec un renvoi actif, donc des lignes de commerce injoignables.
 *
 * Personne ne l'a su. Le propriétaire l'a découvert en appelant son propre
 * numéro, par hasard, en voulant tester autre chose. Entre la panne et cette
 * découverte, tous les appels entrants étaient perdus.
 *
 * ── Pourquoi le canari existant ne pouvait PAS le voir ─────────────────────
 *
 * `fallback-watch.service.ts` a été écrit le 09/09 pour très exactement ce
 * scénario, un cran plus bas: « le crédit OpenAI épuisé, chaque tour en repli,
 * et le premier à l'apprendre aurait été un client ». Il compte les tours que
 * NOTRE backend a servis.
 *
 * Or quand la panne est chez Vapi, notre backend n'est jamais appelé: pas un
 * tour de modèle, pas un outil, pas une ligne. Sa fenêtre reste vide, son taux
 * reste `null`, et il se tait. **Il est aveugle exactement quand la panne est
 * la plus grave**, celle qui emporte la flotte entière au lieu de dégrader les
 * réponses. Un canari qui se nourrit du trafic ne peut pas signaler l'absence
 * de trafic.
 *
 * ── Ce que celui-ci regarde, et pourquoi c'est une FORME et pas un code ────
 *
 * Un appel qui se termine sans une seule parole, ni de l'agent ni de
 * l'appelant. C'est la signature d'une panne en amont du pipeline, quelle
 * qu'en soit la cause: solde épuisé, assistant refusé (6octies), première
 * phrase qui ne part pas (6octovicies).
 *
 * On ne teste AUCUN code d'erreur de Vapi, et c'est délibéré. Les valeurs
 * d'`endedReason` ne sont pas documentées de façon fiable, et deviner celles
 * qui nomment une panne de facturation, c'est fabriquer une lecture qui a
 * l'air d'un fait (6quinvicies). L'alerte transporte donc la raison BRUTE,
 * telle que le fournisseur l'a dite: c'est elle qui décide de la réparation,
 * et c'est la seule chose que ce code ne pouvait pas connaître (6nonies).
 *
 * ── Pourquoi une SÉRIE, et pas un taux ─────────────────────────────────────
 *
 * Un appel sans parole est banal: un faux numéro, un raccroché immédiat. Sur
 * une flotte de deux clients, un taux mettrait des jours à devenir lisible, et
 * la panne dure pendant ce temps. Trois d'affilée, en revanche, ne se produit
 * pas par accident: la série se remet à zéro dès qu'un seul appel aboutit.
 * C'est ce retour à zéro qui distingue une panne d'une coïncidence.
 */

/** Une alerte au plus par demi-heure. Une panne franche reste une panne. */
const COOLDOWN_MS = 30 * 60 * 1000;

export interface DeadCallWatchSummary {
  /** Appels sans une parole, consécutifs, à cet instant. */
  streak: number;
  /** La dernière raison vue, telle que Vapi l'a dite. */
  lastReason: string | null;
  /** Vrai depuis l'alerte et jusqu'au premier appel qui aboutit. */
  alerting: boolean;
  threshold: number;
}

/**
 * Un appel n'a produit AUCUNE parole.
 *
 * La règle vit ici et pas chez l'appelant, pour qu'il n'y en ait qu'une: deux
 * définitions de « appel mort » finiraient par diverger (6vicies).
 *
 * Le transcript est le seul juge. La durée ne l'est pas: un appel de trois
 * minutes sans un mot est une panne tout aussi vraie (transcripteur muet),
 * et exiger une durée courte la laisserait passer.
 */
export function isSilentCall(transcript: string | null | undefined): boolean {
  return !String(transcript ?? '').trim();
}

export class DeadCallWatchService {
  private streak = 0;
  private lastReason: string | null = null;
  private alerting = false;
  private lastAlertAt = 0;

  /**
   * Un appel terminé. Appelé une fois par fin d'appel, sur tous les clients.
   *
   * Vit dans le webhook, donc aucune I/O et aucun `await`: l'envoi de l'alerte
   * est détaché, et son échec ne peut pas faire échouer le traitement de fin
   * d'appel, qui porte la réservation et le lead.
   */
  record(opts: { silent: boolean; reason?: string | null; clientLabel?: string | null }): void {
    if (!opts.silent) {
      /* LA LEVÉE COMPTE AUTANT QUE L'ALERTE: sans elle, personne ne sait que
         c'est fini, et la prochaine alerte se lit comme la même. Un seul appel
         qui aboutit prouve que la ligne est revenue. */
      if (this.alerting) {
        this.alerting = false;
        this.announce(
          `✅ Voix: la ligne répond de nouveau${opts.clientLabel ? ` (${opts.clientLabel})` : ''}. ` +
            `Un appel vient d'aboutir après ${this.streak} appel(s) sans un mot.`,
          'info',
        );
      }
      this.streak = 0;
      return;
    }

    this.streak += 1;
    if (opts.reason) this.lastReason = opts.reason;

    if (this.streak >= env.VOICE_DEAD_CALL_ALERT_STREAK) this.raise(opts.clientLabel ?? null);
  }

  private raise(clientLabel: string | null): void {
    const now = Date.now();
    if (this.alerting && now - this.lastAlertAt < COOLDOWN_MS) return;
    this.alerting = true;
    this.lastAlertAt = now;

    this.announce(
      `🔴 LIGNE MUETTE: ${this.streak} appels de suite se sont terminés sans une seule parole` +
        `${clientLabel ? ` (dernier client: ${clientLabel})` : ''}. ` +
        `Les appelants n'entendent PAS la réceptionniste, et un renvoi actif leur fait perdre l'appel. ` +
        /* La raison brute, jamais interprétée: c'est elle qui dit si on
           recharge un solde, si on resynchronise un assistant refusé, ou si
           c'est la première phrase qui ne part pas. */
        (this.lastReason
          ? `Raison rendue par Vapi: « ${this.lastReason} ».`
          : `Vapi n'a donné aucune raison.`) +
        ` À vérifier dans l'ordre: le solde du compte Vapi, puis \`npm run voice:audit\`.`,
      'error',
    );
  }

  /** Journal d'abord, Discord ensuite et sans être attendu. */
  private announce(message: string, level: 'error' | 'info'): void {
    logger[level](`[DeadCallWatch] ${message}`);
    void discordService
      .notifyAlerts(message)
      .catch(err => logger.warn(`[DeadCallWatch] alerte non transmise: ${(err as Error).message}`));
  }

  summary(): DeadCallWatchSummary {
    return {
      streak: this.streak,
      lastReason: this.lastReason,
      alerting: this.alerting,
      threshold: env.VOICE_DEAD_CALL_ALERT_STREAK,
    };
  }

  /** Point de reprise pour les tests. */
  reset(): void {
    this.streak = 0;
    this.lastReason = null;
    this.alerting = false;
    this.lastAlertAt = 0;
  }
}

export const deadCallWatchService = new DeadCallWatchService();
