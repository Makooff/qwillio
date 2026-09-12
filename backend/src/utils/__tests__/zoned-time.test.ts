import { describe, it, expect } from 'vitest';
import { zonedInstant, ymdOf, businessTimezone } from '../zoned-time';

/**
 * « Neuf heures » demandé, 15 h dans l'agenda (appel réel, 12/09/2026): six
 * heures d'écart, New York → Bruxelles. L'heure d'un rendez-vous se lit dans
 * le fuseau de l'ENTREPRISE, jamais dans celui du serveur.
 */
describe('zonedInstant', () => {
  it('pose 9 h de Bruxelles à 7 h UTC en été', () => {
    expect(zonedInstant('2026-09-17', '09:00', 'Europe/Brussels').toISOString()).toBe('2026-09-17T07:00:00.000Z');
  });

  it('pose 9 h de Bruxelles à 8 h UTC en hiver', () => {
    expect(zonedInstant('2026-12-17', '09:00', 'Europe/Brussels').toISOString()).toBe('2026-12-17T08:00:00.000Z');
  });

  it('ne dépend pas du fuseau du processus', () => {
    // 9 h à New York, c'est 13 h UTC en septembre: l'ancien code donnait cela pour un client belge.
    expect(zonedInstant('2026-09-17', '09:00', 'America/New_York').toISOString()).toBe('2026-09-17T13:00:00.000Z');
  });

  it('tient le jour du changement d\'heure', () => {
    // 25 octobre 2026, 03:00 à Bruxelles, après le retour à l'heure d'hiver: 02:00 UTC.
    expect(zonedInstant('2026-10-25', '03:00', 'Europe/Brussels').toISOString()).toBe('2026-10-25T02:00:00.000Z');
  });
});

describe('ymdOf', () => {
  it('lit le jour d\'une date stockée à midi UTC sans passer par le fuseau local', () => {
    expect(ymdOf(new Date('2026-09-17T12:00:00Z'))).toBe('2026-09-17');
  });
});

describe('businessTimezone', () => {
  it('prend le fuseau posé à l\'inscription avant tout', () => {
    expect(businessTimezone({ onboardingData: { timezone: 'Europe/Paris' }, country: 'BE' })).toBe('Europe/Paris');
  });

  it('retombe sur le pays, puis la ville', () => {
    expect(businessTimezone({ country: 'BE' })).toBe('Europe/Brussels');
    expect(businessTimezone({ country: 'US', city: 'Los Angeles' })).toBe('America/Los_Angeles');
  });

  it('sans pays, un agent francophone est en Europe', () => {
    expect(businessTimezone({ agentLanguage: 'fr' })).toBe('Europe/Brussels');
    expect(businessTimezone({ agentLanguage: 'en' })).toBe('America/New_York');
  });
});
