import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le sélecteur du portail ne montre que les voix Cartesia retenues.
 *
 * « Il y a toutes les voix. Par contre, il y a des voix québécoises, enlève-les. »
 * (12/09/2026). Le tri se fait ICI, dans la liste servie au portail, et pas
 * dans le client Cartesia: `cartesiaChoice` et la synthèse doivent continuer
 * d'accepter n'importe quel identifiant, sinon une voix retirée de la liste
 * casserait l'appel du client qui l'avait déjà choisie.
 */
const { envMock } = vi.hoisted(() => ({ envMock: { ELEVENLABS_API_KEY: '', VOICE_TTS_PROVIDER: 'cartesia' } }));
vi.mock('../../../config/env', () => ({ env: envMock }));
vi.mock('../../../config/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn() } }));

const listCartesiaVoices = vi.fn();
vi.mock('../cartesia.service', () => ({
  listCartesiaVoices: (...a: unknown[]) => listCartesiaVoices(...a),
}));

const { voiceCatalogService } = await import('../voice-catalog.service');
const { CARTESIA_CURATED } = await import('../../../config/cartesia-curated');

const KEPT = CARTESIA_CURATED.fr![0];
const voice = (voiceId: string, name: string, language = 'fr') => ({
  voiceId, name, language, description: null, gender: 'female' as const,
});

describe('catalogue Cartesia trié', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    voiceCatalogService.invalidate();
  });

  it('écarte les voix « fr » hors de la liste retenue', async () => {
    listCartesiaVoices.mockResolvedValue([
      voice(KEPT.voiceId, KEPT.name),
      voice('11111111-1111-4111-8111-111111111111', 'Marie-Eve - Team Mentor'),
    ]);
    const ids = (await voiceCatalogService.list(undefined, 'fr', 'cartesia')).map(v => v.voiceId);
    expect(ids).toEqual([KEPT.voiceId]);
  });

  it('sert tout pour une langue qui n\'a pas de liste', async () => {
    listCartesiaVoices.mockResolvedValue([
      voice('22222222-2222-4222-8222-222222222222', 'Skylar - Friendly Guide', 'en'),
    ]);
    const ids = (await voiceCatalogService.list(undefined, 'en', 'cartesia')).map(v => v.voiceId);
    expect(ids).toEqual(['22222222-2222-4222-8222-222222222222']);
  });
});
