/**
 * Les voix Cartesia que le portail PROPOSE, par langue.
 *
 * Le catalogue public répond 69 voix « fr » (relevé le 12/09/2026 avec
 * `npm run voice:cartesia -- --lang=fr`), et le tout-venant n'est pas montrable:
 * des voix québécoises pour une clientèle belge et française, des timbres de
 * narration qui ne tiennent pas une conversation, des doublons de prénom. Le
 * propriétaire a choisi la liste ci-dessous sur cartesia.ai (onglet « French »)
 * et c'est elle, et elle seule, qui apparaît dans le sélecteur.
 *
 * Les identifiants viennent de la réponse de l'API, jamais d'un nom d'écran:
 * un nom se ressemble d'une voix à l'autre (« Pierre » et « Pierre - Baritone
 * Storyteller » existent tous les deux), un identifiant non. Deux noms de la
 * page publique n'existent pas tels quels dans l'API (« Henri », « Inès »): ce
 * sont les seules voix de ce prénom, retenues sous leur nom complet.
 *
 * Une langue ABSENTE d'ici sert le catalogue entier: c'est le cas de l'anglais
 * et du néerlandais tant que personne n'a fait le tri. Le vide, lui, n'est pas
 * un tri: une liste vide sert tout, pour qu'un oubli n'éteigne pas un écran.
 */
export interface CuratedCartesiaVoice {
  voiceId: string;
  /** Le nom tel que l'API le rend, pour la relecture; l'écran affiche celui de l'API. */
  name: string;
}

export const CARTESIA_CURATED: Partial<Record<'fr' | 'en' | 'nl', ReadonlyArray<CuratedCartesiaVoice>>> = {
  fr: [
    { voiceId: 'faa75703-00e3-4a57-9955-0703001e3231', name: 'Amélie - Decisive Agent' },
    { voiceId: '0418348a-0ca2-4e90-9986-800fb8b3bbc0', name: 'Antoine - Stern Man' },
    { voiceId: '5def377d-908b-4540-8bd7-3c968fcae351', name: 'Benoît - Methodical Moderator' },
    { voiceId: '6c64b57a-bc65-48e4-bff4-12dbe85606cd', name: 'Eloise - Dialogue Anchor' },
    { voiceId: '735287ee-ce91-4b08-8de4-63315c5ba1fb', name: 'Emmanuelle' },
    { voiceId: 'ab636c8b-9960-4fb3-bb0c-b7b655fb9745', name: 'Erwan - Everyday Speaker' },
    { voiceId: '8832a0b5-47b2-4751-bb22-6a8e2149303d', name: 'French Narrator Lady' },
    { voiceId: '5c3c89e5-535f-43ef-b14d-f8ffe148c1f0', name: 'French Narrator Man' },
    { voiceId: 'ab7c61f5-3daa-47dd-a23b-4ac0aac5f5c3', name: 'Friendly French Man' },
    { voiceId: '5deeaea9-c3cf-4288-82ec-22d8f04eb158', name: 'Gerard' },
    { voiceId: '2d693a9c-fc75-4313-aefb-c9cfaa17dd83', name: 'Gerard - Monsieur Noir' },
    { voiceId: 'd9f4af15-c402-4f50-bbda-d8823d028d6a', name: 'Henri - Express Host' },
    { voiceId: '7c58f4a4-a72c-42fa-a503-41b9408820f3', name: 'Inès - Poised Communicator' },
    { voiceId: '68db3d29-e0ab-4d4f-a5d5-e34ee47d38b7', name: 'Joris - Command Coach' },
    { voiceId: 'c9115185-0086-4cf4-bfdd-0d36425db387', name: 'Juliette' },
    { voiceId: '7345dfa5-ee04-44d2-abf4-29262b880ab4', name: 'Laurent - Dependable Anchor' },
    { voiceId: 'c96a7d7d-3457-4979-8665-522f7b3e36fb', name: 'Léa - Logical Liaison' },
    { voiceId: 'adff5dcb-249f-463f-aa89-d98d8ca05e88', name: 'Leo' },
    { voiceId: '2f8e82c4-cb94-4e6d-8b6a-29bf58ceb60a', name: 'Manon - Bright Belle' },
    { voiceId: '93c98a2b-7d15-4f7b-8236-294b1e02b1c0', name: 'Mathieu - Assured Expert' },
    { voiceId: 'cc7d2711-69af-4072-9674-df588dd85682', name: 'Maxime - Methodical Moderator' },
    { voiceId: '65b25c5d-ff07-4687-a04c-da2f43ef6fa9', name: 'Pauline - Helpful Companion' },
    { voiceId: 'bfd5390b-e4f9-4e44-95ab-9ebd223acd62', name: 'Pierre' },
    { voiceId: '0d09e991-5763-406e-b637-02bc431ef72d', name: 'Valérie - Vibrant Voice' },
    { voiceId: '80e11491-2d8a-4361-ac61-c4f3e0a4f7e7', name: 'Vincent' },
  ],
};

/**
 * Les identifiants retenus pour une langue, ou `null` quand la langue n'a pas
 * été triée (le catalogue entier est alors servi).
 */
export function curatedCartesiaIds(lang: string): Set<string> | null {
  const list = CARTESIA_CURATED[lang as 'fr' | 'en' | 'nl'];
  if (!list || list.length === 0) return null;
  return new Set(list.map(v => v.voiceId));
}
