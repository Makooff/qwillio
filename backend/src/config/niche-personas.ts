// Le métier d'un client, traduit en ton de voix par défaut.
//
// Un réceptionniste doit sonner juste pour le métier qu'il accueille: un
// cabinet dentaire veut une voix douce et posée, un restaurant une voix
// chaleureuse, un cabinet d'avocat une voix professionnelle. Le client peut
// changer de personnage (donc de voix) ensuite, mais ce qu'il reçoit par
// défaut doit déjà être le bon timbre, sinon il n'entend jamais la promesse.
//
// Indexé sur `NicheId` (voir `niches.ts`), pas sur une nouvelle liste de
// métiers: une liste de plus aurait divergé de celles qui existent déjà.
// Chaque `PersonaKey` (voir `personalities.ts`) est un ton déjà écrit dans le
// prompt, donc la chaîne niche → persona → personnage → voix ne crée aucun
// nouveau concept, elle réutilise ce qui existe.

import type { NicheId } from './niches';
import type { PersonaKey } from './personalities';
import { listCharacters } from './voice-characters';

/**
 * Le ton de voix qu'un métier attend.
 *
 * Trois métiers partagent `caring` (dentaire, médical, vétérinaire) et trois
 * partagent `professional` (juridique, immobilier, financier): c'est voulu, ce
 * sont les mêmes familles d'accueil. Le partage ne coûte rien ici — la VOIX
 * reste distincte d'un personnage à l'autre, c'est le TON du prompt qui se
 * partage.
 */
export const NICHE_PERSONA: Record<NicheId, PersonaKey> = {
  restaurant: 'warm',
  dental: 'caring',
  medical: 'caring',
  salon: 'luxury',
  law: 'professional',
  real_estate: 'professional',
  auto: 'casual',
  home_services: 'casual',
  veterinary: 'caring',
  fitness: 'energetic',
  financial: 'professional',
  default: 'warm',
};

/**
 * Le personnage par défaut d'un métier, ou `null` si le catalogue n'en a pas.
 *
 * Choisit le premier personnage dont le ton correspond au métier, en préférant
 * le genre demandé quand il est fourni (un salon de coiffure féminin, un
 * garage plutôt masculin). Le client peut toujours en choisir un autre: ceci
 * n'est que la valeur de départ.
 *
 * Pur: aucune E/S, vérifiable directement.
 */
export function defaultCharacterForNiche(
  niche: NicheId,
  preferGender?: 'f' | 'm',
): string | null {
  const persona = NICHE_PERSONA[niche];
  const characters = listCharacters();

  const exact = characters.find(
    c => c.personaKey === persona && (!preferGender || c.gender === preferGender),
  );
  const any = characters.find(c => c.personaKey === persona);
  return (exact ?? any)?.id ?? null;
}
