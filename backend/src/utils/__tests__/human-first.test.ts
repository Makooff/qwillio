import { describe, it, expect } from 'vitest';
import { humanFirstActive, parseHumanFirst } from '../human-first';

const TZ = 'Europe/Brussels';
const semaine = { enabled: true, days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00' };
// Lundi 16 novembre 2026. Bruxelles est à UTC+1 en novembre.
const lundi = (hhmm: string) => new Date(`2026-11-16T${hhmm}:00+01:00`);

describe('la plage « mon téléphone d\'abord »', () => {
  it('est active dans la plage, un jour coché', () => {
    expect(humanFirstActive(semaine, lundi('09:00'), TZ)).toBe(true);
    expect(humanFirstActive(semaine, lundi('16:59'), TZ)).toBe(true);
  });

  it('s\'arrête à l\'heure de fin, et ne commence pas avant', () => {
    expect(humanFirstActive(semaine, lundi('08:59'), TZ)).toBe(false);
    expect(humanFirstActive(semaine, lundi('17:00'), TZ)).toBe(false);
  });

  it('ne vaut pas un jour non coché', () => {
    const dimanche = new Date('2026-11-15T10:00:00+01:00');
    expect(humanFirstActive(semaine, dimanche, TZ)).toBe(false);
  });

  it('se lit dans le fuseau du commerce, pas dans celui du serveur', () => {
    // 08:30 UTC, c'est 09:30 à Bruxelles : dans la plage.
    expect(humanFirstActive(semaine, new Date('2026-11-16T08:30:00Z'), TZ)).toBe(true);
    // 16:30 UTC, c'est 17:30 à Bruxelles : hors plage, alors qu'un serveur en UTC y verrait 16 h 30.
    expect(humanFirstActive(semaine, new Date('2026-11-16T16:30:00Z'), TZ)).toBe(false);
  });

  it('suit l\'heure d\'été', () => {
    // Lundi 6 juillet 2026, Bruxelles à UTC+2 : 07:30 UTC = 09:30.
    expect(humanFirstActive(semaine, new Date('2026-07-06T07:30:00Z'), TZ)).toBe(true);
    expect(humanFirstActive(semaine, new Date('2026-07-06T06:30:00Z'), TZ)).toBe(false);
  });

  it('rattache une plage qui passe minuit au jour où elle commence', () => {
    const nuit = { enabled: true, days: [5], from: '22:00', to: '06:00' }; // vendredi
    expect(humanFirstActive(nuit, new Date('2026-11-20T23:00:00+01:00'), TZ)).toBe(true);  // vendredi 23 h
    expect(humanFirstActive(nuit, new Date('2026-11-21T05:00:00+01:00'), TZ)).toBe(true);  // samedi 5 h
    expect(humanFirstActive(nuit, new Date('2026-11-21T07:00:00+01:00'), TZ)).toBe(false); // samedi 7 h
    expect(humanFirstActive(nuit, new Date('2026-11-21T23:00:00+01:00'), TZ)).toBe(false); // samedi 23 h
    expect(humanFirstActive(nuit, new Date('2026-11-20T05:00:00+01:00'), TZ)).toBe(false); // vendredi 5 h
  });

  it('reste éteinte tant qu\'elle n\'est pas activée', () => {
    expect(humanFirstActive({ ...semaine, enabled: false }, lundi('10:00'), TZ)).toBe(false);
    expect(humanFirstActive(undefined, lundi('10:00'), TZ)).toBe(false);
    expect(humanFirstActive('oui', lundi('10:00'), TZ)).toBe(false);
  });

  it('s\'éteint sur un fuseau illisible plutôt que de deviner', () => {
    expect(humanFirstActive(semaine, lundi('10:00'), 'Mars/Olympus')).toBe(false);
  });
});

describe('la lecture de ce qui est stocké', () => {
  it('éteint une plage à moitié valide au lieu de la réparer', () => {
    expect(parseHumanFirst({ enabled: true, days: [], from: '09:00', to: '17:00' }).enabled).toBe(false);
    expect(parseHumanFirst({ enabled: true, days: [1], from: '9h', to: '17:00' }).enabled).toBe(false);
    expect(parseHumanFirst({ enabled: true, days: [1], from: '09:00', to: '09:00' }).enabled).toBe(false);
    expect(parseHumanFirst({ enabled: 'true', days: [1], from: '09:00', to: '17:00' }).enabled).toBe(false);
  });

  it('nettoie les jours: bornes, doublons, ordre', () => {
    expect(parseHumanFirst({ enabled: true, days: [5, 1, 1, 9, -1, 2.5, '3'], from: '09:00', to: '17:00' }))
      .toEqual({ enabled: true, days: [1, 3, 5], from: '09:00', to: '17:00' });
  });

  it('rend des valeurs affichables quand rien n\'est stocké', () => {
    expect(parseHumanFirst(null)).toEqual({ enabled: false, days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00' });
  });
});
