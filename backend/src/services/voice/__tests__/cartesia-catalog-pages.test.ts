import { describe, it, expect, vi, beforeEach } from 'vitest';

const envState = vi.hoisted(() => ({
  CARTESIA_API_KEY: 'k',
  CARTESIA_MODEL: 'sonic-3.5',
  CARTESIA_VOICES: '',
  CARTESIA_DEFAULT_VOICE_ID: '',
  VOICE_TTS_PROVIDER: 'cartesia',
  VOICE_TTS_MODEL: 'eleven_turbo_v2_5',
}));
vi.mock('../../../config/env', () => ({ env: envState }));
const warn = vi.hoisted(() => vi.fn());
vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn, error: vi.fn(), debug: vi.fn() } }));

const { listCartesiaVoices, invalidateCartesiaCatalog } = await import('../cartesia.service');

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const page = (data: unknown[], next: string | null) => ({
  ok: true,
  status: 200,
  json: async () => ({ data, has_more: next !== null, next_page: next }),
  text: async () => '',
});

const fr = (id: string, gender = 'masculine') => ({ id, name: id, language: 'fr', gender, is_public: true });
const en = (id: string) => ({ id, name: id, language: 'en', gender: 'feminine', is_public: true });

beforeEach(() => {
  fetchMock.mockReset();
  warn.mockReset();
  invalidateCartesiaCatalog();
});

/**
 * La réponse réelle du 12/09/2026 porte `has_more: true` et `next_page`:
 * Cartesia sert sa bibliothèque PUBLIQUE entière, et les cent premières voix
 * sont à peu près toutes anglaises. Ne lire qu'une page, c'est servir « aucune
 * voix française » à un client qui en voit des dizaines sur le site de
 * Cartesia. Rien ne manquait: on n'avait pas tourné la page.
 */
describe('listCartesiaVoices — tout le catalogue, page après page', () => {
  it('suit `next_page` jusqu\'au bout et rend les voix des pages suivantes', async () => {
    fetchMock
      .mockResolvedValueOnce(page([en('e1'), en('e2')], 'e2'))
      .mockResolvedValueOnce(page([fr('f1'), en('e3')], 'e3'))
      .mockResolvedValueOnce(page([fr('f2')], null));

    const voices = await listCartesiaVoices('fr');
    expect(voices.map(v => v.voiceId)).toEqual(['f1', 'f2']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('renvoie le curseur tel que Cartesia l\'a donné', async () => {
    fetchMock
      .mockResolvedValueOnce(page([en('e1')], 'e1'))
      .mockResolvedValueOnce(page([fr('f1')], null));

    await listCartesiaVoices('fr');
    const second = String(fetchMock.mock.calls[1][0]);
    expect(second).toContain('starting_after=e1');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('starting_after');
  });

  /**
   * Le nom du paramètre de curseur n'a pas pu être lu dans une documentation
   * inaccessible d'ici. S'il est faux, la page suivante répète la première:
   * on s'arrête avec ce qu'on a et on nomme le paramètre, plutôt que de servir
   * cent fois la même page ou de tourner sans fin.
   */
  it('s\'arrête et le dit quand la page suivante ne fait pas avancer', async () => {
    fetchMock
      .mockResolvedValueOnce(page([fr('f1')], 'f1'))
      .mockResolvedValueOnce(page([fr('f1')], 'f1'));

    const voices = await listCartesiaVoices('fr');
    expect(voices.map(v => v.voiceId)).toEqual(['f1']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/starting_after/));
  });

  it('lit le genre sous la forme réelle, « feminine » / « masculine »', async () => {
    fetchMock.mockResolvedValueOnce(page([fr('f1', 'masculine'), fr('f2', 'feminine')], null));
    const voices = await listCartesiaVoices('fr');
    expect(voices.map(v => v.gender)).toEqual(['male', 'female']);
  });
});
