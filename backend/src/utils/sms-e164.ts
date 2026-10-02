/**
 * Le numéro tel que Twilio l'exige: E.164, avec le « + ».
 *
 * `Invalid 'To' Phone Number: 3248362XXXX [Twilio 21211]` (appel réel,
 * 12/09/2026): le numéro de l'appelant traverse `normalizeNumber`, qui ne
 * garde que les chiffres pour servir de clé d'attribution et de mémoire. Ce
 * qui est une bonne clé n'est pas un bon destinataire: Twilio refuse un
 * numéro sans « + ». La conversion se fait au SEUL endroit qui envoie, pour
 * que chaque SMS (confirmation, rappel, alerte) en profite.
 *
 * LE PAYS, ET POURQUOI IL EST LÀ. Un appelant belge dit « 0483620980 » : c'est
 * la forme nationale, et c'est le cas NORMAL. Sans pays, on rendait `null` et
 * le SMS de confirmation partait nulle part — l'appel se terminait bien, la
 * réservation existait, et l'appelant n'avait jamais sa confirmation. On ne
 * devine pas le pays d'un « 0 » de tête: on le REÇOIT. `BE` couvre le marché
 * principal, et `clientId` permet de lire le vrai pays quand il diffère.
 */
export function toE164(raw: string | null | undefined, country?: string | null): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.replace(/[\s().-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  if (/^00[1-9]\d{7,14}$/.test(trimmed)) return `+${trimmed.slice(2)}`;
  /* Des chiffres seuls, sans zéro de tête: un indicatif de pays suivi du
     numéro, tel que `normalizeNumber` le rend. */
  if (/^[1-9]\d{9,14}$/.test(trimmed)) return `+${trimmed}`;

  /* Un zéro de tête: la forme NATIONALE. On ne devine pas l'indicatif, mais on
     n'a pas à le deviner — on sait dans quel pays la ligne est appelée. Le
     zéro saute, l'indicatif le remplace. */
  if (/^0\d{7,13}$/.test(trimmed)) {
    const cc = INDICATIFS[(country || 'BE').toUpperCase()];
    if (cc) return `+${cc}${trimmed.slice(1)}`;
  }
  return null;
}

/** Les pays où Qwillio a des lignes, et leur indicatif. */
const INDICATIFS: Record<string, string> = {
  BE: '32',
  FR: '33',
  NL: '31',
  LU: '352',
  DE: '49',
  GB: '44',
  US: '1',
};
