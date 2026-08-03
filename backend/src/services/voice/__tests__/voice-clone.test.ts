import { describe, it, expect, vi, beforeEach } from 'vitest';

const { envMock } = vi.hoisted(() => ({ envMock: { ELEVENLABS_API_KEY: 'key-123' } }));
vi.mock('../../../config/env', () => ({ env: envMock }));
vi.mock('../../../config/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn() } }));

const { voiceCloneService, VoiceCloneError, MIN_SAMPLE_BYTES, MAX_SAMPLE_BYTES } =
  await import('../voice-clone.service');

const sample = (bytes: number) => Buffer.alloc(bytes, 1);
const good = () => ({
  clientId: 'client-abcdef123',
  sample: sample(MIN_SAMPLE_BYTES + 1),
  mimeType: 'audio/webm',
  label: 'Ma voix',
  consent: true,
});

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.ELEVENLABS_API_KEY = 'key-123';
  });

  it('refuses without consent, before spending anything', async () => {
    // Cloning a voice without the speaker's agreement is against ElevenLabs'
    // terms. A UI checkbox alone would not stop a direct API call.
    await expect(voiceCloneService.create({ ...good(), consent: false })).rejects.toMatchObject({
      message: 'consent_required',
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a missing key as 503, not as a failed clone', async () => {
    envMock.ELEVENLABS_API_KEY = '';
    await expect(voiceCloneService.create(good())).rejects.toMatchObject({
      message: 'elevenlabs_key_missing',
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a sample too short to clone anything usable', async () => {
    await expect(
      voiceCloneService.create({ ...good(), sample: sample(MIN_SAMPLE_BYTES - 1) })
    ).rejects.toMatchObject({ message: 'sample_too_short', status: 400 });
  });

  it('rejects a sample over the body limit', async () => {
    await expect(
      voiceCloneService.create({ ...good(), sample: sample(MAX_SAMPLE_BYTES + 1) })
    ).rejects.toMatchObject({ message: 'sample_too_large', status: 413 });
  });

  it('returns the upstream voice id on success', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ voice_id: 'v_789' }) });
    const voice = await voiceCloneService.create(good());
    expect(voice.voiceId).toBe('v_789');
    expect(voice.createdAt).toMatch(/^\d{4}-/);
  });

  it('namespaces the voice name with the client id', async () => {
    // One ElevenLabs account is shared by every tenant. Two clients both naming
    // their voice "Accueil" would be indistinguishable when one has to go.
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ voice_id: 'v_1' }) });
    const voice = await voiceCloneService.create(good());
    expect(voice.name.startsWith('client-a')).toBe(true);
    expect(voice.name).toContain('Ma voix');
  });

  it('surfaces the upstream status — 401 here means a free plan, not a bad key', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'can_not_use_instant_voice_cloning' });
    await expect(voiceCloneService.create(good())).rejects.toMatchObject({
      message: 'elevenlabs_clone_failed',
      status: 502,
      upstream: 401,
    });
  });

  it('treats a 200 without a voice id as a failure', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await expect(voiceCloneService.create(good())).rejects.toBeInstanceOf(VoiceCloneError);
  });
});

describe('remove', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.ELEVENLABS_API_KEY = 'key-123';
  });

  it('never throws when the upstream delete fails', async () => {
    // The user's goal is to stop using the voice, which is a local config
    // change. A leftover voice upstream is clutter, not a reason to fail.
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(voiceCloneService.remove('v_1')).resolves.toBe(false);
  });

  it('reports success when the upstream delete succeeds', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await expect(voiceCloneService.remove('v_1')).resolves.toBe(true);
  });
});
