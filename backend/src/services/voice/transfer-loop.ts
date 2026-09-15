import { normalizeNumber } from './phone-allocation.service';

/**
 * Le numéro de transfert ne doit JAMAIS renvoyer vers l'IA.
 *
 * C'est la boucle que rien ne gardait, et elle est silencieuse:
 *
 *   1. le numéro pro du client est renvoyé vers Qwillio
 *   2. un appelant le compose, il tombe sur l'IA
 *   3. l'IA transfère vers `transferNumber`
 *   4. si ce numéro est CELUI QUI RENVOIE, l'appel repart vers l'IA
 *
 * L'appelant entend alors la réceptionniste se présenter en boucle, les minutes
 * se facturent, et personne ne décroche jamais. Le client ne le découvre pas
 * dans son tableau de bord: il le découvre parce qu'un client a raccroché.
 *
 * Ce n'est pas une limite de Qwillio, c'est le fonctionnement du renvoi d'appel
 * partout: on ne peut pas transférer vers une ligne qui vous renvoie. Il faut
 * une SECONDE ligne, un mobile personnel ou celle d'un collègue.
 *
 * Le contrôle est fait à DEUX endroits, et c'est voulu: à l'enregistrement pour
 * que le client comprenne tout de suite, et au moment de construire l'appel
 * pour les fiches réglées avant l'existence de ce garde-fou. La deuxième est la
 * seule qui protège un appelant réel.
 */

/** Les numéros d'un client qui aboutissent à l'IA. */
export interface ClientLines {
  /** La ligne attribuée par la plateforme. */
  vapiPhoneNumber?: string | null;
  /** Les numéros que le client a déclarés et renvoyés vers nous. */
  declared?: Array<{ number: string }>;
}

/**
 * Vrai si transférer vers ce numéro renverrait l'appel à l'IA.
 *
 * Compare sur les chiffres seuls: « +32 470 11 22 33 » et « 0032470112233 »
 * sont le même téléphone, et une comparaison de chaînes les croirait
 * différents, ce qui laisserait passer précisément la faute qu'on veut
 * empêcher.
 */
/**
 * Un renvoi CONDITIONNEL fait sonner le téléphone du client AVANT l'IA:
 * occupé, sans réponse, ou le « conditionnel complet » posé pour un horaire.
 * Seul le renvoi de tous les appels (`unconditional`, ou rien de déclaré, qui
 * vaut le pire cas) empêche le téléphone de sonner par construction.
 */
export function isConditionalForwarding(forwardingType: unknown): boolean {
  return forwardingType === 'busy' || forwardingType === 'no_answer' || forwardingType === 'scheduled';
}

/**
 * Vrai si transférer vers ce numéro renverrait l'appel à l'IA.
 *
 * Le renvoi CONDITIONNEL change la réponse (15/09/2026). Le client qui a choisi
 * « si pas de réponse » ou « si occupé » accepte que son téléphone sonne
 * d'abord: son propre mobile est alors une cible valide, c'est même le montage
 * à UN numéro que tout le monde demande. Le transfert sonne
 * `VOICE_TRANSFER_RING_SECONDS` (20 s) et abandonne AVANT le renvoi sur
 * non-réponse (30 s dans le code donné au client); le cas « occupé » revient
 * bien chez nous, et c'est `isOwnLine` qui le raccroche à l'arrivée.
 * Sans type déclaré, on suppose le renvoi total: le laisser passer au bénéfice
 * du doute rouvrirait la boucle en silence.
 */
export function wouldLoop(transferNumber: unknown, lines: ClientLines, forwardingType?: unknown): boolean {
  if (isConditionalForwarding(forwardingType)) return false;
  return isOwnLine(transferNumber, lines);
}

/**
 * Ce numéro est-il une ligne qui aboutit à l'IA ?
 *
 * Sert aussi au garde-fou ENTRANT: un appel dont l'appelant est notre propre
 * ligne est un transfert que le renvoi du client nous a ramené (occupé, ou un
 * délai mal réglé). Il se raccroche, il ne se décroche pas.
 */
export function isOwnLine(candidate: unknown, lines: ClientLines): boolean {
  const cible = normalizeNumber(candidate);
  if (!cible) return false;

  const versLIa = [
    normalizeNumber(lines.vapiPhoneNumber),
    ...(lines.declared ?? []).map(l => normalizeNumber(l.number)),
  ].filter(Boolean) as string[];

  /* Comparaison par SUFFIXE, après avoir retiré le zéro de préfixe national.
     Un même téléphone s'écrit « 0470112233 » chez soi et « 32470112233 » à
     l'international: le zéro national n'existe pas dans la seconde forme, donc
     une comparaison brute par suffixe échoue précisément sur le cas que le
     client produit, en tapant son numéro à la main dans deux écrans différents.
     Huit chiffres au minimum, comme le routage entrant: sans ce plancher, un
     « 4455 » saisi par erreur serait le suffixe de la moitié des numéros du
     pays et bloquerait des transferts parfaitement valides. */
  const significatif = (n: string) => n.replace(/^0+/, '');
  const c = significatif(cible);

  return versLIa.some(n => {
    const v = significatif(n);
    const [court, long] = v.length <= c.length ? [v, c] : [c, v];
    return court.length >= 8 && long.endsWith(court);
  });
}

/** Ce que le client lit quand il tente de se transférer à lui-même. */
export const LOOP_MESSAGE =
  "Ce numéro est déjà renvoyé vers votre réceptionniste : l'IA se transférerait "
  + "l'appel à elle-même, en boucle. Indiquez une autre ligne, par exemple votre "
  + "mobile personnel ou celle d'un collègue. Ou choisissez un renvoi « si pas de "
  + "réponse » : votre téléphone sonne d'abord, et ce numéro devient valide.";
