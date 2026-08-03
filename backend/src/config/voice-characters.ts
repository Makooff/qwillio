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
  model: string;
  stability: number;
  similarityBoost: number;
  style: number;
  personaKey: PersonaKey;
  /** Served under /characters/<id>.webp, 512px. */
  avatar: string;
  taglineFr: string;
  taglineEn: string;
  previewFr: string;
  previewEn: string;
}

const MODEL = 'eleven_turbo_v2_5';

// Per-character voice override: VAPI_VOICE_ID_MARIE, VAPI_VOICE_ID_LUCAS, …
function voice(id: string, fallback: string): string {
  return process.env[`VAPI_VOICE_ID_${id.toUpperCase()}`] || fallback;
}

/**
 * ElevenLabs voice ids.
 *
 * Only the first five were auditioned. The five characters added afterwards
 * reuse them deliberately rather than carrying an id nobody has listened to:
 * a duplicate voice is a cosmetic flaw, an unverified id is how a male
 * character ends up speaking with a woman's voice. Each has its own env
 * override so they diverge as soon as someone assigns them by ear.
 */
const EL = {
  rachel: '21m00Tcm4TlvDq8ikWAM', // EN female, calm
  antoni: 'ErXwobaYiN019PkySvjV', // male, warm — documented premade voice
  frMarie:   'BilXxxvRLrA8YTteM2sl',
  frCamille: 'd3AXX0BlgJHYFCuH9X88',
  frLea:     'CYR0HqHoZAUmoZsLWPob',
  frSofia:   'FvmvwvObRqIHojkEGh5N',
} as const;

export const CHARACTERS: Record<string, Character> = {
  marie: {
    id: 'marie',
    name: 'Marie',
    accent: 'FR',
    gender: 'f',
    voiceId: voice('marie', env.VAPI_VOICE_ID_FR || EL.frMarie),
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
    voiceId: voice('camille', EL.frCamille),
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
    voiceId: voice('lea', EL.frLea),
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
    voiceId: voice('sofia', EL.frSofia),
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
    // Shares Camille's voice until a calmer one is auditioned: `caring` wants a
    // slower, softer delivery, which is tuning as much as timbre.
    voiceId: voice('nour', EL.frCamille),
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
    voiceId: voice('lucas', EL.antoni),
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
    voiceId: voice('adrien', EL.antoni),
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
    voiceId: voice('hugo', EL.antoni),
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
    voiceId: voice('theo', EL.antoni),
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
    voiceId: voice('julien', EL.antoni),
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

export const DEFAULT_CHARACTER_FR = 'marie';
/**
 * English default. Still Marie: characters are bilingual now, and the previous
 * English-only pair (Ashley, Ethan) offered nothing the ten do not, while
 * splitting the catalog in two.
 */
export const DEFAULT_CHARACTER_EN = 'marie';

/**
 * The client's own cloned voice. Not in CHARACTERS: it has no fixed voiceId,
 * it is per-tenant and lives in the client's config.
 */
export const CUSTOM_CHARACTER_ID = 'custom';

export interface CustomVoice {
  voiceId: string;
  name: string;
  createdAt: string;
}

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

  // A cloned voice replaces the voiceId only. Tuning and persona keep coming
  // from the character: those describe how the agent behaves, which the clone
  // says nothing about.
  if (characterId === CUSTOM_CHARACTER_ID && customVoice?.voiceId) {
    const base = CHARACTERS[isFrench ? DEFAULT_CHARACTER_FR : DEFAULT_CHARACTER_EN];
    return {
      ...base,
      id: CUSTOM_CHARACTER_ID,
      name: customVoice.name || base.name,
      voiceId: customVoice.voiceId,
      // A cloned voice carries the speaker's own timbre; pushing style on top
      // of it is what makes clones sound like impressions of themselves.
      style: 0,
      similarityBoost: 0.85,
      avatar: '',
    };
  }

  if (isValidCharacterId(characterId)) {
    return CHARACTERS[characterId as string];
  }

  const base = CHARACTERS[isFrench ? DEFAULT_CHARACTER_FR : DEFAULT_CHARACTER_EN];
  const isBE = (country || '').toUpperCase() === 'BE';
  if (isFrench && isBE && env.VAPI_VOICE_ID_BE) {
    return { ...base, accent: 'BE', voiceId: env.VAPI_VOICE_ID_BE };
  }
  return base;
}

/** Public catalog for the client picker (no secrets — voiceIds are fine to expose). */
export function listCharacters(): Character[] {
  return Object.values(CHARACTERS);
}
