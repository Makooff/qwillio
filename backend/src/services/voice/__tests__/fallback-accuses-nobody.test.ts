import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * UNE PHRASE DE REPLI N'AFFIRME PAS UNE CAUSE QU'ELLE NE CONNAÎT PAS.
 *
 * Elle disait « Pardon, je vous ai mal entendu. Vous pouvez répéter ? », ce qui
 * affirme que l'appelant a parlé, et mal. Appel réel du 21/09/2026, et
 * l'appelant a corrigé lui-même: « Non, je n'ai rien dit. » La vraie cause
 * était notre délai — le premier jeton d'OpenAI a dépassé le seuil d'abandon.
 *
 * C'est la leçon des phrases d'attente d'un cran plus haut (6sexquadragesies):
 * une phrase de démarrage ne dit pas son ISSUE, une phrase de repli ne dit pas
 * sa CAUSE. Ici le mensonge fait douter l'appelant de sa propre diction et le
 * fait répéter quelque chose qu'il n'a jamais dit.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const fallbackLines = () => {
  const src = stripComments(readFileSync(join(__dirname, '../llm-stream.service.ts'), 'utf8'));
  const body = src.slice(src.indexOf('private fallbackLine('));
  return body.slice(0, body.indexOf('\n  }'));
};

describe('la phrase de repli', () => {
  it("n'accuse plus l'appelant d'avoir mal parlé", () => {
    /* Les trois formes fautives, une par langue: chacune affirme que l'appelant
       a parlé et que nous l'avons mal reçu. */
    const body = fallbackLines();
    expect(body).not.toMatch(/mal entendu/i);
    expect(body).not.toMatch(/did not catch/i);
    expect(body).not.toMatch(/niet goed verstaan/i);
  });

  it("ne lui demande plus de RÉPÉTER ce qu'il n'a peut-être pas dit", () => {
    const body = fallbackLines();
    expect(body).not.toMatch(/répéter/i);
    expect(body).not.toMatch(/say it again/i);
    expect(body).not.toMatch(/herhalen/i);
  });

  it('existe toujours dans les TROIS langues, et ne descend pas au silence', () => {
    /* Un appelant flamand qui s'entend répondre en anglais au moment précis où
       quelque chose vient de rater, c'est le défaut que ce repli évitait déjà.
       Et un blanc se lirait comme une ligne coupée: il faut une phrase. */
    const body = fallbackLines();
    for (const lang of ["'fr'", "'nl'"]) expect(body).toContain(lang);
    const said = [...body.matchAll(/return '([^']+)'/g)].map(m => m[1]);
    expect(said).toHaveLength(3);
    for (const s of said) expect(s.trim().length).toBeGreaterThan(5);
  });

  it('ne nomme aucune panne technique', () => {
    /* Règle d'origine, qui tient: l'appelant n'a pas à connaître nos pannes. */
    const body = fallbackLines();
    expect(body).not.toMatch(/erreur|error|technique|technical|problème|probleem/i);
  });
});
