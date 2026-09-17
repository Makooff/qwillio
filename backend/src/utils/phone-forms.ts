/**
 * Les écritures sous lesquelles un même numéro peut être STOCKÉ.
 *
 * `normalizeNumber` ne garde que les chiffres pour servir de CLÉ (attribution,
 * mémoire d'appelant), mais tout ce qui vient d'ailleurs — Vapi, Twilio, un
 * formulaire du portail — arrive en E.164 avec le « + », ou tel que tapé. Une
 * comparaison d'égalité rate donc le même numéro une fois sur deux, en
 * silence: la requête réussit et ne trouve rien.
 *
 * Écrit ici et non près d'un appelant: le filtre `?phone=` du portail et la
 * recherche de réservation de l'agent doivent trouver les MÊMES lignes, et
 * deux règles écrites à la main pour la même question divergent en moins d'un
 * mois (6vicies).
 */
export function phoneForms(raw: string): string[] {
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return [raw];
  return Array.from(new Set([digits, `+${digits}`, raw.trim()]));
}
