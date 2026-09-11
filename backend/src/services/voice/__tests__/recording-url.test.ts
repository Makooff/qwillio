import { describe, it, expect } from 'vitest';
import { pickRecordingUrl } from '../../../controllers/voice-webhook.controller';

/**
 * L'enregistrement qui n'arrivait nulle part.
 *
 * Premier appel entrant reel, 11/09/2026: le portail montre l'appel, le lead,
 * le resume et la transcription. Pas l'enregistrement. Le code ne lisait que
 * `message.recordingUrl` et `event.recordingUrl`, et le mot `artifact`
 * n'apparaissait NULLE PART dans le backend, alors que le rapport de fin
 * d'appel de Vapi y range ses artefacts.
 *
 * On lit desormais les deux formes. C'est la meme lecon que les outils a la
 * racine contre `model.tools` (6novodecies, 6sexvicies): quand un fournisseur
 * deplace un champ, lire l'ancien emplacement seul ne produit pas une erreur,
 * il produit un SILENCE, et un silence ne se remarque que si quelqu'un cherche
 * la chose disparue.
 */
describe('pickRecordingUrl', () => {
  it('lit la forme historique, a la racine du message', () => {
    expect(pickRecordingUrl({ message: { recordingUrl: 'https://a/1.wav' } })).toBe('https://a/1.wav');
  });

  it('lit la forme ARTEFACT, celle qui manquait', () => {
    expect(pickRecordingUrl({ message: { artifact: { recordingUrl: 'https://a/2.wav' } } })).toBe('https://a/2.wav');
  });

  it('lit un artefact imbrique', () => {
    expect(pickRecordingUrl({ message: { artifact: { recording: { url: 'https://a/3.wav' } } } })).toBe('https://a/3.wav');
  });

  it('prefere la piste MONO a la stereo', () => {
    /* La stereo est plus lourde et sert au diagnostic, pas au client. */
    const url = pickRecordingUrl({
      message: { artifact: { stereoRecordingUrl: 'https://a/stereo.wav', recordingUrl: 'https://a/mono.wav' } },
    });
    expect(url).toBe('https://a/mono.wav');
  });

  it('rend undefined quand il n\'y a vraiment rien, jamais une chaine vide', () => {
    /* `undefined` et non `''`: une chaine vide s'enregistrerait comme une URL
       et ferait afficher un lecteur audio qui ne lit rien. */
    expect(pickRecordingUrl({ message: {} })).toBeUndefined();
    expect(pickRecordingUrl({})).toBeUndefined();
    expect(pickRecordingUrl({ message: { recordingUrl: '' } })).toBeUndefined();
  });

  it('ne tombe pas sur une charge inattendue', () => {
    expect(pickRecordingUrl(null)).toBeUndefined();
    expect(pickRecordingUrl({ message: { artifact: null } })).toBeUndefined();
  });
});
