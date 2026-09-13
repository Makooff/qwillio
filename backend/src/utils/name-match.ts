/**
 * Un nom ENTENDU contre un nom ÉCRIT.
 *
 * Appel réel du 13/09/2026: la réservation était au nom de « Jean-Luc de la
 * forge », et l'appelant a été transcrit « de la Ford », « Delaforde », « de la
 * foireux », « de la foire » avant que le transcripteur ne rende « de la
 * forge ». Une recherche `contains` sur la chaîne ne retrouvait donc rien, et
 * l'agent a fait répéter cinq fois pour finir sur « aucun rendez-vous ». Le
 * nom d'un appelant n'est jamais exact au téléphone; il est PROCHE.
 */
function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Lettres seules, minuscules, sans accent: la forme sous laquelle on compare. */
export function normaliseName(raw: string): string {
  return stripDiacritics(String(raw ?? '')).toLowerCase().replace(/[^a-z]/g, '');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * 0 (rien à voir) à 1 (identique). Deux lectures, la meilleure gagne: la
 * chaîne entière, et le NOM DE FAMILLE seul (dernier mot), parce que c'est lui
 * que le transcripteur abîme et que le prénom, lui, est presque toujours juste.
 */
export function nameSimilarity(heard: string, written: string): number {
  const a = normaliseName(heard);
  const b = normaliseName(written);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const whole = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  const lastOf = (s: string) => normaliseName(String(s).trim().split(/\s+/).pop() ?? '');
  const la = lastOf(heard);
  const lb = lastOf(written);
  const last = la && lb && la.length >= 3 && lb.length >= 3 ? 1 - levenshtein(la, lb) / Math.max(la.length, lb.length) : 0;
  return Math.max(whole, last);
}

/** Le seuil: « de la foireux » pour « de la forge » passe, « Van Devel » non. */
export const NAME_MATCH_THRESHOLD = 0.6;

export function namesMatch(heard: string, written: string): boolean {
  return nameSimilarity(heard, written) >= NAME_MATCH_THRESHOLD;
}
