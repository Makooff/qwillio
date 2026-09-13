/**
 * Ce que la réceptionniste SAIT, tel que le serveur le calcule
 * (`/my-dashboard/overview`, champ `setup`, et `/my-dashboard/setup`).
 *
 * Le score est pondéré par métier, depuis le preset : la même table que le
 * formulaire et que le prompt. Il vit dans le bandeau « Démarrer avec
 * Qwillio », comme une étape, et non dans une carte à part : deux blocs qui
 * disent « il vous manque ceci » sur la même page se contredisent au premier
 * écart (retour du 13/09/2026).
 */

export interface SetupItem {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  weight: number;
  to: string;
}

export interface SetupState {
  score: number;
  done: number;
  total: number;
  missing: SetupItem[];
  openGaps: number;
  niche: string;
}

/**
 * Le seuil à partir duquel l'étape « apprendre son métier » se coche.
 * Pas 100 : « laissez vide ce qui ne vous concerne pas » est écrit sur le
 * formulaire, et un cabinet sans parking n'atteindra jamais 100. À 70,
 * pondéré, il faut le transfert, les horaires, les services et les champs
 * lourds (urgence, annulation, mutuelles) : ce sans quoi l'agent invente
 * ou se trompe de jour.
 */
export const KNOWS_ENOUGH = 70;

export const GUIDE_LINK = '/dashboard/setup/guide';
export const GAPS_LINK = '/dashboard/receptionist#connaissances';

/** « ce qu'un cabinet dentaire doit savoir » : le métier, en toutes lettres. */
export const NICHE_PHRASE: Record<string, string> = {
  restaurant: 'un restaurant',
  dental: 'un cabinet dentaire',
  medical: 'un cabinet médical',
  salon: 'un salon',
  law: 'un cabinet d’avocats',
  real_estate: 'une agence immobilière',
  auto: 'un garage',
  home_services: 'une entreprise de services',
  veterinary: 'une clinique vétérinaire',
  fitness: 'une salle de sport',
  financial: 'un cabinet de conseil',
  default: 'votre activité',
};

export function nichePhrase(niche: string | undefined): string {
  return NICHE_PHRASE[niche ?? 'default'] ?? NICHE_PHRASE.default;
}

export function knowsEnough(setup: SetupState | null | undefined): boolean {
  return !setup || setup.score >= KNOWS_ENOUGH;
}
