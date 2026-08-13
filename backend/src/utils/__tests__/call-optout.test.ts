import { describe, it, expect } from 'vitest';
import { detectCallOptOut } from '../call-optout';

/**
 * Opt-out d'appel verbal (roadmap 3.3, première brique).
 *
 * Conservateur par contrat: « pas intéressé » n'est PAS un opt-out (c'est un
 * prospect à recontacter dans trois mois); « ne me rappelez plus » l'est,
 * définitivement.
 */
describe('detectCallOptOut', () => {
  it.each([
    'Non merci, ne me rappelez plus jamais.',
    'Arrêtez de m\'appeler, s\'il vous plaît.',
    'Retirez-moi de votre liste.',
    'Je suis sur liste rouge, inscrit à Bloctel.',
    'Please stop calling me.',
    "Don't call me again.",
    'Take me off your list, thanks.',
    'Never call us again.',
    'Bel me niet meer alstublieft.',
    'Stop met bellen.',
    'Haal mij van jullie lijst.',
  ])('détecte: %s', phrase => {
    expect(detectCallOptOut(phrase)).toBe(true);
  });

  it.each([
    'Non, pas intéressé pour le moment.',
    'Rappelez-moi plutôt le mois prochain.',
    'Je n\'ai pas le temps là, désolé.',
    "I'm not interested right now.",
    'Can you call back next week?',
    'Nee, nu even niet, bel morgen terug.',
    '',
  ])('ne se déclenche pas sur: %s', phrase => {
    expect(detectCallOptOut(phrase)).toBe(false);
  });

  it('tolère null/undefined', () => {
    expect(detectCallOptOut(null)).toBe(false);
    expect(detectCallOptOut(undefined)).toBe(false);
  });
});
