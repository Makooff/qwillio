import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

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
