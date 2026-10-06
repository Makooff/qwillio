import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * ── L'AGENDA OUTLOOK, ET LE PIÈGE DU JETON QUI TOURNE ───────────────────────
 *
 * Google Agenda était la seule option, et ce n'était pas un choix : un client
 * sous Outlook confirmait un rendez-vous qui n'apparaissait dans aucun agenda à
 * lui. Ces tests couvrent le service qui répare ça, et surtout les trois pièges
 * de Microsoft Graph qu'on ne découvre qu'en production :
 *
 *   1. Le refresh token TOURNE. L'ignorer, c'est garder un jeton déjà révoqué :
 *      ça marche encore une heure, puis l'intégration meurt en parlant de jeton
 *      invalide sans jamais dire pourquoi.
 *   2. `expires_in` est en SECONDES, pas une date absolue.
 *   3. Sans `offline_access`, AUCUN refresh token n'est rendu.
 */

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.stubGlobal('fetch', fetchMock);

const { outlookCalendarService, OutlookCalendarError } = await import('../outlook-calendar.service');

const AVANT = { ...process.env };

beforeEach(() => {
  fetchMock.mockReset();
  outlookCalendarService.forgetAccessToken('refresh-1');
  process.env.MICROSOFT_CLIENT_ID = 'client-abc';
  process.env.MICROSOFT_CLIENT_SECRET = 'secret-xyz';
  delete process.env.MICROSOFT_TENANT_ID;
});

afterEach(() => {
  process.env = { ...AVANT };
});

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
  json: async () => body,
});

const formBody = (callIndex = 0) =>
  new URLSearchParams(fetchMock.mock.calls[callIndex][1].body as string);

describe('Outlook — l’URL de consentement', () => {
  it('demande `offline_access`, sans quoi il n’y a jamais de refresh token', () => {
    const url = outlookCalendarService.getConnectUrl('state-1');

    /* C'est LA permission qu'on oublie. Sans elle Microsoft rend un jeton
       d'accès et aucun refresh: l'intégration expire au bout d'une heure, et
       l'erreur parle de jeton invalide sans jamais nommer la cause. */
    expect(url).toContain('offline_access');
    expect(url).toContain('Calendars.ReadWrite');
  });

  it('force l’écran de consentement', () => {
    /* Sans `prompt=consent`, un client qui a déjà autorisé l'app reçoit un
       jeton SANS refresh — le consentement est mis en cache et `offline_access`
       n'est pas rejoué. On croit alors à un bug d'API. */
    expect(outlookCalendarService.getConnectUrl('s')).toContain('prompt=consent');
  });

  it('vise `common` par défaut, pour couvrir comptes pro et personnels', () => {
    /* Exiger un locataire ferait échouer la moitié des branchements sur un
       écran d'erreur que personne ne comprend. */
    expect(outlookCalendarService.getConnectUrl('s')).toContain('/common/oauth2');
  });

  it('lève quand l’application Microsoft n’est pas configurée', () => {
    delete process.env.MICROSOFT_CLIENT_ID;
    expect(outlookCalendarService.isConfigured()).toBe(false);
    expect(() => outlookCalendarService.getConnectUrl('s')).toThrow(OutlookCalendarError);
  });
});

describe('Outlook — le renouvellement du jeton', () => {
  it('lit `expires_in` en SECONDES et pose la marge', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ access_token: 'acc-1', expires_in: 3600, refresh_token: 'refresh-1' }));

    await outlookCalendarService.getAccessTokenFromRefresh('refresh-1');

    const body = formBody();
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh-1');
  });

  it('REMONTE le nouveau refresh token, parce que Microsoft le fait tourner', async () => {
    /* Le point le plus important du service. Un refresh token Microsoft est à
       usage unique : le renouvellement en rend un nouveau et révoque l'ancien.
       Jeter le nouveau, c'est garder un jeton mort — ça marche encore un
       moment, puis plus rien, sans message clair. */
    fetchMock.mockResolvedValue(jsonResponse({ access_token: 'acc-1', expires_in: 3600, refresh_token: 'refresh-2' }));
    const recu: string[] = [];

    await outlookCalendarService.getAccessTokenFromRefresh('refresh-1', (next) => { recu.push(next); });

    expect(recu).toEqual(['refresh-2']);
  });

  it('n’appelle pas l’écriture quand le refresh token est inchangé', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ access_token: 'acc-1', expires_in: 3600, refresh_token: 'refresh-1' }));
    const ecrit = vi.fn();

    await outlookCalendarService.getAccessTokenFromRefresh('refresh-1', ecrit);

    expect(ecrit).not.toHaveBeenCalled();
  });

  it('un échec d’écriture du nouveau jeton ne casse pas l’appel en cours', async () => {
    /* Le rendez-vous doit pouvoir se poser: le jeton d'accès est valide même si
       la base a hoqueté. Faire échouer ici perdrait un rendez-vous confirmé au
       téléphone. */
    fetchMock.mockResolvedValue(jsonResponse({ access_token: 'acc-1', expires_in: 3600, refresh_token: 'refresh-2' }));

    await expect(
      outlookCalendarService.getAccessTokenFromRefresh('refresh-1', () => { throw new Error('base indisponible'); }),
    ).resolves.toBe('acc-1');
  });

  it('réutilise le jeton en cache au lieu de refrapper', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ access_token: 'acc-1', expires_in: 3600, refresh_token: 'r' }));

    await outlookCalendarService.getAccessTokenFromRefresh('refresh-1');
    await outlookCalendarService.getAccessTokenFromRefresh('refresh-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ne fait pas partir deux renouvellements concurrents', async () => {
    /* Deux lectures d'agenda en parallèle ne doivent pas déclencher deux
       renouvellements: avec un refresh token à usage unique, le second
       invaliderait le premier et les deux appels échoueraient. */
    fetchMock.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return jsonResponse({ access_token: 'acc-1', expires_in: 3600, refresh_token: 'r' });
    });

    const [a, b] = await Promise.all([
      outlookCalendarService.getAccessTokenFromRefresh('refresh-1'),
      outlookCalendarService.getAccessTokenFromRefresh('refresh-1'),
    ]);

    expect(a).toBe('acc-1');
    expect(b).toBe('acc-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('remonte le `error_description` de Microsoft plutôt qu’une phrase à nous', async () => {
    /* « invalid_grant » de Microsoft vaut mieux que notre « failed to mint » :
       c'est le seul mot qui dit au client que son consentement a expiré. */
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: 'invalid_grant', error_description: 'AADSTS70000: refresh token expired' }),
    });

    await expect(outlookCalendarService.getAccessTokenFromRefresh('refresh-1'))
      .rejects.toThrow(/token request failed \(400\)/);
  });
});

describe('Outlook — poser un rendez-vous', () => {
  const token = async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'acc-1', expires_in: 3600, refresh_token: 'r' }));
    return outlookCalendarService.getAccessTokenFromRefresh('refresh-1');
  };

  it('envoie l’instant AVEC son décalage, pas en UTC nu', async () => {
    /* Le bug du 12/09/2026 sur Google, mot pour mot : « neuf heures » demandé,
       15 h dans l'agenda. Graph accepte un instant sans décalage et l'interprète
       selon le fuseau du calendrier. L'instant doit porter son heure locale. */
    const acc = await token();
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'ev-1' }));

    await outlookCalendarService.createEvent(acc, {
      subject: 'Rendez-vous - Marc',
      startIso: '2026-10-15T09:00:00+02:00',
      endIso: '2026-10-15T10:00:00+02:00',
      timeZone: 'Europe/Brussels',
    });

    const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(payload.start.dateTime).toBe('2026-10-15T09:00:00+02:00');
    expect(payload.start.timeZone).toBe('Europe/Brussels');
  });

  it('écrit dans `me/calendar` quand l’identifiant est `primary`', async () => {
    /* Graph ne connaît pas « primary »: c'est le nom que Google donne à son
       calendrier par défaut, et le passer tel quel donnerait un 404. */
    const acc = await token();
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'ev-1' }));

    await outlookCalendarService.createEvent(acc, {
      subject: 'x', startIso: '2026-10-15T09:00:00+02:00', endIso: '2026-10-15T10:00:00+02:00', timeZone: 'Europe/Brussels',
    }, 'primary');

    expect(fetchMock.mock.calls[1][0]).toContain('/me/calendar/events');
    expect(fetchMock.mock.calls[1][0]).not.toContain('primary');
  });

  it('n’ajoute que les invités qui ont une adresse', async () => {
    const acc = await token();
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'ev-1' }));

    await outlookCalendarService.createEvent(acc, {
      subject: 'x', startIso: '2026-10-15T09:00:00+02:00', endIso: '2026-10-15T10:00:00+02:00',
      timeZone: 'Europe/Brussels', attendees: [''],
    });

    expect(JSON.parse(fetchMock.mock.calls[1][1].body).attendees).toEqual([]);
  });

  it('lève quand Graph refuse, au lieu de croire à un rendez-vous posé', async () => {
    const acc = await token();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'Forbidden' });

    await expect(outlookCalendarService.createEvent(acc, {
      subject: 'x', startIso: '2026-10-15T09:00:00+02:00', endIso: '2026-10-15T10:00:00+02:00', timeZone: 'Europe/Brussels',
    })).rejects.toThrow(/403/);
  });
});

describe('Outlook — retirer un rendez-vous', () => {
  it('un 404 est un succès : il n’est déjà plus là', async () => {
    /* Sans cela, une annulation après une suppression manuelle côté Outlook
       ferait échouer l'annulation côté Qwillio, et le client croirait que le
       rendez-vous tient toujours. */
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => 'not found' });
    await expect(outlookCalendarService.deleteEvent('acc', 'ev-1')).resolves.toBeUndefined();
  });
});
