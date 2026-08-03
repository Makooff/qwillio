import { describe, it, expect } from 'vitest';
import { resolveCharacter, CUSTOM_CHARACTER_ID, CHARACTERS, DEFAULT_CHARACTER_FR } from '../voice-characters';
import { readCustomVoice } from '../../services/voice/realtime-context.service';

const clone = { voiceId: 'v_cloned', name: 'Ma voix', createdAt: '2026-08-03T00:00:00.000Z' };

describe('resolveCharacter with a cloned voice', () => {
  it('uses the clone as the voice when the client selected it', () => {
    const c = resolveCharacter({ characterId: CUSTOM_CHARACTER_ID, isFrench: true, customVoice: clone });
    expect(c.voiceId).toBe('v_cloned');
    expect(c.id).toBe(CUSTOM_CHARACTER_ID);
  });

  it('keeps the language default tuning and persona', () => {
    // A clone says nothing about how the agent should behave, only how it
    // sounds. Persona and language must not follow the voice.
    const base = CHARACTERS[DEFAULT_CHARACTER_FR];
    const c = resolveCharacter({ characterId: CUSTOM_CHARACTER_ID, isFrench: true, customVoice: clone });
    expect(c.personaKey).toBe(base.personaKey);
    expect(c.language).toBe('fr');
  });

  it('drops style on a clone', () => {
    // Style exaggeration on top of a cloned timbre is what makes clones sound
    // like impressions of the person rather than the person.
    const c = resolveCharacter({ characterId: CUSTOM_CHARACTER_ID, isFrench: true, customVoice: clone });
    expect(c.style).toBe(0);
  });

  it('falls back to a catalog voice when the clone is missing', () => {
    // The selection can outlive the voice: deleted upstream, or a half-written
    // config. An agent with no voiceId cannot answer a call at all.
    const c = resolveCharacter({ characterId: CUSTOM_CHARACTER_ID, isFrench: true, customVoice: null });
    expect(c.voiceId).toBe(CHARACTERS[DEFAULT_CHARACTER_FR].voiceId);
    expect(c.id).not.toBe(CUSTOM_CHARACTER_ID);
  });

  it('ignores a clone when another character is selected', () => {
    const c = resolveCharacter({ characterId: 'marie', isFrench: true, customVoice: clone });
    expect(c.voiceId).toBe(CHARACTERS.marie.voiceId);
  });
});

describe('readCustomVoice', () => {
  it('accepts a well-formed stored value', () => {
    expect(readCustomVoice(clone)).toEqual(clone);
  });

  it('rejects anything without a usable voice id', () => {
    // A blank voiceId would be sent to ElevenLabs on every call of a live
    // tenant, so it must not survive the read.
    for (const bad of [null, undefined, 'string', 42, {}, { voiceId: '' }, { voiceId: '  ' }, { voiceId: 7 }]) {
      expect(readCustomVoice(bad)).toBeNull();
    }
  });

  it('fills in a name and date rather than returning a partial object', () => {
    const v = readCustomVoice({ voiceId: 'v_1' });
    expect(v).toMatchObject({ voiceId: 'v_1', name: 'Ma voix' });
    expect(typeof v?.createdAt).toBe('string');
  });
});
