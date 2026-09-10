import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * La spéculation d'agenda doit partir sur les transcriptions PARTIELLES.
 *
 * L'orchestrateur commençait par `if (!isFinal) return null`, donc la lecture
 * Google ne partait qu'au silence de fin de tour — c'est-à-dire au moment
 * précis où le modèle allait de toute façon la demander. Tout le temps de
 * parole restant était jeté, et le module de spéculation ne gagnait rien de ce
 * pour quoi il avait été écrit.
 *
 * Le test lit le SOURCE, faute d'un harnais capable d'instancier
 * l'orchestrateur. Il retire d'abord les commentaires: celui qui explique ce
 * correctif nomme forcément la forme fautive, et le test tomberait sur sa
 * propre explication.
 */

function sourceWithoutComments(file: string): string {
  return readFileSync(join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Le corps de la branche « partielle », accolades appariées. */
function partialBranch(source: string): string {
  const start = source.indexOf('if (!isFinal) {');
  if (start < 0) return '';
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  return '';
}

describe('spéculation sur transcription partielle', () => {
  const source = sourceWithoutComments('realtime-orchestrator.service.ts');

  it('ne rejette plus la partielle avant d\'avoir regardé la date', () => {
    /* La forme fautive exacte: un seul `return` qui emportait les deux cas. */
    expect(source).not.toMatch(/if\s*\(\s*!isFinal\s*\|\|/);
    expect(partialBranch(source)).not.toBe('');
  });

  it('lance la lecture d\'agenda depuis la branche partielle', () => {
    const branch = partialBranch(source);
    expect(branch).toContain('detectDate');
    expect(branch).toContain('availabilitySpeculator.speculate');
  });

  it('ne fait RIEN d\'autre sur une partielle', () => {
    /* Une partielle se réécrit au mot suivant. Un tour compté deux fois, une
       humeur assise sur une demi-phrase ou une marque de latence posée trop
       tôt seraient des données FAUSSES, pas des données précoces. Seule la
       lecture d'agenda peut se tromper sans conséquence: elle ne fait que
       lire. */
    const branch = partialBranch(source);
    for (const forbidden of [
      'appendTranscript',
      'assessMood',
      'setMood',
      'markLatency',
      'routeIntent',
      'recordDeflection',
    ]) {
      expect(branch).not.toContain(forbidden);
    }
  });

  it('ne spécule que sur la parole de l\'APPELANT', () => {
    /* L'agent qui prononce « mardi » dans sa propre réponse ne demande rien. */
    expect(partialBranch(source)).toContain("role === 'user'");
  });
});
