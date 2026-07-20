// Shared personality tone presets for the AI receptionist.
//
// These are tone directives injected into the assistant's system prompt. They
// steer HOW the receptionist speaks (warmth, pace, formality) independently of
// WHICH voice is used — a character (see voice-characters.ts) pairs one of these
// tones with a specific ElevenLabs voice. Kept in one place so the prompt
// builder (onboarding.service) and the character catalog never drift.

export type PersonaKey =
  | 'warm'
  | 'professional'
  | 'casual'
  | 'energetic'
  | 'luxury'
  | 'caring';

export const PERSONALITY_PROMPTS: Record<PersonaKey, string> = {
  warm:         'Warm, welcoming, empathetic — smile in your voice. Use friendly phrasing and acknowledge feelings.',
  professional: 'Professional, direct, precise. Keep things crisp; minimal small talk.',
  casual:       'Casual and conversational, like a relaxed colleague. Contractions are fine. Stay natural.',
  energetic:    'Energetic, enthusiastic, upbeat. Sound excited to help.',
  luxury:       'Polished, refined, articulate. Use elevated vocabulary; project a premium brand feel.',
  caring:       'Soft, reassuring, attentive — ideal for health/medical contexts. Speak slowly and patiently.',
};

export const DEFAULT_PERSONA: PersonaKey = 'warm';

/** Resolve a persona tone directive by key, defaulting to warm. */
export function getPersonaPrompt(key: string | null | undefined): string {
  const k = (key || '') as PersonaKey;
  return PERSONALITY_PROMPTS[k] ?? PERSONALITY_PROMPTS[DEFAULT_PERSONA];
}
