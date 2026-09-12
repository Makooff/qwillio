import { describe, it, expect } from 'vitest';
import { clockLine, vapiClockLine, todayIso, spokenDate } from '../clock';

/**
 * La date, dite à l'agent.
 *
 * Appel réel du 12/09/2026: « un détartrage la semaine prochaine », et l'agent
 * propose « lundi 17 juin », qui n'est ni un lundi ni à venir. Rien ne lui
 * disait quel jour on était.
 */
const NOW = new Date('2026-09-12T04:31:00Z');

describe('clockLine', () => {
  it('dit le jour de la semaine, la date et l\'heure dans le fuseau de l\'entreprise', () => {
    const line = clockLine('fr', 'Europe/Brussels', NOW);
    expect(line).toContain('samedi 12 septembre 2026');
    expect(line).toContain('06:31');
    expect(line).toContain('Europe/Brussels');
  });

  it('existe dans les trois langues', () => {
    expect(clockLine('en', 'Europe/Brussels', NOW)).toContain('Saturday, 12 September 2026');
    expect(clockLine('nl', 'Europe/Brussels', NOW)).toContain('zaterdag 12 september 2026');
  });

  it('dit que les dates relatives se comptent d\'aujourd\'hui', () => {
    expect(clockLine('fr', 'Europe/Paris', NOW)).toMatch(/à partir d'aujourd'hui/);
  });
});

describe('vapiClockLine', () => {
  it('porte le gabarit que Vapi remplit à chaque appel, dans le fuseau donné', () => {
    /* L'assistant enregistré a un prompt FIGÉ: une date réelle y serait
       fausse dès le lendemain. */
    const line = vapiClockLine('fr', 'Europe/Brussels');
    expect(line).toContain('{{"now" | date: "%A %d %B %Y, %H:%M", "Europe/Brussels"}}');
    expect(line).toMatch(/^Nous sommes le /);
  });
});

describe('todayIso', () => {
  it('rend le jour du FUSEAU, pas celui d\'UTC', () => {
    // 23h30 UTC, c'est déjà demain à Bruxelles.
    expect(todayIso('Europe/Brussels', new Date('2026-09-12T23:30:00Z'))).toBe('2026-09-13');
    expect(todayIso('America/New_York', new Date('2026-09-12T23:30:00Z'))).toBe('2026-09-12');
  });
});

describe('spokenDate', () => {
  it('nomme le jour de la semaine, que le modèle ne calcule pas', () => {
    expect(spokenDate(new Date('2026-09-16T12:00:00Z'), 'fr', 'Europe/Brussels')).toBe('mercredi 16 septembre 2026');
  });
});
