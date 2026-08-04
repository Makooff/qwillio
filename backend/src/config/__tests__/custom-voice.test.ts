import { describe, it, expect } from 'vitest';
import { resolveCharacter, CHARACTERS, DEFAULT_CHARACTER_FR, applyAssignedVoices, listCharacters } from '../voice-characters';
import { readCustomVoice } from '../../services/voice/realtime-context.service';

const clone = { voiceId: 'v_cloned', name: 'Ma voix', createdAt: '2026-08-03T00:00:00.000Z', cloned: true };
const library = { voiceId: 'v_library', name: 'Voix ElevenLabs', createdAt: '2026-08-03T00:00:00.000Z' };

describe('a chosen voice overrides the character voice', () => {
  it('replaces the voiceId of whichever character is selected', () => {
    const c = resolveCharacter({ characterId: 'lucas', isFrench: true, customVoice: clone });
    expect(c.voiceId).toBe('v_cloned');
  });

  it('keeps the character whole', () => {
    // The whole point of the override model: picking your own voice used to
    // swap you onto a pseudo-character called 'custom', costing the face, the
    // name and the personality. Only the timbre should change.
    const c = resolveCharacter({ characterId: 'lucas', isFrench: true, customVoice: clone });
    expect(c.id).toBe('lucas');
    expect(c.name).toBe(CHARACTERS.lucas.name);
    expect(c.avatar).toBe(CHARACTERS.lucas.avatar);
    expect(c.personaKey).toBe(CHARACTERS.lucas.personaKey);
    expect(c.stability).toBe(CHARACTERS.lucas.stability);
  });

  it('drops style on a clone', () => {
    // Style exaggeration on top of a cloned timbre is what makes clones sound
    // like impressions of the person rather than the person.
    const c = resolveCharacter({ characterId: 'lea', isFrench: true, customVoice: clone });
    expect(c.style).toBe(0);
    expect(c.similarityBoost).toBe(0.85);
  });

  it('leaves the character tuning alone for a library voice', () => {
    // A voice picked from the account library is a normal ElevenLabs voice, so
    // the character's tuning applies to it exactly as to its own default.
    const c = resolveCharacter({ characterId: 'lea', isFrench: true, customVoice: library });
    expect(c.voiceId).toBe('v_library');
    expect(c.style).toBe(CHARACTERS.lea.style);
    expect(c.similarityBoost).toBe(CHARACTERS.lea.similarityBoost);
  });

  it('applies to the default character when none is selected', () => {
    const c = resolveCharacter({ characterId: null, isFrench: true, customVoice: clone });
    expect(c.id).toBe(DEFAULT_CHARACTER_FR);
    expect(c.voiceId).toBe('v_cloned');
  });

  it('falls back to the character voice when the override is missing', () => {
    // The selection can outlive the voice: deleted upstream, or a half-written
    // config. An agent with no voiceId cannot answer a call at all.
    const c = resolveCharacter({ characterId: 'lucas', isFrench: true, customVoice: null });
    expect(c.voiceId).toBe(CHARACTERS.lucas.voiceId);
  });

  it('ignores an override with a blank voice id', () => {
    const c = resolveCharacter({
      characterId: 'lucas',
      isFrench: true,
      customVoice: { voiceId: '', name: 'x', createdAt: '' },
    });
    expect(c.voiceId).toBe(CHARACTERS.lucas.voiceId);
  });
});

describe('readCustomVoice', () => {
  it('accepts a well-formed stored value', () => {
    expect(readCustomVoice(clone)).toMatchObject({ voiceId: 'v_cloned', name: 'Ma voix' });
  });

  it('rejects anything without a usable voice id', () => {
    // A blank voiceId would be sent to ElevenLabs on every call of a live
    // tenant, so it must not survive the read.
    for (const bad of [null, undefined, 'string', 42, {}, { voiceId: '' }, { voiceId: '  ' }, { voiceId: 7 }]) {
      expect(readCustomVoice(bad)).toBeNull();
    }
  });

  it('carries the cloned flag through', () => {
    // Lost here, a clone would be tuned like a library voice and sound like an
    // impression of its owner.
    expect(readCustomVoice(clone)?.cloned).toBe(true);
    expect(readCustomVoice(library)?.cloned).toBeUndefined();
  });

  it('fills in a name and date rather than returning a partial object', () => {
    const v = readCustomVoice({ voiceId: 'v_1' });
    expect(v).toMatchObject({ voiceId: 'v_1', name: 'Ma voix' });
    expect(typeof v?.createdAt).toBe('string');
  });
});

describe('voices assigned at runtime', () => {
  it('reaches every reader of the catalog, not just new ones', () => {
    // The assignment arrives after this module is imported, and every consumer
    // already holds CHARACTERS. A copy taken at import time would keep the old
    // voices for the life of the process.
    applyAssignedVoices({ lucas: 'v_assigned_lucas' });
    expect(CHARACTERS.lucas.voiceId).toBe('v_assigned_lucas');
    expect(listCharacters().find(c => c.id === 'lucas')?.voiceId).toBe('v_assigned_lucas');
    expect(resolveCharacter({ characterId: 'lucas', isFrench: true }).voiceId).toBe('v_assigned_lucas');
    // Untouched characters keep theirs.
    expect(CHARACTERS.marie.voiceId).not.toBe('v_assigned_lucas');
    applyAssignedVoices({});
  });

  it('still loses to an explicit env pin', () => {
    process.env.VAPI_VOICE_ID_HUGO = 'v_pinned';
    applyAssignedVoices({ hugo: 'v_assigned' });
    expect(CHARACTERS.hugo.voiceId).toBe('v_pinned');
    delete process.env.VAPI_VOICE_ID_HUGO;
    applyAssignedVoices({});
  });
});
