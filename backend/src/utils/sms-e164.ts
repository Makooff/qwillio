/**
 * Le numéro tel que Twilio l'exige: E.164, avec le « + ».
 *
 * `Invalid 'To' Phone Number: 3248362XXXX [Twilio 21211]` (appel réel,
 * 12/09/2026): le numéro de l'appelant traverse `normalizeNumber`, qui ne
 * garde que les chiffres pour servir de clé d'attribution et de mémoire. Ce
 * qui est une bonne clé n'est pas un bon destinataire: Twilio refuse un
 * numéro sans « + ». La conversion se fait au SEUL endroit qui envoie, pour
 * que chaque SMS (confirmation, rappel, alerte) en profite.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.replace(/[\s().-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  if (/^00[1-9]\d{7,14}$/.test(trimmed)) return `+${trimmed.slice(2)}`;
  /* Des chiffres seuls, sans zéro de tête: un indicatif de pays suivi du
     numéro, tel que `normalizeNumber` le rend. Un zéro de tête serait un
     numéro local dont on ne connaît pas le pays: on ne devine pas. */
  if (/^[1-9]\d{9,14}$/.test(trimmed)) return `+${trimmed}`;
  return null;
}
