import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * L'assistant qui DÉCROCHE doit porter des outils.
 *
 * Le défaut que ce fichier fige a coûté un appel entrant réel: l'agent
 * répondait bien, puis ne pouvait ni transférer, ni enregistrer un lead, ni
 * lire la base de connaissances, et rien n'apparaissait dans le tableau de
 * bord. Une seule cause: le champ `tools` était construit à la création
 * `if (client.transferNumber)` — donc jamais, personne ne connaissant son
 * numéro de transfert en s'inscrivant — et `syncVapiAssistant` ne l'envoyait
 * pas du tout.
 *
 * Ce n'est pas visible en lisant l'écran des paramètres: il enregistre, la
 * synchronisation réussit, et l'assistant distant reste sans outils. Seul un
 * appelant l'apprend.
 *
 * Les deux règles vérifiées ici:
 *  1. la charge de synchronisation PORTE `tools`, et il est non vide dès que le
 *     profil offre quelque chose;
 *  2. le profil est relu APRÈS invalidation du cache, sinon les outils sont
 *     ceux d'avant l'enregistrement qu'on vient de faire, et le client doit
 *     sauver deux fois pour que son numéro de transfert prenne effet.
 */

const findUnique = vi.fn();
vi.mock('../../config/database', () => ({
  prisma: { client: { findUnique: (...a: unknown[]) => findUnique(...a), update: vi.fn() } },
}));
vi.mock('../../config/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

/** L'ordre des appels est ce qu'on teste: on les consigne dans une même trace. */
const order: string[] = [];

const updateAssistant = vi.fn();
vi.mock('../../config/vapi', () => ({
  vapiClient: {
    updateAssistant: (...a: unknown[]) => { order.push('update'); return updateAssistant(...a); },
    createAssistant: vi.fn(),
  },
}));

const getClientProfile = vi.fn();
const invalidateClient = vi.fn();
vi.mock('../voice/realtime-context.service', () => ({
  realtimeContextService: {
    getClientProfile: (...a: unknown[]) => { order.push('read'); return getClientProfile(...a); },
    invalidateClient: (...a: unknown[]) => { order.push('invalidate'); return invalidateClient(...a); },
  },
}));

vi.mock('../voice/greeting-audio.service', () => ({
  greetingAudioService: { invalidate: vi.fn(), generate: vi.fn() },
}));
vi.mock('../email.service', () => ({ emailService: { send: vi.fn() } }));
vi.mock('../discord.service', () => ({ discordService: { send: vi.fn(), notify: vi.fn() } }));

const { onboardingService } = await import('../onboarding.service');

const profile = {
  clientId: 'c1',
  businessName: 'Chez Marie',
  businessType: 'restaurant',
  agentName: 'Camille',
  language: 'fr' as const,
  timezone: 'Europe/Brussels',
  transferNumber: '+32460112233',
  transferMode: 'always' as const,
  inboundNumber: '+32460445566',
  inboundLines: [],
  instructions: null,
  services: [],
  openingHours: null,
  bookingEnabled: true,
  calendarConnected: true,
  planType: 'pro',
  characterId: null,
  customVoice: null,
  country: 'BE',
  customLlm: false,
  voiceMode: 'auto' as const,
  hasKnowledgeBase: true,
  recordCalls: true,
};

describe('syncVapiAssistant — les outils partent avec la configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    order.length = 0;
    updateAssistant.mockResolvedValue({});
    invalidateClient.mockResolvedValue(undefined);
    getClientProfile.mockResolvedValue(profile);
    findUnique.mockResolvedValue({
      id: 'c1',
      businessName: 'Chez Marie',
      agentName: 'Camille',
      agentLanguage: 'fr',
      country: 'BE',
      vapiAssistantId: 'asst_1',
      vapiConfig: {},
      transferNumber: '+32460112233',
    });
  });

  it("envoie le jeu d'outils complet, transfert compris", async () => {
    await onboardingService.syncVapiAssistant('c1');

    const [, config] = updateAssistant.mock.calls[0] as [string, Record<string, any>];
    /* DANS le modèle, pas à la racine. L'API vivante refuse la racine —
       « property tools should not exist », six variantes sur six, le 10/09 —
       et ce test figeait justement le mauvais emplacement. */
    expect(Array.isArray(config.model.tools)).toBe(true);

    const kinds = config.model.tools.map((t: any) => (t.type === 'function' ? t.function.name : t.type));
    // Le transfert est celui qui manquait à l'appelant du 09/09; `captureLead`
    // est celui sans lequel aucune alerte ne part (voir `lead-alert.service`).
    expect(kinds).toContain('transferCall');
    expect(kinds).toContain('captureLead');
    expect(kinds).toContain('lookupKnowledge');
  });

  it('vide le cache AVANT de lire le profil', async () => {
    await onboardingService.syncVapiAssistant('c1');

    /* Sans cet ordre, les outils sont bâtis sur le profil d'avant
       l'enregistrement: le numéro de transfert saisi à l'instant n'y est pas,
       et il faut sauver une seconde fois pour qu'il prenne effet.

       La trace est coupée à l'envoi: `syncVapiAssistant` vide de nouveau le
       cache APRÈS coup, et régénère les accueils, ce qui rejoue les deux
       étiquettes. Les compter toutes ferait passer ce test même si rien
       n'était lu avant l'envoi, ce qui est exactement le défaut visé. */
    const upTo = order.slice(0, order.indexOf('update'));
    expect(upTo).toEqual(['invalidate', 'read']);
  });

  it("envoie un tableau vide plutôt que rien quand le profil est illisible", async () => {
    getClientProfile.mockResolvedValue(null);

    await onboardingService.syncVapiAssistant('c1');

    const [, config] = updateAssistant.mock.calls[0] as [string, Record<string, any>];
    /* Omettre le champ laisserait chez Vapi les outils d'une configuration
       qu'on vient d'annuler: un agent continuerait de promettre un rendez-vous
       sur un agenda débranché. */
    expect(config.model.tools).toEqual([]);
  });
});
