// Receptionist character catalog — single source of truth.
//
// A "character" bundles a name, a face, an ElevenLabs voice and a personality
// tone. Clients pick one for their inbound receptionist; provisioning
// (onboarding.service) reads the selected character's voiceId + tuning + persona.
//
// Characters are NOT tied to a language. The ElevenLabs models in use
// (turbo_v2_5, multilingual_v2) speak both French and English from one voice id,
// so the same Marie answers a French caller in French and an English one in
// English — the language comes from the client, not from the character. The
// `accent` field only says which accent the voice carries when it speaks.
//
// Voice IDs are defaults, and defaults are the weak point here: a voice id is an
// opaque string, and one of them (Lucas) turned out to be a woman's voice and
// shipped that way for weeks. Nothing in the code could catch it — only
// listening did. Each is overridable via `VAPI_VOICE_ID_<ID>` without a deploy,
// and the dashboard voice picker exists so a human ear assigns them.

import { env } from './env';
import type { PersonaKey } from './personalities';

export interface Character {
  id: string;
  name: string;
  /** Accent the voice carries. Not a restriction on who may pick it. */
  accent: 'FR' | 'BE' | 'US';
  gender: 'f' | 'm';
  voiceId: string;
  /**
   * La voix anglaise native du personnage, quand le site est en anglais.
   *
   * Absente, le personnage garde sa voix `voiceId` (multilingue) en anglais.
   * Toujours un identifiant Cartesia: les voix anglaises natives servies ici
   * viennent du catalogue Cartesia, pas d'ElevenLabs. Voir `voiceForLanguage`.
   */
  voiceIdEn?: string;
  model: string;
  stability: number;
  similarityBoost: number;
  style: number;
  /** Posé quand la voix vient d'un autre catalogue. Voir `CustomVoice.provider`. */
  voiceProvider?: 'cartesia';
  /** Posé pour un VRAI clone, pas pour toute voix choisie. Voir `useCartesia`. */
  voiceCloned?: boolean;
  personaKey: PersonaKey;
  /** Served under /characters/<id>.webp, 512px. */
  avatar: string;
  taglineFr: string;
  taglineEn: string;
  previewFr: string;
  previewEn: string;
}

const MODEL = 'eleven_turbo_v2_5';

/**
 * Voices assigned at runtime from ElevenLabs' own library, gender-checked
 * against each character.
 *
 * The hardcoded ids below were pasted in by hand and never verified: one of the
 * men spoke with a woman's voice for weeks, two of the women turned out to be
 * men, and five of the characters shared a single voice. A voice id is an
 * opaque string, so nothing in the code could ever have caught that — the only
 * fix is to stop writing them down and start reading them from the API, which
 * publishes each voice's gender and language.
 *
 * Filled by french-voices.service at boot. The hardcoded values stay as the
 * fallback for the moments before that lands, and for a server with no key.
 */
let assigned: Record<string, string> = {};

/**
 * ── DEUX TABLES, PAS UNE ────────────────────────────────────────────────────
 *
 * `assigned` porte les identifiants ElevenLabs — c'est ce qu'y écrit
 * `french-voices.service`, et ce que lisent les seize champs de personnage.
 *
 * `cartesiaAssigned` porte les identifiants Cartesia. Il existe SÉPARÉMENT
 * parce que les deux fournisseurs ne désignent pas la même chose : un
 * identifiant Cartesia ne vaut RIEN chez ElevenLabs et réciproquement. Les
 * mélanger dans une seule table, c'est devoir deviner l'origine de chaque
 * valeur — et une devinette ratée envoie une voix à un service qui ne la
 * connaît pas, qui répond alors par sa voix par défaut.
 *
 * C'est exactement ce qui s'est produit : les personnages recevaient un
 * identifiant Cartesia, `buildVoice` le croyait ElevenLabs, le cherchait dans
 * une table de traduction où il n'existait pas, et servait une voix unique à
 * tout le monde.
 */
let cartesiaAssigned: Record<string, string> = {};

export function applyAssignedVoices(map: Record<string, string>): void {
  assigned = { ...map };
}

/**
 * Range les voix Cartesia assignées, et les fait porter à la fiche des
 * personnages — identifiant ET provenance, indissociablement.
 *
 * Les deux sont posés dans la même fonction à dessein : les séparer est
 * précisément l'erreur qu'on répare, et rien ne doit plus pouvoir écrire l'un
 * sans l'autre.
 */
export function applyCartesiaVoices(map: Record<string, string>): void {
  /* On ne touche PAS aux fiches de `CHARACTERS` : `listCharacters` rend le
     résultat de `resolveCharacter`, qui fabrique un objet neuf à chaque appel.
     Écrire dans `CHARACTERS` reviendrait à écrire dans un brouillon que
     personne ne relit — la valeur serait posée, et l'appel n'en saurait rien.
     L'identifiant est donc lu à la résolution, comme la provenance. */
  cartesiaAssigned = { ...map };
}

export function getCartesiaVoices(): Record<string, string> {
  return { ...cartesiaAssigned };
}

export function getAssignedVoices(): Record<string, string> {
  return { ...assigned };
}

/**
 * Precedence: an explicit env override, then the assignment, then the
 * hardcoded default. The env var stays first so one voice can be pinned by
 * hand without disabling the rest.
 */
function voice(id: string, fallback: string): string {
  /* Les DEUX tables sont lues, la Cartesia d'abord : c'est elle qui sert
     réellement les appels depuis que le TTS est passé chez Cartesia, et un
     identifiant assigné par le portail doit battre une valeur par défaut.
     Le fallback vient ENSUITE, avant l'ancienne table ElevenLabs (`assigned`) :
     le fallback est désormais une voix Cartesia (`FR.<id>`), et il doit battre
     le vestige ElevenLabs d'avant le passage à Cartesia. */
  return process.env[`VAPI_VOICE_ID_${id.toUpperCase()}`]
    || cartesiaAssigned[id]
    || fallback
    || assigned[id];
}

/**
 * D'OÙ VIENT LA VOIX ASSIGNÉE, et pourquoi il fallait le dire.
 *
 * `voiceCartesia` et `voiceEleven` portent les deux tables parallèles. Tant
 * qu'une seule existait, la provenance se déduisait du réglage global ; depuis
 * que les deux cohabitent, elle ne se déduit plus du tout.
 *
 * L'oubli a coûté cher et s'est vu à l'oreille : les personnages du site
 * recevaient bien un identifiant Cartesia de `voice()`, mais le personnage
 * gardait `voiceProvider` vide. `buildVoice` le renvoyait donc traduire par
 * `cartesiaVoiceFor` — une table qui convertit de l'ELEVENLABS, où un
 * identifiant Cartesia ne peut rien trouver — et tout le monde retombait sur
 * `CARTESIA_DEFAULT_VOICE_ID`. Une seule voix, masculine, pour dix
 * personnages dont cinq femmes. Le catalogue était juste ; c'est l'étiquette
 * qui manquait.
 *
 * `voice()` continue de rendre l'identifiant seul : c'est ce qu'attendent les
 * seize champs qui l'appellent. La provenance est rendue à part, pour que
 * seuls les endroits qui en ont besoin la lisent. Elle compare l'identifiant
 * RÉSOLU (passé par le Proxy) aux catalogues Cartesia, plutôt que de deviner
 * d'après les clés : un `VAPI_VOICE_ID_FR` ElevenLabs sur Marie doit garder
 * l'étiquette ElevenLabs, même si la fiche porte une voix Cartesia par défaut.
 */
function voiceProviderOf(id: string, voiceId: string): 'cartesia' | undefined {
  /* Une épingle d'environnement est un identifiant ElevenLabs : elle passe
     avant l'assignation, donc elle décide aussi de la provenance. */
  if (process.env[`VAPI_VOICE_ID_${id.toUpperCase()}`]) return undefined;
  if (voiceId && (voiceId === cartesiaAssigned[id]
    || voiceId === FR[id as keyof typeof FR]
    || voiceId === EN[id as keyof typeof EN])) {
    return 'cartesia';
  }
  return undefined;
}

/**
 * La voix anglaise native d'un personnage, ou chaîne vide quand il n'en a pas.
 *
 * Une épingle d'environnement (`VAPI_VOICE_ID_EN_<ID>`) l'emporte, puis le
 * défaut du catalogue. Toujours Cartesia: la provenance n'est pas devinée ici,
 * elle est posée par `voiceForLanguage`. Vide = pas de voix anglaise dédiée, le
 * personnage garde sa voix multilingue.
 */
function voiceEn(id: string): string {
  return process.env[`VAPI_VOICE_ID_EN_${id.toUpperCase()}`] || EN[id as keyof typeof EN] || '';
}

/**
 * Les voix anglaises NATIVES par personnage, servies quand le site est en
 * anglais (le drapeau). Identifiants Cartesia, tirés de la documentation
 * publique de Cartesia (voix « voice agents » recommandées) et du catalogue
 * partenaire.
 *
 * Ce sont des DÉFAUTS, pas des choix définitifs: comme pour les voix
 * françaises, une voix se choisit à l'oreille, et chaque personnage peut être
 * épinglé par `VAPI_VOICE_ID_EN_<ID>`. La provenance est toujours Cartesia,
 * posée par `voiceForLanguage`, jamais devinée ici.
 */
const EN = {
  // Femmes — chaleur, luxe, énergie, décontraction, douceur.
  marie:   'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', // Skylar, en-US, naturelle et chaleureuse
  camille: '62ae83ad-4f6a-430b-af41-a9bede9286ca', // Gemma, en-GB, raffinée
  lea:     'f786b574-daa5-4673-aa0c-cbe3e8534c02', // Katie, en-US, dynamique
  sofia:   '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', // Jacqueline, en-US, conversationnelle
  nour:    '00a77add-48d5-4ef6-8157-71e5437b282d', // Calm Lady, douce et posée
  // Hommes — professionnel, chaleur, décontraction, énergie, distinction.
  lucas:   'a167e0f3-df7e-4d52-a9c3-f949145efdab', // Customer Support Man, posé et direct
  adrien:  'ef191366-f52f-447a-a398-ed8c0f2943a1', // Archie, en-GB, chaleureux
  hugo:    'a5136bf9-224c-4d76-b823-52bd5efcffcc', // Jameson, en-US, naturel
  theo:    '47c38ca4-5f35-497b-b1a3-415245fb35e1', // Daniel, en-US, énergique
  julien:  'd46abd1d-2d02-43e8-819f-51fb652c1c61', // Newsman, distingué
} as const;

/**
 * Les voix FRANÇAISES par personnage, une distincte pour chacun.
 *
 * Toutes sortent de la liste que le propriétaire a triée sur cartesia.ai
 * (`cartesia-curated.ts`), jamais d'un nom d'écran : chaque identifiant est
 * celui de l'API. Le timbre est assorti à la personnalité du personnage
 * (chaleureux, raffiné, énergique, doux, posé…), pas attribué dans l'ordre du
 * catalogue. Ce sont des DÉFAUTS auditionnables : `VAPI_VOICE_ID_<ID>`
 * l'emporte, et l'assignation Cartesia en base (`cartesiaAssigned`) aussi.
 *
 * Pourquoi Cartesia et plus ElevenLabs : le TTS est passé chez Cartesia, et
 * l'ancien fallback ElevenLabs faisait parler cinq hommes avec un seul timbre.
 */
const FR = {
  // Femmes — chaleur, luxe, énergie, décontraction, douceur.
  marie:   '65b25c5d-ff07-4687-a04c-da2f43ef6fa9', // Pauline - Helpful Companion, serviable
  camille: '8832a0b5-47b2-4751-bb22-6a8e2149303d', // French Narrator Lady, raffinée
  lea:     '0d09e991-5763-406e-b637-02bc431ef72d', // Valérie - Vibrant Voice, énergique
  sofia:   '2f8e82c4-cb94-4e6d-8b6a-29bf58ceb60a', // Manon - Bright Belle, vive et naturelle
  nour:    '6c64b57a-bc65-48e4-bff4-12dbe85606cd', // Eloise - Dialogue Anchor, douce et posée
  // Hommes — professionnel, chaleur, décontraction, énergie, distinction.
  lucas:   '7345dfa5-ee04-44d2-abf4-29262b880ab4', // Laurent - Dependable Anchor, posé
  adrien:  'ab7c61f5-3daa-47dd-a23b-4ac0aac5f5c3', // Friendly French Man, chaleureux
  hugo:    'ab636c8b-9960-4fb3-bb0c-b7b655fb9745', // Erwan - Everyday Speaker, décontracté
  theo:    'd9f4af15-c402-4f50-bbda-d8823d028d6a', // Henri - Express Host, énergique
  julien:  '0418348a-0ca2-4e90-9986-800fb8b3bbc0', // Antoine - Stern Man, distingué
} as const;

const BASE_CHARACTERS: Record<string, Character> = {
  marie: {
    id: 'marie',
    name: 'Marie',
    accent: 'FR',
    gender: 'f',
    voiceId: voice('marie', env.VAPI_VOICE_ID_FR || FR.marie),
    model: MODEL,
    stability: 0.38,
    similarityBoost: 0.78,
    style: 0.45,
    personaKey: 'warm',
    avatar: '/characters/marie.webp',
    taglineFr: 'Chaleureuse et accueillante, sourire dans la voix.',
    taglineEn: 'Warm and welcoming, a smile in her voice.',
    previewFr: 'Bonjour, merci d’appeler ! Comment puis-je vous aider aujourd’hui ?',
    previewEn: 'Hello, thanks for calling! How can I help you today?',
  },
  camille: {
    id: 'camille',
    name: 'Camille',
    accent: 'FR',
    gender: 'f',
    voiceId: voice('camille', FR.camille),
    model: MODEL,
    stability: 0.5,
    similarityBoost: 0.8,
    style: 0.3,
    personaKey: 'luxury',
    avatar: '/characters/camille.webp',
    taglineFr: 'Soignée et raffinée, pour une image premium.',
    taglineEn: 'Polished and refined, for a premium brand.',
    previewFr: 'Bonjour et bienvenue. Je vous écoute, en quoi puis-je vous être utile ?',
    previewEn: 'Good day and welcome. I’m listening — how may I assist you?',
  },
  lea: {
    id: 'lea',
    name: 'Léa',
    accent: 'FR',
    gender: 'f',
    voiceId: voice('lea', FR.lea),
    model: MODEL,
    stability: 0.3,
    similarityBoost: 0.75,
    style: 0.6,
    personaKey: 'energetic',
    avatar: '/characters/lea.webp',
    taglineFr: 'Dynamique et enthousiaste, pleine d’énergie.',
    taglineEn: 'Dynamic and upbeat, full of energy.',
    previewFr: 'Salut ! Super de vous avoir au téléphone, dites-moi tout !',
    previewEn: 'Hi there! Great to have you on the line, tell me everything!',
  },
  sofia: {
    id: 'sofia',
    name: 'Sofia',
    accent: 'FR',
    gender: 'f',
    voiceId: voice('sofia', FR.sofia),
    model: MODEL,
    stability: 0.4,
    similarityBoost: 0.78,
    style: 0.5,
    personaKey: 'casual',
    avatar: '/characters/sofia.webp',
    taglineFr: 'Naturelle et décontractée, ton conversationnel.',
    taglineEn: 'Natural and easy-going, conversational tone.',
    previewFr: 'Bonjour, ravie de vous entendre. Comment puis-je vous aider ?',
    previewEn: 'Hi, lovely to hear from you. How can I help?',
  },
  nour: {
    id: 'nour',
    name: 'Nour',
    accent: 'FR',
    gender: 'f',
    voiceId: voice('nour', FR.nour),
    model: MODEL,
    stability: 0.62,
    similarityBoost: 0.8,
    style: 0.15,
    personaKey: 'caring',
    avatar: '/characters/nour.webp',
    taglineFr: 'Douce et rassurante, idéale pour la santé.',
    taglineEn: 'Soft and reassuring, ideal for healthcare.',
    previewFr: 'Bonjour, je vous écoute. Prenez votre temps.',
    previewEn: 'Hello, I’m listening. Take your time.',
  },
  lucas: {
    id: 'lucas',
    name: 'Lucas',
    accent: 'FR',
    gender: 'm',
    voiceId: voice('lucas', FR.lucas),
    model: MODEL,
    stability: 0.45,
    similarityBoost: 0.8,
    style: 0.35,
    personaKey: 'professional',
    avatar: '/characters/lucas.webp',
    taglineFr: 'Posé et professionnel, direct et rassurant.',
    taglineEn: 'Composed and professional, direct and reassuring.',
    previewFr: 'Bonjour, vous êtes bien au secrétariat. Que puis-je faire pour vous ?',
    previewEn: 'Hello, you’ve reached the front desk. What can I do for you?',
  },
  adrien: {
    id: 'adrien',
    name: 'Adrien',
    accent: 'FR',
    gender: 'm',
    voiceId: voice('adrien', FR.adrien),
    model: MODEL,
    stability: 0.4,
    similarityBoost: 0.78,
    style: 0.45,
    personaKey: 'warm',
    avatar: '/characters/adrien.webp',
    taglineFr: 'Chaleureux et avenant, met à l’aise tout de suite.',
    taglineEn: 'Warm and approachable, puts callers at ease.',
    previewFr: 'Bonjour ! Merci de votre appel, qu’est-ce qui vous ferait plaisir ?',
    previewEn: 'Hello! Thanks for calling, what can I do for you?',
  },
  hugo: {
    id: 'hugo',
    name: 'Hugo',
    accent: 'FR',
    gender: 'm',
    voiceId: voice('hugo', FR.hugo),
    model: MODEL,
    stability: 0.35,
    similarityBoost: 0.76,
    style: 0.4,
    personaKey: 'casual',
    avatar: '/characters/hugo.webp',
    taglineFr: 'Détendu et direct, comme un collègue au comptoir.',
    taglineEn: 'Relaxed and direct, like a colleague at the desk.',
    previewFr: 'Salut, vous êtes bien chez nous. Je peux vous aider ?',
    previewEn: 'Hi, you’ve got the right place. How can I help?',
  },
  theo: {
    id: 'theo',
    name: 'Théo',
    accent: 'FR',
    gender: 'm',
    voiceId: voice('theo', FR.theo),
    model: MODEL,
    stability: 0.3,
    similarityBoost: 0.75,
    style: 0.6,
    personaKey: 'energetic',
    avatar: '/characters/theo.webp',
    taglineFr: 'Énergique et motivé, ça s’entend au téléphone.',
    taglineEn: 'Energetic and driven, you can hear it on the line.',
    previewFr: 'Bonjour ! Ravi de vous avoir, dites-moi ce qu’il vous faut !',
    previewEn: 'Hello! Great to have you, tell me what you need!',
  },
  julien: {
    id: 'julien',
    name: 'Julien',
    accent: 'FR',
    gender: 'm',
    voiceId: voice('julien', FR.julien),
    model: MODEL,
    stability: 0.55,
    similarityBoost: 0.82,
    style: 0.2,
    personaKey: 'luxury',
    avatar: '/characters/julien.webp',
    taglineFr: 'Distingué et posé, pour une maison haut de gamme.',
    taglineEn: 'Distinguished and composed, for a high-end house.',
    previewFr: 'Bonjour, vous êtes bien à l’accueil. Je vous écoute.',
    previewEn: 'Good day, you’ve reached the front desk. I’m listening.',
  },
};

/**
 * The catalog as everything else reads it, with the current voice assignment
 * applied on the way out.
 *
 * A proxy rather than a rebuilt object because the assignment arrives after
 * this module is imported — every consumer already holds `CHARACTERS`, and a
 * copy made at import time would be frozen with the old voices for the life of
 * the process.
 */
export const CHARACTERS: Record<string, Character> = new Proxy(BASE_CHARACTERS, {
  get(target, prop: string) {
    const base = target[prop];
    if (!base) return base;
    /* Identifiant ET provenance, posés au même endroit et au même moment.
       Les dissocier était exactement la panne : un identifiant Cartesia sans
       son étiquette partait se faire traduire comme de l'ElevenLabs, ne
       trouvait rien, et tout le monde retombait sur la voix par défaut. */
    const voiceId = voice(base.id, base.voiceId);
    const provider = voiceProviderOf(base.id, voiceId);
    const voiceIdEn = voiceEn(base.id);
    return {
      ...base,
      voiceId,
      ...(voiceIdEn ? { voiceIdEn } : {}),
      ...(provider ? { voiceProvider: provider } : {}),
    };
  },
});

export const DEFAULT_CHARACTER_FR = 'marie';
/**
 * English default. Still Marie: characters are bilingual now, and the previous
 * English-only pair (Ashley, Ethan) offered nothing the ten do not, while
 * splitting the catalog in two.
 */
export const DEFAULT_CHARACTER_EN = 'marie';

/**
 * La voix d'un personnage pour une langue donnée, avec sa provenance.
 *
 * Point unique où la langue choisit le timbre: en anglais, la voix anglaise
 * native (`voiceIdEn`, toujours Cartesia) ; partout ailleurs, la voix du
 * personnage (`voiceId`) avec la provenance que le catalogue a déjà résolue.
 * Tous les chemins qui connaissent la langue (appel, prévisualisation, accueil)
 * passent par ici plutôt que de lire `character.voiceId` en direct.
 */
export function voiceForLanguage(
  character: Character,
  lang: 'fr' | 'en' | 'nl',
): { voiceId: string; voiceProvider?: 'cartesia' } {
  if (lang === 'en' && character.voiceIdEn) {
    return { voiceId: character.voiceIdEn, voiceProvider: 'cartesia' };
  }
  return {
    voiceId: character.voiceId,
    ...(character.voiceProvider ? { voiceProvider: character.voiceProvider } : {}),
  };
}

/**
 * A voice the client chose for themselves: cloned from their own recording, or
 * picked from their ElevenLabs library.
 *
 * It is an OVERRIDE on top of a character, not a character of its own. The
 * first version made it a pseudo-character called 'custom', which meant
 * choosing your own voice cost you the face, the name and the personality you
 * had picked — three losses for one gain. Here the character stays whole and
 * only its voiceId changes.
 */
export interface CustomVoice {
  voiceId: string;
  name: string;
  createdAt: string;
  /** Cloned from the owner's recording, as opposed to picked from the library. */
  cloned?: boolean;
  /**
   * Le catalogue d'où vient cet identifiant.
   *
   * Absent veut dire ElevenLabs, ce qu'étaient toutes les configurations
   * écrites jusqu'ici. `cartesia` existe parce qu'un identifiant Cartesia ne
   * désigne RIEN chez ElevenLabs et réciproquement: sans ce champ, une voix
   * choisie chez l'un serait envoyée à l'autre, qui répondrait par une erreur
   * ou par une voix étrangère au choix du client.
   *
   * Il est porté par la voix plutôt que déduit du réglage global, parce que le
   * réglage global peut changer après: une voix choisie reste ce qu'elle est.
   */
  provider?: 'cartesia';
}

/** Kept for configs written before the override model. Never assigned anymore. */
export const CUSTOM_CHARACTER_ID = 'custom';

export function isValidCharacterId(id: string | null | undefined): boolean {
  return !!id && Object.prototype.hasOwnProperty.call(CHARACTERS, id);
}

/**
 * Resolve the character for a client. Honors an explicit selection; otherwise
 * falls back to the default. For a Belgian client with no selection, a Belgian
 * voice replaces the voiceId only, keeping the character's tuning.
 */
export function resolveCharacter(params: {
  characterId?: string | null;
  isFrench: boolean;
  country?: string | null;
  customVoice?: CustomVoice | null;
}): Character {
  const { characterId, isFrench, country, customVoice } = params;

  let character: Character;
  if (isValidCharacterId(characterId)) {
    character = CHARACTERS[characterId as string];
  } else {
    character = CHARACTERS[isFrench ? DEFAULT_CHARACTER_FR : DEFAULT_CHARACTER_EN];
    const isBE = (country || '').toUpperCase() === 'BE';
    if (isFrench && isBE && env.VAPI_VOICE_ID_BE) {
      character = { ...character, accent: 'BE', voiceId: env.VAPI_VOICE_ID_BE };
    }
  }

  // The chosen voice replaces the voiceId and nothing else. Tuning and persona
  // keep coming from the character: they describe how the agent behaves, which
  // a voice says nothing about.
  if (customVoice?.voiceId) {
    return {
      ...character,
      voiceId: customVoice.voiceId,
      /* Une voix choisie (clone ou bibliothèque) parle les DEUX langues: c'est
         la voix du client, pas un timbre par langue. Effacer `voiceIdEn` évite
         que `voiceForLanguage` lui substitue la voix anglaise du personnage. */
      voiceIdEn: undefined,
      /* La provenance suit la voix CHOISIE, pas le personnage. Un clone sans
         `provider` est ElevenLabs (l'ancien défaut) : il ne doit pas hériter du
         'cartesia' que la fiche porte désormais par défaut. */
      voiceProvider: customVoice.provider,
      /* Et le fait d'être un CLONE voyage avec, séparément de « le client a
         choisi une voix ». Les deux se confondaient jusqu'ici, ce qui n'avait
         pas de conséquence tant qu'un seul fournisseur existait; maintenant si:
         seul un vrai clone doit rester chez ElevenLabs, une voix de
         bibliothèque n'a aucune raison d'y être retenue. */
      ...(customVoice.cloned ? { voiceCloned: true } : {}),
      // Only for a clone. A cloned voice carries the speaker's own timbre, and
      // pushing style on top of it is what makes clones sound like impressions
      // of themselves. A library voice keeps the character's tuning.
      ...(customVoice.cloned ? { style: 0, similarityBoost: 0.85 } : {}),
    };
  }

  return character;
}

/** Public catalog for the client picker (no secrets — voiceIds are fine to expose). */
export function listCharacters(): Character[] {
  return Object.values(CHARACTERS);
}
