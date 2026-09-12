import { describe, it, expect } from 'vitest';
import { parseWeekHours, dayWindow, nextOpenDay, describeHours, weekDayOf } from '../opening-hours';

/**
 * Un rendez-vous pris un DIMANCHE chez un commerce fermé le dimanche (appel
 * réel, 12/09/2026): l'agenda proposait 9 h-17 h tous les jours, et le prompt
 * disait « Horaires: [object Object] ». Une seule lecture des horaires du
 * portail, pour le prompt, les créneaux et la réservation.
 */
const hours = parseWeekHours({
  monday: { open: true, from: '09:00', to: '18:00' },
  tuesday: { open: true, from: '09:00', to: '18:00' },
  wednesday: { open: true, from: '09:00', to: '18:00' },
  thursday: { open: true, from: '09:00', to: '18:00' },
  friday: { open: true, from: '09:00', to: '18:00' },
  saturday: { open: false, from: '10:00', to: '16:00' },
  sunday: { open: false, from: '10:00', to: '16:00' },
});

describe('parseWeekHours', () => {
  it('lit la forme du portail et ignore le reste', () => {
    expect(hours?.sunday).toEqual({ open: false, from: '10:00', to: '16:00' });
    expect(parseWeekHours('Lun-Ven 9h-18h')).toBeNull();
    expect(parseWeekHours(null)).toBeNull();
    expect(parseWeekHours({ monday: { open: 'yes' } })).toBeNull();
  });
});

describe('dayWindow', () => {
  it('ferme le dimanche et ouvre le lundi aux heures du portail', () => {
    // 13 septembre 2026 est un dimanche.
    expect(weekDayOf('2026-09-13', 'Europe/Brussels')).toBe('sunday');
    expect(dayWindow(hours, '2026-09-13', 'Europe/Brussels')).toEqual({ open: false });
    expect(dayWindow(hours, '2026-09-14', 'Europe/Brussels')).toEqual({ open: true, from: '09:00', to: '18:00' });
  });

  it("sans horaires, tient le jour pour ouvert aux heures par défaut", () => {
    expect(dayWindow(null, '2026-09-13', 'Europe/Brussels')).toEqual({ open: true, from: '09:00', to: '17:00' });
  });
});

describe('nextOpenDay', () => {
  it('saute le week-end', () => {
    expect(nextOpenDay(hours, '2026-09-12', 'Europe/Brussels')).toBe('2026-09-14');
  });
});

describe('describeHours', () => {
  it('regroupe les jours consécutifs au même réglage', () => {
    expect(describeHours(hours!, 'fr')).toBe('lundi-vendredi 09:00-18:00, samedi-dimanche fermé');
    expect(describeHours(hours!, 'en')).toBe('Monday-Friday 09:00-18:00, Saturday-Sunday closed');
  });
});
