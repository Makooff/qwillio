import { logger } from '../config/logger';

/* Plafond de la démonstration publique: deux minutes par jour et par visiteur.
 *
 * Pourquoi c'est nécessaire: chaque minute de démo sort du solde Vapi, et la
 * carte d'essai est ouverte à tout le monde, sans inscription. Le rate-limit
 * par IP bornait le NOMBRE d'appels par heure, pas les MINUTES: douze appels de
 * cinq minutes faisaient déjà une heure de voix par IP et par heure. Ici on
 * borne ce qui coûte.
 *
 * Le décompte se fait à l'OCTROI, pas à la fin de l'appel. C'est délibéré:
 * - la fin d'un appel de démo n'est notifiée par aucun webhook (l'assistant est
 *   éphémère et n'appartient à aucun client), il n'y a donc rien de fiable à
 *   attendre;
 * - une durée rapportée par le navigateur serait la seule source, et elle est
 *   falsifiable dans le sens qui nous coûte de l'argent: annoncer deux secondes
 *   après en avoir consommé cent vingt.
 * Un visiteur qui raccroche au bout de dix secondes perd donc le reste de son
 * quota du jour. C'est le mauvais côté du marché, et c'est le bon choix: une
 * démonstration n'est pas un service à la minute.
 *
 * Stockage en mémoire, avec purge. Un redémarrage remet les compteurs à zéro,
 * et deux instances compteraient chacune de leur côté. Assumé: la borne existe
 * pour empêcher une dérive de coût, pas pour facturer au centime, et Render ne
 * fait tourner qu'une instance. Le jour où il y en a plusieurs, ce fichier est
 * l'endroit unique à brancher sur Redis.
 */

/** Ce que chaque visiteur peut consommer par jour, en secondes. */
export const DEMO_DAILY_SECONDS = 120;

/** Plafond d'un seul appel: il ne sert à rien de dépasser le quota du jour. */
export const DEMO_MAX_CALL_SECONDS = DEMO_DAILY_SECONDS;

interface Bucket { used: number; day: string }

const buckets = new Map<string, Bucket>();

/** La journée courante, en UTC. Une clé par jour suffit à faire la remise à zéro. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Réserve du temps pour ce visiteur, et retourne ce qui lui est accordé.
 *
 * Zéro signifie « quota épuisé pour aujourd'hui »: l'appelant doit refuser
 * l'appel plutôt que d'en accorder un de durée nulle, qui échouerait chez Vapi
 * avec un message que personne ne saurait lire.
 */
export function reserveDemoSeconds(key: string): number {
  const day = today();
  const b = buckets.get(key);
  if (!b || b.day !== day) {
    buckets.set(key, { used: DEMO_MAX_CALL_SECONDS, day });
    return DEMO_MAX_CALL_SECONDS;
  }
  const left = Math.max(0, DEMO_DAILY_SECONDS - b.used);
  if (left <= 0) return 0;
  b.used += left;
  return left;
}

/** Ce qu'il reste à ce visiteur, sans rien réserver. */
export function remainingDemoSeconds(key: string): number {
  const b = buckets.get(key);
  if (!b || b.day !== today()) return DEMO_DAILY_SECONDS;
  return Math.max(0, DEMO_DAILY_SECONDS - b.used);
}

/**
 * Purge des journées passées.
 *
 * Sans elle la table grossit d'une entrée par visiteur et par jour, pour
 * toujours: une fuite lente, du genre qui ne se voit qu'au bout de plusieurs
 * mois de trafic.
 */
const PURGE_MS = 6 * 60 * 60_000;
if (process.env.NODE_ENV !== 'test') {
  const timer = setInterval(() => {
    const day = today();
    let dropped = 0;
    for (const [k, v] of buckets) if (v.day !== day) { buckets.delete(k); dropped++; }
    if (dropped) logger.debug(`[DEMO] ${dropped} compteurs de quota purgés`);
  }, PURGE_MS);
  // Ne retient pas le process a l'arret.
  if (typeof timer.unref === 'function') timer.unref();
}

/** Réservé aux tests: repart d'une table vide. */
export function __resetDemoQuota(): void {
  buckets.clear();
}
