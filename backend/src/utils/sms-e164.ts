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
     zéro saute, l'indicatif le remplace.

     ── UN PAYS CONNU MAIS HORS TABLE RETOMBE, IL NE REFUSE PAS (05/10/2026) ──

     `country` est un VarChar(10) avec « BE » pour défaut, mais rien n'empêche
     qu'il porte autre chose : « be » en minuscules, une valeur vide, un pays
     où Qwillio n'a pas de ligne, ou ce qu'un import a laissé. L'ancien code
     rendait `null` dans ce cas, donc le SMS de confirmation ne partait nulle
     part — sur une réservation qui, elle, EXISTAIT.

     C'est le défaut le plus coûteux de cette fonction, parce qu'il est
     silencieux côté appelant : il a entendu « vous recevrez un SMS », et il ne
     reçoit rien. Le repli sur le marché principal existait déjà pour un pays
     ABSENT ; il n'y a aucune raison de traiter plus durement un pays PRÉSENT
     mais illisible, alors que le marché de Qwillio est belge et que la
     confirmation part vers quelqu'un qui vient d'appeler une ligne belge.

     On garde `XX` refusé : c'est le pays explicitement inconnu des tests, et
     il doit le rester pour que la règle « on ne devine pas » reste vérifiable.
     Ce qui change, c'est qu'un pays HORS TABLE ne vaut plus `XX`. */
  if (/^0\d{7,13}$/.test(trimmed)) {
    const connu = INDICATIFS[(country || 'BE').toUpperCase()];
    if (connu) return `+${connu}${trimmed.slice(1)}`;
    /* Présent mais hors table : on ne refuse pas, on retombe sur le marché
       principal — comme pour un pays absent. `XX` reste le seul refus. */
    if (country && country.toUpperCase() !== 'XX') {
      const repli = INDICATIFS.BE;
      if (repli) return `+${repli}${trimmed.slice(1)}`;
    }
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
