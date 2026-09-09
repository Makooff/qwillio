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
  CARTESIA_API_KEY: 'cartesia-key',
  API_BASE_URL: 'https://api.example.com',
  VAPI_VOICE_ID: 'v1',
  VAPI_VOICE_ID_FR: 'v-fr',
  VAPI_VOICE_ID_BE: '',
  VOICE_TTS_MODEL: 'eleven_flash_v2_5',
  VOICE_TTS_PROVIDER: '11labs',
  CARTESIA_MODEL: 'sonic-3.5',
  CARTESIA_VOICES: '',
  CARTESIA_DEFAULT_VOICE_ID: '',
  VAPI_VOICE_FALLBACK_1: 'fb-1',
  VAPI_VOICE_FALLBACK_2: 'fb-2',
  VAPI_OPTIMIZE_LATENCY: 2,
  VOICE_SPEECH_SPEED: 1,
  VOICE_TTS_STYLE_CAP: 0.7,
  VOICE_TTS_MIN_CHUNK_CHARS: 60,
  VOICE_BARGE_IN_WORDS: 2,
  VOICE_BARGE_IN_VOICE_SECONDS: 0.2,
  VOICE_BARGE_IN_BACKOFF_SECONDS: 1,
  VAPI_SILENCE_TIMEOUT: 30,
  VOICE_REALTIME_MODEL: 'gpt-realtime-2.1',
  VAPI_MODEL: 'gpt-4o',
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

/**
 * La signature vocale que le service ÉCRIT, relue depuis ce qu'il a écrit.
 *
 * Elle sert à fabriquer des lignes en base qui soient à jour. La recalculer ici
 * à partir du catalogue de personnages reviendrait à réécrire la règle qu'on
 * teste, et à la voir diverger le jour où elle change.
 */
async function currentSignature() {
  findMany.mockResolvedValue([]);
  upsert.mockResolvedValue({});
  mockTts();
  await greetingAudioService.generate(profile);
  const { provider, voiceId, ttsModel } = upsert.mock.calls[0][0].create;
  vi.restoreAllMocks();
  vi.clearAllMocks();
  return { provider, voiceId, ttsModel };
}

/** Les lignes telles qu'elles sont en base quand tout est à jour. */
async function storedRows() {
  const sig = await currentSignature();
  return firstMessageVariants(profile, null).map((text, variant) => ({ variant, text, ...sig }));
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
    findMany.mockResolvedValue(await storedRows());
    const fetchSpy = mockTts();

    expect(await greetingAudioService.generate(profile)).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('regenerates only the variant whose wording changed', async () => {
    const rows = await storedRows();
    findMany.mockResolvedValue(rows.map(r => (r.variant === 1 ? { ...r, text: 'stale wording' } : r)));
    mockTts();
    expect(await greetingAudioService.generate(profile)).toBe(1);
  });

  /**
   * Le défaut du 27/08, et la raison de la signature vocale.
   *
   * Le texte n'a pas bougé d'un caractère, mais la flotte est passée à
   * Cartesia: ces lignes sont dites par ElevenLabs et ne ressemblent plus à la
   * suite de l'appel. La comparaison sur le seul texte les gardait, ce qui
   * faisait accueillir par une voix et répondre par une autre.
   */
  it('regénère un accueil dont le texte est intact mais la voix périmée', async () => {
    findMany.mockResolvedValue(await storedRows());
    envState.VOICE_TTS_PROVIDER = 'cartesia';
    envState.CARTESIA_VOICES = 'cart-voice';
    try {
      mockTts();
      expect(await greetingAudioService.generate(profile)).toBe(firstMessageVariants(profile, null).length);
    } finally {
      envState.VOICE_TTS_PROVIDER = '11labs';
      envState.CARTESIA_VOICES = '';
    }
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
   * L'accueil suit la synthèse de l'appel, il ne l'impose pas.
   *
   * La version précédente ne savait synthétiser que chez ElevenLabs, et se
   * taisait dès que la flotte passait ailleurs: l'optimisation était éteinte
   * pour tout le monde depuis le 27/08. C'est le fournisseur de l'appel qui dit
   * l'accueil, quel qu'il soit.
   */
  it('pré-enregistre chez Cartesia quand c\'est Cartesia qui dit l\'appel', async () => {
    const fetchSpy = mockTts();
    envState.VOICE_TTS_PROVIDER = 'cartesia';
    envState.CARTESIA_VOICES = 'cart-voice';
    try {
      expect(await greetingAudioService.generate(profile)).toBe(firstMessageVariants(profile, null).length);
      expect(fetchSpy.mock.calls.every(c => String(c[0]).includes('api.cartesia.ai'))).toBe(true);
      expect(upsert.mock.calls[0][0].create.provider).toBe('cartesia');
      expect(upsert.mock.calls[0][0].create.voiceId).toBe('cart-voice');
    } finally {
      envState.VOICE_TTS_PROVIDER = '11labs';
      envState.CARTESIA_VOICES = '';
    }
  });

  it('ne synthétise rien sans la clé du fournisseur qui doit dire l\'accueil', async () => {
    const fetchSpy = mockTts();
    envState.VOICE_TTS_PROVIDER = 'cartesia';
    envState.CARTESIA_VOICES = 'cart-voice';
    envState.CARTESIA_API_KEY = '';
    try {
      // La clé ElevenLabs est toujours là: ce n'est pas elle qui compte ici.
      expect(await greetingAudioService.generate(profile)).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      envState.VOICE_TTS_PROVIDER = '11labs';
      envState.CARTESIA_VOICES = '';
      envState.CARTESIA_API_KEY = 'cartesia-key';
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
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    upsert.mockResolvedValue({});
  });

  it('returns a public URL per stored variant', async () => {
    const sig = await currentSignature();
    findMany.mockResolvedValue([{ variant: 0, text: 'Bonjour', ...sig }]);
    const refs = await greetingAudioService.available(profile);
    expect(refs[0].url).toBe('https://api.example.com/api/voice/greeting/client_1/0');
  });

  /**
   * Le garde-fou est ici, à la LECTURE, et pas seulement à l'écriture.
   *
   * Une ligne enregistrée avant la bascule reste en base tant que l'assistant
   * n'a pas été resynchronisé. La servir, c'est accueillir avec une voix et
   * répondre avec une autre — le défaut que la génération, à elle seule, ne
   * pouvait pas corriger.
   */
  it("écarte un accueil enregistré avec une autre voix que celle de l'appel", async () => {
    const sig = await currentSignature();
    findMany.mockResolvedValue([{ variant: 0, text: 'Bonjour', ...sig, provider: 'cartesia' }]);
    expect(await greetingAudioService.available(profile)).toEqual([]);
  });

  it('écarte une ligne dont la provenance est inconnue', async () => {
    // Toutes les lignes antérieures au 09/09: elles ont pu être dites par
    // n'importe quelle voix, donc aucune ne peut être déclarée conforme.
    findMany.mockResolvedValue([
      { variant: 0, text: 'Bonjour', provider: null, voiceId: null, ttsModel: null },
    ]);
    expect(await greetingAudioService.available(profile)).toEqual([]);
  });

  it('returns nothing on a database failure instead of throwing during a call', async () => {
    findMany.mockRejectedValue(new Error('connection lost'));
    expect(await greetingAudioService.available(profile)).toEqual([]);
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
