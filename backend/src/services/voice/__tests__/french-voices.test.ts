import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../config/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('../../../config/database', () => ({ prisma: {} }));

const { toSharedVoice, pairVoices } = await import('../french-voices.service');

const raw = (over: Record<string, unknown> = {}) => ({
  voice_id: 'v1',
  public_owner_id: 'owner1',
  name: 'Amélie',
  gender: 'female',
  language: 'fr',
  cloned_by_count: 120,
  accent: 'french',
  ...over,
});

/**
 * These assertions exist because the hand-written ids shipped a male voice for
 * a female character, a female voice for a male one, and one voice shared by
 * five characters. A voice id is opaque, so the only defence is to check what
 * the library says about it before using it.
 */
describe('reading a library voice', () => {
  it('accepts a French voice of the wanted gender', () => {
    expect(toSharedVoice(raw(), 'female')).toMatchObject({ voiceId: 'v1', gender: 'female', usage: 120 });
  });

  it('refuses a voice of the other gender, whatever the query asked for', () => {
    // The filter is in the query string too. This is the one that has to hold
    // when the third party's filter does not.
    expect(toSharedVoice(raw({ gender: 'male' }), 'female')).toBeNull();
    expect(toSharedVoice(raw({ gender: 'female' }), 'male')).toBeNull();
  });

  it('refuses a voice with no French', () => {
    expect(toSharedVoice(raw({ language: 'en', verified_languages: [] }), 'female')).toBeNull();
  });

  it('accepts a voice verified in French even when its own language is not', () => {
    const v = toSharedVoice(raw({ language: 'en', verified_languages: [{ language: 'fr' }] }), 'female');
    expect(v?.voiceId).toBe('v1');
  });

  it('refuses anything without the two ids needed to use it', () => {
    for (const bad of [null, undefined, 'string', 42, {}, raw({ voice_id: '' }), raw({ public_owner_id: '' })]) {
      expect(toSharedVoice(bad, 'female')).toBeNull();
    }
  });
});

describe('pairing characters with voices', () => {
  const characters = [
    { id: 'marie', gender: 'f' as const },
    { id: 'camille', gender: 'f' as const },
    { id: 'lea', gender: 'f' as const },
    { id: 'lucas', gender: 'm' as const },
    { id: 'hugo', gender: 'm' as const },
  ];
  const voice = (id: string, gender: 'male' | 'female') => ({
    publicOwnerId: 'o', voiceId: id, name: id, gender, usage: 1, accent: null, description: null,
  });
  const pool = {
    female: [voice('f1', 'female'), voice('f2', 'female'), voice('f3', 'female')],
    male: [voice('m1', 'male'), voice('m2', 'male')],
  };

  it('gives every character a voice of its own gender', () => {
    const pairing = pairVoices(characters, pool);
    for (const c of characters) {
      expect(pairing[c.id].gender).toBe(c.gender === 'f' ? 'female' : 'male');
    }
  });

  it('never gives two characters the same voice', () => {
    // Five men sharing one voice is what the catalog shipped with.
    const ids = Object.values(pairVoices(characters, pool)).map(v => v.voiceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves a character unassigned rather than borrowing the wrong voice', () => {
    const short = { female: [voice('f1', 'female')], male: [] as ReturnType<typeof voice>[] };
    const pairing = pairVoices(characters, short);
    expect(pairing.marie.voiceId).toBe('f1');
    expect(pairing.camille).toBeUndefined();
    expect(pairing.lucas).toBeUndefined();
  });

  it('hands out the most-used voices first', () => {
    // The pool arrives sorted by usage; pairing must not reshuffle it, or
    // "the best French voices" becomes "any French voices".
    const ordered = {
      female: [voice('best', 'female'), voice('second', 'female')],
      male: [voice('bestM', 'male')],
    };
    const pairing = pairVoices([characters[0], characters[1], characters[3]], ordered);
    expect(pairing.marie.voiceId).toBe('best');
    expect(pairing.camille.voiceId).toBe('second');
    expect(pairing.lucas.voiceId).toBe('bestM');
  });
});
