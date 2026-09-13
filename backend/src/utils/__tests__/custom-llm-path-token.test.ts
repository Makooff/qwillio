import { describe, it, expect } from 'vitest';
import { customLlmPathToken, isCustomLlmAuthorized } from '../vapi-webhook-auth';

/** Premier appel réel sur un assistant enregistré en custom-LLM (13/09): raccroché après l'accueil. */
describe('le point de terminaison custom-LLM accepte le secret en en-tête OU en jeton de chemin', () => {
  const secret = 'top-secret';
  const token = customLlmPathToken('c1', secret)!;
  const req = (params: Record<string, string>, headers: Record<string, string> = {}) => ({ params, headers }) as never;

  it('dérive un jeton par client, stable, sans secret dedans', () => {
    expect(token).toHaveLength(32);
    expect(token).toBe(customLlmPathToken('c1', secret));
    expect(token).not.toBe(customLlmPathToken('c2', secret));
    expect(token).not.toContain(secret);
    expect(customLlmPathToken('c1', '')).toBeNull();
  });

  it('accepte l\'en-tête seul', () => {
    expect(isCustomLlmAuthorized(req({ clientId: 'c1' }, { 'x-vapi-secret': secret }), 'c1', secret)).toBe(true);
  });

  it('accepte le bon jeton de chemin sans en-tête', () => {
    expect(isCustomLlmAuthorized(req({ clientId: 'c1', token }), 'c1', secret)).toBe(true);
  });

  it('refuse un jeton d\'un autre client, un jeton tronqué, et l\'absence des deux', () => {
    expect(isCustomLlmAuthorized(req({ clientId: 'c1', token: customLlmPathToken('c2', secret)! }), 'c1', secret)).toBe(false);
    expect(isCustomLlmAuthorized(req({ clientId: 'c1', token: token.slice(0, 31) }), 'c1', secret)).toBe(false);
    expect(isCustomLlmAuthorized(req({ clientId: 'c1' }), 'c1', secret)).toBe(false);
  });
});
