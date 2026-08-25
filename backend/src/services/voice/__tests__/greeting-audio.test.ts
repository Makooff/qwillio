import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
const findUnique = vi.fn();
const upsert = vi.fn();
const deleteMany = vi.fn();

vi.mock('../../../config/database', () => ({
  prisma: {
    greetingAudio: {
      findMany: (...a: unknown[]) => findMany(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
      upsert: (...a: unknown[]) => upsert(...a),
      deleteMany: (...a: unknown[]) => deleteMany(...a),
    },
  },
}));

const envState = vi.hoisted(() => ({
  ELEVENLABS_API_KEY: 'test-key',
  API_BASE_URL: 'https://api.example.com',
  VAPI_VOICE_ID: 'v1',
  VAPI_VOICE_ID_FR: 'v-fr',
  VAPI_VOICE_ID_BE: '',
  VOICE_TTS_MODEL: 'eleven_flash_v2_5',
  VOICE_TTS_PROVIDER: '11labs',
}));
vi.mock('../../../config/env', () => ({ env: envState }));

const { greetingAudioService } = await import('../greeting-audio.service');
const { firstMessageVariants } = await import('../system-prompt');

const profile: any = {
  clientId: 'client_1',
  businessName: 'Le Comptoir',
  businessType: 'restaurant',
  agentName: 'Camille',
  language: 'fr',
  characterId: null,
  country: 'FR',
};

function mockTts(ok = true) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    arrayBuffer: async () => new ArrayBuffer(1024),
  } as unknown as Response);
}

describe('greetingAudioService.generate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    envState.ELEVENLABS_API_KEY = 'test-key';
    findMany.mockResolvedValue([]);
    upsert.mockResolvedValue({});
  });

  it('synthesises every anonymous variant', async () => {
    mockTts();
    const written = await greetingAudioService.generate(profile);
    expect(written).toBe(firstMessageVariants(profile, null).length);
  });

  it('does nothing without an ElevenLabs key, rather than failing onboarding', async () => {
    envState.ELEVENLABS_API_KEY = '';
    const fetchSpy = mockTts();
    expect(await greetingAudioService.generate(profile)).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips variants whose text has not changed — a config change must not re-bill the set', async () => {
    const variants = firstMessageVariants(profile, null);
    findMany.mockResolvedValue(variants.map((text, variant) => ({ variant, text })));
    const fetchSpy = mockTts();

    expect(await greetingAudioService.generate(profile)).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('regenerates only the variant whose wording changed', async () => {
    const variants = firstMessageVariants(profile, null);
    findMany.mockResolvedValue(
      variants.map((text, variant) => ({ variant, text: variant === 1 ? 'stale wording' : text }))
    );
    mockTts();
    expect(await greetingAudioService.generate(profile)).toBe(1);
  });

  it('keeps going when one variant fails to synthesise', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call++;
      // Two out of three cached still removes the wait on two calls in three.
      if (call === 2) return { ok: false, status: 429 } as unknown as Response;
      return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(512) } as unknown as Response;
    });

    const written = await greetingAudioService.generate(profile);
    expect(written).toBe(firstMessageVariants(profile, null).length - 1);
  });

  /**
   * Ce service synthétise chez ElevenLabs, en direct.
   *
   * Si les APPELS passent par un autre fournisseur, un accueil pré-enregistré
   * ici serait d'un autre grain que la phrase suivante: la voix changerait au
   * milieu du premier tour de parole, ce qui s'entend bien plus qu'un accueil
   * légèrement plus lent. L'accueil retourne alors à la synthèse en direct de
   * l'appel, qui est du bon fournisseur.
   */
  it("ne pré-enregistre rien quand les appels ne sont plus chez ElevenLabs", async () => {
    const fetchSpy = mockTts();
    envState.VOICE_TTS_PROVIDER = 'cartesia';
    try {
      expect(await greetingAudioService.generate(profile)).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      envState.VOICE_TTS_PROVIDER = '11labs';
    }
  });

  it('uses the same TTS model as the live pipeline', async () => {
    const fetchSpy = mockTts();
    await greetingAudioService.generate(profile);
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    // A greeting that sounds different from the rest of the call is worse than
    // a slower one. Le modèle est réglable (`VOICE_TTS_MODEL`, posé pour juger
    // le naturel à l'oreille): c'est l'ÉGALITÉ avec le pipeline qui compte ici,
    // pas la valeur, sinon changer de modèle laisserait l'accueil derrière.
    expect(body.model_id).toBe(envState.VOICE_TTS_MODEL);
  });
});

describe('greetingAudioService.available', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a public URL per stored variant', async () => {
    findMany.mockResolvedValue([{ variant: 0, text: 'Bonjour' }]);
    const refs = await greetingAudioService.available('client_1');
    expect(refs[0].url).toBe('https://api.example.com/api/voice/greeting/client_1/0');
  });

  it('returns nothing on a database failure instead of throwing during a call', async () => {
    findMany.mockRejectedValue(new Error('connection lost'));
    expect(await greetingAudioService.available('client_1')).toEqual([]);
  });
});

describe('greetingAudioService.invalidate', () => {
  it('clears every variant so a rename cannot be spoken under the old name', async () => {
    deleteMany.mockResolvedValue({ count: 3 });
    await greetingAudioService.invalidate('client_1');
    expect(deleteMany).toHaveBeenCalledWith({ where: { clientId: 'client_1' } });
  });

  it('swallows a failure — invalidation is cleanup, not a call path', async () => {
    deleteMany.mockRejectedValue(new Error('locked'));
    await expect(greetingAudioService.invalidate('client_1')).resolves.toBeUndefined();
  });
});
