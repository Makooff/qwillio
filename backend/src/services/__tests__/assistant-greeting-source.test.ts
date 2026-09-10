import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Le source sans ses commentaires: ce test parle du CODE, pas de la prose. */
const read = (rel: string) =>
  readFileSync(join(process.cwd(), 'src', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * L'accueil pré-enregistré atteint l'assistant qui décroche, sans ouvrir de
 * fenêtre de silence (LAT-7).
 */
describe('l\'accueil de l\'assistant enregistré', () => {
  const onboarding = read('services/onboarding.service.ts');

  it('vient du constructeur qui sait servir l\'audio déjà fabriqué', () => {
    expect(onboarding).toMatch(/assistantFirstMessage\(/);
    expect(onboarding).toMatch(/greetingAudioService\.available/);
    expect(onboarding).toMatch(/firstMessageVariants/);
  });

  it('n\'écrit plus la phrase à la main dans la charge envoyée', () => {
    const inline = onboarding.match(/firstMessage:\s*this\.generateFirstMessage/g) ?? [];
    expect(inline.length).toBe(0);
  });

  it('refait les accueils AVANT de lire leur URL, et les attend', () => {
    /* L'ordre est tout: la synchronisation efface ces lignes pour les refaire.
       Épingler l'URL puis effacer ouvrirait une fenêtre où chaque appel
       s'ouvre sur un 404, c'est-à-dire sur du silence — bien plus cher que la
       latence qu'on économise. */
    const invalidate = onboarding.search(/greetingAudioService\.invalidate\(client\.id\)/);
    const regenerate = onboarding.search(/await this\.regenerateGreetings\(client\.id\)/);
    const readUrl = onboarding.search(/const firstMessage = await this\.assistantFirstMessage/);
    expect(invalidate).toBeGreaterThan(-1);
    expect(regenerate).toBeGreaterThan(invalidate);
    expect(readUrl).toBeGreaterThan(regenerate);
  });

  it('n\'efface plus les accueils APRÈS l\'envoi', () => {
    // Ce serait rouvrir la même fenêtre, une ligne plus bas.
    const update = onboarding.search(/vapiClient\.updateAssistant\(client\.vapiAssistantId/);
    const after = onboarding.slice(update);
    expect(after).not.toMatch(/greetingAudioService\.invalidate/);
  });

  it('garde la régénération attendue, jamais en tâche de fond ici', () => {
    // `void this.regenerateGreetings(client.id)` rendrait l'URL épinglée
    // valable « bientôt », ce qui ne veut rien dire pour l'appel en cours.
    expect(onboarding).not.toMatch(/void this\.regenerateGreetings\(client\.id\)/);
  });
});
