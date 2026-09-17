import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * LE JETON D'ACCÈS GOOGLE SE FRAPPE UNE FOIS PAR HEURE, PAS PAR LECTURE
 * (17/09/2026).
 *
 * Appel réel: `checkAvailability` à 4,0 s, 12,6 s, 13,3 s puis 15,5 s, et le
 * propriétaire: « il met du temps à répondre donc répond en même temps que
 * moi ». La lenteur ne fait pas qu'attendre, elle FABRIQUE le chevauchement:
 * l'agent pose une question, l'outil tourne quinze secondes, l'appelant parle
 * pendant ce temps.
 *
 * `getOAuthClient()` rendait un client NEUF à chaque appel, donc
 * `getAccessToken()` n'avait rien à réutiliser: chaque lecture d'agenda payait
 * deux allers-retours séquentiels vers Google depuis l'Oregon, alors que le
 * premier vaut une heure.
 */
const { getAccessToken, setCredentials, credentials } = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  setCredentials: vi.fn(),
  credentials: { expiry_date: undefined as number | undefined },
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    credentials = credentials;
    setCredentials = setCredentials;
    getAccessToken = getAccessToken;
  },
}));
vi.mock('../../config/database', () => ({ prisma: {} }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { googleCalendarService } = await import('../google-calendar.service');

const REFRESH = '1//refresh-token-du-client';

beforeEach(() => {
  getAccessToken.mockReset();
  credentials.expiry_date = undefined;
  googleCalendarService.forgetAccessToken(REFRESH);
});

describe('le jeton Google est retenu', () => {
  it('une seule frappe pour trois lectures', async () => {
    getAccessToken.mockResolvedValue({ token: 'ya29.aaa' });
    expect(await googleCalendarService.getAccessTokenFromRefresh(REFRESH)).toBe('ya29.aaa');
    await googleCalendarService.getAccessTokenFromRefresh(REFRESH);
    await googleCalendarService.getAccessTokenFromRefresh(REFRESH);
    expect(getAccessToken).toHaveBeenCalledTimes(1);
  });

  it('trois demandes CONCURRENTES partagent la même frappe', async () => {
    /* Sans ça, trois outils lancés ensemble en déclenchent trois, et c'est
       exactement le cas d'un appel qui consulte plusieurs jours. */
    let resolve: (v: { token: string }) => void = () => {};
    getAccessToken.mockReturnValue(new Promise(r => { resolve = r; }));
    const all = Promise.all([
      googleCalendarService.getAccessTokenFromRefresh(REFRESH),
      googleCalendarService.getAccessTokenFromRefresh(REFRESH),
      googleCalendarService.getAccessTokenFromRefresh(REFRESH),
    ]);
    resolve({ token: 'ya29.bbb' });
    expect(await all).toEqual(['ya29.bbb', 'ya29.bbb', 'ya29.bbb']);
    expect(getAccessToken).toHaveBeenCalledTimes(1);
  });

  it('un jeton ÉCHU est refrappé, avec une marge', async () => {
    /* La marge porte le correctif: un jeton qui expire entre notre lecture et
       l'arrivée de la requête chez Google rendrait un 401 au milieu d'un
       appel. Une échéance dans trente secondes est donc déjà périmée. */
    credentials.expiry_date = Date.now() + 30_000;
    getAccessToken.mockResolvedValue({ token: 'ya29.court' });
    await googleCalendarService.getAccessTokenFromRefresh(REFRESH);
    await googleCalendarService.getAccessTokenFromRefresh(REFRESH);
    expect(getAccessToken).toHaveBeenCalledTimes(2);
  });

  it('une échéance lointaine est retenue', async () => {
    credentials.expiry_date = Date.now() + 3600_000;
    getAccessToken.mockResolvedValue({ token: 'ya29.long' });
    await googleCalendarService.getAccessTokenFromRefresh(REFRESH);
    await googleCalendarService.getAccessTokenFromRefresh(REFRESH);
    expect(getAccessToken).toHaveBeenCalledTimes(1);
  });

  it('un refus ne laisse pas la clé coincée en vol', async () => {
    /* Sinon toute lecture d'agenda de ce client est bloquée pour la vie du
       processus, ce qui est pire que la lenteur qu'on corrige. */
    getAccessToken.mockRejectedValueOnce(new Error('google down'));
    await expect(googleCalendarService.getAccessTokenFromRefresh(REFRESH)).rejects.toThrow('google down');
    getAccessToken.mockResolvedValue({ token: 'ya29.apres' });
    expect(await googleCalendarService.getAccessTokenFromRefresh(REFRESH)).toBe('ya29.apres');
  });

  it('deux clients ne partagent pas un jeton', async () => {
    getAccessToken.mockResolvedValueOnce({ token: 'ya29.un' }).mockResolvedValueOnce({ token: 'ya29.deux' });
    expect(await googleCalendarService.getAccessTokenFromRefresh(REFRESH)).toBe('ya29.un');
    expect(await googleCalendarService.getAccessTokenFromRefresh('1//autre-client')).toBe('ya29.deux');
    googleCalendarService.forgetAccessToken('1//autre-client');
  });

  it('une frappe sans jeton lève, elle ne met pas `undefined` en cache', async () => {
    getAccessToken.mockResolvedValue({ token: null });
    await expect(googleCalendarService.getAccessTokenFromRefresh(REFRESH)).rejects.toThrow(/mint/i);
  });
});
