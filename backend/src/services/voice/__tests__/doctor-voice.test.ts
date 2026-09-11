import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * `voice:doctor` répond à « qu'est-ce qui tourne VRAIMENT », et la voix en fait
 * partie.
 *
 * Le client peut croire sa flotte passée chez Cartesia et s'entendre répondre
 * par ElevenLabs: trois réglages décident (la voix choisie dans le portail, le
 * réglage par client, puis `VOICE_TTS_PROVIDER` qui vaut « 11labs » s'il n'est
 * pas posé), aucun ne se voit, et le seul indice était une ligne
 * `[Greeting] ... 401` qui ne nomme pas la cause.
 *
 * Deux règles, et la seconde porte la leçon de 6vicies: la voix ATTENDUE se
 * calcule par la même fonction que l'appel, jamais par une copie écrite ici.
 * Une seconde règle divergerait, et un docteur qui se trompe coûte plus cher
 * qu'aucun docteur (6sexvicies).
 */
const SOURCE = readFileSync(join(__dirname, '../../../scripts/diagnose-inbound.ts'), 'utf8');

/** Sans les commentaires: le commentaire d'un correctif nomme la forme fautive. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('voice:doctor — la voix qui parle vraiment', () => {
  it('lit la voix de l\'assistant DISTANT', () => {
    expect(CODE).toMatch(/assistant\.voice/);
  });

  it('calcule la voix attendue par la fonction de l\'appel, jamais par une copie', () => {
    expect(CODE).toMatch(/voiceSignatureFor/);
    // `buildVoice` appelé ici serait une seconde règle: c'est ce qu'on interdit.
    expect(CODE).not.toMatch(/buildVoice\s*\(/);
    expect(CODE).not.toMatch(/resolveCharacter\s*\(/);
  });

  it('nomme le réglage à changer, pas seulement l\'écart', () => {
    expect(CODE).toMatch(/VOICE_TTS_PROVIDER/);
  });
});
