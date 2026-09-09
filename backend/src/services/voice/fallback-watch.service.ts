import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { discordService } from '../discord.service';

/**
 * Le canari des replis du modèle (TST-8).
 *
 * Quand le modèle ne répond pas, `llm-stream` parle à sa place: « pardon, je
 * vous ai mal entendu, vous pouvez répéter ? ». La phrase est bien choisie —
 * elle ne nomme aucune panne — et c'est exactement ce qui la rend dangereuse:
 * une flotte dont le modèle est mort tient une conversation entière de
 * « pouvez-vous répéter ? » sans qu'aucun voyant ne s'allume. C'est arrivé le
 * 09/09/2026: le crédit OpenAI épuisé, chaque tour en repli, et le premier à
 * l'apprendre aurait été un client.
 *
 * Ce que compte ce service, et ce qu'il ne compte pas: les replis DONT NOUS
 * SOMMES TÉMOINS, c'est-à-dire ceux que notre propre code déclenche. Les
 * bascules internes de Vapi (les `fallbackPlan` du transcripteur et de la voix)
 * ne remontent nulle part, donc les compter serait inventer un chiffre. Le
 * taux publié ici dit « sur les tours que ce processus a servis », rien de plus.
 *
 * Fenêtre en TOURS et non en minutes, volontairement: la question posée est
 * « quelle proportion des tours a échoué », et une nuit calme à deux appels ne
 * doit pas déclencher d'alerte parce que l'un des deux a raté. D'où le plancher
 * d'échantillon, qui est la moitié du garde-fou; le refroidissement est l'autre.
 */

/** Bornage mémoire: un booléen par tour, coupé par le début. */
const WINDOW_TURNS = 200;

/**
 * En dessous, aucun taux n'a de sens.
 *
 * Vingt tours, c'est à peu près deux appels: assez pour qu'un taux à 30 % soit
 * une tendance et pas un accident, assez peu pour que l'alerte parte dans les
 * minutes qui suivent une panne franche plutôt que le lendemain.
 */
const MIN_TURNS = 20;

/** Une alerte au plus par demi-heure. Une panne franche reste une panne. */
const COOLDOWN_MS = 30 * 60 * 1000;

export interface FallbackWatchSummary {
  /** Tours servis par le modèle dans la fenêtre (replis compris). */
  turns: number;
  fallbacks: number;
  /** Entre 0 et 1, ou null tant que la fenêtre est trop courte pour parler. */
  rate: number | null;
  /** La dernière cause vue, telle que le fournisseur l'a dite. */
  lastReason: string | null;
  /** Vrai depuis l'alerte et jusqu'au retour sous le seuil. */
  alerting: boolean;
  thresholdRate: number;
  minTurns: number;
}

export class FallbackWatchService {
  private window: boolean[] = [];
  private lastReason: string | null = null;
  private alerting = false;
  private lastAlertAt = 0;

  /**
   * Un tour servi. `reason` n'est renseigné que sur un repli.
   *
   * Vit dans le chemin d'un appel: aucune I/O, aucun `await`. L'envoi éventuel
   * de l'alerte est détaché, et son échec ne peut pas remonter ici.
   */
  record(fellBack: boolean, reason?: string): void {
    this.window.push(fellBack);
    if (this.window.length > WINDOW_TURNS) this.window.shift();
    if (fellBack && reason) this.lastReason = reason;

    const rate = this.rate();
    if (rate === null) return;

    if (rate >= env.VOICE_FALLBACK_ALERT_RATE) {
      this.raise(rate);
    } else if (this.alerting) {
      /* La levée compte autant que l'alerte: sans elle, personne ne sait que
         c'est fini, et la prochaine alerte se lit comme la même. */
      this.alerting = false;
      this.announce(
        `✅ Voix: les replis du modèle sont retombés à ${pct(rate)} ` +
          `(${this.window.filter(Boolean).length}/${this.window.length} tours).`,
      );
    }
  }

  /** Le taux sur la fenêtre, ou null tant qu'elle est trop courte. */
  rate(): number | null {
    if (this.window.length < MIN_TURNS) return null;
    return this.window.filter(Boolean).length / this.window.length;
  }

  private raise(rate: number): void {
    const now = Date.now();
    if (this.alerting && now - this.lastAlertAt < COOLDOWN_MS) return;
    this.alerting = true;
    this.lastAlertAt = now;

    const fallbacks = this.window.filter(Boolean).length;
    /* La cause est dans le message, parce qu'elle décide de la réparation:
       un crédit épuisé se recharge, un délai dépassé se diagnostique. */
    this.announce(
      `🔴 Voix: ${pct(rate)} des tours partent en repli ` +
        `(${fallbacks}/${this.window.length}). L'appelant entend « pouvez-vous répéter ? » ` +
        `au lieu d'une réponse.` +
        (this.lastReason ? ` Dernière cause: ${this.lastReason}` : ''),
    );
  }

  /** Journal d'abord, Discord ensuite et sans être attendu. */
  private announce(message: string): void {
    logger.error(`[FallbackWatch] ${message}`);
    void discordService
      .notifyAlerts(message)
      .catch(err => logger.warn(`[FallbackWatch] alerte non transmise: ${(err as Error).message}`));
  }

  summary(): FallbackWatchSummary {
    return {
      turns: this.window.length,
      fallbacks: this.window.filter(Boolean).length,
      rate: this.rate(),
      lastReason: this.lastReason,
      alerting: this.alerting,
      thresholdRate: env.VOICE_FALLBACK_ALERT_RATE,
      minTurns: MIN_TURNS,
    };
  }

  /** Test seam. */
  reset(): void {
    this.window = [];
    this.lastReason = null;
    this.alerting = false;
    this.lastAlertAt = 0;
  }
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}

export const fallbackWatchService = new FallbackWatchService();
