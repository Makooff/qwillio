import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Le source sans ses commentaires: ce test parle du CODE, pas de la prose. */
const read = (rel: string) =>
  readFileSync(join(process.cwd(), 'src', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Un seul constructeur de prompt atteint l'assistant qui décroche.
 *
 * Deux coexistaient. `buildSystemPrompt` porte le vouvoiement, le glossaire
 * belge, les champs nommés du métier, le repli clavier et la discipline de
 * transfert — et c'est celui que le harnais d'évals mesure.
 * `generateClientSystemPrompt` est un texte hérité qui ne porte rien de cela,
 * et c'était LUI que recevait l'assistant enregistré, le seul qui réponde à un
 * appel entrant. Tout ce qui était écrit dans le premier partait dans le vide.
 */
describe('le prompt de l\'assistant qui décroche', () => {
  const onboarding = read('services/onboarding.service.ts');

  it('vient du constructeur que les évals mesurent', () => {
    expect(onboarding).toMatch(/buildSystemPrompt\(/);
  });

  it('n\'est plus posé directement par le constructeur hérité', () => {
    // L'ancien reste appelé, mais seulement depuis `assistantPrompt`, en repli
    // quand le profil est illisible: un assistant avec un prompt hérité vaut
    // mieux qu'un assistant sans prompt.
    const direct = onboarding.match(/systemPrompt\s*=\s*this\.generateClientSystemPrompt/g) ?? [];
    expect(direct.length).toBe(0);
  });

  it('est construit APRÈS la purge du cache, sur les deux écritures', () => {
    // Bâti avant, il décrirait la configuration d'avant l'enregistrement, et
    // le client devrait sauver deux fois pour que sa réponse prenne effet.
    for (const [tools, prompt] of [
      [/const tools = await this\.buildAssistantTools/, /const systemPrompt = await this\.assistantPrompt/],
      [/const syncTools = await this\.buildAssistantTools/, /const systemPrompt = await this\.assistantPrompt\(client\.id/],
    ] as const) {
      const t = onboarding.search(tools);
      const p = onboarding.slice(t).search(prompt);
      expect(t).toBeGreaterThan(-1);
      expect(p).toBeGreaterThan(-1);
    }
  });

  it('lit les DEUX magasins de connaissance, comme à l\'appel', () => {
    // Les champs nommés vivent dans `vapiConfig.knowledge`, la FAQ dans la
    // table. Le prompt de l'appel lit les deux; celui-ci le doit aussi, sinon
    // le client remplit un champ et l'agent répond qu'il ne sait pas.
    expect(onboarding).toMatch(/knowledgeFields/);
    expect(onboarding).toMatch(/businessMemoryService/);
  });
});
