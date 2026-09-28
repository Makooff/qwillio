import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  recordingsCreate: vi.fn(),
  recordingsList: vi.fn(),
  recordingRemove: vi.fn(),
}));

vi.mock('../../../config/twilio-trunk', () => ({
  twilioTrunkClient: () => ({
    calls: () => ({ recordings: { create: h.recordingsCreate } }),
    recordings: Object.assign(
      (_sid: string) => ({ remove: h.recordingRemove }),
      { list: h.recordingsList },
    ),
  }),
}));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../config/env', () => ({
  env: {
    TWILIO_TRUNK_REGION: 'ie1',
    TWILIO_TRUNK_EDGE: 'dublin',
    TWILIO_TRUNK_KEY_SID: 'SK' + '1'.repeat(32),
    TWILIO_TRUNK_KEY_SECRET: 'secret',
    TWILIO_ACCOUNT_SID: 'AC' + '9'.repeat(32),
    TWILIO_AUTH_TOKEN: 'jeton',
  },
}));

import { twilioRecordingService, sidDepuisUrl, enteteAuthTwilio } from '../twilio-recording.service';

const CA = 'CA' + 'a'.repeat(32);
const RE = 'RE' + 'b'.repeat(32);
const AC = 'AC' + 'c'.repeat(32);

beforeEach(() => vi.clearAllMocks());

/**
 * L'enregistrement au niveau du TRUNK enregistre tous les clients à la fois,
 * y compris ceux qui l'ont coupé, sans que la purge sache qu'il existe. Ces
 * tests verrouillent l'alternative: un enregistrement par appel, démarré
 * seulement quand il est permis, et retrouvable par la purge.
 */
describe('sidDepuisUrl — la purge doit savoir où vit l’audio', () => {
  it('lit le SID dans une URL Twilio', () => {
    expect(sidDepuisUrl(`https://api.twilio.com/2010-04-01/Accounts/${AC}/Recordings/${RE}.mp3`)).toBe(RE);
  });

  it('lit aussi un hôte régional — le trunk est en Irlande', () => {
    expect(sidDepuisUrl(`https://api.dublin.ie1.twilio.com/2010-04-01/Accounts/${AC}/Recordings/${RE}.mp3`)).toBe(RE);
  });

  it('ne reconnaît PAS une URL Vapi/R2, qui se supprime ailleurs', () => {
    // Confondre les deux enverrait un DELETE Twilio sur un audio Vapi: le 404
    // passerait pour un succès et l'audio survivrait à sa propre purge.
    expect(sidDepuisUrl('https://abc.r2.cloudflarestorage.com/vapi/call.wav')).toBeNull();
  });

  it('supporte null et une chaîne vide sans lever', () => {
    expect(sidDepuisUrl(null)).toBeNull();
    expect(sidDepuisUrl('')).toBeNull();
  });
});

describe('demarrer — au décroché, et jamais sur le trunk', () => {
  it('demande deux canaux et ne rogne pas le début', async () => {
    h.recordingsCreate.mockResolvedValue({ sid: RE });
    await expect(twilioRecordingService.demarrer(CA)).resolves.toBe(RE);
    // `do-not-trim`: l'annonce d'enregistrement est dans les premières
    // secondes, et une preuve de consentement rognée ne prouve plus rien.
    expect(h.recordingsCreate).toHaveBeenCalledWith({ recordingChannels: 'dual', trim: 'do-not-trim' });
  });

  it("n'appelle même pas Twilio sur un SID qui n'en est pas un", async () => {
    await expect(twilioRecordingService.demarrer('le nom de la salle')).resolves.toBeNull();
    expect(h.recordingsCreate).not.toHaveBeenCalled();
  });

  it('rend null plutôt que de lever: un appel vaut mieux qu’un enregistrement', async () => {
    h.recordingsCreate.mockRejectedValue(new Error('twilio down'));
    await expect(twilioRecordingService.demarrer(CA)).resolves.toBeNull();
  });
});

describe('delAppel — à la fin, et seulement si le média existe', () => {
  it('construit l’URL .mp3 sur l’hôte de la RÉGION, pas sur us1', async () => {
    // Préfixer par `api.twilio.com` marche pour un compte us1 et rend 404
    // pour une ressource irlandaise: la lecture casserait sur les appels les
    // plus récents seulement, le genre de panne qu'on met une semaine à voir.
    h.recordingsList.mockResolvedValue([
      { sid: RE, status: 'completed', uri: `/2010-04-01/Accounts/${AC}/Recordings/${RE}.json` },
    ]);
    await expect(twilioRecordingService.delAppel(CA)).resolves.toEqual({
      sid: RE,
      url: `https://api.dublin.ie1.twilio.com/2010-04-01/Accounts/${AC}/Recordings/${RE}.mp3`,
    });
  });

  it('rend null tant que l’enregistrement est en traitement', async () => {
    // Une URL rendue trop tôt répond 404 au portail, ce qui est pire qu'une
    // absence d'URL: l'absence se dit, le 404 se découvre en cliquant.
    h.recordingsList.mockResolvedValue([{ sid: RE, status: 'processing', uri: 'x.json' }]);
    await expect(twilioRecordingService.delAppel(CA)).resolves.toBeNull();
  });

  it('rend null quand il n’y a rien — l’état normal d’un client qui a coupé', async () => {
    h.recordingsList.mockResolvedValue([]);
    await expect(twilioRecordingService.delAppel(CA)).resolves.toBeNull();
  });
});

describe('supprimer — la purge doit pouvoir se rejouer', () => {
  it('efface et confirme', async () => {
    h.recordingRemove.mockResolvedValue(undefined);
    await expect(twilioRecordingService.supprimer(RE)).resolves.toBe(true);
  });

  it('traite un 404 comme un succès: l’audio n’existe plus, c’est le but', async () => {
    h.recordingRemove.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
    await expect(twilioRecordingService.supprimer(RE)).resolves.toBe(true);
  });

  it('rend false sur un vrai refus, pour que la ligne garde son URL et soit retentée', async () => {
    h.recordingRemove.mockRejectedValue(Object.assign(new Error('nope'), { status: 500 }));
    await expect(twilioRecordingService.supprimer(RE)).resolves.toBe(false);
  });
});

describe('enteteAuthTwilio — le portail lit un média privé', () => {
  it('préfère la clé régionale, celle qui a créé l’enregistrement', () => {
    const attendu = 'Basic ' + Buffer.from(`SK${'1'.repeat(32)}:secret`).toString('base64');
    expect(enteteAuthTwilio()).toBe(attendu);
  });

  it('rend un en-tête Basic, pas une URL signée', () => {
    // Vapi signe ses adresses, Twilio non: c'est le compte qui ouvre la
    // sienne. Sans cet en-tête le lecteur affiche un 502 et le gérant conclut
    // que l'appel n'a pas été enregistré.
    expect(enteteAuthTwilio()?.startsWith('Basic ')).toBe(true);
  });
});
