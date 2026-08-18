import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * L'audition Fish Audio, et le piège qu'elle tend.
 *
 * Ces aperçus existent pour répondre à UNE question: la voix est-elle meilleure
 * en français ? Une audition qui, sans le dire, rejoue un clip ElevenLabs
 * répondrait « aucune différence », c'est-à-dire la mauvaise réponse, de la
 * manière la plus difficile à détecter. Les deux tests qui comptent ici sont
 * donc ceux qui interdisent le repli et la collision de cache.
 */

const envState = vi.hoisted(() => ({
  ELEVENLABS_API_KEY: 'eleven-key',
  FISH_AUDIO_API_KEY: 'fish-key',
  FISH_AUDIO_MODEL: 's2-pro',
  VOICE_PREVIEW_PROVIDER: 'fish' as '11labs' | 'fish',
  FISH_AUDIO_VOICES: 'v_marie=fish_marie',
  FISH_AUDIO_DEFAULT_VOICE_ID: '',
}));
vi.mock('../../../config/env', () => ({ env: envState }));
vi.mock('../../../config/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const files = vi.hoisted(() => new Map<string, Buffer>());
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async (path: string) => {
    const held = files.get(path);
    if (!held) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return held;
  }),
  writeFile: vi.fn(async (path: string, data: Buffer) => { files.set(path, data); }),
}));

const { previewAudioService, previewKey } = await import('../preview-audio.service');
const { fishVoiceFor } = await import('../fish-audio.service');

const req = {
  voiceId: 'v_marie',
  text: 'Bonjour, cabinet Martin, je suis un assistant IA.',
  stability: 0.38,
  similarityBoost: 0.78,
  style: 0.45,
};

const mp3 = () => Buffer.from([0xff, 0xfb, 0x90, 0x00, 0x01, 0x02]);
const ok = () => ({ ok: true, arrayBuffer: async () => mp3().buffer.slice(0) });
const fail = (status: number, body = '') => ({ ok: false, status, text: async () => body });

beforeEach(() => {
  previewAudioService.clear();
  files.clear();
  envState.VOICE_PREVIEW_PROVIDER = 'fish';
  envState.FISH_AUDIO_API_KEY = 'fish-key';
  envState.FISH_AUDIO_MODEL = 's2-pro';
  envState.FISH_AUDIO_VOICES = 'v_marie=fish_marie';
  envState.FISH_AUDIO_DEFAULT_VOICE_ID = '';
  vi.restoreAllMocks();
});

describe('la voix Fish correspondant à une voix ElevenLabs', () => {
  it('lit la table de correspondance', () => {
    expect(fishVoiceFor('v_marie')).toBe('fish_marie');
  });

  it('retombe sur la voix par défaut, et sur rien quand il n’y en a pas', () => {
    expect(fishVoiceFor('v_inconnue')).toBeNull();
    envState.FISH_AUDIO_DEFAULT_VOICE_ID = 'fish_defaut';
    expect(fishVoiceFor('v_inconnue')).toBe('fish_defaut');
  });
});

describe('l’aperçu par Fish Audio', () => {
  it('appelle Fish Audio, avec le modèle en en-tête et la voix dans le corps', async () => {
    const fetchMock = vi.fn(async () => ok() as never);
    vi.stubGlobal('fetch', fetchMock);

    const { audio } = await previewAudioService.get(req);

    expect(audio.length).toBeGreaterThan(0);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.fish.audio/v1/tts');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer fish-key');
    // Le modèle voyage dans un en-tête chez Fish Audio: le mettre dans le corps
    // le ferait ignorer en silence, et on auditionnerait le modèle par défaut.
    expect((init.headers as Record<string, string>).model).toBe('s2-pro');
    expect(JSON.parse(init.body as string)).toMatchObject({
      text: req.text,
      reference_id: 'fish_marie',
      format: 'mp3',
    });
  });

  it('ne retombe JAMAIS sur ElevenLabs quand la voix Fish manque', async () => {
    // Le repli serait la pire des issues: l'aperçu marcherait, et il ferait
    // juger ElevenLabs en croyant juger Fish.
    envState.FISH_AUDIO_VOICES = '';
    const fetchMock = vi.fn(async () => ok() as never);
    vi.stubGlobal('fetch', fetchMock);

    await expect(previewAudioService.get(req)).rejects.toMatchObject({
      message: 'fish_voice_unmapped',
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dit que la clé manque, sans appeler personne', async () => {
    envState.FISH_AUDIO_API_KEY = '';
    const fetchMock = vi.fn(async () => ok() as never);
    vi.stubGlobal('fetch', fetchMock);

    await expect(previewAudioService.get(req)).rejects.toMatchObject({
      message: 'fish_key_missing',
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('réessaie une limite de débit, pas un refus d’authentification', async () => {
    const rateLimited = vi.fn()
      .mockResolvedValueOnce(fail(429, '') as never)
      .mockResolvedValueOnce(ok() as never);
    vi.stubGlobal('fetch', rateLimited);
    await expect(previewAudioService.get(req)).resolves.toBeTruthy();
    expect(rateLimited).toHaveBeenCalledTimes(2);

    previewAudioService.clear();
    files.clear();
    const refused = vi.fn(async () => fail(401, '{"detail":"invalid token"}') as never);
    vi.stubGlobal('fetch', refused);
    await expect(previewAudioService.get(req)).rejects.toMatchObject({
      message: 'fish_request_failed',
      status: 502,
      upstream: 401,
      reason: 'invalid token',
    });
    expect(refused).toHaveBeenCalledTimes(1);
  });

  it('refuse un corps vide au lieu de mettre le silence en cache', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }) as never));
    await expect(previewAudioService.get(req)).rejects.toMatchObject({ message: 'fish_empty_audio' });
  });
});

describe('la clé de cache sépare les deux fournisseurs', () => {
  it('change avec le fournisseur, le modèle et la voix Fish', () => {
    const underFish = previewKey(req);

    envState.VOICE_PREVIEW_PROVIDER = '11labs';
    const underEleven = previewKey(req);
    // Sans cette séparation, basculer sur Fish servirait les clips ElevenLabs
    // déjà en cache et l'audition n'aurait rien comparé.
    expect(underFish).not.toBe(underEleven);

    envState.VOICE_PREVIEW_PROVIDER = 'fish';
    envState.FISH_AUDIO_MODEL = 's1';
    expect(previewKey(req)).not.toBe(underFish);

    envState.FISH_AUDIO_MODEL = 's2-pro';
    envState.FISH_AUDIO_VOICES = 'v_marie=fish_autre';
    expect(previewKey(req)).not.toBe(underFish);
  });

  it('garde un clip Fish déjà payé', async () => {
    const fetchMock = vi.fn(async () => ok() as never);
    vi.stubGlobal('fetch', fetchMock);

    await previewAudioService.get(req);
    await previewAudioService.get(req);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
