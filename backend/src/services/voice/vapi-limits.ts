/**
 * Les bornes que l'API Vapi impose au NOM d'un assistant.
 *
 * Découvert le 09/09/2026 par `npm run voice:validate`, qui a refusé ses six
 * variantes avec « name must be shorter than or equal to 40 characters ».
 * Le script portait un nom trop long, mais ce n'est pas là que ça comptait: la
 * PRODUCTION compose le nom à partir du nom commercial du client, qui n'a
 * aucune raison d'être court.
 *
 *   « Receptionist - Boulangerie Saint-Michel Uccle » → 45 caractères
 *
 * Ce client-là n'aurait jamais eu d'assistant. Pas un assistant dégradé: un
 * 400 à la création, donc rien, et l'échec porte sur le NOM, la seule partie
 * de la charge qui n'a aucune conséquence sur le comportement de l'agent.
 *
 * Le nom est une étiquette, lue par nous dans le tableau de bord Vapi et par
 * personne d'autre. Il se coupe donc sans rien perdre d'utile, à condition de
 * couper le bon morceau: le nom de l'agent d'abord (« Sophie »), le nom de
 * l'entreprise ensuite, parce que c'est celui qui déborde et celui dont le
 * début suffit à reconnaître la fiche.
 */

/** « name must be shorter than or equal to 40 characters » (API, 09/09/2026). */
export const VAPI_ASSISTANT_NAME_MAX = 40;

/** Le caractère qui dit qu'on a coupé. Un seul point de code. */
const ELLIPSIS = '…';

/**
 * Compose « agent - entreprise » en tenant dans la limite de Vapi.
 *
 * La longueur se mesure avec `.length`, c'est-à-dire en unités UTF-16, parce
 * que c'est ce que compte le validateur en face: une entreprise dont le nom
 * porte un emoji consomme deux unités là aussi, et les deux comptes coïncident.
 */
export function fitAssistantName(agent: string, business: string, separator = ' - '): string {
  const left = agent.trim().replace(/\s+/g, ' ');
  const right = business.trim().replace(/\s+/g, ' ');

  if (!right) return truncate(left || 'Receptionist', VAPI_ASSISTANT_NAME_MAX);
  if (!left) return truncate(right, VAPI_ASSISTANT_NAME_MAX);

  const full = `${left}${separator}${right}`;
  if (full.length <= VAPI_ASSISTANT_NAME_MAX) return full;

  /* Le budget qui reste à l'entreprise une fois l'agent et le séparateur
     écrits. S'il ne reste pas de quoi écrire au moins un caractère et la
     coupure, c'est l'agent lui-même qui déborde: on tombe alors sur lui, et le
     nom de l'entreprise disparaît — un nom d'agent de 40 caractères est déjà
     une anomalie, mais elle ne doit pas coûter l'assistant. */
  const budget = VAPI_ASSISTANT_NAME_MAX - left.length - separator.length;
  if (budget < 2) return truncate(left, VAPI_ASSISTANT_NAME_MAX);

  return `${left}${separator}${truncate(right, budget)}`;
}

/**
 * Le dernier filet, posé sur le passage obligé vers l'API.
 *
 * `fitAssistantName` coupe intelligemment parce qu'elle sait quoi couler:
 * l'entreprise plutôt que l'agent. Ici on ne sait rien du nom reçu, donc on
 * coupe la fin. C'est laid et c'est le but: mieux vaut une étiquette tronquée
 * dans le tableau de bord qu'un assistant refusé, et un appelant sans agent.
 */
export function fitAssistantLabel(name: string): string {
  return truncate(name.trim(), VAPI_ASSISTANT_NAME_MAX);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  /* `trimEnd` avant l'ellipse: couper au milieu d'un mot laisse parfois une
     espace, et « Boulangerie … » se lit moins bien que « Boulangerie… ». */
  return `${value.slice(0, max - 1).trimEnd()}${ELLIPSIS}`;
}
