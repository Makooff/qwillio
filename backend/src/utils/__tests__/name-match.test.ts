import { describe, it, expect } from 'vitest';
import { nameSimilarity, namesMatch, normaliseName } from '../name-match';

describe('namesMatch — un nom entendu contre un nom écrit', () => {
  const written = 'Jean-Luc de la forge';

  it('accepte les cinq lectures du transcripteur du 13/09', () => {
    for (const heard of ['Jean-Luc de la Ford', 'Jean-Luc Delaforde', 'Jean-Luc de la foireux', 'Jean-Luc de la foire', 'Jean-Luc de la forge']) {
      expect(namesMatch(heard, written), heard).toBe(true);
    }
  });

  it('refuse un autre appelant', () => {
    expect(namesMatch('Lucas van Devel', written)).toBe(false);
    expect(namesMatch('Paul et Matthieu', written)).toBe(false);
    expect(nameSimilarity('', written)).toBe(0);
  });

  it('le nom de famille seul suffit, avec ou sans accent', () => {
    expect(namesMatch('Delaforge', written)).toBe(true);
    expect(namesMatch('Stéphane Van Hold', 'Stephane VAN HOLD')).toBe(true);
    expect(normaliseName('Élodie D\'Hoore')).toBe('elodiedhoore');
  });
});
