import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * L'assistant ENREGISTRÉ reçoit un gabarit de date, jamais une date réelle.
 *
 * Son prompt est figé à la synchronisation: une date réelle y serait fausse
 * dès le lendemain, et « la semaine prochaine » se compterait depuis le jour
 * de la dernière sauvegarde. Vapi remplit `{{"now" | date: …}}` à chaque
 * appel. Le test lit le source, commentaires retirés (6vicies).
 */
const SRC = readFileSync(join(__dirname, '..', 'onboarding.service.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('assistantPrompt — la date de l\'assistant enregistré', () => {
  it('passe le gabarit Vapi à buildSystemPrompt', () => {
    expect(SRC).toMatch(/vapiClockLine\(profile\.language,\s*profile\.timezone\)/);
    expect(SRC).toMatch(/clock:\s*vapiClockLine\(/);
  });

  it('ne fige jamais une date réelle', () => {
    expect(SRC).not.toMatch(/clock:\s*clockLine\(/);
  });
});
