import { resolveCharacter, voiceForLanguage } from '../../config/voice-characters';

/** Same saved voice on SIP/browser; no invented selection for an unset or malformed profile. */
export function coreProfileVoice(profile: {
  characterId?: string | null; language?: string; country?: string | null;
  customVoice?: { voiceId: string; name?: string; cloned?: boolean; provider?: string } | null;
}) {
  const chosen = profile.customVoice;
  if (chosen?.voiceId?.trim() && chosen.voiceId.trim().length <= 128) {
    return { voiceId: chosen.voiceId.trim(), name: chosen.name?.trim().slice(0, 120) || '',
      cloned: chosen.cloned === true, provider: chosen.provider === 'cartesia' ? 'cartesia' : 'elevenlabs' };
  }
  if (chosen || !profile.characterId) return null;
  const character = resolveCharacter({ characterId: profile.characterId, isFrench: profile.language === 'fr', country: profile.country });
  const selected = voiceForLanguage(character, profile.language === 'en' ? 'en' : profile.language === 'nl' ? 'nl' : 'fr');
  return { voiceId: selected.voiceId, name: character.name, cloned: false,
    provider: selected.voiceProvider === 'cartesia' ? 'cartesia' : 'elevenlabs' };
}
