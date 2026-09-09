import { describe, it, expect } from 'vitest';
import { looksLikeSilenceArtifact } from '../transcription.service';

/**
 * Whisper ne rend pas une chaîne vide sur un clip silencieux: il rend la phrase
 * la plus probable de son entraînement, et son entraînement est plein de
 * sous-titres. Relevé en production le 09/09, dans le chat d'inscription:
 * l'owner a parlé, et son message est parti sous la forme « Sous-titrage
 * ST' 501 ».
 *
 * Rendre ce texte est pire que ne rien rendre: l'assistant répond alors à une
 * phrase que personne n'a dite.
 */
describe('les hallucinations de Whisper sur du silence', () => {
  it('écarte les deux génériques exacts vus en production', () => {
    expect(looksLikeSilenceArtifact("Sous-titrage ST' 501")).toBe(true);
    /* Rapporté mot pour mot par l'owner le 09/09, « para » compris: Whisper
       écorche aussi ses propres génériques, donc le filtre ne peut pas exiger
       une orthographe exacte. */
    expect(looksLikeSilenceArtifact("Sous-titres réalisés para la communauté d'Amara.org")).toBe(true);
  });

  it('écarte les autres génériques de la même famille', () => {
    expect(looksLikeSilenceArtifact('Sous-titrage Société Radio-Canada')).toBe(true);
    expect(looksLikeSilenceArtifact("Sous-titres réalisés par la communauté d'Amara.org")).toBe(true);
    expect(looksLikeSilenceArtifact("Merci d'avoir regardé cette vidéo.")).toBe(true);
    expect(looksLikeSilenceArtifact('Thanks for watching!')).toBe(true);
    expect(looksLikeSilenceArtifact('[Musique]')).toBe(true);
    expect(looksLikeSilenceArtifact('Ondertitels ingediend door de Amara.org gemeenschap')).toBe(true);
  });

  it('ignore la casse, les accents et la ponctuation finale', () => {
    expect(looksLikeSilenceArtifact('SOUS-TITRAGE ST 501...')).toBe(true);
    expect(looksLikeSilenceArtifact('sous titrage st 501')).toBe(true);
  });

  /**
   * La moitié qui compte. Un filtre trop large mangerait de vraies phrases, et
   * l'owner verrait sa dictée disparaître sans savoir pourquoi.
   */
  it('laisse passer une vraie phrase qui CONTIENT ces mots', () => {
    expect(looksLikeSilenceArtifact("Merci d'avoir regardé la vidéo que je vous ai envoyée hier")).toBe(false);
    expect(looksLikeSilenceArtifact('On propose du sous-titrage pour les clients sourds')).toBe(false);
    expect(looksLikeSilenceArtifact('Thanks for watching the shop while I was away')).toBe(false);
  });

  it('laisse passer la politesse nue, que Whisper produit aussi sur du silence', () => {
    // « Merci » est une réponse plausible de l'owner: la perdre coûterait plus
    // cher que de la laisser passer.
    expect(looksLikeSilenceArtifact('Merci')).toBe(false);
    expect(looksLikeSilenceArtifact('Thank you.')).toBe(false);
    expect(looksLikeSilenceArtifact('Oui')).toBe(false);
  });

  it('ne dit rien sur une transcription vide', () => {
    expect(looksLikeSilenceArtifact('')).toBe(false);
    expect(looksLikeSilenceArtifact('   ')).toBe(false);
  });
});
