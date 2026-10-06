/**
 * Le forfait choisi sur la page tarifs, porté jusqu'à la caisse (A4).
 *
 * Même mécanisme que `billingPeriod.ts`: la page tarifs arrive avec
 * `?plan=solo|starter|pro|enterprise`, l'inscription et la confirmation
 * d'adresse passent entre les deux, et l'URL ne survit pas au trajet. Le choix
 * est donc capturé une fois depuis la query string et rangé dans le
 * `sessionStorage`: il survit aux étapes du tunnel (y compris au retour
 * Google OAuth dans le même onglet), pas à la fermeture de l'onglet.
 *
 * Règles du contrat:
 *   - seuls les quatre forfaits vendus sont acceptés, casse normalisée;
 *   - toute valeur inconnue est REJETÉE (`null`), jamais « dégradée » vers un
 *     forfait au hasard: c'est l'écran de souscription qui décide de son
 *     défaut (Pro), pas une URL trafiquée;
 *   - à l'usage (ouverture de la caisse), le choix est effacé comme la
 *     période, pour ne pas basculer une seconde souscription du même onglet.
 */

export type SignupPlan = 'solo' | 'starter' | 'pro' | 'enterprise';

/** Les quatre forfaits vendus, dans l'ordre d'affichage de la caisse. */
export const SIGNUP_PLANS: readonly SignupPlan[] = ['solo', 'starter', 'pro', 'enterprise'];

const KEY = 'qwillio.signupPlan';

/** Normalise une valeur entrante. Renvoie `null` sur tout ce qui n'est pas un
 *  forfait vendu — le rejet est explicite, pas un fallback silencieux. */
export function normalizeSignupPlan(value: unknown): SignupPlan | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  return (SIGNUP_PLANS as readonly string[]).includes(normalized)
    ? (normalized as SignupPlan)
    : null;
}

/** À appeler sur les écrans d'entrée du tunnel, avec `location.search`.
 *  Une valeur inconnue est ignorée: le stockage ne retient que des choix
 *  valides, donc `readSignupPlan` ne peut jamais relire une entrée corrompue
 *  écrite par cette fonction. */
export function captureSignupPlan(search: string): void {
  try {
    const plan = normalizeSignupPlan(new URLSearchParams(search).get('plan'));
    if (plan) sessionStorage.setItem(KEY, plan);
  } catch {
    /* sessionStorage indisponible: la caisse retombera sur son défaut. */
  }
}

/** Le forfait choisi, ou `null` si rien de valide n'a été capturé. */
export function readSignupPlan(): SignupPlan | null {
  try {
    return normalizeSignupPlan(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

/** Après ouverture de la caisse: le choix a servi, ne pas le laisser
 *  basculer une seconde souscription faite dans le même onglet. */
export function clearSignupPlan(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* rien à nettoyer si le stockage est refusé */
  }
}
