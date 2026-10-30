import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

/**
 * Le contrat de la VOIX DU CLIENT sur le profil authentifié
 * (`GET /api/voice-core/context/by-number/:trunkNumber`).
 *
 * Ce que ce fichier verrouille, côté pont :
 *
 *  - la route EXIGE la clé fleet (voiceCoreAuth) — un profil avec la voix d'un
 *    client ne se lit pas sans elle ;
 *  - un clone enregistré (ElevenLabs) part avec `provider: 'elevenlabs'` et
 *    `cloned: true` — même quand la fiche ne porte pas de `provider` (défaut
 *    historique) ;
 *  - une voix de bibliothèque Cartesia part avec `provider: 'cartesia'` ;
 *  - un client SANS voix choisie reçoit `voice: null` : voice-core replie sur
 *    ses voix par défaut, il ne doit pas inventer un choix ;
 *  - une fiche malformée (`voiceId` vide) reçoit aussi `voice: null` — une
 *    charge pourrie ne casse pas l'appel, elle renonce au override ;
 *  - la forme du payload est exactement celle que `voice_core.voix`
 *    consomme : même nommage, même sémantique (contrat aller-retour).
 */

const db = vi.hoisted(() => ({
  client: { findFirst: vi.fn() },
  clientPhoneNumber: { findFirst: vi.fn() },
}));
const profiles = vi.hoisted(() => ({ getClientProfile: vi.fn() }));

vi.mock('../../config/database', () => ({ prisma: db }));
vi.mock('../../config/env', () => ({ env: {} }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/voice/realtime-context.service', () => ({
  realtimeContextService: profiles,
  shouldRecord: () => false,
}));
vi.mock('../../services/voice/twilio-recording.service', () => ({ twilioRecordingService: {} }));
vi.mock('../../services/client-call.service', () => ({ clientCallService: {} }));
vi.mock('../../services/voice/tool-runtime.service', () => ({ toolRuntimeService: {} }));
vi.mock('../../services/voice/caller-memory.service', () => ({ callerMemoryService: {} }));
vi.mock('../../services/voice/live-transcript.store', () => ({ liveTranscripts: {} }));
vi.mock('../../config/knowledge-presets', () => ({ knowledgePreset: vi.fn(() => ({})) }));
vi.mock('../../services/voice/portal-knowledge.service', () => ({ entreesDepuisVapiConfig: vi.fn(() => []) }));
vi.mock('../../services/voice/voice-core-metadata', () => ({ persistCompletedVoiceMetadata: vi.fn() }));
vi.mock('../../services/voice/lead-capture-store.service', () => ({
  getPendingCaptureForRoom: vi.fn(),
  linkCaptureToCall: vi.fn(),
  persistCapture: vi.fn(),
  persistRoomCapture: vi.fn(),
}));
vi.mock('../../services/lead-identity', () => ({ normalizeLeadPhone: vi.fn((x: string) => x) }));
vi.mock('../../utils/spelled-name', () => ({ isPlaceholderName: vi.fn(() => false) }));
vi.mock('../../services/voice/worker-calendar.service', () => ({ workerCalendarService: { takenSlots: vi.fn() } }));
vi.mock('../../services/voice/voice-completion-inbox.service', () => ({ voiceCompletionInbox: {} }));
vi.mock('../../services/voice/learning-runtime-scope', () => ({
  signRuntimeScope: vi.fn(() => null),
}));

import router from '../voice-core.routes';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const CLE_FLEET = 'cle-de-test-voice-core';
const CHEMIN = '/api/voice-core/context/by-number/%2B32460258033';

function profilDeBase(customVoice: unknown = null) {
  return {
    clientId: CLIENT_ID,
    businessName: 'Chez Marie',
    businessType: 'restaurant',
    agentName: 'Marc',
    language: 'fr',
    instructions: null,
    inboundNumber: '+32460258033',
    inboundLines: [],
    transferNumber: null,
    transferMode: 'always',
    forwardingType: null,
    weekHours: null,
    openingHours: null,
    timezone: 'Europe/Brussels',
    services: [],
    bookingEnabled: true,
    customVoice,
  };
}

async function appMontee() {
  const app = express();
  app.use(express.json());
  app.use('/api/voice-core', router);
  return app;
}

describe('profil voice-core : la voix du client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOICE_CORE_API_KEY = CLE_FLEET;
    db.client.findFirst.mockImplementation(async (args: { where?: { id?: string } }) =>
      args?.where?.id ? { id: CLIENT_ID, businessType: 'restaurant', country: 'BE', agentLanguage: 'fr' } : { id: CLIENT_ID });
    db.clientPhoneNumber.findFirst.mockResolvedValue(null);
  });
  afterEach(() => { delete process.env.VOICE_CORE_API_KEY; });

  it('exige la clé fleet : sans elle, rien ne se lit', async () => {
    delete process.env.VOICE_CORE_API_KEY;
    profiles.getClientProfile.mockResolvedValue(profilDeBase());
    const app = await appMontee();
    const res = await request(app).get(CHEMIN).set('x-api-key', CLE_FLEET);
    expect(res.status).toBe(503);
    expect(profiles.getClientProfile).not.toHaveBeenCalled();
  });

  it('refuse une mauvaise clé sans toucher au profil', async () => {
    profiles.getClientProfile.mockResolvedValue(profilDeBase());
    const app = await appMontee();
    const res = await request(app).get(CHEMIN).set('x-api-key', 'mauvaise-cle');
    expect(res.status).toBe(401);
    expect(profiles.getClientProfile).not.toHaveBeenCalled();
  });

  it('un clone ElevenLabs sans provider part avec provider elevenlabs, cloned true', async () => {
    profiles.getClientProfile.mockResolvedValue(profilDeBase({
      voiceId: 'xyz123cloneEL',
      name: 'Voix du gérant',
      createdAt: '2026-10-30T12:00:00.000Z',
      cloned: true,
    }));
    const app = await appMontee();
    const res = await request(app).get(CHEMIN).set('x-api-key', CLE_FLEET);
    expect(res.status).toBe(200);
    expect(res.body.voice).toEqual({
      voiceId: 'xyz123cloneEL',
      name: 'Voix du gérant',
      cloned: true,
      provider: 'elevenlabs',
    });
  });

  it('ne tronque pas un identifiant trop long en un autre identifiant de voix', async () => {
    profiles.getClientProfile.mockResolvedValue(profilDeBase({
      voiceId: 'a'.repeat(129), provider: 'elevenlabs', cloned: true,
    }));
    const res = await request(await appMontee()).get(CHEMIN).set('x-api-key', CLE_FLEET);
    expect(res.status).toBe(200);
    expect(res.body.voice).toBeNull();
  });

  it('le fournisseur de la voix choisie prime sur le réglage TTS générique', async () => {
    profiles.getClientProfile.mockResolvedValue({
      ...profilDeBase({ voiceId: 'clone-client-42', provider: 'elevenlabs', cloned: true }),
      ttsProvider: 'cartesia',
    });
    const res = await request(await appMontee()).get(CHEMIN).set('x-api-key', CLE_FLEET);
    expect(res.status).toBe(200);
    expect(res.body.voice.provider).toBe('elevenlabs');
    expect(res.body.voice.voiceId).toBe('clone-client-42');
  });

  it('une voix de bibliothèque Cartesia garde son provider', async () => {
    profiles.getClientProfile.mockResolvedValue(profilDeBase({
      voiceId: 'cartesia-voice-42',
      name: 'Bibliothèque Cartesia',
      createdAt: '2026-10-30T12:00:00.000Z',
      provider: 'cartesia',
    }));
    const app = await appMontee();
    const res = await request(app).get(CHEMIN).set('x-api-key', CLE_FLEET);
    expect(res.status).toBe(200);
    expect(res.body.voice).toEqual({
      voiceId: 'cartesia-voice-42',
      name: 'Bibliothèque Cartesia',
      cloned: false,
      provider: 'cartesia',
    });
  });

  it('un client sans voix choisie reçoit voice: null (défauts du worker)', async () => {
    profiles.getClientProfile.mockResolvedValue(profilDeBase(null));
    const app = await appMontee();
    const res = await request(app).get(CHEMIN).set('x-api-key', CLE_FLEET);
    expect(res.status).toBe(200);
    expect(res.body.voice).toBeNull();
  });

  it('une fiche malformée (voiceId vide) reçoit voice: null, sans casser l’appel', async () => {
    profiles.getClientProfile.mockResolvedValue(profilDeBase({
      voiceId: '   ',
      name: 'Rien',
      cloned: true,
    }));
    const app = await appMontee();
    const res = await request(app).get(CHEMIN).set('x-api-key', CLE_FLEET);
    expect(res.status).toBe(200);
    expect(res.body.voice).toBeNull();
    // Le reste du profil est intact : seule la voix est renoncée.
    expect(res.body.clientId).toBe(CLIENT_ID);
    expect(res.body.business).toBe('Chez Marie');
  });

  it('le payload respecte le contrat aller-retour consommé par voice_core.voix', async () => {
    profiles.getClientProfile.mockResolvedValue(profilDeBase({
      voiceId: 'xyz123cloneEL',
      name: 'Voix du gérant',
      cloned: true,
    }));
    const app = await appMontee();
    const res = await request(app).get(CHEMIN).set('x-api-key', CLE_FLEET);
    expect(res.status).toBe(200);
    // Exactement ces quatre clés, pas une de plus : le parseur Python lit
    // `voiceId`, `provider`, `cloned`, `name`. Toute clé ajoutée doit y
    // avoir droit dans les DEUX dépôts.
    expect(Object.keys(res.body.voice).sort()).toEqual(['cloned', 'name', 'provider', 'voiceId']);
    expect(typeof res.body.voice.voiceId).toBe('string');
    expect(['elevenlabs', 'cartesia']).toContain(res.body.voice.provider);
    expect(typeof res.body.voice.cloned).toBe('boolean');
  });
});
