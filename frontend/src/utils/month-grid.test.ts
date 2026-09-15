import { describe, it, expect } from 'vitest';
import { monthGrid, monthRange, monthLabel, isoDay, dayLabel, addMonths } from './month-grid';

describe('monthGrid', () => {
  it('commence un lundi et couvre le mois en semaines entières', () => {
    /* Septembre 2026 commence un mardi: une case de tête (lundi 31 août). */
    const cells = monthGrid(new Date(2026, 8, 1), new Date(2026, 8, 15));
    expect(cells[0]).toMatchObject({ iso: '2026-08-31', inMonth: false, weekday: 0 });
    expect(cells[1]).toMatchObject({ iso: '2026-09-01', day: 1, inMonth: true });
    expect(cells.length % 7).toBe(0);
    expect(cells.length).toBe(35);
    expect(cells.find(c => c.iso === '2026-09-15')?.isToday).toBe(true);
    expect(cells[cells.length - 1].iso).toBe('2026-10-04');
  });

  it('un mois qui commence un lundi n\'a aucune case de tête', () => {
    /* Juin 2026 commence un lundi. */
    expect(monthGrid(new Date(2026, 5, 1))[0]).toMatchObject({ iso: '2026-06-01', inMonth: true });
  });
});

describe('les bornes et les libellés', () => {
  it('monthRange: du premier au dernier jour', () => {
    expect(monthRange(new Date(2026, 8, 15))).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthRange(new Date(2026, 1, 3))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
  it('isoDay ne décale pas d\'un jour le soir', () => {
    expect(isoDay(new Date(2026, 8, 15, 23, 30))).toBe('2026-09-15');
  });
  it('majuscule au mois et au jour seulement', () => {
    expect(monthLabel(new Date(2026, 8, 1))).toBe('Septembre 2026');
    expect(dayLabel('2026-09-15')).toBe('Mardi 15 septembre');
  });
  it('addMonths passe l\'année', () => {
    expect(isoDay(addMonths(new Date(2026, 11, 20), 1))).toBe('2027-01-01');
  });
});
