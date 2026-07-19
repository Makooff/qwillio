// Receptionist character catalog — single source of truth.
//
// A "character" bundles a named persona (Marie, Lucas, Ashley…) with a specific
// ElevenLabs voice AND a personality tone. Clients pick one for their inbound
// receptionist; provisioning (onboarding.service) reads the selected character's
// voiceId + tuning + persona, so the voice actually matches the language and the
// chosen personality (previously every client got the same English voice).
//
// Voice IDs are launch defaults using known ElevenLabs voices. Each is
// overridable via an env var `VAPI_VOICE_ID_<ID>` (e.g. VAPI_VOICE_ID_LUCAS) so
// the founder can swap in the best-sounding voice after testing — no code change.
// Voice quality is subjective and can't be judged from code, so treat these as
// placeholders to validate.

import { env } from './env';
import type { PersonaKey } from './personalities';

export interface Character {
  id: string;
  name: string;
  language: 'fr' | 'en';
  accent: 'FR' | 'BE' | 'US';
  gender: 'f' | 'm';
  voiceId: string;
  model: string;
  stability: number;
  similarityBoost: number;
  style: number;
  personaKey: PersonaKey;
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

// Known ElevenLabs voice IDs used as launch defaults.
const EL = {
  rachel: '21m00Tcm4TlvDq8ikWAM', // EN female, calm
  bella: 'EXAVITQu4vr4xnSDxMaL',  // EN female, soft
  antoni: 'ErXwobaYiN019PkySvjV', // male, warm
  amelie: 'pFZP5JQG7iQjIQuC4Bku', // FR female (Amélie)
} as const;

export const CHARACTERS: Record<string, Character> = {
  marie: {
    id: 'marie',
    name: 'Marie',
    language: 'fr',
    accent: 'FR',
    gender: 'f',
    // Default to the configured French voice so existing env keeps working.
    voiceId: voice('marie', env.VAPI_VOICE_ID_FR || EL.amelie),
    model: MODEL,
    stability: 0.38,
    similarityBoost: 0.78,
    style: 0.45,
    personaKey: 'warm',
    taglineFr: 'Chaleureuse et accueillante, sourire dans la voix.',
    taglineEn: 'Warm and welcoming, a smile in her voice.',
    previewFr: 'Bonjour, merci d’appeler ! Comment puis-je vous aider aujourd’hui ?',
    previewEn: 'Hello, thanks for calling! How can I help you today?',
  },
  camille: {
    id: 'camille',
    name: 'Camille',
    language: 'fr',
    accent: 'FR',
    gender: 'f',
    voiceId: voice('camille', EL.amelie),
    model: MODEL,
    stability: 0.5,
    similarityBoost: 0.8,
    style: 0.3,
    personaKey: 'luxury',
    taglineFr: 'Soignée et raffinée, pour une image premium.',
    taglineEn: 'Polished and refined, for a premium brand.',
    previewFr: 'Bonjour et bienvenue. Je vous écoute, en quoi puis-je vous être utile ?',
    previewEn: 'Good day and welcome. I’m listening — how may I assist you?',
  },
  lea: {
    id: 'lea',
    name: 'Léa',
    language: 'fr',
    accent: 'FR',
    gender: 'f',
    voiceId: voice('lea', EL.amelie),
    model: MODEL,
    stability: 0.3,
    similarityBoost: 0.75,
    style: 0.6,
    personaKey: 'energetic',
    taglineFr: 'Dynamique et enthousiaste, pleine d’énergie.',
    taglineEn: 'Dynamic and upbeat, full of energy.',
    previewFr: 'Salut ! Super de vous avoir au téléphone, dites-moi tout !',
    previewEn: 'Hi there! Great to have you on the line, tell me everything!',
  },
  lucas: {
    id: 'lucas',
    name: 'Lucas',
    language: 'fr',
    accent: 'FR',
    gender: 'm',
    voiceId: voice('lucas', EL.antoni),
    model: MODEL,
    stability: 0.45,
    similarityBoost: 0.8,
    style: 0.35,
    personaKey: 'professional',
    taglineFr: 'Posé et professionnel, direct et rassurant.',
    taglineEn: 'Composed and professional, direct and reassuring.',
    previewFr: 'Bonjour, vous êtes bien au secrétariat. Que puis-je faire pour vous ?',
    previewEn: 'Hello, you’ve reached the front desk. What can I do for you?',
  },
  ashley: {
    id: 'ashley',
    name: 'Ashley',
    language: 'en',
    accent: 'US',
    gender: 'f',
    voiceId: voice('ashley', env.VAPI_VOICE_ID || EL.rachel),
    model: MODEL,
    stability: 0.42,
    similarityBoost: 0.82,
    style: 0.35,
    personaKey: 'warm',
    taglineFr: 'Chaleureuse, voix anglaise naturelle.',
    taglineEn: 'Warm and welcoming, natural English voice.',
    previewFr: 'Hello, thanks for calling! How can I help you today?',
    previewEn: 'Hello, thanks for calling! How can I help you today?',
  },
  ethan: {
    id: 'ethan',
    name: 'Ethan',
    language: 'en',
    accent: 'US',
    gender: 'm',
    voiceId: voice('ethan', EL.antoni),
    model: MODEL,
    stability: 0.45,
    similarityBoost: 0.8,
    style: 0.3,
    personaKey: 'professional',
    taglineFr: 'Professionnel, voix anglaise masculine posée.',
    taglineEn: 'Professional, composed male English voice.',
    previewFr: 'Hi, you’ve reached the front desk. How can I help?',
    previewEn: 'Hi, you’ve reached the front desk. How can I help?',
  },
};

export const DEFAULT_CHARACTER_FR = 'marie';
export const DEFAULT_CHARACTER_EN = 'ashley';

export function isValidCharacterId(id: string | null | undefined): boolean {
  return !!id && Object.prototype.hasOwnProperty.call(CHARACTERS, id);
}

/**
 * Resolve the character for a client. Honors an explicit selection; otherwise
 * falls back by language. For a French/Belgian client with no selection we use
 * Marie, and if a Belgian-accent voice is configured (VAPI_VOICE_ID_BE) we swap
 * just the voiceId so the accent matches while keeping Marie's tuning.
 */
export function resolveCharacter(params: {
  characterId?: string | null;
  isFrench: boolean;
  country?: string | null;
}): Character {
  const { characterId, isFrench, country } = params;

  if (isValidCharacterId(characterId)) {
    return CHARACTERS[characterId as string];
  }

  if (isFrench) {
    const base = CHARACTERS[DEFAULT_CHARACTER_FR];
    const isBE = (country || '').toUpperCase() === 'BE';
    if (isBE && env.VAPI_VOICE_ID_BE) {
      return { ...base, accent: 'BE', voiceId: env.VAPI_VOICE_ID_BE };
    }
    return base;
  }
  return CHARACTERS[DEFAULT_CHARACTER_EN];
}

/** Public catalog for the client picker (no secrets — voiceIds are fine to expose). */
export function listCharacters(): Character[] {
  return Object.values(CHARACTERS);
}
