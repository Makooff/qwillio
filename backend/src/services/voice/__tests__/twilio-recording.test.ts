import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  recordingsCreate: vi.fn(),
  recordingsList: vi.fn(),
  recordingRemove: vi.fn(),
  recordingFetch: vi.fn(),
  callsList: vi.fn(),
  env: {
    TWILIO_TRUNK_REGION: 'ie1',
    TWILIO_TRUNK_EDGE: 'dublin',
    TWILIO_TRUNK_KEY_SID: 'SK' + '1'.repeat(32),
    TWILIO_TRUNK_KEY_SECRET: 'secret',
    TWILIO_ACCOUNT_SID: 'AC' + '9'.repeat(32),
    TWILIO_AUTH_TOKEN: 'jeton',
  },
}));

vi.mock('../../../config/twilio-trunk', async importOriginal => ({
  ...await importOriginal<typeof import('../../../config/twilio-trunk')>(),
  twilioTrunkClient: () => ({
    calls: Object.assign(
      (_sid: string) => ({ recordings: { create: h.recordingsCreate } }),
      { list: h.callsList },
    ),
    recordings: Object.assign(
      (_sid: string) => ({ remove: h.recordingRemove, fetch: h.recordingFetch }),
      { list: h.recordingsList },
    ),
  }),
}));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../config/env', () => ({
  env: h.env,
}));

import { twilioRecordingService, sidDepuisUrl, enteteAuthTwilio } from '../twilio-recording.service';

const CA = 'CA' + 'a'.repeat(32);
const RE = 'RE' + 'b'.repeat(32);
const AC = h.env.TWILIO_ACCOUNT_SID;
const mediaUrl = `https://api.dublin.ie1.twilio.com/2010-04-01/Accounts/${AC}/Recordings/${RE}.mp3`;

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
    await expect(twilioRecordingService.supprimer(RE, mediaUrl)).resolves.toBe(true);
  });

  it('traite un 404 comme un succès: l’audio n’existe plus, c’est le but', async () => {
    h.recordingRemove.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
    await expect(twilioRecordingService.supprimer(RE, mediaUrl)).resolves.toBe(true);
  });

  it('rend false sur un vrai refus, pour que la ligne garde son URL et soit retentée', async () => {
    h.recordingRemove.mockRejectedValue(Object.assign(new Error('nope'), { status: 500 }));
    await expect(twilioRecordingService.supprimer(RE, mediaUrl)).resolves.toBe(false);
  });
});

describe('enteteAuthTwilio — le portail lit un média privé dans sa région', () => {
  it('utilise la clé régionale pour un média IE1', () => {
    const attendu = 'Basic ' + Buffer.from(`${h.env.TWILIO_TRUNK_KEY_SID}:secret`).toString('base64');
    expect(enteteAuthTwilio(mediaUrl)).toBe(attendu);
  });

  it('ne replie pas un média US1 sur une clé régionale', () => {
    const garder = { ...h.env };
    h.env.TWILIO_AUTH_TOKEN = '';
    try {
      expect(enteteAuthTwilio(mediaUrl.replace('api.dublin.ie1.twilio.com', 'api.twilio.com'))).toBeNull();
    } finally { Object.assign(h.env, garder); }
  });

  it('rend null quand AUCUN identifiant n’est configuré', () => {
    const garder = { ...h.env };
    h.env.TWILIO_TRUNK_KEY_SID = '';
    h.env.TWILIO_TRUNK_KEY_SECRET = '';
    h.env.TWILIO_ACCOUNT_SID = '';
    h.env.TWILIO_AUTH_TOKEN = '';
    try {
      expect(enteteAuthTwilio(mediaUrl)).toBeNull();
    } finally { Object.assign(h.env, garder); }
  });

  it('rend un en-tête Basic, pas une URL signée', () => {
    expect(enteteAuthTwilio(mediaUrl)?.startsWith('Basic ')).toBe(true);
  });
});

/**
 * LE SID QUI N'ARRIVE PAS DU PONT.
 *
 * LiveKit ne remplit `sip.twilio.callSid` que s'il reconnaît le trunk comme
 * Twilio. Quand l'attribut manque, le pont n'envoie rien, `demarrer` n'est
 * jamais appelé, et l'enregistrement n'existe pas — sans que rien ne le dise.
 * Ces tests verrouillent le rattrapage: on retrouve l'appel en cours chez
 * Twilio par l'appelant et l'instant, jamais par approximation large.
 */
describe('sidEnCours — retrouver l’appel quand le pont n’a pas donné le SID', () => {
  const maintenant = new Date('2026-10-27T22:02:00Z');

  it('rend le SID de l’appel en cours le plus récent de cet appelant', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(maintenant);
    h.callsList.mockResolvedValue([
      { sid: 'CA' + '1'.repeat(32), dateCreated: new Date(maintenant.getTime() - 30_000), to: 'sip:+32470006690@livekit' },
      { sid: 'CA' + '2'.repeat(32), dateCreated: new Date(maintenant.getTime() - 10_000), to: 'sip:+32470006690@livekit' },
    ]);
    await expect(twilioRecordingService.sidEnCours('+32475123456', '+32470006690'))
      .resolves.toBe('CA' + '2'.repeat(32));
    vi.useRealTimers();
  });

  it('ignore un appel trop vieux — mieux vaut pas d’audio qu’un autre appelant', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(maintenant);
    h.callsList.mockResolvedValue([
      { sid: 'CA' + '3'.repeat(32), dateCreated: new Date(maintenant.getTime() - 600_000), to: 'sip:+32470006690@livekit' },
    ]);
    await expect(twilioRecordingService.sidEnCours('+32475123456')).resolves.toBeNull();
    vi.useRealTimers();
  });

  it('ne cherche pas pour un numéro qui n’en est pas un', async () => {
    await expect(twilioRecordingService.sidEnCours('anonymous')).resolves.toBeNull();
    expect(h.callsList).not.toHaveBeenCalled();
  });

  it('rend null plutôt que de lever quand Twilio répond mal', async () => {
    h.callsList.mockRejectedValue(new Error('503'));
    await expect(twilioRecordingService.sidEnCours('+32475123456')).resolves.toBeNull();
  });
});

describe('parSid — l’audio retrouvé par son RE quand le CA manque', () => {
  const uri = `/2010-04-01/Accounts/${AC}/Recordings/${RE}.json`;

  it('rend l’URL du média d’un enregistrement terminé', async () => {
    h.recordingFetch.mockResolvedValue({ sid: RE, status: 'completed', uri });
    await expect(twilioRecordingService.parSid(RE)).resolves.toEqual({ sid: RE, url: mediaUrl });
  });

  it('laisse de côté un enregistrement encore en cours de traitement', async () => {
    h.recordingFetch.mockResolvedValue({ sid: RE, status: 'processing', uri });
    await expect(twilioRecordingService.parSid(RE)).resolves.toBeNull();
  });

  it('ne demande rien pour autre chose qu’un RE', async () => {
    await expect(twilioRecordingService.parSid(CA)).resolves.toBeNull();
    expect(h.recordingFetch).not.toHaveBeenCalled();
  });

  it('rend null plutôt que de lever quand le média a disparu', async () => {
    h.recordingFetch.mockRejectedValue(new Error('404'));
    await expect(twilioRecordingService.parSid(RE)).resolves.toBeNull();
  });
});
