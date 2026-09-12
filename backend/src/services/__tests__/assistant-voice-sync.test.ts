import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * L'assistant qui DÉCROCHE doit porter la voix que le client a CHOISIE.
 *
 * Trois endroits construisaient la voix d'un client. L'appel entrant et
 * l'accueil pré-enregistré lisaient tout: la voix choisie dans le portail, le
 * clone, le catalogue d'origine, la synthèse par client. La synchronisation de
 * l'assistant enregistré — celui qui décroche sur une ligne dédiée — résolvait
 * le personnage SANS `customVoice` et appelait `buildVoice` sans `cloned`,
 * `voiceProvider` ni `ttsProvider`.
 *
 * Relevé le 12/09/2026: « j'avais choisi des voix Cartesia et maintenant c'est
 * ElevenLabs ». Le choix était enregistré, l'accueil le disait, et l'assistant
 * distant repartait sur la voix par défaut du personnage à chaque sauvegarde.
 * Une voix qui accueille, une autre qui répond: 6bis depuis l'autre côté.
 *
 * Ce fichier vérifie ce que la CHARGE envoyée à Vapi porte, pas ce qu'une
 * fonction interne calcule: c'est la charge qui décroche.
 */

const findUnique = vi.fn();
vi.mock('../../config/database', () => ({
  prisma: { client: { findUnique: (...a: unknown[]) => findUnique(...a), update: vi.fn() } },
}));
vi.mock('../../config/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const updateAssistant = vi.fn();
vi.mock('../../config/vapi', () => ({
  vapiClient: { updateAssistant: (...a: unknown[]) => updateAssistant(...a), createAssistant: vi.fn() },
}));

const getClientProfile = vi.fn();
vi.mock('../voice/realtime-context.service', () => ({
  realtimeContextService: {
    getClientProfile: (...a: unknown[]) => getClientProfile(...a),
    invalidateClient: vi.fn().mockResolvedValue(undefined),
  },
  shouldRecord: (profile: { recordCalls?: boolean }) => profile?.recordCalls !== false,
}));
vi.mock('../voice/greeting-audio.service', () => ({
  greetingAudioService: { invalidate: vi.fn(), generate: vi.fn() },
}));
vi.mock('../email.service', () => ({ emailService: { send: vi.fn() } }));
vi.mock('../discord.service', () => ({ discordService: { send: vi.fn(), notify: vi.fn() } }));

const { onboardingService } = await import('../onboarding.service');

const base = {
  clientId: 'c1',
  businessName: 'Demtalix',
  businessType: 'dentiste',
  agentName: 'Lucas',
  language: 'fr' as const,
  timezone: 'Europe/Brussels',
  transferNumber: null,
  transferMode: 'always' as const,
  inboundNumber: '+32460207490',
  inboundLines: [],
  instructions: null,
  services: [],
  openingHours: null,
  weekHours: null,
  bookingEnabled: false,
  calendarConnected: false,
  planType: 'pro',
  characterId: null,
  customVoice: null as null | { voiceId: string; provider?: 'cartesia'; cloned?: boolean },
  country: 'BE',
  customLlm: false,
  voiceMode: 'auto' as const,
  hasKnowledgeBase: false,
  recordCalls: true,
  knowledgeFields: {},
};

function sentVoice(): Record<string, any> {
  const [, config] = updateAssistant.mock.calls[0] as [string, Record<string, any>];
  return config.voice;
}

describe('syncVapiAssistant — la voix choisie atteint l\'assistant qui décroche', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateAssistant.mockResolvedValue({});
    findUnique.mockResolvedValue({
      id: 'c1',
      businessName: 'Demtalix',
      agentName: 'Lucas',
      agentLanguage: 'fr',
      country: 'BE',
      vapiAssistantId: 'asst_1',
      vapiConfig: {},
      transferNumber: null,
    });
  });

  /** LE cas du 12/09: une voix prise dans le catalogue Cartesia du portail. */
  it('envoie la voix Cartesia choisie dans le portail, pas celle du personnage', async () => {
    getClientProfile.mockResolvedValue({
      ...base,
      characterId: 'custom',
      customVoice: { voiceId: 'a1b2c3d4-0000-4000-8000-000000000001', provider: 'cartesia' },
    });
    await onboardingService.syncVapiAssistant('c1');

    const voice = sentVoice();
    expect(voice.provider).toBe('cartesia');
    expect(voice.voiceId).toBe('a1b2c3d4-0000-4000-8000-000000000001');
  });

  /** Un clone n'existe que chez ElevenLabs: il doit partir tel quel, jamais traduit. */
  it('envoie le clone du client, chez ElevenLabs, quoi que dise la plateforme', async () => {
    getClientProfile.mockResolvedValue({
      ...base,
      characterId: 'custom',
      customVoice: { voiceId: 'CLONE123456789012345', cloned: true },
      ttsProvider: 'cartesia',
    });
    await onboardingService.syncVapiAssistant('c1');

    const voice = sentVoice();
    expect(voice.provider).toBe('11labs');
    expect(voice.voiceId).toBe('CLONE123456789012345');
  });

  /* La même règle que l'accueil: si `voiceForProfile` et cette charge
     divergeaient un jour, l'accueil serait dit par une voix et l'appel par
     une autre. On compare donc à la fonction, pas à une valeur recopiée. */
  it('porte exactement la voix que l\'accueil pré-enregistré utilisera', async () => {
    const profile = {
      ...base,
      characterId: 'custom',
      customVoice: { voiceId: 'a1b2c3d4-0000-4000-8000-000000000002', provider: 'cartesia' as const },
    };
    getClientProfile.mockResolvedValue(profile);
    await onboardingService.syncVapiAssistant('c1');

    const { voiceForProfile } = await import('../voice/profile-voice');
    const expected = voiceForProfile(profile as any).signature;
    const voice = sentVoice();
    expect(voice.provider).toBe(expected.provider);
    expect(voice.voiceId).toBe(expected.voiceId);
  });
});
