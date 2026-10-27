/**
 * Politique de modèle partagée entre le producteur de revues (call-review),
 * le balayage (call-patterns) et l'exportateur d'observations
 * (learning-evidence). Un seul endroit, aucune copie dérivée.
 *
 * - Modèle courant : LEARNING_MODEL || CALL_REVIEW_MODEL, identifiant exact.
 *   Aucune configuration => null côté export (pas de balayage API, pas de
 *   petit modèle par défaut) ; le writer lève une erreur explicite.
 * - Famille GPT6 exigée (`^gpt-6[.-]`).
 * - Modèle servi : identité exacte du modèle demandé, ou un snapshot
 *   explicitement autorisé via CALL_REVIEW_MODEL_SNAPSHOTS (liste d'identifiants
 *   séparés par des virgules). Aucun ancien GPT6 arbitraire n'est accepté.
 */

const GPT6_FAMILY = /^gpt-6(?:[.-]|$)/i;
const MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/;

/** Modèle de revue configuré, ou null quand rien n'est configuré/valide. */
export function currentReviewModel(): string | null {
  const raw = process.env.LEARNING_MODEL || process.env.CALL_REVIEW_MODEL;
  if (!raw || raw !== raw.trim() || !MODEL_ID.test(raw)) return null;
  return raw;
}

/** Côté writer/balayage : exiger une configuration explicite. */
export function reviewModelOrThrow(): string {
  const model = currentReviewModel();
  if (!model) throw new Error('LEARNING_MODEL ou CALL_REVIEW_MODEL explicite requis');
  return model;
}

export function isGpt6Family(model: unknown): model is string {
  return typeof model === 'string' && GPT6_FAMILY.test(model);
}

/** Snapshots servis explicitement autorisés (CALL_REVIEW_MODEL_SNAPSHOTS). */
export function allowedModelSnapshots(): Set<string> {
  const raw = process.env.CALL_REVIEW_MODEL_SNAPSHOTS;
  if (typeof raw !== 'string' || !raw.trim()) return new Set();
  return new Set(raw.split(',').map(entry => entry.trim()).filter(Boolean));
}

/**
 * Le modèle réellement servi doit être l'identité exacte du modèle demandé,
 * ou figurer dans l'ensemble de snapshots explicitement configuré. Les deux
 * doivent être de la famille GPT6.
 */
export function servedModelAllowed(requestedModel: unknown, actualModel: unknown): boolean {
  if (typeof requestedModel !== 'string' || typeof actualModel !== 'string') return false;
  if (!isGpt6Family(requestedModel) || !isGpt6Family(actualModel)) return false;
  if (actualModel === requestedModel) return true;
  return allowedModelSnapshots().has(actualModel);
}
