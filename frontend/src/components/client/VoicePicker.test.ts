import { describe, it, expect } from 'vitest';
import { groupVoices, voiceGender, type CatalogVoice } from './VoicePicker';

const v = (over: Partial<CatalogVoice>): CatalogVoice => ({
  voiceId: 'x', name: 'x', gender: null, accent: null, description: null, previewUrl: null, cloned: false, ...over,
});

/**
 * Le portail trie par homme, femme et voix clonée. Le tri est une fonction
 * pure, testée ici sans écran: c'est elle qui décide de l'ordre, et les deux
 * catalogues étiquettent le genre chacun à sa façon.
 */
describe('groupVoices', () => {
  it('lit le genre sous les formes des deux catalogues', () => {
    expect(voiceGender('male')).toBe('male');
    expect(voiceGender('Masculine')).toBe('male');
    expect(voiceGender('female')).toBe('female');
    expect(voiceGender('feminine')).toBe('female');
    expect(voiceGender('neutral')).toBeNull();
    expect(voiceGender(null)).toBeNull();
  });

  it('range clonées, femmes, hommes, autres, dans cet ordre', () => {
    const groups = groupVoices([
      v({ voiceId: 'a', gender: 'male' }),
      v({ voiceId: 'b', gender: 'female' }),
      v({ voiceId: 'c', gender: null }),
      v({ voiceId: 'd', cloned: true, gender: 'female' }),
    ]);
    expect(groups.map(g => g.group)).toEqual(['cloned', 'female', 'male', 'other']);
    // Un clone n'apparaît QUE sous « clonées », même étiqueté femme.
    expect(groups.find(g => g.group === 'female')!.voices.map(x => x.voiceId)).toEqual(['b']);
    expect(groups.find(g => g.group === 'cloned')!.voices.map(x => x.voiceId)).toEqual(['d']);
  });

  it('ne montre pas un groupe vide', () => {
    const groups = groupVoices([v({ voiceId: 'a', gender: 'male' })]);
    expect(groups.map(g => g.group)).toEqual(['male']);
  });

  it('sert une voix sans genre plutôt que de la cacher', () => {
    const groups = groupVoices([v({ voiceId: 'a' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].group).toBe('other');
  });
});
