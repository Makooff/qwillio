import { describe, it, expect } from 'vitest';

/**
 * ── QUEL AGENDA FAIT FOI ────────────────────────────────────────────────────
 *
 * Un client peut avoir Google ET Outlook connectés. Le risque n'est pas
 * théorique : il suffit d'un branchement raté, ou d'un client qui essaie les
 * deux, pour que deux agendas reçoivent — ou n'attendent — des rendez-vous
 * différents. La règle doit être écrite une fois et tenue partout.
 *
 * Le second piège est rétroactif : tous les comptes créés avant ce jour ont un
 * jeton Google et AUCUN `calendarProvider`. Exiger la colonne les aurait
 * débranchés du jour au lendemain.
 */

const { resolveCalendar, calendarForEvent, hasCalendar, calendarIntegrationId, bookingInstants } =
  await import('../calendar-provider.service');

const GOOGLE = { googleCalendarRefreshToken: 'g-tok', googleCalendarId: 'primary' };
const OUTLOOK = { outlookRefreshToken: 'o-tok', outlookCalendarId: null };

describe('resolveCalendar — décider de l’agenda', () => {
  it('un client sans agenda rend `null`, et ce n’est pas une erreur', () => {
    expect(resolveCalendar({})).toBeNull();
    expect(resolveCalendar(null)).toBeNull();
    expect(hasCalendar({})).toBe(false);
  });

  it('un client Google historique est reconnu SANS la colonne', () => {
    /* Le cas de tous les comptes existants : la colonne n'existe pas encore
       dans leurs données. La déduire du jeton les garde branchés. */
    expect(resolveCalendar(GOOGLE)?.provider).toBe('google');
  });

  it('le choix explicite gagne sur la déduction', () => {
    expect(resolveCalendar({ ...GOOGLE, ...OUTLOOK, calendarProvider: 'outlook' })?.provider).toBe('outlook');
    expect(resolveCalendar({ ...GOOGLE, ...OUTLOOK, calendarProvider: 'google' })?.provider).toBe('google');
  });

  it('un choix qui désigne un jeton disparu retombe sur l’autre', () => {
    /* Une déconnexion à moitié faite, ou un jeton effacé à la main. Rendre
       `null` laisserait l'agent promettre un rendez-vous sans l'écrire nulle
       part : le rendez-vous fantôme est pire que le mauvais agenda, parce que
       le second se voit. */
    expect(resolveCalendar({ ...GOOGLE, calendarProvider: 'outlook' })?.provider).toBe('google');
    expect(resolveCalendar({ ...OUTLOOK, calendarProvider: 'google' })?.provider).toBe('outlook');
  });

  it('le choix est insensible à la casse et aux espaces', () => {
    expect(resolveCalendar({ ...OUTLOOK, calendarProvider: 'OUTLOOK' })?.provider).toBe('outlook');
    expect(resolveCalendar({ ...GOOGLE, calendarProvider: ' Google ' })?.provider).toBe('google');
  });

  it('ne devine pas quand le client a les deux sans choix explicite', () => {
    /* Google d'abord, parce que c'est l'ordre d'arrivée : un client qui branche
       Outlook sans que Qwillio enregistre son choix (boucle ancienne, appel
       direct) ne doit pas voir ses rendez-vous changer de maison en silence. */
    expect(resolveCalendar({ ...GOOGLE, ...OUTLOOK })?.provider).toBe('google');
  });
});

describe('calendarForEvent — viser l’agenda qui a posé l’évènement', () => {
  it('supprime chez Google un évènement né sous Google, même si Outlook est actif', () => {
    /* LE cas qui compte. Le client bascule sur Outlook, puis annule un
       rendez-vous pris avant le basculement. Utiliser l'agenda actif donnerait
       un 404 silencieux, et le rendez-vous resterait dans l'agenda Google —
       l'appelant croirait avoir annulé. */
    const cible = calendarForEvent({ ...GOOGLE, ...OUTLOOK, calendarProvider: 'outlook' }, { eventId: 'g-1', provider: 'google' });
    expect(cible?.provider).toBe('google');
  });

  it('supprime chez Outlook un évènement né sous Outlook', () => {
    const cible = calendarForEvent({ ...GOOGLE, ...OUTLOOK, calendarProvider: 'google' }, { eventId: 'o-1', provider: 'outlook' });
    expect(cible?.provider).toBe('outlook');
  });

  it('un évènement sans propriétaire connu est chez Google', () => {
    // Tous les rendez-vous en base aujourd'hui, écrits avant Outlook.
    const cible = calendarForEvent(GOOGLE, { eventId: 'vieux' });
    expect(cible?.provider).toBe('google');
  });
});

describe('calendarIntegrationId — le nom au sens du catalogue', () => {
  it('rend l’identifiant attendu par la page Intégrations', () => {
    expect(calendarIntegrationId('google')).toBe('google-calendar');
    expect(calendarIntegrationId('outlook')).toBe('outlook-calendar');
  });
});

describe('bookingInstants — l’heure est celle de l’ENTREPRISE', () => {
  /* Le fuseau vient de `onboardingData.timezone` quand le client l'a renseigné,
     du pays sinon, de la langue en dernier recours. On teste la première voie :
     c'est celle qui porte la vraie réponse pour un client existant. */
  const client = (tz: string) => ({ onboardingData: { timezone: tz } });

  it('pose 9 h à Bruxelles quand on demande 9 h, pas 9 h UTC', () => {
    /* Le bug du 12/09/2026 : « neuf heures » demandé, 15 h dans l'agenda.
       `setHours(9)` écrivait 9 h dans le fuseau du processus, et l'été belge
       étant à UTC+2, l'agenda affichait 15 h. */
    const { startIso, timeZone } = bookingInstants(
      { bookingDate: new Date('2026-07-15T00:00:00Z'), bookingTime: '09:00' },
      client('Europe/Brussels'),
    );

    expect(timeZone).toBe('Europe/Brussels');
    expect(startIso).toBe('2026-07-15T07:00:00.000Z'); // 09:00 CEST
  });

  it('donne le même créneau aux deux fournisseurs', () => {
    /* C'est la raison d'être de cette fonction partagée: deux calculs séparés
       finiraient par diverger d'une heure le jour où quelqu'un n'en corrige
       qu'un. */
    const a = bookingInstants({ bookingDate: new Date('2026-01-15T00:00:00Z'), bookingTime: '14:30' }, client('Europe/Brussels'));
    const b = bookingInstants({ bookingDate: new Date('2026-01-15T00:00:00Z'), bookingTime: '14:30' }, client('Europe/Brussels'));
    expect(a.startIso).toBe(b.startIso);
  });

  it('dure une heure par défaut', () => {
    const { startIso, endIso } = bookingInstants(
      { bookingDate: new Date('2026-07-15T00:00:00Z'), bookingTime: '09:00' },
      client('Europe/Brussels'),
    );
    expect(new Date(endIso).getTime() - new Date(startIso).getTime()).toBe(3600_000);
  });
});
