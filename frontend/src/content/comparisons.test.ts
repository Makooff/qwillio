import { describe, expect, it } from 'vitest';
import { COMPARISON_PAGES } from './comparisons';

describe('Smith.ai comparison — human handoff', () => {
  it.each([
    ['fr', 'Relais humain sur appel complexe', 'Oui, vers votre équipe (si configuré)', 'votre propre équipe'],
    ['en', 'Human backup on tricky calls', 'Yes, to your team (when configured)', 'your own team'],
  ] as const)('does not confuse team transfers with outsourced receptionists in %s', (lang, label, value, team) => {
    const comparison = COMPARISON_PAGES.find(page => page.slug === 'smith-ai')!;
    const blocks = comparison.content[lang];
    const rows = blocks.flatMap(block => block.type === 'table' ? block.rows : []);
    expect(rows.find(row => row[0] === label)?.[2]).toBe(value);
    const paragraphs = blocks.flatMap(block => block.type === 'p' ? [block.text] : []).join('\n');
    expect(paragraphs).toContain(team);
    expect(JSON.stringify(blocks)).not.toMatch(/Non \(IA pure\)|No \(pure AI\)/);
  });
});
