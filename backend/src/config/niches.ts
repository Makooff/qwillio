// Le métier d'un client, résolu à UN SEUL endroit.
//
// Le dépôt portait déjà quatre tables de niches qui ne s'accordaient pas:
// `niche-scripts.ts` (prospection, `garage_auto`), `vapi-templates.ts`
// (`garage`), `ai-script-generator.service.ts` (`auto`) et les branches en
// `type.includes(...)` de `onboarding-flow.service.ts`. Ajouter une cinquième
// liste pour les présets du tableau de bord aurait garanti la divergence
// suivante: un client marqué « garage » aurait eu ses questions d'onboarding
// mais pas ses présets, sans que rien ne le signale.
//
// Ce fichier ne porte donc PAS de contenu. Il porte la seule chose que toutes
// ces tables ont en commun et se recopiaient chacune de son côté: comment lire
// un `businessType` libre et en tirer un métier. Le contenu reste là où il est
// déjà écrit, indexé par les identifiants d'ici.

export type NicheId =
  | 'restaurant'
  | 'dental'
  | 'medical'
  | 'salon'
  | 'law'
  | 'real_estate'
  | 'auto'
  | 'home_services'
  | 'veterinary'
  | 'fitness'
  | 'financial'
  | 'default';

/**
 * Les mots qui désignent un métier, dans les deux langues.
 *
 * L'ordre compte et n'est pas alphabétique: `dental` passe avant `medical`
 * parce qu'un cabinet dentaire se décrit souvent comme « medical dental », et
 * l'inverse le ferait tomber dans la mauvaise branche. C'est l'ordre qu'avait
 * la suite de `if` d'origine, conservé tel quel.
 */
const MATCHERS: { niche: NicheId; words: string[] }[] = [
  { niche: 'restaurant',    words: ['restaurant', 'café', 'cafe', 'food', 'bar', 'bistro', 'pizzeria', 'dining', 'sushi', 'grill', 'bakery', 'boulangerie', 'traiteur', 'brasserie'] },
  { niche: 'dental',        words: ['dental', 'dentist', 'orthodont', 'dentaire', 'dentiste'] },
  { niche: 'medical',       words: ['medical', 'doctor', 'clinic', 'physician', 'health', 'médical', 'medecin', 'médecin', 'clinique', 'kine', 'kiné'] },
  { niche: 'salon',         words: ['salon', 'spa', 'beauty', 'hair', 'barber', 'nail', 'coiffure', 'coiffeur', 'esthetique', 'esthétique', 'ongle', 'institut'] },
  { niche: 'law',           words: ['law', 'legal', 'attorney', 'lawyer', 'avocat', 'juridique', 'notaire', 'huissier'] },
  { niche: 'real_estate',   words: ['real estate', 'realty', 'property', 'immobilier', 'agence immo'] },
  { niche: 'auto',          words: ['auto', 'car', 'mechanic', 'garage', 'dealer', 'carrosserie', 'mecanique', 'mécanique', 'pneu'] },
  { niche: 'home_services', words: ['plumb', 'hvac', 'electric', 'contractor', 'handyman', 'cleaning', 'plomb', 'chauffage', 'electricien', 'électricien', 'toiture', 'nettoyage', 'serrurier', 'home_services'] },
  { niche: 'veterinary',    words: ['vet', 'animal', 'pet', 'veterinaire', 'vétérinaire'] },
  { niche: 'fitness',       words: ['gym', 'fitness', 'yoga', 'pilates', 'crossfit', 'martial', 'boxing', 'training', 'salle de sport', 'coach sportif'] },
  { niche: 'financial',     words: ['account', 'cpa', 'tax', 'bookkeep', 'financial', 'wealth', 'insurance', 'comptab', 'fiscal', 'assurance', 'courtier'] },
];

/**
 * Le métier d'un `businessType` libre, ou `default` si rien ne correspond.
 *
 * `default` est une valeur de plein droit et non un échec: la plupart des
 * clients ne rentrent dans aucune case, et ils ont droit au même formulaire
 * que les autres, en plus générique.
 */
export function resolveNiche(businessType: string | null | undefined): NicheId {
  const type = (businessType || '').toLowerCase();
  if (!type) return 'default';
  for (const { niche, words } of MATCHERS) {
    if (words.some(w => type.includes(w))) return niche;
  }
  return 'default';
}
