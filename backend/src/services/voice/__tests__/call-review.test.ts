import { afterEach, describe, expect, it, vi } from 'vitest';
import { reviewCall, reviewModel } from '../call-review';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const scope = { tenant_id: '11111111-1111-4111-8111-111111111111', niche: 'restaurant', country: 'BE', language: 'fr' };
describe('revue comportementale réelle au bord HTTP', () => {
  it('refuse un modèle absent plutôt que choisir un petit modèle', () => {
    vi.stubEnv('LEARNING_MODEL', ''); vi.stubEnv('CALL_REVIEW_MODEL', '');
    expect(() => reviewModel()).toThrow();
  });
  it('omet temperature pour GPT6 et conserve le modèle réellement servi et le vide valide', async () => {
    vi.stubEnv('CALL_REVIEW_MODEL', 'gpt-6-fixture');
    vi.stubEnv('LEARNING_MODEL', '');
    vi.stubEnv('CALL_REVIEW_MODEL_SNAPSHOTS', 'gpt-6-fixture-snapshot');
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ model: 'gpt-6-fixture-snapshot', choices: [{ message: { content: JSON.stringify({ learningBehaviour: { schema_version: 1, observations: [] }, patterns: [] }) } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const result = await reviewCall('fixture-key', 'Agent: Bonjour.', scope);
    const body = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
    expect(body.model).toBe('gpt-6-fixture');
    expect(body).not.toHaveProperty('temperature');
    expect(result.review).toMatchObject({ status: 'succeeded', requestedModel: 'gpt-6-fixture', actualModel: 'gpt-6-fixture-snapshot' });
    expect(result.evidence.behaviour.observations).toEqual([]);
  });
  it('accepte l’identité exacte servie sans snapshot autorisé supplémentaire', async () => {
    vi.stubEnv('CALL_REVIEW_MODEL', 'gpt-6-fixture');
    vi.stubEnv('LEARNING_MODEL', '');
    vi.stubEnv('CALL_REVIEW_MODEL_SNAPSHOTS', '');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ model: 'gpt-6-fixture', choices: [{ message: { content: JSON.stringify({ learningBehaviour: { schema_version: 1, observations: [] }, patterns: [] }) } }] }), { status: 200 })));
    await expect(reviewCall('fixture-key', 'Agent: Bonjour.', scope)).resolves.toMatchObject({ review: expect.objectContaining({ actualModel: 'gpt-6-fixture' }) });
  });
  it('refuse un modèle servi hors politique (snapshot non autorisé ou autre famille)', async () => {
    vi.stubEnv('CALL_REVIEW_MODEL', 'gpt-6-fixture');
    vi.stubEnv('LEARNING_MODEL', '');
    vi.stubEnv('CALL_REVIEW_MODEL_SNAPSHOTS', '');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ model: 'gpt-6-fixture-snapshot', choices: [{ message: { content: JSON.stringify({ learningBehaviour: { schema_version: 1, observations: [] }, patterns: [] }) } }] }), { status: 200 })));
    await expect(reviewCall('fixture-key', 'Agent: Bonjour.', scope)).rejects.toThrow('hors politique');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ model: 'gpt-5-mini', choices: [{ message: { content: JSON.stringify({ learningBehaviour: { schema_version: 1, observations: [] }, patterns: [] }) } }] }), { status: 200 })));
    await expect(reviewCall('fixture-key', 'Agent: Bonjour.', scope)).rejects.toThrow('inattendue');
  });
  it('ne transforme pas un refus fournisseur en résultat vide', async () => {
    vi.stubEnv('CALL_REVIEW_MODEL', 'gpt-6-fixture'); vi.stubEnv('LEARNING_MODEL', '');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    await expect(reviewCall('fixture-key', 'Agent: Bonjour.', scope)).rejects.toThrow('429');
  });
});
