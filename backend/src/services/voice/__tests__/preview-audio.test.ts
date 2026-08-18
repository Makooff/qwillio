import { describe, it, expect, vi, beforeEach } from 'vitest';

// Le fournisseur est explicite ici: ces tests décrivent le chemin ElevenLabs,
// et laisser le champ absent les ferait dépendre d'un `undefined` comparé à
// 'fish' plutôt que d'un choix.
const envState = vi.hoisted(() => ({
  ELEVENLABS_API_KEY: 'test-key',
  VOICE_PREVIEW_PROVIDER: '11labs' as '11labs' | 'fish',
  FISH_AUDIO_API_KEY: '',
  FISH_AUDIO_MODEL: 's2-pro',
  FISH_AUDIO_VOICES: '',
  FISH_AUDIO_DEFAULT_VOICE_ID: '',
}));
vi.mock('../../../config/env', () => ({ env: envState }));
vi.mock('../../../config/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

// The disk layer would otherwise leak clips between tests through the real
// temp directory, where a stale file makes a cache miss look like a hit.
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

const { previewAudioService, PreviewAudioError, previewKey } = await import('../preview-audio.service');

const req = {
  voiceId: 'v_marie',
  text: 'Bonjour, merci d’appeler !',
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
  envState.ELEVENLABS_API_KEY = 'test-key';
  vi.restoreAllMocks();
});

describe('preview clips are bought once', () => {
  it('synthesises on the first request and never again', async () => {
    // The whole point: the line is fixed, so paying and waiting for it on every
    // press of ▶ was the delay before the sound and the silence once the
    // account hit its rate limit.
    const fetchMock = vi.fn(async () => ok() as never);
    vi.stubGlobal('fetch', fetchMock);

    const first = await previewAudioService.get(req);
    const second = await previewAudioService.get(req);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.audio.equals(first.audio)).toBe(true);
  });

  it('collapses simultaneous requests for the same clip into one call', async () => {
    // Ten cards pressed in a row used to be ten syntheses, and concurrency is
    // exactly what the account limit punishes.
    const fetchMock = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return ok() as never;
    });
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([1, 2, 3, 4].map(() => previewAudioService.get(req)));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads the clip back from disk after the memory cache is gone', async () => {
    const fetchMock = vi.fn(async () => ok() as never);
    vi.stubGlobal('fetch', fetchMock);

    await previewAudioService.get(req);
    previewAudioService.clear(); // a restart, or a second worker
    await previewAudioService.get(req);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keys on the voice, the words and the tuning', async () => {
    expect(previewKey(req)).toBe(previewKey({ ...req }));
    expect(previewKey({ ...req, voiceId: 'other' })).not.toBe(previewKey(req));
    expect(previewKey({ ...req, text: 'Hello' })).not.toBe(previewKey(req));
    expect(previewKey({ ...req, style: 0 })).not.toBe(previewKey(req));
  });
});

describe('when ElevenLabs refuses', () => {
  it('retries a rate limit once rather than returning silence', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(fail(429, '{"detail":{"message":"too many concurrent requests"}}') as never)
      .mockResolvedValueOnce(ok() as never);
    vi.stubGlobal('fetch', fetchMock);

    const { audio } = await previewAudioService.get(req);
    expect(audio.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('carries the upstream reason, not just a status', async () => {
    // Server logs are unreachable from a phone: without the reason, "no sound"
    // is indistinguishable from a bad voice.
    vi.stubGlobal('fetch', vi.fn(async () => fail(401, '{"detail":{"message":"quota_exceeded"}}') as never));

    await expect(previewAudioService.get(req)).rejects.toMatchObject({
      status: 502,
      upstream: 401,
      reason: 'quota_exceeded',
    });
  });

  it('does not cache a failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(fail(401, 'nope') as never)
      .mockResolvedValueOnce(ok() as never);
    vi.stubGlobal('fetch', fetchMock);

    await expect(previewAudioService.get(req)).rejects.toBeInstanceOf(PreviewAudioError);
    await expect(previewAudioService.get(req)).resolves.toBeTruthy();
  });

  it('says the key is missing with a status the UI can act on', async () => {
    envState.ELEVENLABS_API_KEY = '';
    await expect(previewAudioService.get(req)).rejects.toMatchObject({
      message: 'elevenlabs_key_missing',
      status: 503,
    });
  });

  it('treats an empty body as a failure instead of caching silence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }) as never));
    await expect(previewAudioService.get(req)).rejects.toMatchObject({ message: 'elevenlabs_empty_audio' });
  });
});

describe('warm-up', () => {
  it('synthesises one at a time and gives up on the first failure', async () => {
    // Firing the whole catalog at once is how the account hits the limit this
    // service exists to avoid; and once a key is exhausted, the rest will fail.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok() as never)
      .mockResolvedValue(fail(401, 'nope') as never);
    vi.stubGlobal('fetch', fetchMock);

    await previewAudioService.warm([
      req,
      { ...req, voiceId: 'v2' },
      { ...req, voiceId: 'v3' },
      { ...req, voiceId: 'v4' },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
