import { describe, it, expect, vi, beforeEach } from 'vitest';

const { envMock } = vi.hoisted(() => ({ envMock: { ELEVENLABS_API_KEY: 'key-123' } }));
vi.mock('../../../config/env', () => ({ env: envMock }));
vi.mock('../../../config/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn() } }));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { toCatalogVoice, cloneBelongsTo, voiceCatalogService } = await import('../voice-catalog.service');

const raw = (over: Record<string, unknown> = {}) => ({
  voice_id: 'v_1',
  name: 'Camille',
  category: 'premade',
  preview_url: 'https://example.test/v_1.mp3',
  labels: { gender: 'female', accent: 'french', use_case: 'narration' },
  ...over,
});

describe('toCatalogVoice', () => {
  it('keeps the fields the picker needs to make a choice', () => {
    expect(toCatalogVoice(raw())).toEqual({
      voiceId: 'v_1',
      name: 'Camille',
      gender: 'female',
      accent: 'french',
      description: 'narration',
      previewUrl: 'https://example.test/v_1.mp3',
      cloned: false,
    });
  });

  it('rejects an entry without a usable voice id', () => {
    // An empty id would be sent to ElevenLabs on a live call. Dropping the row
    // costs one voice in a list; keeping it costs a silent agent.
    for (const bad of [null, undefined, 'string', 42, {}, { voice_id: '' }, { voice_id: 7 }]) {
      expect(toCatalogVoice(bad)).toBeNull();
    }
  });

  it('survives missing labels rather than throwing', () => {
    // ElevenLabs omits labels on some voices, and has changed this shape before.
    const v = toCatalogVoice(raw({ labels: undefined, preview_url: undefined }));
    expect(v).toMatchObject({ voiceId: 'v_1', gender: null, accent: null, previewUrl: null });
  });

  it('treats blank strings as absent', () => {
    const v = toCatalogVoice(raw({ labels: { gender: '   ', accent: '' } }));
    expect(v?.gender).toBeNull();
    expect(v?.accent).toBeNull();
  });

  it('names an unnamed voice instead of showing an empty row', () => {
    expect(toCatalogVoice(raw({ name: '' }))?.name).toBe('Sans nom');
  });

  it('marks cloned and professional voices as the account owner own', () => {
    // These are the ones the owner made deliberately; the list surfaces them
    // first so a library of stock voices does not bury them.
    expect(toCatalogVoice(raw({ category: 'cloned' }))?.cloned).toBe(true);
    expect(toCatalogVoice(raw({ category: 'professional' }))?.cloned).toBe(true);
    expect(toCatalogVoice(raw({ category: 'premade' }))?.cloned).toBe(false);
  });

  it('falls back to a label when the voice carries no description', () => {
    expect(toCatalogVoice(raw({ description: undefined }))?.description).toBe('narration');
    expect(toCatalogVoice(raw({ description: 'Voix posée' }))?.description).toBe('Voix posée');
  });
});

/**
 * Le cloisonnement des clones.
 *
 * Le compte ElevenLabs est partagé par toute la flotte : sans ce tri, chaque
 * client voyait, et pouvait écouter, la voix enregistrée par les autres. Ce
 * n'est pas de l'encombrement, c'est la voix d'une personne servie à quelqu'un
 * d'autre, et c'est la raison d'être des tests qui suivent.
 */
describe('cloneBelongsTo', () => {
  it('reconnaît le préfixe posé par le clonage', () => {
    // `voice-clone.service` nomme « 45b6d8c7 — Ma voix ». Les huit premiers
    // caractères de l'identifiant sont la signature.
    expect(cloneBelongsTo('45b6d8c7 — Ma voix', '45b6d8c7-1111-2222-3333-444444444444')).toBe(true);
  });

  it("refuse le clone d'un autre client", () => {
    expect(cloneBelongsTo('99999999 — Ma voix', '45b6d8c7-1111-2222-3333-444444444444')).toBe(false);
  });

  it("exige l'espace qui suit le préfixe", () => {
    // Sans lui, `45b6d8c7` accepterait `45b6d8c7x`, et deux identifiants
    // voisins se verraient l'un l'autre.
    expect(cloneBelongsTo('45b6d8c7x — Ma voix', '45b6d8c7-1111-2222-3333-444444444444')).toBe(false);
  });
});

describe('list', () => {
  const remote = [
    raw({ voice_id: 'lib', name: 'Camille', category: 'premade' }),
    raw({ voice_id: 'mine', name: '45b6d8c7 — Ma voix', category: 'cloned' }),
    raw({ voice_id: 'theirs', name: '99999999 — Sa voix', category: 'cloned' }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    voiceCatalogService.invalidate();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ voices: remote }) });
  });

  it('ne sert au client que ses propres clones', async () => {
    const ids = (await voiceCatalogService.list('45b6d8c7-1111-2222')).map(v => v.voiceId);
    expect(ids).toContain('lib');
    expect(ids).toContain('mine');
    expect(ids).not.toContain('theirs');
  });

  it('trie aussi la réponse servie depuis le cache', async () => {
    // Le cache porte la réponse brute d'ElevenLabs. Si le tri se faisait avant
    // lui, le premier client à appeler figerait SA liste pour tous les autres.
    await voiceCatalogService.list('45b6d8c7-1111-2222');
    const ids = (await voiceCatalogService.list('99999999-aaaa-bbbb')).map(v => v.voiceId);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ids).toEqual(['theirs', 'lib']);
  });

  it('sans identifiant, ne sert aucun clone', async () => {
    // Les appelants internes qui n'ont pas de client sous la main : mieux vaut
    // une liste incomplète qu'une liste qui fuit.
    const ids = (await voiceCatalogService.list()).map(v => v.voiceId);
    expect(ids).toEqual(['lib']);
  });
});
