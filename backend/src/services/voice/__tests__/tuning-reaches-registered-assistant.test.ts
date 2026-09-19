import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LES CURSEURS D'UN NIVEAU ATTEIGNENT-ILS L'ASSISTANT QUI DÉCROCHE ?
 *
 * Huitième trou de la famille 6quindecies, relevé le 19/09/2026 en cherchant
 * où poser la personnalité de la chaîne classique.
 *
 * Il y a DEUX constructeurs de voix, et un seul passait le `tuning`:
 *
 *   - `buildSpeech` bâtit l'assistant à l'appel, sur la ligne PARTAGÉE des
 *     essais. Il passe `tuning: opts.tuning` depuis toujours.
 *   - `voiceForProfile` sert `assistantSpeechForProfile`, donc les DEUX
 *     écritures de `onboarding.service.ts`, donc l'assistant ENREGISTRÉ, le
 *     seul qui décroche sur une ligne DÉDIÉE. Il calculait `tuningFor(profile)`
 *     pour le RENDRE à ses appelants et bâtissait la voix sans lui.
 *
 * Conséquence: `speed`, `styleCap`, `ttsModel`, `cartesiaModel` et
 * `minChunkChars` d'un niveau ne pouvaient atteindre qu'un compte d'essai.
 * Jamais un client qui paie. Le réglage s'enregistre, l'écran dit enregistré,
 * l'appelant entend les valeurs d'environnement: le mode d'échec exact de
 * 6quindecies, 6vicies, 6tertrigesies et 6quaterquadragesies.
 *
 * Il n'avait rien cassé parce qu'aucun niveau ne pose encore ces champs:
 * `base` est vide par contrat, `superagent` ne pose que des champs relus
 * ailleurs. Le trou attendait le premier curseur de rendu posé sur un niveau.
 */

const SRC = join(__dirname, '..');

/** Le commentaire d'un correctif NOMME la forme fautive: il doit sortir. */
function sansCommentaires(fichier: string): string {
  return readFileSync(join(SRC, fichier), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('les curseurs du niveau atteignent l\'assistant enregistré', () => {
  it('voiceForProfile passe son tuning à buildVoice', () => {
    const src = sansCommentaires('profile-voice.ts');
    const appel = src.match(/buildVoice\(\{[\s\S]*?\n  \}\)/);
    expect(appel, 'buildVoice introuvable dans profile-voice.ts').not.toBeNull();
    expect(appel![0]).toMatch(/\btuning,/);
  });

  it('assistantSpeechForProfile passe le modèle du niveau, comme buildSpeech', () => {
    const src = sansCommentaires('profile-voice.ts');
    expect(src).toMatch(/llmModel: tuning\.llmModel/);
    // La température aussi: obligatoire ici, un niveau ne pouvait pas la porter.
    expect(src).toMatch(/temperature: opts\.temperature \?\? tuning\.temperature/);
  });

  /**
   * La branche CARTESIA appelait `buildChunkPlan()` sans argument quand celle
   * d'ElevenLabs passait le tuning. Deux copies d'une même décision, et c'est
   * celle qui sert la flotte qui était fausse.
   */
  it('les DEUX branches de buildVoice passent le tuning au chunkPlan', () => {
    const src = sansCommentaires('speech-plans.ts');
    expect(src).not.toMatch(/chunkPlan: buildChunkPlan\(\s*\)/);
    expect((src.match(/chunkPlan: buildChunkPlan\(tuning\)/g) || []).length).toBe(2);
  });
});

/**
 * Le test de source dit que la valeur est PASSÉE. Celui-ci dit qu'elle ARRIVE,
 * ce qui n'est pas la même question: `buildVoice` pourrait la recevoir et
 * l'ignorer. Le niveau est bouchonné parce que c'est exactement ce qu'on
 * asserte — « quel que soit ce que le niveau rend, la voix le porte » — et
 * qu'aucun niveau réel ne pose encore de curseur de rendu.
 */
describe('la valeur arrive vraiment dans le bloc voix', () => {
  beforeEach(() => vi.resetModules());

  it('un minChunkChars de niveau se retrouve sur la voix de l\'assistant enregistré', async () => {
    vi.doMock('../voice-tiers', async () => {
      const reel = await vi.importActual<typeof import('../voice-tiers')>('../voice-tiers');
      return { ...reel, tuningFor: () => ({ minChunkChars: 137, speed: 1.15 }) };
    });

    const { voiceForProfile } = await import('../profile-voice');
    const voix = voiceForProfile({
      clientId: 'c1', businessName: 'Le Comptoir', businessType: 'restaurant',
      agentName: 'Camille', language: 'fr', timezone: 'Europe/Paris',
      transferNumber: null, instructions: null, services: [], openingHours: null,
      weekHours: null, bookingEnabled: false, calendarConnected: false,
      planType: 'starter', characterId: null, customVoice: null, country: 'FR',
      customLlm: true, voiceMode: 'classic', hasKnowledgeBase: false, recordCalls: true,
    } as any).block as any;

    expect(voix.chunkPlan.minCharacters).toBe(137);
    // `speed` n'existe que sur le bloc ElevenLabs: Cartesia refuse le champ.
    if (voix.provider === '11labs') expect(voix.speed).toBe(1.15);
  });
});
