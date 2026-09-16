import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { retryDelayMs } from '../run-evals';

/**
 * Un refus de DÉBIT n'est pas un verdict d'éval (16/09/2026).
 *
 * CI rouge sur huit scénarios, tous en « OpenAI responded 429 ... tokens per
 * min (TPM): Limit 30000 », sans qu'une seule assertion ait parlé: la CI de
 * master et celle d'une PR ont joué les évals dans la même minute, sur la même
 * organisation. Les scénarios tournent déjà en série; la limite étant par
 * organisation, la sérialisation ne peut rien. On attend ce qu'OpenAI DIT
 * d'attendre, dans le corps de son refus.
 */

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('retryDelayMs', () => {
  it('lit les secondes que le refus annonce, avec une marge', () => {
    expect(retryDelayMs('Rate limit reached ... Please try again in 1.454s. Visit ...')).toBe(1704);
  });

  it('lit aussi la forme en millisecondes', () => {
    expect(retryDelayMs('Please try again in 792ms.')).toBe(1042);
  });

  it('sans délai lisible, attend une seconde plutôt que de deviner', () => {
    expect(retryDelayMs('{"error":{"type":"tokens"}}')).toBe(1000);
    expect(retryDelayMs('')).toBe(1000);
  });

  it('ne dort jamais plus de dix secondes, quoi que dise le corps', () => {
    expect(retryDelayMs('Please try again in 600s.')).toBe(10_000);
  });
});

describe('le harnais réessaie un 429, et lui seul', () => {
  const src = stripComments(readFileSync(join(__dirname, '../run-evals.ts'), 'utf8'));

  it('la boucle ne se répète que sur 429', () => {
    expect(src).toMatch(/response\.status !== 429 \|\| attempt >= EVAL_RATE_LIMIT_RETRIES/);
  });

  it('attend le délai lu dans le corps, jamais une constante choisie ici', () => {
    expect(src).toMatch(/sleep\(retryDelayMs\(await response\.text\(\)/);
  });

  it('les scénarios restent joués en série: la limite est par organisation', () => {
    expect(src).not.toMatch(/Promise\.all\(\s*scenarios/);
    expect(src).toMatch(/for \(const scenario of scenarios\)/);
  });
});
