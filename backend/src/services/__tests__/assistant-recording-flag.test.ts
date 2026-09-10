import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) =>
  readFileSync(join(process.cwd(), 'src', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * On n'enregistre jamais quelqu'un qui n'a pas été prévenu (LEG-2 / LEG-5).
 *
 * Deux drapeaux ont coexisté. Le portail écrit `recordCalls`; le profil honore
 * `recordCalls` ET l'historique `disableRecordingNotice`, et c'est le profil
 * qui décide de la notice dans l'accueil. L'assistant ENREGISTRÉ, lui, ne lisait
 * que l'historique. Un client qui coupait l'enregistrement voyait donc la notice
 * disparaître de son accueil pendant que son assistant continuait d'enregistrer.
 */
describe('le drapeau d\'enregistrement de l\'assistant qui décroche', () => {
  const onboarding = read('services/onboarding.service.ts');

  it('prend la même décision que l\'accueil, par le profil', () => {
    expect(onboarding).toMatch(/shouldRecord\(profile\)/);
    expect(onboarding).toMatch(/recordingEnabled:\s*speech\?\.recording/);
  });

  it('ne décide plus sur le seul drapeau historique', () => {
    // `disableRecordingNotice !== true` reste en REPLI, quand le profil est
    // illisible, jamais comme seule règle.
    const soleRule = onboarding.match(/recordingEnabled:\s*\(\(client\?\.vapiConfig as any\)\?\.disableRecordingNotice/g) ?? [];
    expect(soleRule.length).toBe(0);
  });

  it('voyage aussi à la SYNCHRONISATION, pas seulement à l\'inscription', () => {
    // Il n'y figurait pas du tout: le réglage était posé à l'inscription et
    // plus jamais relu, donc le couper dans le portail ne coupait rien.
    const sync = onboarding.slice(onboarding.search(/const updatedConfig/));
    expect(sync).toMatch(/recordingEnabled:/);
  });

  it('penche vers l\'enregistrement quand le profil est illisible', () => {
    // Le doute ne doit pas produire un appel muet côté preuve; il ne produit
    // jamais non plus un enregistrement caché, puisque l'accueil suit la même
    // source et annoncera la notice.
    expect(onboarding).toMatch(/syncSpeech\?\.recording\s*\?\?\s*true/);
  });
});
