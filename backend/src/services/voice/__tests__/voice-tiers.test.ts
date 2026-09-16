import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { requestedTier, servedTier, tuningFor, voiceModeFor, VOICE_TIERS } from '../voice-tiers';
import { assistantSpeechForProfile, voiceForProfile } from '../profile-voice';
import type { ClientVoiceProfile } from '../realtime-context.service';

/**
 * DEUX niveaux, et le seul défaut qui compte: que le niveau choisi n'atteigne
 * pas l'assistant qui décroche.
 *
 * C'est arrivé, et pas une fois: les deux écritures de `onboarding.service.ts`
 * posaient `buildRealtimePlans(lang, false, …)`, un `false` écrit en dur. Un
 * client réglé en parole-à-parole gardait donc la chaîne classique tant qu'il
 * avait une ligne DÉDIÉE, c'est-à-dire dès qu'il payait. Le réglage
 * s'enregistrait, l'écran disait enregistré, et l'appelant entendait l'autre
 * moteur. Septième trou de la famille 6quindecies.
 */

const profile = (over: Partial<ClientVoiceProfile> = {}): ClientVoiceProfile => ({
  language: 'fr',
  characterId: null,
  customVoice: null,
  country: 'BE',
  customLlm: true,
  voiceMode: 'auto',
  voiceTier: null,
  ...over,
} as ClientVoiceProfile);

describe('la résolution du niveau', () => {
  it('fait primer le niveau CHOISI sur le réglage historique', () => {
    expect(requestedTier({ voiceTier: 'superagent', voiceMode: 'classic' })).toBe('superagent');
    expect(requestedTier({ voiceTier: 'base', voiceMode: 'realtime' })).toBe('base');
  });

  it('lit l\'ancien réglage en repli, au MÊME endroit que le nouveau', () => {
    // La leçon de 6duovicies: deux drapeaux pour la même chose divergent dès
    // qu'ils sont lus à deux endroits.
    expect(requestedTier({ voiceMode: 'realtime' })).toBe('superagent');
    expect(requestedTier({ voiceMode: 'classic' })).toBe('base');
  });

  it('tient une valeur inconnue pour « rien de choisi », jamais pour un niveau', () => {
    expect(requestedTier({ voiceTier: 'SUPERAGENT' as any })).toBeNull();
    expect(requestedTier({ voiceTier: 'premium' as any })).toBeNull();
    expect(requestedTier({})).toBeNull();
    // Rien de choisi: le réglage global décide, comme avant l'existence des niveaux.
    expect(voiceModeFor({})).toBe('auto');
  });

  it('ne change RIEN quand le niveau de base est choisi', () => {
    /* La garantie qui fait que nommer la chaîne existante ne la modifie pas:
       un `tuning` vide vaut « les valeurs de l'environnement ». Si `base`
       posait ses propres curseurs, « base » ne serait plus ce qui tourne
       aujourd'hui, et la comparaison des deux niveaux ne mesurerait plus rien. */
    expect(VOICE_TIERS.base.tuning).toEqual({});
    expect(tuningFor({ voiceTier: 'base' })).toEqual({});
    expect(voiceModeFor({ voiceTier: 'base' })).toBe('classic');
  });

  it('nomme le modèle du superagent au lieu de le laisser deviner', () => {
    expect(voiceModeFor({ voiceTier: 'superagent' })).toBe('realtime');
    expect(tuningFor({ voiceTier: 'superagent' }).realtimeModel).toBeTruthy();
  });

  it('distingue le niveau DEMANDÉ du niveau SERVI', () => {
    expect(servedTier(true).id).toBe('superagent');
    expect(servedTier(false).id).toBe('base');
  });
});

describe('le niveau atteint l\'assistant ENREGISTRÉ', () => {
  const blocks = (p: ClientVoiceProfile) =>
    assistantSpeechForProfile(p, { clientId: 'cl_1', systemPrompt: 'p', tools: [], temperature: 0.7 });

  it('pose le couple parole-à-parole quand le client est en superagent', () => {
    const { model, voice, speechToSpeech, tier } = blocks(profile({ voiceTier: 'superagent' }));
    expect(speechToSpeech).toBe(true);
    expect(tier.id).toBe('superagent');
    // OpenAI tient la boucle en audio: un `custom-llm` n'aurait rien à intercepter.
    expect(model.provider).toBe('openai');
    expect(model.model).toMatch(/realtime/);
    expect(voice.provider).toBe('openai');
  });

  it('laisse le niveau de base sur custom-LLM, sans rien déplacer', () => {
    const { model, speechToSpeech, tier } = blocks(profile({ voiceTier: 'base' }));
    expect(speechToSpeech).toBe(false);
    expect(tier.id).toBe('base');
    expect(model.provider).toBe('custom-llm');
    // Les outils vivent DANS le modèle: la racine les refuse (6novodecies).
    expect(model).toHaveProperty('tools');
  });

  it('laisse une voix CLONÉE primer sur le niveau demandé', () => {
    /* Un client qui a enregistré SA voix est venu chercher cette voix-là. La
       remplacer par celle d'OpenAI n'est pas une montée en gamme, c'est la
       perte de ce qu'il a payé. La règle vit dans `useSpeechToSpeech`, et le
       niveau ne la contourne pas. */
    const cloned = profile({
      voiceTier: 'superagent',
      characterId: 'custom',
      customVoice: { voiceId: 'cl_abc', provider: 'cartesia', cloned: true } as any,
    });
    const resolved = voiceForProfile(cloned);
    expect(resolved.speechToSpeech).toBe(false);
    expect(resolved.tier.id).toBe('base');
    // Et le niveau DEMANDÉ reste superagent: c'est cet écart qu'il faut afficher.
    expect(requestedTier(cloned)).toBe('superagent');
  });
});

describe('les deux écritures de l\'assistant enregistré', () => {
  /* Un test qui lit le SOURCE retire d'abord les commentaires: celui posé
     au-dessus du correctif nomme forcément la forme fautive, donc le test
     tomberait sur sa propre explication (leçon de 6vicies). */
  const CODE = readFileSync(join(__dirname, '../../onboarding.service.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('ne fige plus le moteur en classique', () => {
    const figé = /buildRealtimePlans\(\s*[A-Za-z0-9_.]+\s*,\s*false\b/;
    expect(CODE).not.toMatch(figé);
  });

  it('passe par l\'assembleur partagé, dans les DEUX écritures', () => {
    // Une seule occurrence voudrait dire qu'un des deux chemins a été oublié,
    // ce qui est exactement la forme du défaut qu'on corrige.
    const appels = CODE.match(/assistantSpeechForProfile\(/g) ?? [];
    expect(appels.length).toBeGreaterThanOrEqual(2);
  });
});
