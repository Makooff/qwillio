import { describe, it, expect } from 'vitest';
import { visibleVoices } from './VoiceMenu';
import type { CatalogVoice } from '../../client/VoicePicker';

const v = (over: Partial<CatalogVoice>): CatalogVoice => ({
  voiceId: 'x', name: 'x', gender: null, accent: null, description: null, previewUrl: null, cloned: false, ...over,
});

/**
 * Le menu ne montrait que les voix CLONÉES, bonne réponse au catalogue
 * ElevenLabs non filtré (des dizaines de voix anglaises). Le catalogue
 * Cartesia est filtré sur la langue côté serveur, et cette règle cachait ses
 * 69 voix françaises: le client ouvrait le menu, voyait les personnages, et
 * concluait qu'aucune voix n'avait été ajoutée. Relevé sur capture le 12/09.
 *
 * La règle exacte, testée ici parce qu'elle est facile à re-perdre: clonée OU
 * Cartesia. Une voix de bibliothèque ElevenLabs reste cachée.
 */
describe('visibleVoices', () => {
  const cartesiaF = v({ voiceId: 'c1', name: 'Léa', gender: 'female', provider: 'cartesia' });
  const cartesiaM = v({ voiceId: 'c2', name: 'Félix', gender: 'male', provider: 'cartesia' });
  const clone = v({ voiceId: 'k1', name: '2882ffdd — Ma voix', cloned: true });
  const elevenStock = v({ voiceId: 'e1', name: 'Skylar', gender: 'female', description: 'Approachable American female' });

  it('montre les voix Cartesia et les clones, jamais la bibliothèque ElevenLabs', () => {
    const ids = visibleVoices([cartesiaF, cartesiaM, clone, elevenStock], 'all', '').map(x => x.voiceId);
    expect(ids).toEqual(['c1', 'c2', 'k1']);
  });

  /**
   * Les clones ont leur onglet: sous « Femmes » et « Hommes » on ne voit que
   * le catalogue, sous « Clonées » rien d'autre que les siens.
   */
  it('filtre les voix Cartesia par genre, sans les clones', () => {
    expect(visibleVoices([cartesiaF, cartesiaM, clone], 'f', '').map(x => x.voiceId)).toEqual(['c1']);
    expect(visibleVoices([cartesiaF, cartesiaM, clone], 'm', '').map(x => x.voiceId)).toEqual(['c2']);
  });

  it('ne montre que les clones sous « Clonées »', () => {
    expect(visibleVoices([cartesiaF, cartesiaM, clone, elevenStock], 'cloned', '').map(x => x.voiceId)).toEqual(['k1']);
  });

  it('cherche sans accents ni casse, sur le nom et la description', () => {
    expect(visibleVoices([cartesiaF, cartesiaM], 'all', 'LEA').map(x => x.voiceId)).toEqual(['c1']);
    const described = v({ voiceId: 'c3', name: 'Nora', provider: 'cartesia', description: 'Attentive Assistant' });
    expect(visibleVoices([described], 'all', 'attentive').map(x => x.voiceId)).toEqual(['c3']);
  });
});
