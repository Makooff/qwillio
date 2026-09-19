import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { voiceModeFor } from '../voice-tiers';

/**
 * UNE règle décide du moteur, et tout le monde la lit.
 *
 * Le niveau (`voiceTier`) n'a de valeur que s'il atteint TOUS les chemins qui
 * font parler l'agent. Il y en a cinq, et ils n'échouent pas ensemble:
 *
 *   - l'assistant ENREGISTRÉ (les deux écritures de `onboarding.service.ts`),
 *     qui décroche sur une ligne DÉDIÉE;
 *   - l'assistant bâti à l'appel (`realtime-orchestrator`), qui décroche sur
 *     la ligne PARTAGÉE des essais;
 *   - l'appel test du portail et le diagnostic en direct;
 *   - le banc d'essai admin.
 *
 * Lire `profile.voiceMode` directement, c'est faire marcher le niveau sur un
 * chemin et pas sur l'autre. Ce dépôt a déjà payé six fois cette forme exacte
 * (famille 6quindecies): un réglage qui s'enregistre, un écran qui dit
 * enregistré, et un appelant qui entend autre chose. `voiceModeFor` fait primer
 * le niveau et garde l'ancien réglage en repli; c'est la seule lecture.
 */
const FILES = [
  'services/voice/realtime-orchestrator.service.ts',
  'services/onboarding.service.ts',
  'controllers/client-dashboard.controller.ts',
  'controllers/voice-lab.controller.ts',
];

/* Les commentaires d'abord: celui posé au-dessus d'un correctif nomme
   forcément la forme fautive, et le test tomberait sur son explication. */
const source = (rel: string) =>
  readFileSync(join(__dirname, '../../..', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('le moteur se lit par une seule règle', () => {
  it.each(FILES)('%s ne lit pas `profile.voiceMode` à la main', rel => {
    expect(source(rel)).not.toMatch(/voiceMode:\s*profile\.voiceMode/);
  });

  it('la règle elle-même est la seule à lire le champ historique', () => {
    // `voice-tiers.ts` a le droit, et lui seul: c'est là que le repli vit.
    expect(source('services/voice/voice-tiers.ts')).toMatch(/profile\.voiceMode/);
  });
});

/**
 * LE DROIT SE CONTRÔLE AUSSI QUAND PERSONNE N'A RIEN CHOISI (19/09/2026).
 *
 * `entitledTier` ne borne que ce qui a été demandé. Sans choix, il rend `null`,
 * le contrôle ne s'exécute pas, et le mode retombait sur `auto`, c'est-à-dire
 * sur un réglage de plateforme qui ne sait rien des forfaits. Le jour où
 * `VOICE_SPEECH_TO_SPEECH` passe à `on`, tout Solo et tout Starter qui n'a
 * jamais touché le réglage bascule sur une minute dix fois plus chère.
 */
describe('le droit borne aussi le defaut', () => {
  it('un client sans droit et sans choix est classique, pas auto', () => {
    expect(voiceModeFor({ superagentAllowed: false })).toBe('classic');
  });

  it('un client AVEC droit et sans choix reste auto: le reglage global decide', () => {
    expect(voiceModeFor({ superagentAllowed: true })).toBe('auto');
  });

  /* `undefined` veut dire « pas de contrôle », et c'est voulu: `voice:validate`
     doit pouvoir soumettre les six variantes, le banc d'essai admin aussi. */
  it("un droit ABSENT n'est pas un droit refuse", () => {
    expect(voiceModeFor({})).toBe('auto');
  });

  it('un choix explicite reste borne par le droit, comme avant', () => {
    expect(voiceModeFor({ voiceTier: 'superagent', superagentAllowed: false })).toBe('classic');
    expect(voiceModeFor({ voiceTier: 'superagent', superagentAllowed: true })).toBe('realtime');
  });
});
