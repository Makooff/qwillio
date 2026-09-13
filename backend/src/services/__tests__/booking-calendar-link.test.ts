import { describe, it, expect } from 'vitest';
import { googleCalendarTemplateUrl } from '../booking-ics';

describe('googleCalendarTemplateUrl — le lien qui ouvre l\'agenda du téléphone', () => {
  const event = {
    summary: 'Détartrage · Demtalix',
    start: new Date('2026-09-14T15:00:00Z'),
    end: new Date('2026-09-14T16:00:00Z'),
    location: 'Rue Neuve 1 1000 Bruxelles',
    description: 'Rendez-vous chez Demtalix · 02 123 45 67',
    timezone: 'Europe/Brussels',
  };

  it('porte les instants en UTC et le fuseau d\'affichage', () => {
    const url = new URL(googleCalendarTemplateUrl(event));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20260914T150000Z/20260914T160000Z');
    expect(url.searchParams.get('ctz')).toBe('Europe/Brussels');
    expect(url.searchParams.get('text')).toBe('Détartrage · Demtalix');
    expect(url.searchParams.get('location')).toBe('Rue Neuve 1 1000 Bruxelles');
  });

  it('omet le lieu quand le client n\'en a pas', () => {
    const url = new URL(googleCalendarTemplateUrl({ ...event, location: '' }));
    expect(url.searchParams.has('location')).toBe(false);
  });
});
