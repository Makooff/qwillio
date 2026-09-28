import { describe, it, expect } from 'vitest';
import { estQuotaEpuise, quotaEpuiseBehaviour, QuotaEpuiseError, retryDelayMs } from '../run-evals';

/**
 * Un 429 de débit et un 429 de crédit épuisé portent le même code HTTP et
 * demandent deux conduites opposées: le premier s'attend, le second ne
 * s'attendra jamais. Confondus, le second a peint `0/20 scénarios verts` sur
 * une PR le 28/09/2026 — le visage d'une régression totale du prompt, pour un
 * compte OpenAI à recharger.
 *
 * Ces tests fixent la frontière, et surtout le fait qu'un run NON EXÉCUTÉ se
 * dit au lieu de se colorier en rouge: rouge doit continuer à vouloir dire
 * « le réceptionniste s'est mis à mal répondre ».
 */
describe('estQuotaEpuise', () => {
  it('reconnaît le corps qu’OpenAI renvoie quand le crédit est à zéro', () => {
    const corps = JSON.stringify({
      error: {
        message: 'You have no credits remaining. Add credits to continue using the API',
        type: 'insufficient_quota',
        code: 'credit_balance_exhausted',
      },
    });
    expect(estQuotaEpuise(corps)).toBe(true);
  });

  it('reconnaît aussi la limite de facturation dure', () => {
    expect(estQuotaEpuise('{"error":{"code":"billing_hard_limit_reached"}}')).toBe(true);
  });

  it('ne confond PAS un débit ordinaire avec un crédit épuisé', () => {
    // Le débit porte un délai: c'est OpenAI qui dit quand revenir, donc il y a
    // quelque chose à attendre. Le prendre pour une facture impayée ferait
    // abandonner un run qui n'avait qu'à patienter une seconde.
    const debit = 'Rate limit reached for gpt-4o. Please try again in 1.454s.';
    expect(estQuotaEpuise(debit)).toBe(false);
    expect(retryDelayMs(debit)).toBeGreaterThan(0);
  });

  it('ne se laisse pas avoir par un corps vide', () => {
    expect(estQuotaEpuise('')).toBe(false);
  });
});

describe('QuotaEpuiseError', () => {
  it('se reconnaît par instanceof, ce dont dépend l’arrêt du run', () => {
    const e = new QuotaEpuiseError('{"error":{"type":"insufficient_quota"}}');
    expect(e).toBeInstanceOf(QuotaEpuiseError);
    expect(e).toBeInstanceOf(Error);
    expect(e.quotaEpuise).toBe(true);
  });

  it('garde un extrait du corps, pour que le message dise de quoi il parle', () => {
    expect(new QuotaEpuiseError('no credits remaining').message).toContain('no credits remaining');
  });
});

describe('quotaEpuiseBehaviour', () => {
  it('émet une annotation GitHub en CI, pas un log qui se perd', () => {
    expect(quotaEpuiseBehaviour({ isCI: true }).startsWith('::warning::')).toBe(true);
  });

  it('reste lisible en local', () => {
    expect(quotaEpuiseBehaviour({ isCI: false }).startsWith('[evals]')).toBe(true);
  });

  it('dit que rien n’a été exécuté ET que ce n’est pas une régression', () => {
    for (const isCI of [true, false]) {
      const m = quotaEpuiseBehaviour({ isCI });
      expect(m).toMatch(/NON EXÉCUTÉES/);
      expect(m).toContain('ne prouve rien');
      expect(m).toContain("n'est pas un signal de régression");
    }
  });
});
